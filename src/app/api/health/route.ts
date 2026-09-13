import { NextResponse } from "next/server";

// Lightweight health check for uptime monitors and the judges' smoke test.
export function GET() {
  return NextResponse.json({
    status: "ok",
    app: "life-rpg",
    time: new Date().toISOString(),
  });
}
