import { NextResponse } from "next/server";
import { isLocal } from "@/lib/backend";
import { createClient } from "@/lib/supabase/server";
import { localCompleteQuest } from "@/lib/local/handlers";

type Params = { params: { id: string } };

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const FRIENDLY_ERRORS: Record<string, string> = {
  QUEST_NOT_FOUND: "That quest has vanished from the board.",
  ALREADY_COMPLETED: "This quest was already completed.",
  AUTH_REQUIRED: "Your session expired — please log in again.",
};

export async function POST(_request: Request, { params }: Params) {
  if (isLocal()) return localCompleteQuest(params.id);

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  if (!UUID_RE.test(params.id)) {
    return NextResponse.json({ error: "Invalid quest id." }, { status: 400 });
  }

  const { data, error } = await supabase.rpc("complete_quest", {
    p_quest_id: params.id,
  });

  if (error) {
    const code = (error.message ?? "").split("\n")[0]?.trim();
    if (code && FRIENDLY_ERRORS[code]) {
      return NextResponse.json({ error: FRIENDLY_ERRORS[code] }, { status: 409 });
    }
    return NextResponse.json(
      { error: "The completion ritual failed. Try again." },
      { status: 500 }
    );
  }

  return NextResponse.json(data);
}
