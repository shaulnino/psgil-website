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
import { getLocale } from "next-intl/server";
import { getPathname } from "@/i18n/navigation";
import {
  can,
  clearStewardSessionCookie,
  createStewardSession,
  getCurrentStewardUser,
  setStewardSessionCookie,
} from "@/lib/stewards/auth";
import type { Account } from "@/lib/accounts/types";

/**
 * Redirect to a public route in the caller's current locale. These helpers run
 * without a locale prefix, so a bare `redirect("/login")` resets the language to
 * the default (Hebrew) — an English guest hitting /en/account would land on a
 * Hebrew /login. Re-apply the correct prefix via `getPathname`.
 */
async function localeRedirect(href: string): Promise<never> {
  const locale = await getLocale();
  const [path, query] = href.split("?");
  const localized = getPathname({ href: path, locale });
  redirect(query ? `${localized}?${query}` : localized);
}

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
    return localeRedirect(`/login${next ? `?next=${encodeURIComponent(next)}` : ""}`);
  }
  return user;
}

/**
 * Require an admin (platform admin console). Sends guests to /login and
 * non-admins to /account. Admin is the `manage_users` permission.
 */
export async function requireAdmin(next?: string): Promise<Account> {
  const user = await requireUser(next);
  if (!can(user, "manage_users")) return localeRedirect("/account");
  return user;
}
