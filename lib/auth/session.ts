/**
 * Platform session helpers (PW-2b).
 *
 * The JWT session mechanism is generic (payload = { sub, roles }), so these are
 * account-neutral names over the existing steward implementation — one auth
 * system, one cookie (`steward_session`), one secret (PW-0 hard-fail). Public
 * pages use these; the steward portal keeps its own `requireStewardUser` (which
 * redirects to /stewards/login and enforces mustChangePassword).
 */
import { redirect } from "next/navigation";
import {
  can,
  clearStewardSessionCookie,
  createStewardSession,
  getCurrentStewardUser,
  setStewardSessionCookie,
} from "@/lib/stewards/auth";
import type { Account } from "@/lib/accounts/types";

/** Current authenticated account, or null. Reads the session cookie. */
export const getCurrentUser = getCurrentStewardUser;
export const createSession = createStewardSession;
export const setSessionCookie = setStewardSessionCookie;
export const clearSessionCookie = clearStewardSessionCookie;

/**
 * Require any authenticated, active account. Redirects guests to /login
 * (optionally preserving where they were headed via ?next=). Used by /account
 * and, later, attendance. Does NOT force mustChangePassword — general accounts
 * are created with it false; steward-provisioned accounts use requireStewardUser.
 */
export async function requireUser(next?: string): Promise<Account> {
  const user = await getCurrentUser();
  if (!user || !user.isActive) {
    redirect(`/login${next ? `?next=${encodeURIComponent(next)}` : ""}`);
  }
  return user;
}

/**
 * Require an admin (platform admin console). Sends guests to /login and
 * non-admins to /account. Admin is the `manage_users` permission.
 */
export async function requireAdmin(next?: string): Promise<Account> {
  const user = await requireUser(next);
  if (!can(user, "manage_users")) redirect("/account");
  return user;
}
