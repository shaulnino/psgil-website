import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SignJWT, jwtVerify } from "jose";
import { getUserById } from "@/lib/stewards/repository";
import type { StewardRole, StewardUser } from "@/lib/stewards/types";

const SESSION_COOKIE = "steward_session";
const MAX_AGE = 60 * 60 * 12;

type SessionPayload = { sub: string; roles: StewardRole[] };

const normalizeRoles = (input: unknown): StewardRole[] => {
  const arr = Array.isArray(input) ? input : typeof input === "string" ? [input] : [];
  const valid = arr.filter(
    (r): r is StewardRole => r === "admin" || r === "steward" || r === "member",
  );
  return [...new Set(valid)];
};

const secret = () =>
  new TextEncoder().encode(process.env.STEWARD_SESSION_SECRET ?? "dev-steward-secret-change-me");

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
  return user;
}

export async function requireRole(required: StewardRole[]) {
  const user = await requireStewardUser();
  if (!required.some((r) => user.roles.includes(r))) redirect("/stewards");
  return user;
}

export const canCreateComplaint = (roles: StewardRole[]) =>
  roles.includes("member") || roles.includes("admin");

export const canCommentInternally = (roles: StewardRole[]) =>
  roles.includes("steward") || roles.includes("admin");
