import { NextResponse } from "next/server";
import { z } from "zod";
import { isLocal } from "@/lib/backend";
import { createClient } from "@/lib/supabase/server";
import { SHOP_ITEMS } from "@/lib/shop";
import { localGetShop, localPurchase, localEquip } from "@/lib/local/handlers";

const PurchaseSchema = z.object({ item_key: z.string().min(1).max(60) });

const FRIENDLY_ERRORS: Record<string, string> = {
  ITEM_NOT_FOUND: "That treasure does not exist.",
  ALREADY_OWNED: "You already own this item.",
  INSUFFICIENT_GOLD: "Not enough gold — complete more quests!",
  NOT_OWNED: "You do not own that item yet.",
  AUTH_REQUIRED: "Your session expired — please log in again.",
};

export async function GET() {
  if (isLocal()) return localGetShop();

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const [invRes, profRes] = await Promise.all([
    supabase.from("inventory").select("item_key, equipped").eq("user_id", user.id),
    supabase.from("profiles").select("gold").eq("id", user.id).single(),
  ]);

  const shop = {
    items: SHOP_ITEMS,
    owned: (invRes.data ?? []).map((r) => ({
      item_key: r.item_key,
      equipped: r.equipped,
    })),
    gold: profRes.data?.gold ?? 0,
  };

  return NextResponse.json(shop);
}

export async function POST(request: Request) {
  if (isLocal()) {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
    }
    return localPurchase(body);
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = PurchaseSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid item." }, { status: 422 });
  }

  const { data, error } = await supabase.rpc("purchase_item", {
    p_item_key: parsed.data.item_key,
  });

  if (error) {
    const code = (error.message ?? "").split("\n")[0]?.trim();
    const status = code === "INSUFFICIENT_GOLD" ? 402 : 409;
    return NextResponse.json(
      { error: (code && FRIENDLY_ERRORS[code]) || "Purchase failed." },
      { status }
    );
  }
  return NextResponse.json(data, { status: 201 });
}

const EquipSchema = PurchaseSchema;

export async function PATCH(request: Request) {
  if (isLocal()) {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
    }
    return localEquip(body);
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = EquipSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid item." }, { status: 422 });
  }

  const { data, error } = await supabase.rpc("equip_item", {
    p_item_key: parsed.data.item_key,
  });

  if (error) {
    const code = (error.message ?? "").split("\n")[0]?.trim();
    return NextResponse.json(
      { error: (code && FRIENDLY_ERRORS[code]) || "Equip failed." },
      { status: 409 }
    );
  }
  return NextResponse.json(data);
}
