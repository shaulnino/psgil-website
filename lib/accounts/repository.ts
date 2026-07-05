/**
 * Account repository (PW-2a) — CRUD over the account store.
 *
 * These functions are re-exported from lib/stewards/repository.ts under their
 * historical names (listUsers/getUserById/…) so every existing steward call
 * site keeps working with no change. Signatures match the previous steward
 * implementations exactly.
 */
import { randomUUID } from "node:crypto";
import {
  deleteAccount,
  getAccountById,
  getAccountByEmail,
  listAccounts,
  putAccount,
} from "@/lib/accounts/store";
import { ALL_ROLES, newAccountSchema, type Account, type AppRole } from "@/lib/accounts/types";

export type RemoveUserResult =
  | { ok: true }
  | { ok: false; reason: "not-found" | "cannot-remove-self" | "last-admin" };

export type NewUserInput = {
  name: string;
  email: string;
  passwordHash: string;
  roles: AppRole[];
  /** Defaults to true — new accounts must change password on first login. */
  mustChangePassword?: boolean;
  /** PW-2b: public registration sets this false and verifies by email. */
  emailVerified?: boolean;
  /** PW-2d: driver linking. */
  driverId?: string | null;
};

const normalizeRoles = (roles: AppRole[]): AppRole[] =>
  [...new Set((roles ?? []).filter((r) => ALL_ROLES.includes(r)))];

export async function listUsers(): Promise<Account[]> {
  const accounts = await listAccounts();
  return accounts.map((a) => ({ ...a, roles: normalizeRoles(a.roles) }));
}

export async function getUserById(id: string): Promise<Account | null> {
  const account = await getAccountById(id);
  return account ? { ...account, roles: normalizeRoles(account.roles) } : null;
}

export async function getUserByEmail(email: string): Promise<Account | null> {
  const account = await getAccountByEmail(email);
  return account ? { ...account, roles: normalizeRoles(account.roles) } : null;
}

export async function createUser(input: NewUserInput): Promise<Account> {
  // Validate + normalize (zod). Throws on malformed input — callers pass
  // trusted server-side data today; PW-2b public registration relies on this.
  const parsed = newAccountSchema.parse(input);
  const now = new Date().toISOString();
  const account: Account = {
    id: `u_${randomUUID()}`,
    name: parsed.name.trim(),
    email: parsed.email.trim().toLowerCase(),
    roles: normalizeRoles(parsed.roles as AppRole[]),
    passwordHash: parsed.passwordHash,
    isActive: true,
    mustChangePassword: parsed.mustChangePassword ?? true,
    emailVerified: parsed.emailVerified ?? false,
    driverId: parsed.driverId ?? null,
    createdAt: now,
    updatedAt: now,
  };
  await putAccount(account);
  return account;
}

export async function updateUser(
  userId: string,
  fields: { name?: string; email?: string; passwordHash?: string; mustChangePassword?: boolean },
): Promise<boolean> {
  const account = await getAccountById(userId);
  if (!account) return false;
  if (fields.name !== undefined) account.name = fields.name.trim();
  if (fields.email !== undefined) account.email = fields.email.trim().toLowerCase();
  if (fields.passwordHash !== undefined) account.passwordHash = fields.passwordHash;
  if (fields.mustChangePassword !== undefined) account.mustChangePassword = fields.mustChangePassword;
  account.updatedAt = new Date().toISOString();
  await putAccount(account);
  return true;
}

export async function updateUserRoles(userId: string, roles: AppRole[]): Promise<void> {
  const account = await getAccountById(userId);
  if (!account) return;
  account.roles = normalizeRoles(roles);
  account.updatedAt = new Date().toISOString();
  await putAccount(account);
}

export async function setUserLocale(userId: string, locale: "en" | "he"): Promise<void> {
  const account = await getAccountById(userId);
  if (!account) return;
  account.locale = locale;
  account.updatedAt = new Date().toISOString();
  await putAccount(account);
}

export async function removeUserById(
  userId: string,
  actorUserId: string,
): Promise<RemoveUserResult> {
  if (userId === actorUserId) return { ok: false, reason: "cannot-remove-self" };
  const all = await listAccounts();
  const target = all.find((a) => a.id === userId);
  if (!target) return { ok: false, reason: "not-found" };
  if (target.roles.includes("admin")) {
    const adminCount = all.filter((a) => a.isActive && a.roles.includes("admin")).length;
    if (adminCount <= 1) return { ok: false, reason: "last-admin" };
  }
  await deleteAccount(userId);
  return { ok: true };
}
