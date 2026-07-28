import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SignJWT, jwtVerify } from "jose";
import { getUserById } from "@/lib/stewards/repository";
import { ALL_ROLES } from "@/lib/accounts/types";
import type { StewardRole, StewardUser } from "@/lib/stewards/types";

const SESSION_COOKIE   = "steward_session";
// Non-persistent logins: JWT is capped at 12h, but the cookie itself is written
// as a SESSION cookie (no maxAge/expires) so it clears when the browser/PWA
// session ends.
const MAX_AGE_DEFAULT  = 60 * 60 * 12;            // 12 hours
// "Remember me": 400 days — the maximum cookie lifetime Chromium honors. Values
// larger than this (e.g. the old 10-year setting) are silently clamped, which
// made persistence behave inconsistently across browsers and iOS PWAs.
const MAX_AGE_REMEMBER = 60 * 60 * 24 * 400;      // 400 days

const DEV_FALLBACK_SECRET = "dev-steward-secret-change-me";

type SessionPayload = { sub: string; roles: StewardRole[] };

const normalizeRoles = (input: unknown): StewardRole[] => {
  const arr = Array.isArray(input) ? input : typeof input === "string" ? [input] : [];
  // Map the retired `member` role to `driver` so pre-existing sessions/tokens
  // (whose JWT still carries `member`) stay valid instead of losing all roles.
  const mapped = arr.map((r) => (r === "member" ? "driver" : r));
  const valid = mapped.filter((r): r is StewardRole =>
    (ALL_ROLES as string[]).includes(r as string),
  );
  return [...new Set(valid)];
};

// Resolve the JWT signing secret. In production we REFUSE to fall back to the
// publicly-known dev secret: signing/verifying sessions with it would make the
// steward portal trivially forgeable. Failing loudly here (on the first login
// or session check) turns a silent security hole into an obvious outage that
// forces STEWARD_SESSION_SECRET to be set in Netlify. Dev keeps the fallback.
const secret = () => {
  const configured = process.env.STEWARD_SESSION_SECRET;
  if (!configured || configured === DEV_FALLBACK_SECRET) {
    if (process.env.NODE_ENV === "production") {
      throw new Error(
        "[steward-auth] STEWARD_SESSION_SECRET is not configured in production. " +
        "Refusing to sign or verify sessions with the publicly-known dev fallback. " +
        "Set STEWARD_SESSION_SECRET in the Netlify site environment settings.",
      );
    }
    return new TextEncoder().encode(DEV_FALLBACK_SECRET);
  }
  return new TextEncoder().encode(configured);
};

/**
 * The HS256 signing key, shared with lib/auth (session cookie + email
 * verification / password-reset tokens) so all tokens use the same secret and
 * the same PW-0 production hard-fail. Exported rather than duplicated.
 */
export const getSessionSecret = secret;

export async function createStewardSession(user: StewardUser, rememberMe = false) {
  // Give the token a bounded lifetime in both cases (a token with no `exp` is
  // valid forever, which some verifiers/platforms handle inconsistently). The
  // cookie's persistence — not the JWT — decides whether it survives app close.
  const lifetimeSeconds = rememberMe ? MAX_AGE_REMEMBER : MAX_AGE_DEFAULT;
  return new SignJWT({ roles: user.roles })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(user.id)
    .setIssuedAt()
    .setExpirationTime(`${lifetimeSeconds}s`)
    .sign(secret());
}

export async function setStewardSessionCookie(token: string, rememberMe = false) {
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    // "Remember me" → a persistent cookie with an explicit maxAge AND expires
    // (both set for cross-browser/iOS reliability). Otherwise omit them entirely
    // so the browser stores a SESSION cookie that is dropped when the session
    // ends (app/browser fully closed) — i.e. the user is logged out on close.
    ...(rememberMe
      ? {
          maxAge: MAX_AGE_REMEMBER,
          expires: new Date(Date.now() + MAX_AGE_REMEMBER * 1000),
        }
      : {}),
  });
}

export async function clearStewardSessionCookie() {
  const jar = await cookies();
  jar.delete(SESSION_COOKIE);
}

export async function getSessionPayload(): Promise<SessionPayload | null> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  try {
    const verified = await jwtVerify(token, secret());
    const sub = verified.payload.sub;
    const roles = normalizeRoles(verified.payload.roles);
    if (!sub || roles.length === 0) return null;
    return { sub, roles };
  } catch {
    return null;
  }
}

export async function getCurrentStewardUser() {
  const payload = await getSessionPayload();
  if (!payload) return null;
  return getUserById(payload.sub);
}

export async function requireStewardUser(): Promise<StewardUser> {
  const user = await getCurrentStewardUser();
  if (!user || !user.isActive) redirect("/stewards/login");
  if (user.mustChangePassword) redirect("/stewards/change-password");
  // Being signed in is not enough to enter the steward area — the account must
  // hold a steward-area role. Plain registered_users are sent to their account
  // page. (Accounts are admin-provisioned; suspended accounts fail isActive above.)
  if (!can(user, "view_steward_area")) redirect("/account");
  return user;
}

/**
 * Like requireStewardUser but does NOT redirect for mustChangePassword.
 * Used exclusively by the change-password page itself so it can render.
 */
export async function requireStewardUserForPasswordChange(): Promise<StewardUser> {
  const user = await getCurrentStewardUser();
  if (!user || !user.isActive) redirect("/stewards/login");
  return user;
}

export async function requireRole(required: StewardRole[]) {
  const user = await requireStewardUser();
  if (!required.some((r) => user.roles.includes(r))) redirect("/stewards");
  return user;
}

// ----------------------------------------------------------------
// Role helpers
// ----------------------------------------------------------------

/** True if the user holds the given role. */
export const hasRole = (user: StewardUser, role: StewardRole) =>
  user.roles.includes(role);

/** True if the user holds at least one of the given roles. */
export const hasAnyRole = (user: StewardUser, roles: StewardRole[]) =>
  roles.some((r) => user.roles.includes(r));

// ----------------------------------------------------------------
// Named permission helpers
// ----------------------------------------------------------------

export type StewardPermission =
  | "view_steward_area"
  | "create_complaint"
  | "submit_response"
  | "submit_appeal"
  | "view_internal_discussion"
  | "comment_internally"
  | "edit_verdict"
  | "publish_verdict"
  | "manage_appeals"
  | "delete_case"
  | "manage_users"
  | "manage_penalties"
  | "reset_password"
  | "submit_own_attendance"
  | "manage_attendance";

const PERMISSION_MATRIX: Record<StewardPermission, StewardRole[]> = {
  // `driver` is the participant role (the retired `member` mapped into it).
  view_steward_area:        ["driver", "steward", "admin"],
  create_complaint:         ["driver", "admin"],
  submit_response:          ["driver", "admin"],
  submit_appeal:            ["driver", "admin"],
  view_internal_discussion: ["steward", "admin"],
  comment_internally:       ["steward", "admin"],
  edit_verdict:             ["steward", "admin"],
  publish_verdict:          ["steward", "admin"],
  manage_appeals:           ["steward", "admin"],
  delete_case:              ["admin"],
  manage_users:             ["admin"],
  manage_penalties:         ["admin"],
  reset_password:           ["admin"],
  // PW-3 attendance: a linked driver RSVPs to their own races; admins and the
  // dedicated attendance_admin role manage and view the full roster.
  submit_own_attendance:    ["driver", "admin"],
  manage_attendance:        ["admin", "attendance_admin"],
};

/** True if the user is allowed to perform the named action. */
export const can = (user: StewardUser, permission: StewardPermission): boolean =>
  PERMISSION_MATRIX[permission].some((r) => user.roles.includes(r));

// ----------------------------------------------------------------
// Legacy role-array helpers (kept for backwards compatibility)
// ----------------------------------------------------------------

export const canCreateComplaint = (roles: StewardRole[]) =>
  roles.includes("driver") || roles.includes("admin");

export const canCommentInternally = (roles: StewardRole[]) =>
  roles.includes("steward") || roles.includes("admin");
