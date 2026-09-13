import { cookies } from "next/headers";
import { getSessionUser, SESSION_COOKIE, type SessionUser } from "./auth";

/** Current local-mode user for a route handler, or null. */
export function getLocalUser(): SessionUser | null {
  const store = cookies();
  return getSessionUser(store.get(SESSION_COOKIE)?.value);
}
