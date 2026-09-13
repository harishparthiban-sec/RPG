// ─────────────────────────────────────────────────────────────────────────────
// Life RPG — optional demo seeder
// Creates demo@liferpg.dev / demo1234 with quests, XP history, and an item.
//
// Usage:
//   SUPABASE_URL=https://xxx.supabase.co \
//   SUPABASE_SERVICE_ROLE_KEY=service-role-key \
//   node scripts/seed-demo.mjs
//
// (Service role key bypasses RLS — never expose it to the client or commit it.)
// ─────────────────────────────────────────────────────────────────────────────

import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  console.error(
    "Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables first."
  );
  process.exit(1);
}

const admin = createClient(url, serviceKey, { auth: { autoRefreshToken: false } });

const DEMO_EMAIL = "demo@liferpg.dev";
const DEMO_PASSWORD = "demo1234";

const DEMO_QUESTS_DONE = [
  { title: "Morning run — 5k", category: "vitality", difficulty: "rare" },
  { title: "Read 30 pages of Clean Code", category: "intellect", difficulty: "common" },
  { title: "Deep work block: algorithms", category: "intellect", difficulty: "epic" },
  { title: "Sketch UI concept for side project", category: "creativity", difficulty: "rare" },
  { title: "Meal prep for tomorrow", category: "vitality", difficulty: "common" },
  { title: "Inbox zero + plan the day", category: "focus", difficulty: "common" },
  { title: "Gym — push day", category: "strength", difficulty: "epic" },
  { title: "Practice guitar 20 min", category: "creativity", difficulty: "common" },
];

const DEMO_QUESTS_OPEN = [
  { title: "Finish React course module 7", category: "intellect", difficulty: "rare" },
  { title: "10k steps outside", category: "vitality", difficulty: "common" },
  { title: "Write blog post draft", category: "creativity", difficulty: "epic" },
  { title: "Meal prep for tomorrow", category: "vitality", difficulty: "common" },
];

async function main() {
  console.log("Seeding demo account…");

  // 1. Create (or fetch) the demo user.
  let userId;
  const { data: listData } = await admin.auth.admin.listUsers({ perPage: 200 });
  const existing = listData?.users?.find((u) => u.email === DEMO_EMAIL);
  if (existing) {
    userId = existing.id;
    console.log("  demo user already exists:", userId);
  } else {
    const { data, error } = await admin.auth.admin.createUser({
      email: DEMO_EMAIL,
      password: DEMO_PASSWORD,
      email_confirm: true,
      user_metadata: { username: "DemoKnight" },
    });
    if (error) throw error;
    userId = data.user.id;
    console.log("  created demo user:", userId);
  }

  // Wait a moment for the handle_new_user trigger to fire.
  await new Promise((r) => setTimeout(r, 1500));

  // 2. Wipe any previous demo content for idempotency.
  await admin.from("quests").delete().eq("user_id", userId);
  await admin.from("transactions").delete().eq("user_id", userId);
  await admin.from("inventory").delete().eq("user_id", userId);

  // 3. Completed quests (with staggered completed_at over the last week).
  const now = Date.now();
  const doneRows = DEMO_QUESTS_DONE.map((q, i) => ({
    user_id: userId,
    title: q.title,
    category: q.category,
    difficulty: q.difficulty,
    completed: true,
    completed_at: new Date(now - (DEMO_QUESTS_DONE.length - i) * 26 * 3600 * 1000).toISOString(),
  }));
  const openRows = DEMO_QUESTS_OPEN.map((q) => ({
    user_id: userId,
    title: q.title,
    category: q.category,
    difficulty: q.difficulty,
    completed: false,
  }));
  const { error: qErr } = await admin.from("quests").insert([...doneRows, ...openRows]);
  if (qErr) throw qErr;

  // 4. Give the character some earned progress: level 5, streak 4, 340 total xp.
  const { error: pErr } = await admin
    .from("profiles")
    .update({
      username: "DemoKnight",
      level: 5,
      xp: 40,
      total_xp: 340,
      gold: 185,
      title: "Squire",
    })
    .eq("id", userId);
  if (pErr) throw pErr;

  const today = new Date().toISOString().slice(0, 10);
  const { error: sErr } = await admin
    .from("streaks")
    .update({ current: 4, best: 6, last_active_date: today })
    .eq("user_id", userId);
  if (sErr) throw sErr;

  // Attribute progress (roughly matching completed quest history).
  const attrProgress = {
    vitality: { xp: 20, level: 2 },
    intellect: { xp: 35, level: 3 },
    creativity: { xp: 10, level: 1 },
    focus: { xp: 5, level: 1 },
    strength: { xp: 40, level: 2 },
  };
  for (const [key, v] of Object.entries(attrProgress)) {
    const { error } = await admin
      .from("attributes")
      .update({ xp: v.xp, level: v.level })
      .eq("user_id", userId)
      .eq("key", key);
    if (error) throw error;
  }

  // 5. A purchase + a couple of ledger entries.
  const { error: invErr } = await admin
    .from("inventory")
    .insert({ user_id: userId, item_key: "relic-compass", equipped: true });
  if (invErr) throw invErr;

  const { error: tErr } = await admin.from("transactions").insert([
    { user_id: userId, kind: "earn", amount: 25, reason: 'Completed "Gym — push day" (epic)' },
    { user_id: userId, kind: "spend", amount: -90, reason: "Purchased Wayfinder's Compass" },
    { user_id: userId, kind: "earn", amount: 12, reason: 'Completed "Morning run — 5k" (rare)' },
  ]);
  if (tErr) throw tErr;

  console.log("✔ Demo ready — log in with demo@liferpg.dev / demo1234");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
