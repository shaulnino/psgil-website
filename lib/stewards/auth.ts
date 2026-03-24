import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SignJWT, jwtVerify } from "jose";
import { getUserById } from "@/lib/stewards/repository";
import type { StewardRole, StewardUser } from "@/lib/stewards/types";

const SESSION_COOKIE = "steward_session";
const MAX_AGE = 60 * 60 * 12;

const DEV_FALLBACK_SECRET = "dev-steward-secret-change-me";

// Warn loudly in production when the session secret has not been configured.
// This appears immediately in Netlify function logs on first request.
if (process.env.NODE_ENV === "production") {
  const configured = process.env.STEWARD_SESSION_SECRET;
  if (!configured || configured === DEV_FALLBACK_SECRET) {
    console.error(
      "[steward-auth] CRITICAL: STEWARD_SESSION_SECRET is not set (or uses the default dev " +
      "value). The JWT signing secret is publicly known. Set this environment variable in " +
      "your Netlify site settings immediately.",
    );
  }
}

type SessionPayload = { sub: string; roles: StewardRole[] };

const normalizeRoles = (input: unknown): StewardRole[] => {
  const arr = Array.isArray(input) ? input : typeof input === "string" ? [input] : [];
  const valid = arr.filter(
    (r): r is StewardRole => r === "admin" || r === "steward" || r === "member",
  );
  return [...new Set(valid)];
};

const secret = () =>
  new TextEncoder().encode(process.env.STEWARD_SESSION_SECRET ?? DEV_FALLBACK_SECRET);

export async function createStewardSession(user: StewardUser) {
  return new SignJWT({ roles: user.roles })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(user.id)
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE}s`)
    .sign(secret());
}

export async function setStewardSessionCookie(token: string) {
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE,
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
  view_steward_area:        ["member", "steward", "admin"],
  create_complaint:         ["member", "admin"],
  submit_response:          ["member", "admin"],
  submit_appeal:            ["member", "admin"],
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
  roles.includes("member") || roles.includes("admin");

export const canCommentInternally = (roles: StewardRole[]) =>
  roles.includes("steward") || roles.includes("admin");
