import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { rewardsFor } from "@/lib/progression";
import type { Quest } from "@/lib/types";

const CreateQuest = z.object({
  title: z.string().trim().min(1, "A quest needs a name.").max(120),
  description: z.string().trim().max(500).optional().nullable(),
  category: z.enum(["strength", "intellect", "vitality", "creativity", "focus"]),
  difficulty: z.enum(["common", "rare", "epic", "legendary"]),
  due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
});

function mapQuest(row: Record<string, unknown>): Quest {
  return {
    id: row.id as string,
    title: row.title as string,
    description: (row.description as string | null) ?? null,
    category: row.category as Quest["category"],
    difficulty: row.difficulty as Quest["difficulty"],
    xp_reward: row.xp_reward as number,
    gold_reward: row.gold_reward as number,
    completed: row.completed as boolean,
    completed_at: (row.completed_at as string | null) ?? null,
    due_date: (row.due_date as string | null) ?? null,
    created_at: row.created_at as string,
  };
}

export async function GET() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("quests")
    .select("*")
    .eq("user_id", user.id)
    .order("completed", { ascending: true })
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ quests: (data ?? []).map(mapQuest) });
}

export async function POST(request: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = CreateQuest.safeParse(body);
  if (!parsed.success) {
    const msg = parsed.error.issues[0]?.message ?? "Invalid quest data.";
    return NextResponse.json({ error: msg }, { status: 422 });
  }

  const { title, description, category, difficulty, due_date } = parsed.data;
  const rewards = rewardsFor(difficulty);

  const { data, error } = await supabase
    .from("quests")
    .insert({
      user_id: user.id,
      title,
      description: description ?? null,
      category,
      difficulty,
      due_date: due_date ?? null,
      xp_reward: rewards.xp,
      gold_reward: rewards.gold,
    })
    .select("*")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ quest: mapQuest(data) }, { status: 201 });
}
