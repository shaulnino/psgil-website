"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/session";
import { hashPassword } from "@/lib/stewards/crypto";
import {
  createUser,
  getUserByEmail,
  removeUserById,
  setAccountActive,
  setDriverId,
  updateUser,
  updateUserRoles,
} from "@/lib/accounts/repository";
import { ALL_ROLES, emailSchema, type AppRole } from "@/lib/accounts/types";

const ADMIN_PATH = "/admin";

const uid = (formData: FormData) => String(formData.get("user_id") ?? "").trim();

const rolesFrom = (formData: FormData): AppRole[] =>
  formData
    .getAll("roles")
    .filter((r): r is string => typeof r === "string")
    .filter((r): r is AppRole => (ALL_ROLES as string[]).includes(r));

export async function setRolesAction(formData: FormData) {
  await requireAdmin();
  const userId = uid(formData);
  const roles = rolesFrom(formData);
  // Never strip an account to zero roles (would break its session).
  if (userId && roles.length > 0) await updateUserRoles(userId, roles);
  revalidatePath(ADMIN_PATH);
  redirect(ADMIN_PATH);
}

export async function linkDriverAction(formData: FormData) {
  await requireAdmin();
  const userId = uid(formData);
  const driverId = String(formData.get("driver_id") ?? "").trim();
  if (userId) await setDriverId(userId, driverId || null);
  revalidatePath(ADMIN_PATH);
  redirect(ADMIN_PATH);
}

export async function setActiveAction(formData: FormData) {
  await requireAdmin();
  const userId = uid(formData);
  if (userId) await setAccountActive(userId, formData.get("active") === "true");
  revalidatePath(ADMIN_PATH);
  redirect(ADMIN_PATH);
}

export async function removeAccountAction(formData: FormData) {
  const admin = await requireAdmin();
  const userId = uid(formData);
  if (userId) await removeUserById(userId, admin.id);
  revalidatePath(ADMIN_PATH);
  redirect(ADMIN_PATH);
}

/** Admin edits an account's display name and/or email. */
export async function editAccountAction(formData: FormData) {
  await requireAdmin();
  const userId = uid(formData);
  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!userId || !name || !emailSchema.safeParse(email).success) {
    redirect(`${ADMIN_PATH}?error=invalid`);
  }
  // Reject an email already owned by a *different* account.
  const existing = await getUserByEmail(email);
  if (existing && existing.id !== userId) redirect(`${ADMIN_PATH}?error=email-taken`);
  await updateUser(userId, { name, email });
  revalidatePath(ADMIN_PATH);
  redirect(`${ADMIN_PATH}?ok=saved`);
}

/**
 * Admin resets an account's password to a new temporary one. The account is
 * flagged `mustChangePassword`, so the user is forced to set their own password
 * on next login. Used when a user forgets their password and asks an admin.
 */
export async function resetPasswordAction(formData: FormData) {
  await requireAdmin();
  const userId = uid(formData);
  const password = String(formData.get("password") ?? "");
  if (!userId || password.length < 8) redirect(`${ADMIN_PATH}?error=invalid`);
  await updateUser(userId, {
    passwordHash: hashPassword(password),
    mustChangePassword: true,
  });
  revalidatePath(ADMIN_PATH);
  redirect(`${ADMIN_PATH}?ok=reset`);
}

/** Admin-provision an account directly. Must change password on first login. */
export async function createAccountAction(formData: FormData) {
  await requireAdmin();
  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const roles = rolesFrom(formData);
  if (!name || !email || password.length < 8 || roles.length === 0) {
    redirect(`${ADMIN_PATH}?error=invalid`);
  }
  if (await getUserByEmail(email)) redirect(`${ADMIN_PATH}?error=email-taken`);
  await createUser({
    name,
    email,
    passwordHash: hashPassword(password),
    roles,
    mustChangePassword: true,
  });
  revalidatePath(ADMIN_PATH);
  redirect(ADMIN_PATH);
}
