import { NextResponse } from "next/server";
import { isLocal } from "@/lib/backend";
import { createClient } from "@/lib/supabase/server";
import { localListTransactions } from "@/lib/local/handlers";
import type { Transaction } from "@/lib/types";

export async function GET() {
  if (isLocal()) return localListTransactions();

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("transactions")
    .select("id, kind, amount, reason, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(20);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const transactions: Transaction[] = (data ?? []).map((t) => ({
    id: t.id,
    kind: t.kind,
    amount: t.amount,
    reason: t.reason,
    created_at: t.created_at,
  }));

  return NextResponse.json({ transactions });
}
