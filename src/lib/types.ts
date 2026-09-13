// ─── Domain types shared by backend and frontend ────────────────────────────

export const CATEGORIES = [
  "strength",
  "intellect",
  "vitality",
  "creativity",
  "focus",
] as const;
export type Category = (typeof CATEGORIES)[number];

export const DIFFICULTIES = ["common", "rare", "epic", "legendary"] as const;
export type Difficulty = (typeof DIFFICULTIES)[number];

export interface Quest {
  id: string;
  title: string;
  description: string | null;
  category: Category;
  difficulty: Difficulty;
  xp_reward: number;
  gold_reward: number;
  completed: boolean;
  completed_at: string | null;
  due_date: string | null;
  created_at: string;
}

export interface QuestInput {
  title: string;
  description?: string | null;
  category: Category;
  difficulty: Difficulty;
  due_date?: string | null;
}

export interface Attribute {
  key: Category;
  label: string;
  icon: string;
  blurb: string;
  xp: number;
  level: number;
}

export interface Streak {
  current: number;
  best: number;
  last_active_date: string | null;
  /** How the last completion affected the streak (from complete_quest). */
  kind?: "started" | "continued" | "already-counted";
}

export interface Transaction {
  id: string;
  kind: "earn" | "spend" | "bonus";
  amount: number;
  reason: string;
  created_at: string;
}

export interface Profile {
  id: string;
  username: string;
  level: number;
  xp: number; // xp within the current level
  gold: number;
  title: string;
  avatar_theme: string;
  created_at: string;
}

export interface Character {
  profile: Profile;
  attributes: Attribute[];
  streak: Streak;
  xp_needed: number; // xp required to go from current level -> next
  total_xp_earned: number;
}

export type ShopItemKind = "theme" | "title" | "relic";

export interface ShopItem {
  key: string;
  name: string;
  kind: ShopItemKind;
  price: number;
  description: string;
  icon: string;
}

export interface OwnedItem {
  item_key: string;
  equipped: boolean;
}

export interface ShopState {
  items: ShopItem[];
  owned: OwnedItem[];
  gold: number;
}

export interface CompleteResult {
  quest: Quest;
  profile: Profile;
  xp_gained: number;
  gold_gained: number;
  leveled_up: boolean;
  new_level: number;
  levels_gained: number;
  streak: Streak;
  attribute: { key: Category; level: number; xp: number };
  attribute_leveled_up: boolean;
}

export interface AuthResult {
  ok: boolean;
  needsEmailConfirmation?: boolean;
  error?: string;
}

// ─── API error envelope ─────────────────────────────────────────────────────

export interface ApiError {
  error: string;
}
