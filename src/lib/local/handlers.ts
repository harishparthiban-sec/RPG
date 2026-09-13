// ─── Local-mode API handlers (mirror the Supabase routes' contracts) ────────

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { z } from "zod";
import db, { newId, nowIso } from "./db";
import {
  hashPassword, verifyPassword, createSession, destroySession,
  SESSION_COOKIE, SESSION_COOKIE_OPTS,
} from "./auth";
import { getLocalUser } from "./session";
import { completeQuest, purchaseItem, equipItem } from "./engine";
import { SHOP_ITEMS, itemByKey } from "@/lib/shop";
import { rewardsFor, xpForLevel } from "@/lib/progression";
import { seedDemoIfNeeded } from "./seed";
import type { Attribute, Character, Quest, Transaction } from "@/lib/types";

// ── shared validation ──
const CreateQuest = z.object({
  title: z.string().trim().min(1, "A quest needs a name.").max(120),
  description: z.string().trim().max(500).optional().nullable(),
  category: z.enum(["strength", "intellect", "vitality", "creativity", "focus"]),
  difficulty: z.enum(["common", "rare", "epic", "legendary"]),
  due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
});

const Credentials = z.object({
  email: z.string().trim().email(),
  password: z.string().min(8, "Password must be at least 8 characters."),
  username: z.string().trim().max(20).optional(),
});

// ── auth ────────────────────────────────────────────────────────────────────

export async function handleSignup(request: Request) {
  seedDemoIfNeeded(); // idempotent; ensures demo exists for the login page too
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  const body = Credentials.safeParse(raw);
  if (!body.success) {
    return NextResponse.json(
      { error: body.error.issues[0]?.message ?? "Invalid data." }, { status: 422 });
  }
  const { email, password, username } = body.data;
  const normalized = email.toLowerCase();

  const existing = db.prepare("select id from users where email = ?").get(normalized);
  if (existing) {
    return NextResponse.json(
      { error: "That email already has a character. Try logging in instead." }, { status: 409 });
  }

  const id = newId();
  db.prepare(
    "insert into users (id, email, username, password_hash, created_at) values (?, ?, ?, ?, ?)"
  ).run(id, normalized, username || normalized.split("@")[0].slice(0, 20), hashPassword(password), nowIso());

  // Bootstrap: profile, five attributes, zeroed streak (mirrors the SQL trigger).
  db.prepare(
    "insert into profiles (id, username, created_at) values (?, ?, ?)"
  ).run(id, username || normalized.split("@")[0].slice(0, 20), nowIso());
  for (const key of ["strength", "intellect", "vitality", "creativity", "focus"]) {
    db.prepare("insert into attributes (user_id, key) values (?, ?)").run(id, key);
  }
  db.prepare("insert into streaks (user_id) values (?)").run(id);

  const { token, expiresAt } = createSession(id);
  const res = NextResponse.json({ ok: true }, { status: 201 });
  res.cookies.set(SESSION_COOKIE, token, { ...SESSION_COOKIE_OPTS, expires: expiresAt });
  return res;
}

export async function handleLogin(request: Request) {
  seedDemoIfNeeded(); // idempotent
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  const body = Credentials.omit({ username: true }).safeParse(raw);
  if (!body.success) {
    return NextResponse.json(
      { error: body.error.issues[0]?.message ?? "Invalid data." }, { status: 422 });
  }
  const { email, password } = body.data;
  const row = db.prepare("select * from users where email = ?").get(email.toLowerCase()) as
    | { id: string; password_hash: string }
    | undefined;
  if (!row || !verifyPassword(password, row.password_hash)) {
    return NextResponse.json({ error: "Wrong email or password — try again." }, { status: 401 });
  }
  const { token, expiresAt } = createSession(row.id);
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, token, { ...SESSION_COOKIE_OPTS, expires: expiresAt });
  return res;
}

export function handleLogout() {
  destroySession(getLocalUser() ? cookies().get(SESSION_COOKIE)?.value : undefined);
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, "", { ...SESSION_COOKIE_OPTS, maxAge: 0 });
  return res;
}

// ── quests ──────────────────────────────────────────────────────────────────

export function localListQuests() {
  const user = getLocalUser();
  if (!user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

  const rows = db
    .prepare(
      `select * from quests where user_id = ?
       order by completed asc, created_at desc`
    )
    .all(user.id) as unknown as QuestRow[];

  const quests: Quest[] = rows.map(mapQuest);
  return NextResponse.json({ quests });

}

// ── SQLite row shapes ──

interface QuestRow {
  id: string; user_id: string; title: string; description: string | null;
  category: string; difficulty: string; xp_reward: number; gold_reward: number;
  completed: number; completed_at: string | null; due_date: string | null;
  created_at: string;
}
interface ProfileRow {
  id: string; username: string; level: number; xp: number; gold: number;
  total_xp: number; title: string; avatar_theme: string; created_at: string;
}
interface AttrRow { user_id: string; key: string; xp: number; level: number }
interface StreakRow { user_id: string; current: number; best: number; last_active_date: string | null }
interface InventoryRow { item_key: string; equipped: number }

function mapQuest(r: QuestRow): Quest {
  return {
    id: r.id, title: r.title, description: r.description ?? null,
    category: r.category as Quest["category"],
    difficulty: r.difficulty as Quest["difficulty"],
    xp_reward: r.xp_reward, gold_reward: r.gold_reward,
    completed: Boolean(r.completed), completed_at: r.completed_at ?? null,
    due_date: r.due_date ?? null, created_at: r.created_at,
  };
}

export function localCreateQuest(bodyRaw: unknown) {
  const user = getLocalUser();
  if (!user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

  const parsed = CreateQuest.safeParse(bodyRaw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid quest data." }, { status: 422 });
  }
  const { title, description, category, difficulty, due_date } = parsed.data;
  const rewards = rewardsFor(difficulty);

  const id = newId();
  db.prepare(
    `insert into quests (id, user_id, title, description, category, difficulty, xp_reward, gold_reward, due_date, created_at)
     values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(id, user.id, title, description ?? null, category, difficulty, rewards.xp, rewards.gold, due_date ?? null, nowIso());

  const row = db.prepare("select * from quests where id = ?").get(id) as unknown as QuestRow;
  const quest = mapQuest(row);
  return NextResponse.json({ quest }, { status: 201 });
}

export function localUpdateQuest(id: string, bodyRaw: unknown) {
  const user = getLocalUser();
  if (!user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

  const parsed = CreateQuest.partial().safeParse(bodyRaw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid quest data." }, { status: 422 });
  }
  const patch = { ...(parsed.data as Record<string, unknown>) };
  if (patch.difficulty) {
    const r = rewardsFor(patch.difficulty as string);
    patch.xp_reward = r.xp;
    patch.gold_reward = r.gold;
  }

  const sets = Object.keys(patch).map((k) => `${k} = ?`);
  if (sets.length === 0) {
    return NextResponse.json({ error: "Nothing to update." }, { status: 422 });
  }
  const values = Object.values(patch) as (string | number | null)[];
  const info = db
    .prepare(
      `update quests set ${sets.join(", ")} where id = ? and user_id = ? and completed = 0`
    )
    .run(...values, id, user.id);

  if (info.changes === 0) {
    return NextResponse.json(
      { error: "Quest not found, already completed, or update rejected." }, { status: 404 });
  }
  const updated = db.prepare("select * from quests where id = ?").get(id) as unknown as QuestRow;
  const quest = mapQuest(updated);
  return NextResponse.json({ quest });
}

export function localDeleteQuest(id: string) {
  const user = getLocalUser();
  if (!user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  const info = db.prepare("delete from quests where id = ? and user_id = ?").run(id, user.id);
  if (info.changes === 0) {
    return NextResponse.json({ error: "Quest not found." }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}

export function localCompleteQuest(id: string) {
  const user = getLocalUser();
  if (!user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  try {
    const payload = completeQuest(user.id, id);
    // Shape quest like the client expects (booleans, not 0/1).
    payload.quest = mapQuest(payload.quest as QuestRow);
    return NextResponse.json(payload);
  } catch (e) {
    const code = e instanceof Error ? e.message : "UNKNOWN";
    const friendly: Record<string, string> = {
      QUEST_NOT_FOUND: "That quest has vanished from the board.",
      ALREADY_COMPLETED: "This quest was already completed.",
    };
    if (friendly[code]) {
      return NextResponse.json({ error: friendly[code] }, { status: 409 });
    }
    return NextResponse.json({ error: "The completion ritual failed. Try again." }, { status: 500 });
  }
}

// ── character ───────────────────────────────────────────────────────────────

const CATEGORY_META: Record<string, { label: string; icon: string; blurb: string }> = {
  strength: { label: "Strength", icon: "💪", blurb: "Forged in gyms, fields, and heavy things." },
  intellect: { label: "Intellect", icon: "📚", blurb: "Grown by books, code, and deep work." },
  vitality: { label: "Vitality", icon: "🏃", blurb: "Fueled by runs, meals, and sleep." },
  creativity: { label: "Creativity", icon: "🎨", blurb: "Sparked by making, playing, and building." },
  focus: { label: "Focus", icon: "🎯", blurb: "Sharpened by deep work and finished plans." },
};

export function localGetCharacter() {
  const user = getLocalUser();
  if (!user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

  const p = db.prepare("select * from profiles where id = ?").get(user.id) as
    | ProfileRow
    | undefined;
  if (!p) return NextResponse.json({ error: "Character sheet not found." }, { status: 404 });

  const attrs = (db.prepare("select * from attributes where user_id = ?").all(user.id) as unknown as AttrRow[])
    .map((a) => ({
      key: a.key,
      ...(CATEGORY_META[a.key] ?? { label: a.key, icon: "❔", blurb: "" }),
      xp: a.xp, level: a.level,
    })) as Attribute[];

  const ORDER = ["strength", "intellect", "vitality", "creativity", "focus"];
  attrs.sort((a, b) => ORDER.indexOf(a.key) - ORDER.indexOf(b.key));

  const streak = db.prepare("select * from streaks where user_id = ?").get(user.id) as
    | StreakRow
    | undefined;

  const character: Character = {
    profile: {
      id: p.id, username: p.username, level: p.level, xp: p.xp, gold: p.gold,
      title: p.title, avatar_theme: p.avatar_theme, created_at: p.created_at,
    },
    attributes: attrs,
    streak: {
      current: streak?.current ?? 0,
      best: streak?.best ?? 0,
      last_active_date: streak?.last_active_date ?? null,
    },
    xp_needed: xpForLevel(p.level),
    total_xp_earned: p.total_xp,
  };
  return NextResponse.json(character);
}

// ── shop ────────────────────────────────────────────────────────────────────

const ItemKey = z.object({ item_key: z.string().min(1).max(60) });

export function localGetShop() {
  const user = getLocalUser();
  if (!user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

  const owned = db.prepare("select item_key, equipped from inventory where user_id = ?").all(user.id) as unknown as InventoryRow[];
  const profile = db.prepare("select gold from profiles where id = ?").get(user.id) as
    | { gold: number }
    | undefined;
  return NextResponse.json({
    items: SHOP_ITEMS,
    owned: owned.map((o) => ({ item_key: o.item_key, equipped: Boolean(o.equipped) })),
    gold: profile?.gold ?? 0,
  });
}

export function localPurchase(bodyRaw: unknown) {
  const user = getLocalUser();
  if (!user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  const parsed = ItemKey.safeParse(bodyRaw);
  if (!parsed.success) return NextResponse.json({ error: "Invalid item." }, { status: 422 });

  const item = itemByKey(parsed.data.item_key);
  if (!item) return NextResponse.json({ error: "That treasure does not exist." }, { status: 404 });

  try {
    const result = purchaseItem(user.id, item.key, item.price, item.name);
    return NextResponse.json(result, { status: 201 });
  } catch (e) {
    const code = e instanceof Error ? e.message : "";
    const status = code === "INSUFFICIENT_GOLD" ? 402 : 409;
    const friendly: Record<string, string> = {
      ALREADY_OWNED: "You already own this item.",
      INSUFFICIENT_GOLD: "Not enough gold — complete more quests!",
    };
    return NextResponse.json({ error: friendly[code] ?? "Purchase failed." }, { status });
  }
}

export function localEquip(bodyRaw: unknown) {
  const user = getLocalUser();
  if (!user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  const parsed = ItemKey.safeParse(bodyRaw);
  if (!parsed.success) return NextResponse.json({ error: "Invalid item." }, { status: 422 });

  const item = itemByKey(parsed.data.item_key);
  if (!item) return NextResponse.json({ error: "That treasure does not exist." }, { status: 404 });

  try {
    const result = equipItem(user.id, item.key, item.kind, item.name);
    return NextResponse.json(result);
  } catch (e) {
    const code = e instanceof Error ? e.message : "";
    return NextResponse.json(
      { error: code === "NOT_OWNED" ? "You do not own that item yet." : "Equip failed." },
      { status: 409 });
  }
}

// ── transactions ────────────────────────────────────────────────────────────

export function localListTransactions() {
  const user = getLocalUser();
  if (!user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

  const rows = db
    .prepare("select id, kind, amount, reason, created_at from transactions where user_id = ? order by created_at desc limit 20")
    .all(user.id) as unknown as Transaction[];

  const transactions: Transaction[] = rows.map((t) => ({
    id: t.id, kind: t.kind, amount: t.amount, reason: t.reason, created_at: t.created_at,
  }));
  return NextResponse.json({ transactions });
}
