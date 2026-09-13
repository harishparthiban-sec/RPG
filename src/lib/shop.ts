import type { ShopItem, ShopItemKind } from "./types";

// ─── The Guild Emporium ─────────────────────────────────────────────────────
// Static catalog (keys are stored in `inventory.item_key`). Prices are tuned
// so a few days of quests buys the cheaper items, rare items take a grind.

export const SHOP_ITEMS: ShopItem[] = [
  // ── Themes (change the whole app accent palette) ──
  {
    key: "theme-crimson",
    name: "Crimson Oath",
    kind: "theme" as ShopItemKind,
    price: 120,
    description: "Blood-pact crimson accents for a war-forged soul.",
    icon: "🗡️",
  },
  {
    key: "theme-verdant",
    name: "Verdant Whispers",
    kind: "theme" as ShopItemKind,
    price: 120,
    description: "Druid-green glow, the color of growing things.",
    icon: "🌿",
  },
  {
    key: "theme-arcane",
    name: "Arcane Depths",
    kind: "theme" as ShopItemKind,
    price: 200,
    description: "Void-purple sorcery for those who bend reality.",
    icon: "🔮",
  },
  {
    key: "theme-dawn",
    name: "Dawnbringer",
    kind: "theme" as ShopItemKind,
    price: 200,
    description: "Radiant gold and white, light made tangible.",
    icon: "🌅",
  },

  // ── Titles (flavor text next to your name) ──
  {
    key: "title-nightowl",
    name: 'Title: "The Night Owl"',
    kind: "title" as ShopItemKind,
    price: 80,
    description: "For quests completed when sane people sleep.",
    icon: "🦉",
  },
  {
    key: "title-unbroken",
    name: 'Title: "The Unbroken"',
    kind: "title" as ShopItemKind,
    price: 150,
    description: "Wear it when your streak refuses to die.",
    icon: "🛡️",
  },
  {
    key: "title-ironbound",
    name: 'Title: "Ironbound"',
    kind: "title" as ShopItemKind,
    price: 150,
    description: "Forged in discipline, quenched in sweat.",
    icon: "⚙️",
  },

  // ── Relics (trophy items for your display case) ──
  {
    key: "relic-compass",
    name: "Wayfinder's Compass",
    kind: "relic" as ShopItemKind,
    price: 90,
    description: "It always points at your next quest.",
    icon: "🧭",
  },
  {
    key: "relic-tome",
    name: "Endless Tome",
    kind: "relic" as ShopItemKind,
    price: 140,
    description: "A book that grows one page per day you show up.",
    icon: "📖",
  },
  {
    key: "relic-flask",
    name: "Everfull Flask",
    kind: "relic" as ShopItemKind,
    price: 140,
    description: "Bottomless stamina in a bottle.",
    icon: "⚗️",
  },
  {
    key: "relic-crown",
    name: "Crown of Small Wins",
    kind: "relic" as ShopItemKind,
    price: 300,
    description: "The rarest treasure: proof you kept going.",
    icon: "👑",
  },
];

export const ITEM_MAP = new Map(SHOP_ITEMS.map((i) => [i.key, i]));

export function itemByKey(key: string): ShopItem | undefined {
  return ITEM_MAP.get(key);
}

/** Items a fresh account starts owning (equipped by default). */
export const DEFAULT_THEME_KEY = "default";

export const THEME_OPTIONS = [
  { key: "default", label: "Emberfall", accent: "#f59e0b" },
  { key: "theme-crimson", label: "Crimson Oath", accent: "#ef4444" },
  { key: "theme-verdant", label: "Verdant Whispers", accent: "#10b981" },
  { key: "theme-arcane", label: "Arcane Depths", accent: "#8b5cf6" },
  { key: "theme-dawn", label: "Dawnbringer", accent: "#38bdf8" },
] as const;
