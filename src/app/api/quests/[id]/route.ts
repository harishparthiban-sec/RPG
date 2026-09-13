import { NextResponse } from "next/server";
import { z } from "zod";
import { isLocal } from "@/lib/backend";
import { createClient } from "@/lib/supabase/server";
import { rewardsFor } from "@/lib/progression";
import { localUpdateQuest, localDeleteQuest } from "@/lib/local/handlers";
import type { Quest } from "@/lib/types";

const UpdateQuest = z.object({
  title: z.string().trim().min(1, "A quest needs a name.").max(120).optional(),
  description: z.string().trim().max(500).optional().nullable(),
  category: z
    .enum(["strength", "intellect", "vitality", "creativity", "focus"])
    .optional(),
  difficulty: z.enum(["common", "rare", "epic", "legendary"]).optional(),
  due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
});

type Params = { params: { id: string } };

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

export async function PATCH(request: Request, { params }: Params) {
  if (isLocal()) {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
    }
    return localUpdateQuest(params.id, body);
  }

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

  const parsed = UpdateQuest.safeParse(body);
  if (!parsed.success) {
    const msg = parsed.error.issues[0]?.message ?? "Invalid quest data.";
    return NextResponse.json({ error: msg }, { status: 422 });
  }

  const patch: Record<string, unknown> = { ...parsed.data };
  // Keep stored rewards in sync when difficulty changes.
  if (parsed.data.difficulty) {
    const rewards = rewardsFor(parsed.data.difficulty);
    patch.xp_reward = rewards.xp;
    patch.gold_reward = rewards.gold;
  }

  const { data, error } = await supabase
    .from("quests")
    .update(patch)
    .eq("id", params.id)
    .eq("user_id", user.id)
    .eq("completed", false) // completed quests are history; don't rewrite them
    .select("*")
    .single();

  if (error) {
    return NextResponse.json(
      { error: "Quest not found, already completed, or update rejected." },
      { status: 404 }
    );
  }
  return NextResponse.json({ quest: mapQuest(data) });
}

export async function DELETE(_request: Request, { params }: Params) {
  if (isLocal()) return localDeleteQuest(params.id);

  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const { error } = await supabase
    .from("quests")
    .delete()
    .eq("id", params.id)
    .eq("user_id", user.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
