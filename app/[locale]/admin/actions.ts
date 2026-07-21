"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/session";
import { hashPassword } from "@/lib/stewards/crypto";
import {
  createUser,
  getUserByEmail,
  listUsers,
  removeUserById,
  setAccountActive,
  setDriverId,
  updateUser,
  updateUserRoles,
} from "@/lib/accounts/repository";
import { ALL_ROLES, emailSchema, type AppRole } from "@/lib/accounts/types";
import { sendAccountEmail, accountCreatedEmail } from "@/lib/auth/mailer";

/**
 * Fixed temporary password for every admin-provisioned account. Safe as a
 * constant because `mustChangePassword: true` forces an immediate change on
 * first login. Communicated to the new user via the welcome email.
 */
const TEMP_PASSWORD = "12345678";
// Public base for the login link in the welcome email (Netlify overrides via env).
const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://f1isl.com").replace(/\/$/, "");

/**
 * Admin account-management actions (redesign, 2026-07).
 *
 * Unlike the previous form-`action` handlers (which redirected on every
 * mutation), these are **result-returning** server actions called directly
 * from the client `AccountsAdmin` UI. Each returns `{ ok: true }` or
 * `{ ok: false, error }` with a stable code the client maps to a localized
 * message, so failures can be shown inline next to the affected account/field
 * instead of via a lossy redirect. All enforce `requireAdmin` and add the
 * safety guards the old handlers lacked (self / last-admin protection).
 */
const ADMIN_ROUTE = "/[locale]/admin";

export type AdminErrorCode =
  | "not-found"
  | "name-required"
  | "email-invalid"
  | "email-taken"
  | "roles-required"
  | "own-admin"
  | "last-admin"
  | "cannot-remove-self"
  | "cannot-suspend-self"
  | "password-short"
  | "generic";

export type ActionResult = { ok: true } | { ok: false; error: AdminErrorCode };

const ok = (): ActionResult => ({ ok: true });
const fail = (error: AdminErrorCode): ActionResult => ({ ok: false, error });

const normalizeRoles = (roles: AppRole[]): AppRole[] =>
  [...new Set((roles ?? []).filter((r) => (ALL_ROLES as string[]).includes(r)))];

/** Save an account's editable fields (name, email, roles, driver link) in one go. */
export async function saveAccount(input: {
  userId: string;
  name: string;
  email: string;
  roles: AppRole[];
  driverId: string | null;
}): Promise<ActionResult> {
  const admin = await requireAdmin();
  const userId = input.userId.trim();
  const name = input.name.trim();
  const email = input.email.trim().toLowerCase();
  const roles = normalizeRoles(input.roles);

  if (!userId) return fail("not-found");
  if (!name) return fail("name-required");
  if (!emailSchema.safeParse(email).success) return fail("email-invalid");
  if (roles.length === 0) return fail("roles-required");

  const all = await listUsers();
  const target = all.find((a) => a.id === userId);
  if (!target) return fail("not-found");

  // Email must be unique across *other* accounts.
  if (all.some((a) => a.id !== userId && a.email === email)) return fail("email-taken");

  // Guard: dropping the `admin` role from someone who currently has it.
  if (target.roles.includes("admin") && !roles.includes("admin")) {
    if (target.id === admin.id) return fail("own-admin");
    const activeAdmins = all.filter((a) => a.isActive && a.roles.includes("admin")).length;
    if (activeAdmins <= 1) return fail("last-admin");
  }

  await updateUser(userId, { name, email });
  await updateUserRoles(userId, roles);
  await setDriverId(userId, input.driverId?.trim() || null);
  revalidatePath(ADMIN_ROUTE, "page");
  return ok();
}

/** Reset an account's password to an admin-chosen temporary one (forces change). */
export async function resetPassword(userId: string, password: string): Promise<ActionResult> {
  await requireAdmin();
  if (password.length < 8) return fail("password-short");
  const updated = await updateUser(userId.trim(), {
    passwordHash: hashPassword(password),
    mustChangePassword: true,
  });
  if (!updated) return fail("not-found");
  revalidatePath(ADMIN_ROUTE, "page");
  return ok();
}

/** Suspend (isActive=false) or reactivate an account. */
export async function setActive(userId: string, isActive: boolean): Promise<ActionResult> {
  const admin = await requireAdmin();
  const id = userId.trim();
  if (!isActive) {
    if (id === admin.id) return fail("cannot-suspend-self");
    const all = await listUsers();
    const target = all.find((a) => a.id === id);
    if (!target) return fail("not-found");
    if (target.roles.includes("admin")) {
      const activeAdmins = all.filter((a) => a.isActive && a.roles.includes("admin")).length;
      if (activeAdmins <= 1) return fail("last-admin");
    }
  }
  await setAccountActive(id, isActive);
  revalidatePath(ADMIN_ROUTE, "page");
  return ok();
}

/** Permanently remove an account (blocks self + last-admin at the repository). */
export async function removeAccount(userId: string): Promise<ActionResult> {
  const admin = await requireAdmin();
  const res = await removeUserById(userId.trim(), admin.id);
  if (!res.ok) return fail(res.reason);
  revalidatePath(ADMIN_ROUTE, "page");
  return ok();
}

/**
 * Admin-provision a new account with the fixed temporary password. The new user
 * is emailed their login link + temp password and must change it on first login.
 */
export async function createAccount(input: {
  name: string;
  email: string;
  roles: AppRole[];
}): Promise<ActionResult> {
  await requireAdmin();
  const name = input.name.trim();
  const email = input.email.trim().toLowerCase();
  const roles = normalizeRoles(input.roles);

  if (!name) return fail("name-required");
  if (!emailSchema.safeParse(email).success) return fail("email-invalid");
  if (roles.length === 0) return fail("roles-required");
  if (await getUserByEmail(email)) return fail("email-taken");

  const account = await createUser({
    name,
    email,
    passwordHash: hashPassword(TEMP_PASSWORD),
    roles,
    mustChangePassword: true,
  });

  // Welcome email with login link + temp password. Non-fatal: sendAccountEmail
  // never throws (logs on failure), so a mail issue never blocks account creation.
  const loginUrl = `${SITE_URL}/login`;
  const mail = accountCreatedEmail(account.name, account.email, TEMP_PASSWORD, loginUrl);
  await sendAccountEmail({ to: account.email, ...mail, devLink: loginUrl });

  revalidatePath(ADMIN_ROUTE, "page");
  return ok();
}
