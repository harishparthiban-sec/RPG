// ─── Local demo seed: runs once so judges can click "Try the demo" ──────────

import db, { newId, nowIso } from "./db";
import { hashPassword } from "./auth";

export const DEMO_EMAIL = "demo@liferpg.dev";
export const DEMO_PASSWORD = "demo1234";

export function seedDemoIfNeeded(): void {
  const { value } = db
    .prepare("select value from meta where key = 'demo_seeded'")
    .get() as { value: string } | undefined ?? { value: "1" };
  if (value === "done") return;

  const existing = db.prepare("select id from users where email = ?").get(DEMO_EMAIL);
  if (existing) {
    markSeeded();
    return;
  }

  const id = newId();
  db.prepare(
    "insert into users (id, email, username, password_hash, created_at) values (?, ?, ?, ?, ?)"
  ).run(id, DEMO_EMAIL, "DemoKnight", hashPassword(DEMO_PASSWORD), nowIso());

  db.prepare(
    "insert into profiles (id, username, level, xp, gold, total_xp, title, created_at) values (?, ?, 5, 40, 185, 340, 'Squire', ?)"
  ).run(id, "DemoKnight", nowIso());

  for (const key of ["strength", "intellect", "vitality", "creativity", "focus"]) {
    db.prepare("insert into attributes (user_id, key) values (?, ?)").run(id, key);
  }
  const attrProgress: Record<string, [number, number]> = {
    vitality: [20, 2], intellect: [35, 3], creativity: [10, 1], focus: [5, 1], strength: [40, 2],
  };
  for (const [key, [xp, level]] of Object.entries(attrProgress)) {
    db.prepare("update attributes set xp = ?, level = ? where user_id = ? and key = ?")
      .run(xp, level, id, key);
  }

  const today = new Date().toISOString().slice(0, 10);
  db.prepare(
    "insert into streaks (user_id, current, best, last_active_date) values (?, 4, 6, ?)"
  ).run(id, today);

  const done = [
    ["Morning run — 5k", "vitality", "rare"],
    ["Read 30 pages of Clean Code", "intellect", "common"],
    ["Deep work block: algorithms", "intellect", "epic"],
    ["Sketch UI concept for side project", "creativity", "rare"],
    ["Meal prep for tomorrow", "vitality", "common"],
    ["Inbox zero + plan the day", "focus", "common"],
    ["Gym — push day", "strength", "epic"],
    ["Practice guitar 20 min", "creativity", "common"],
  ] as const;
  const open = [
    ["Finish React course module 7", "intellect", "rare"],
    ["10k steps outside", "vitality", "common"],
    ["Write blog post draft", "creativity", "epic"],
  ] as const;

  const ins = db.prepare(
    `insert into quests (id, user_id, title, category, difficulty, xp_reward, gold_reward, completed, completed_at, created_at)
     values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );
  const now = Date.now();
  const XP: Record<string, number> = { common: 10, rare: 25, epic: 50, legendary: 100 };
  const GOLD: Record<string, number> = { common: 5, rare: 12, epic: 25, legendary: 50 };

  done.forEach(([title, category, difficulty], i) => {
    ins.run(
      newId(), id, title, category, difficulty, XP[difficulty], GOLD[difficulty],
      1, new Date(now - (done.length - i) * 26 * 3600 * 1000).toISOString(),
      new Date(now - (done.length - i) * 26 * 3600 * 1000).toISOString()
    );
  });
  open.forEach(([title, category, difficulty]) => {
    ins.run(newId(), id, title, category, difficulty, XP[difficulty], GOLD[difficulty], 0, null, nowIso());
  });

  db.prepare(
    "insert into inventory (id, user_id, item_key, equipped, acquired_at) values (?, ?, 'relic-compass', 1, ?)"
  ).run(newId(), id, nowIso());

  const tx = db.prepare(
    "insert into transactions (id, user_id, kind, amount, reason, created_at) values (?, ?, ?, ?, ?, ?)"
  );
  tx.run(newId(), id, "earn", 25, 'Completed "Gym — push day" (epic)', nowIso());
  tx.run(newId(), id, "spend", -90, "Purchased Wayfinder's Compass", nowIso());
  tx.run(newId(), id, "earn", 12, 'Completed "Morning run — 5k" (rare)', nowIso());

  markSeeded();
  console.log("[life-rpg] demo account ready: demo@liferpg.dev / demo1234");
}

function markSeeded(): void {
  db.prepare(
    "insert into meta (key, value) values ('demo_seeded', 'done') on conflict(key) do update set value = 'done'"
  ).run();
}
