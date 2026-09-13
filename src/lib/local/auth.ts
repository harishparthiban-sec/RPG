// ─── Local auth: scrypt password hashing + server-side sessions ────────────

import {
  randomBytes,
  scryptSync,
  timingSafeEqual,
} from "node:crypto";
import db, { newId, nowIso } from "./db";

const SESSION_TTL_DAYS = 30;

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `scrypt:${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [scheme, salt, hash] = stored.split(":");
  if (scheme !== "scrypt" || !salt || !hash) return false;
  const candidate = scryptSync(password, salt, 64);
  const expected = Buffer.from(hash, "hex");
  return candidate.length === expected.length && timingSafeEqual(candidate, expected);
}

export interface SessionUser {
  id: string;
  email: string;
  username: string;
}

export function createSession(userId: string): { token: string; expiresAt: Date } {
  const token = newId() + newId().replace(/-/g, "");
  const expiresAt = new Date(Date.now() + SESSION_TTL_DAYS * 24 * 3600 * 1000);
  db.prepare(
    "insert into sessions (token, user_id, expires_at) values (?, ?, ?)"
  ).run(token, userId, expiresAt.toISOString());
  return { token, expiresAt };
}

export function getSessionUser(token: string | undefined): SessionUser | null {
  if (!token) return null;
  const row = db
    .prepare(
      `select u.id, u.email, u.username
       from sessions s join users u on u.id = s.user_id
       where s.token = ? and s.expires_at > ?`
    )
    .get(token, nowIso()) as SessionUser | undefined;
  return row ?? null;
}

export function destroySession(token: string | undefined): void {
  if (!token) return;
  db.prepare("delete from sessions where token = ?").run(token);
}

export const SESSION_COOKIE = "liferpg_session";

export const SESSION_COOKIE_OPTS = {
  httpOnly: true,
  sameSite: "lax" as const,
  path: "/",
  secure: process.env.NODE_ENV === "production",
};
