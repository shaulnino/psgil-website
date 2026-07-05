/**
 * Short-lived, purpose-scoped tokens for email verification and password reset
 * (PW-2b / PW-2c). Signed with the same HS256 session secret (PW-0 hard-fail in
 * prod), so no new secret to manage. Stateless: a token is valid until it
 * expires; verification is idempotent (re-confirming a verified email is a
 * no-op), and password reset is single-use in effect because a successful reset
 * changes the password hash.
 */
import { SignJWT, jwtVerify } from "jose";
import { getSessionSecret } from "@/lib/stewards/auth";

export type TokenPurpose = "verify-email" | "reset-password";

const TTL_SECONDS: Record<TokenPurpose, number> = {
  "verify-email": 60 * 60 * 24, // 24h
  "reset-password": 60 * 60, // 1h
};

export async function signAuthToken(sub: string, purpose: TokenPurpose): Promise<string> {
  return new SignJWT({ purpose })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(sub)
    .setIssuedAt()
    .setExpirationTime(`${TTL_SECONDS[purpose]}s`)
    .sign(getSessionSecret());
}

/** Returns the account id (sub) if the token is valid for the given purpose, else null. */
export async function verifyAuthToken(token: string, purpose: TokenPurpose): Promise<string | null> {
  try {
    const { payload } = await jwtVerify(token, getSessionSecret());
    if (payload.purpose !== purpose) return null;
    return typeof payload.sub === "string" ? payload.sub : null;
  } catch {
    return null;
  }
}
