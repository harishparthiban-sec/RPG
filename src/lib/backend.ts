// ─── Backend selector ────────────────────────────────────────────────────────
// "supabase" when NEXT_PUBLIC_SUPABASE_URL is a real URL; "local" otherwise
// (placeholder URLs included). Local mode = SQLite + cookie sessions, zero config.

export type BackendMode = "supabase" | "local";

export function backendMode(): BackendMode {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
  const looksReal =
    url.startsWith("https://") &&
    !url.includes("placeholder") &&
    key.length > 40;
  return looksReal ? "supabase" : "local";
}

export function isLocal(): boolean {
  return backendMode() === "local";
}
