import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SignJWT, jwtVerify } from "jose";
import { getUserById } from "@/lib/stewards/repository";
import { ALL_ROLES } from "@/lib/accounts/types";
import type { StewardRole, StewardUser } from "@/lib/stewards/types";

const SESSION_COOKIE   = "steward_session";
const MAX_AGE_DEFAULT  = 60 * 60 * 12;            // 12 hours
const MAX_AGE_REMEMBER = 60 * 60 * 24 * 365 * 10; // 10 years (≈ no limit)

const DEV_FALLBACK_SECRET = "dev-steward-secret-change-me";

type SessionPayload = { sub: string; roles: StewardRole[] };

const normalizeRoles = (input: unknown): StewardRole[] => {
  const arr = Array.isArray(input) ? input : typeof input === "string" ? [input] : [];
  const valid = arr.filter((r): r is StewardRole =>
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
  const jwt = new SignJWT({ roles: user.roles })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(user.id)
    .setIssuedAt();
  if (!rememberMe) jwt.setExpirationTime(`${MAX_AGE_DEFAULT}s`);
  return jwt.sign(secret());
}

export async function setStewardSessionCookie(token: string, rememberMe = false) {
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: rememberMe ? MAX_AGE_REMEMBER : MAX_AGE_DEFAULT,
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
  // Now that public accounts exist (PW-2b), being signed in is not enough to
  // enter the steward area — the account must be approved AND hold a
  // steward-area role. Pending/rejected or plain registered_users are sent to
  // their account page.
  if (user.status !== "approved" || !can(user, "view_steward_area")) redirect("/account");
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
  | "reset_password";

const PERMISSION_MATRIX: Record<StewardPermission, StewardRole[]> = {
  // `driver` is the Identity-v2 participant role; `member` is kept for legacy
  // accounts/cases until the member→driver migration (PW-2d).
  view_steward_area:        ["driver", "member", "steward", "admin"],
  create_complaint:         ["driver", "member", "admin"],
  submit_response:          ["driver", "member", "admin"],
  submit_appeal:            ["driver", "member", "admin"],
  view_internal_discussion: ["steward", "admin"],
  comment_internally:       ["steward", "admin"],
  edit_verdict:             ["steward", "admin"],
  publish_verdict:          ["steward", "admin"],
  manage_appeals:           ["steward", "admin"],
  delete_case:              ["admin"],
  manage_users:             ["admin"],
  manage_penalties:         ["admin"],
  reset_password:           ["admin"],
};

/** True if the user is allowed to perform the named action. */
export const can = (user: StewardUser, permission: StewardPermission): boolean =>
  PERMISSION_MATRIX[permission].some((r) => user.roles.includes(r));

// ----------------------------------------------------------------
// Legacy role-array helpers (kept for backwards compatibility)
// ----------------------------------------------------------------

export const canCreateComplaint = (roles: StewardRole[]) =>
  roles.includes("driver") || roles.includes("member") || roles.includes("admin");

export const canCommentInternally = (roles: StewardRole[]) =>
  roles.includes("steward") || roles.includes("admin");
