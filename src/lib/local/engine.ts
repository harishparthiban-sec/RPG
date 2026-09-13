// ─── Local game engine: same rules as the Supabase functions ────────────────
// XP curve 100×level^1.5, streak bonus +2%/day capped 50%, attribute curve
// 40×level^1.35. All inside one SQLite transaction per completion.

import { Txn, newId, nowIso } from "./db";
import { titleForLevel } from "@/lib/progression";
import { SHOP_ITEMS } from "@/lib/shop";

const DIFFICULTY_XP: Record<string, number> = {
  common: 10, rare: 25, epic: 50, legendary: 100,
};
const DIFFICULTY_GOLD: Record<string, number> = {
  common: 5, rare: 12, epic: 25, legendary: 50,
};

function xpForLevel(level: number): number {
  return Math.round(100 * Math.pow(level, 1.5));
}
function attrXpForLevel(level: number): number {
  return Math.round(40 * Math.pow(level, 1.35));
}

function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function yesterdayStr(): string {
  const y = new Date();
  y.setDate(y.getDate() - 1);
  return `${y.getFullYear()}-${String(y.getMonth() + 1).padStart(2, "0")}-${String(y.getDate()).padStart(2, "0")}`;
}

export interface CompletePayload {
  quest: unknown;
  profile: unknown;
  xp_gained: number;
  gold_gained: number;
  leveled_up: boolean;
  levels_gained: number;
  new_level: number;
  streak: { current: number; best: number; last_active_date: string | null; kind: string };
  attribute: { key: string; level: number; xp: number; leveled_up: boolean };
}

interface ProfileRow {
  id: string; username: string; level: number; xp: number; gold: number;
  total_xp: number; title: string; avatar_theme: string; created_at: string;
}
interface StreakRow {
  user_id: string; current: number; best: number; last_active_date: string | null;
}
interface AttrRow { user_id: string; key: string; xp: number; level: number }
interface QuestRow {
  id: string; user_id: string; title: string; description: string | null;
  category: string; difficulty: string; xp_reward: number; gold_reward: number;
  completed: number; completed_at: string | null; due_date: string | null; created_at: string;
}

export function completeQuest(userId: string, questId: string): CompletePayload {
  const txn = new Txn();
  try {
    const quest = txn
      .prepare("select * from quests where id = ? and user_id = ?")
      .get(questId, userId) as unknown as QuestRow | undefined;
    if (!quest) throw new Error("QUEST_NOT_FOUND");
    if (quest.completed) throw new Error("ALREADY_COMPLETED");

    const profile = txn.prepare("select * from profiles where id = ?").get(userId) as unknown as ProfileRow;
    const streak = txn.prepare("select * from streaks where user_id = ?").get(userId) as unknown as StreakRow;

    // ── Rewards ──
    const baseXp = DIFFICULTY_XP[quest.difficulty] ?? 10;
    const bonusPct = Math.min(50, (streak?.current ?? 0) * 2);
    const gained = baseXp + Math.round((baseXp * bonusPct) / 100);
    const gold = DIFFICULTY_GOLD[quest.difficulty] ?? 5;

    // ── Streak ──
    let kind = "already-counted";
    let current = streak?.current ?? 0;
    let best = streak?.best ?? 0;
    if (!streak?.last_active_date) {
      current = 1; best = Math.max(best, 1); kind = "started";
    } else if (streak.last_active_date === todayStr()) {
      current = Math.max(current, 1);
    } else if (streak.last_active_date === yesterdayStr()) {
      current += 1; best = Math.max(best, current); kind = "continued";
    } else {
      current = 1; best = Math.max(best, 1); kind = "started";
    }
    txn.prepare(
      "update streaks set current = ?, best = ?, last_active_date = ? where user_id = ?"
    ).run(current, best, todayStr(), userId);

    // ── Character level (carry overflow, cap 60) ──
    let level = profile.level;
    let xp = profile.xp + gained;
    const levelsFrom = level;
    while (level < 60 && xp >= xpForLevel(level)) {
      xp -= xpForLevel(level);
      level += 1;
    }
    if (level >= 60) { level = 60; xp = Math.min(xp, xpForLevel(60)); }
    const totalXp = profile.total_xp + gained;
    const title = titleForLevel(level);

    txn.prepare(
      `update profiles set level = ?, xp = ?, total_xp = ?, gold = ?, title = ? where id = ?`
    ).run(level, xp, totalXp, profile.gold + gold, title, userId);

    // ── Attribute progression ──
    let attr = txn
      .prepare("select * from attributes where user_id = ? and key = ?")
      .get(userId, quest.category) as unknown as AttrRow | undefined;
    if (!attr) {
      txn.prepare("insert into attributes (user_id, key) values (?, ?)").run(userId, quest.category);
      attr = { user_id: userId, key: quest.category, xp: 0, level: 0 };
    }
    const attrBefore = attr.level;
    let aLevel = attrBefore;
    let aXp = attr.xp + baseXp;
    while (aXp >= attrXpForLevel(aLevel)) {
      aXp -= attrXpForLevel(aLevel);
      aLevel += 1;
    }
    txn.prepare("update attributes set level = ?, xp = ? where user_id = ? and key = ?")
      .run(aLevel, aXp, userId, quest.category);

    // ── Quest + ledger ──
    const completedAt = nowIso();
    txn.prepare("update quests set completed = 1, completed_at = ? where id = ?")
      .run(completedAt, questId);
    txn.prepare(
      "insert into transactions (id, user_id, kind, amount, reason, created_at) values (?, ?, ?, ?, ?, ?)"
    ).run(newId(), userId, "earn", gold, `Completed "${quest.title}" (${quest.difficulty})`, completedAt);

    const updatedProfile = txn.prepare("select * from profiles where id = ?").get(userId);

    txn.commit();

    return {
      quest: { ...quest, completed: true, completed_at: completedAt },
      profile: updatedProfile,
      xp_gained: gained,
      gold_gained: gold,
      leveled_up: level > levelsFrom,
      levels_gained: level - levelsFrom,
      new_level: level,
      streak: { current, best, last_active_date: todayStr(), kind },
      attribute: { key: quest.category, level: aLevel, xp: aXp, leveled_up: aLevel > attrBefore },
    };
  } catch (e) {
    txn.rollback();
    throw e;
  }
}

export function purchaseItem(userId: string, itemKey: string, price: number, name: string) {
  const txn = new Txn();
  try {
    const profile = txn.prepare("select * from profiles where id = ?").get(userId) as unknown as ProfileRow;
    const owned = txn
      .prepare("select 1 from inventory where user_id = ? and item_key = ?")
      .get(userId, itemKey);
    if (owned) throw new Error("ALREADY_OWNED");
    if (profile.gold < price) throw new Error("INSUFFICIENT_GOLD");

    txn.prepare("update profiles set gold = gold - ? where id = ?").run(price, userId);
    txn.prepare(
      "insert into inventory (id, user_id, item_key, equipped, acquired_at) values (?, ?, ?, 0, ?)"
    ).run(newId(), userId, itemKey, nowIso());
    txn.prepare(
      "insert into transactions (id, user_id, kind, amount, reason, created_at) values (?, ?, ?, ?, ?, ?)"
    ).run(newId(), userId, "spend", -price, `Purchased ${name}`, nowIso());

    const updated = txn.prepare("select * from profiles where id = ?").get(userId);
    txn.commit();
    return { profile: updated, item_key: itemKey, equipped: false };
  } catch (e) {
    txn.rollback();
    throw e;
  }
}

export function equipItem(userId: string, itemKey: string, kind: string, name: string) {
  const txn = new Txn();
  try {
    const owned = txn
      .prepare("select 1 from inventory where user_id = ? and item_key = ?")
      .get(userId, itemKey);
    if (!owned) throw new Error("NOT_OWNED");

    if (kind === "theme" || kind === "title") {
      // Exclusive within kind: unequip everything of the same catalog kind.
      const unequip = txn.prepare("update inventory set equipped = 0 where user_id = ? and item_key = ?");
      for (const it of SHOP_ITEMS.filter((i) => i.kind === kind)) unequip.run(userId, it.key);
    }
    txn.prepare("update inventory set equipped = 1 where user_id = ? and item_key = ?").run(userId, itemKey);

    if (kind === "theme") {
      txn.prepare("update profiles set avatar_theme = ? where id = ?").run(itemKey, userId);
    } else if (kind === "title") {
      txn.prepare("update profiles set title = ? where id = ?").run(name, userId);
    }
    const updated = txn.prepare("select * from profiles where id = ?").get(userId);
    txn.commit();
    return { profile: updated, item_key: itemKey };
  } catch (e) {
    txn.rollback();
    throw e;
  }
}
