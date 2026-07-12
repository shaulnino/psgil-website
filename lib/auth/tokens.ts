/**
 * Short-lived, purpose-scoped tokens for email verification and password reset
 * (PW-2b / PW-2c). Signed with the same HS256 session secret (PW-0 hard-fail in
 * prod), so no new secret to manage. Stateless: a token is valid until it
 * expires; verification is idempotent (re-confirming a verified email is a
 * no-op).
 *
 * Single-use via `binding` (PW-2f): a caller can bind a token to a fingerprint
 * of some server-side state (e.g. the current password hash). Verification then
 * requires the fingerprint to still match, so once a reset changes the password
 * hash the link stops working — even before it expires, and even if replayed.
 */
import { createHash } from "node:crypto";
import { SignJWT, jwtVerify } from "jose";
import { getSessionSecret } from "@/lib/stewards/auth";

export type TokenPurpose = "verify-email" | "reset-password";

const TTL_SECONDS: Record<TokenPurpose, number> = {
  "verify-email": 60 * 60 * 24, // 24h
  "reset-password": 60 * 60, // 1h
};

/** Short, non-reversible fingerprint of arbitrary state to bind a token to. */
export function tokenBinding(value: string): string {
  return createHash("sha256").update(value).digest("hex").slice(0, 16);
}

export async function signAuthToken(
  sub: string,
  purpose: TokenPurpose,
  binding?: string,
): Promise<string> {
  const jwt = new SignJWT(binding ? { purpose, bnd: binding } : { purpose })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(sub)
    .setIssuedAt()
    .setExpirationTime(`${TTL_SECONDS[purpose]}s`);
  return jwt.sign(getSessionSecret());
}

/**
 * Returns the account id (sub) if the token is valid for the given purpose, else
 * null. When `binding` is supplied it must match the token's bound fingerprint.
 */
export async function verifyAuthToken(
  token: string,
  purpose: TokenPurpose,
  binding?: string,
): Promise<string | null> {
  try {
    const { payload } = await jwtVerify(token, getSessionSecret());
    if (payload.purpose !== purpose) return null;
    if (binding !== undefined && payload.bnd !== binding) return null;
    return typeof payload.sub === "string" ? payload.sub : null;
  } catch {
    return null;
  }
}
