// ─── RPG progression math ───────────────────────────────────────────────────
// SERVER-ONLY. This module powers all leveling math so the client can never
// "cheat" its stats: the UI merely displays values the API returns.

export const XP_BASE = 100;
export const XP_EXPONENT = 1.5;
export const XP_MAX_LEVEL = 60;

/** XP needed to advance FROM `level` to `level + 1` (non-linear curve). */
export function xpForLevel(level: number): number {
  return Math.round(XP_BASE * Math.pow(level, XP_EXPONENT));
}

/** Cumulative XP required to REACH `level` from level 1. */
export function totalXpForLevel(level: number): number {
  let sum = 0;
  for (let l = 1; l < level; l++) sum += xpForLevel(l);
  return sum;
}

export function maxLevel(): number {
  return XP_MAX_LEVEL;
}

/**
 * Apply `xpGained` to a (level, xpWithinLevel) pair.
 * Returns the new state plus how many levels were gained (0, 1, or many).
 * Overflowing XP carries over so multi-level ups feel earned.
 */
export function applyXp(
  level: number,
  xpWithinLevel: number,
  xpGained: number
): { level: number; xp: number; levelsGained: number } {
  let l = level;
  let xp = Math.max(0, xpWithinLevel) + Math.max(0, Math.round(xpGained));
  let levelsGained = 0;

  while (l < XP_MAX_LEVEL && xp >= xpForLevel(l)) {
    xp -= xpForLevel(l);
    l += 1;
    levelsGained += 1;
  }
  if (l >= XP_MAX_LEVEL) {
    l = XP_MAX_LEVEL;
    xp = Math.min(xp, xpForLevel(l)); // cap bar at full at max level
  }
  return { level: l, xp, levelsGained };
}

// ─── Attribute progression (per-category, smaller curve) ────────────────────

export const ATTR_XP_BASE = 40;
export const ATTR_XP_EXPONENT = 1.35;

export function attrXpForLevel(level: number): number {
  return Math.round(ATTR_XP_BASE * Math.pow(level, ATTR_XP_EXPONENT));
}

export function applyAttrXp(
  level: number,
  xpWithinLevel: number,
  xpGained: number
): { level: number; xp: number; levelsGained: number } {
  let l = level;
  let xp = Math.max(0, xpWithinLevel) + Math.max(0, Math.round(xpGained));
  let levelsGained = 0;
  while (xp >= attrXpForLevel(l)) {
    xp -= attrXpForLevel(l);
    l += 1;
    levelsGained += 1;
  }
  return { level: l, xp, levelsGained };
}

// ─── Streak logic (all dates are LOCAL calendar days, YYYY-MM-DD) ───────────

/** Local calendar date string for a Date, e.g. "2026-09-13". */
export function localDateString(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function addDays(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + days);
  return localDateString(dt);
}

export interface StreakUpdate {
  current: number;
  best: number;
  /** How the completion affected the streak, for toast copy. */
  kind: "started" | "continued" | "already-counted";
}

/**
 * Recompute a streak after a completion "now".
 * - first ever completion  -> start at 1
 * - same local day again   -> unchanged (already counted)
 * - next consecutive day   -> current + 1
 * - gap of >= 2 days       -> reset to 1
 * `best` is bumped if current exceeds it.
 */
export function advanceStreak(
  lastActiveDate: string | null,
  currentStreak: number,
  bestStreak: number,
  today: string = localDateString()
): StreakUpdate {
  if (!lastActiveDate) {
    return { current: 1, best: Math.max(1, bestStreak), kind: "started" };
  }
  if (lastActiveDate === today) {
    return {
      current: Math.max(currentStreak, 1),
      best: Math.max(bestStreak, currentStreak, 1),
      kind: "already-counted",
    };
  }
  const yesterday = addDays(today, -1);
  if (lastActiveDate === yesterday) {
    const next = currentStreak + 1;
    return { current: next, best: Math.max(bestStreak, next), kind: "continued" };
  }
  return { current: 1, best: Math.max(bestStreak, 1), kind: "started" };
}

// ─── Reward tables ──────────────────────────────────────────────────────────

export const DIFFICULTY_XP: Record<string, number> = {
  common: 10,
  rare: 25,
  epic: 50,
  legendary: 100,
};

export const DIFFICULTY_GOLD: Record<string, number> = {
  common: 5,
  rare: 12,
  epic: 25,
  legendary: 50,
};

export function rewardsFor(
  difficulty: string
): { xp: number; gold: number } {
  const xp = DIFFICULTY_XP[difficulty] ?? 10;
  const gold = DIFFICULTY_GOLD[difficulty] ?? 5;
  // Streak bonus: +2% XP per current streak day, capped at +50%.
  return { xp, gold };
}

export function streakBonusXp(baseXp: number, streak: number): number {
  const bonusPct = Math.min(0.5, streak * 0.02);
  return Math.round(baseXp * bonusPct);
}

// ─── Character titles unlocked by level ─────────────────────────────────────

export function titleForLevel(level: number): string {
  if (level >= 40) return "Mythic Sovereign";
  if (level >= 30) return "Dragonkin";
  if (level >= 25) return "Archmage";
  if (level >= 20) return "Champion";
  if (level >= 15) return "Warlord";
  if (level >= 10) return "Knight-Captain";
  if (level >= 7) return "Adept";
  if (level >= 4) return "Squire";
  return "Wanderer";
}
