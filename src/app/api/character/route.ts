import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { xpForLevel } from "@/lib/progression";
import type { Attribute, Character } from "@/lib/types";

const CATEGORY_META: Record<
  string,
  { label: string; icon: string; blurb: string }
> = {
  strength: {
    label: "Strength",
    icon: "💪",
    blurb: "Forged in gyms, fields, and heavy things.",
  },
  intellect: {
    label: "Intellect",
    icon: "📚",
    blurb: "Grown by books, code, and deep work.",
  },
  vitality: {
    label: "Vitality",
    icon: "🏃",
    blurb: "Fueled by runs, meals, and sleep.",
  },
  creativity: {
    label: "Creativity",
    icon: "🎨",
    blurb: "Sparked by making, playing, and building.",
  },
  focus: {
    label: "Focus",
    icon: "🎯",
    blurb: "Sharpened by deep work and finished plans.",
  },
};

export async function GET() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const [profileRes, attrsRes, streakRes] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", user.id).single(),
    supabase.from("attributes").select("*").eq("user_id", user.id),
    supabase.from("streaks").select("*").eq("user_id", user.id).single(),
  ]);

  if (profileRes.error || !profileRes.data) {
    return NextResponse.json(
      { error: "Character sheet not found." },
      { status: 404 }
    );
  }

  const p = profileRes.data;
  const attrs: Attribute[] = (attrsRes.data ?? []).map((a) => {
    const meta = CATEGORY_META[a.key] ?? {
      label: a.key,
      icon: "❔",
      blurb: "",
    };
    return {
      key: a.key,
      label: meta.label,
      icon: meta.icon,
      blurb: meta.blurb,
      xp: a.xp,
      level: a.level,
    };
  });

  // Deterministic ordering for the UI.
  const ORDER = ["strength", "intellect", "vitality", "creativity", "focus"];
  attrs.sort((a, b) => ORDER.indexOf(a.key) - ORDER.indexOf(b.key));

  const character: Character = {
    profile: {
      id: p.id,
      username: p.username,
      level: p.level,
      xp: p.xp,
      gold: p.gold,
      title: p.title,
      avatar_theme: p.avatar_theme,
      created_at: p.created_at,
    },
    attributes: attrs,
    streak: {
      current: streakRes.data?.current ?? 0,
      best: streakRes.data?.best ?? 0,
      last_active_date: streakRes.data?.last_active_date ?? null,
    },
    xp_needed: xpForLevel(p.level),
    total_xp_earned: p.total_xp,
  };

  return NextResponse.json(character);
}
