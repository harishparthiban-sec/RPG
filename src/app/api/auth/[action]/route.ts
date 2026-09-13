import { NextResponse } from "next/server";
import { isLocal } from "@/lib/backend";
import { handleSignup, handleLogin, handleLogout } from "@/lib/local/handlers";

export async function POST(request: Request) {
  const { pathname } = new URL(request.url);
  const action = pathname.split("/").pop();

  if (isLocal()) {
    if (action === "signup") return handleSignup(request);
    if (action === "login") return handleLogin(request);
    if (action === "logout") return handleLogout();
    return NextResponse.json({ error: "Unknown action." }, { status: 404 });
  }

  // ── Supabase mode: the client SDK talks to Supabase directly; the API only
  //    exists for parity. Return a hint so a misrouted call is obvious.
  return NextResponse.json(
    { error: "Use the Supabase client SDK for auth in this mode." },
    { status: 501 }
  );
}
