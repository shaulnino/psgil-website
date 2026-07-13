"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { hashPassword, verifyPassword } from "@/lib/stewards/crypto";
import {
  getUserByEmail,
  getUserById,
  setDriverPhotoUrl,
  updateUser,
} from "@/lib/accounts/repository";
import { isDriverRole } from "@/lib/accounts/types";
import { saveDriverPhoto } from "@/lib/drivers/photoStore";
import {
  clearSessionCookie,
  createSession,
  getCurrentUser,
  setSessionCookie,
} from "@/lib/auth/session";
import { signAuthToken, tokenBinding, verifyAuthToken } from "@/lib/auth/tokens";
import { passwordResetEmail, sendAccountEmail } from "@/lib/auth/mailer";
import {
  forgotPasswordSchema,
  loginSchema,
  passwordSchema,
  resetPasswordSchema,
} from "@/lib/auth/schemas";

export type FormState = { error?: string } | undefined;

/** Forgot-password state — `sent` drives the anti-enumeration confirmation. */
export type ForgotState = { error?: string; sent?: boolean } | undefined;

const firstIssue = (issues: { message: string }[]) =>
  issues[0]?.message ?? "Please check the form and try again.";

/** Absolute base URL for building email links, from the request headers. */
async function baseUrl(): Promise<string> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "http";
  if (host) return `${proto}://${host}`;
  return process.env.NEXT_PUBLIC_SITE_URL ?? "https://f1isl.com";
}

/** Only allow same-site relative redirects (defends against open-redirect). */
function safeNext(value: FormDataEntryValue | null): string | null {
  const v = typeof value === "string" ? value : "";
  return v.startsWith("/") && !v.startsWith("//") ? v : null;
}

export async function loginAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) return { error: firstIssue(parsed.error.issues) };

  const { email, password } = parsed.data;
  const user = await getUserByEmail(email);
  if (!user || !user.isActive || !verifyPassword(password, user.passwordHash)) {
    return { error: "Invalid email or password." };
  }

  const remember = formData.get("remember_me") === "on";
  const token = await createSession(user, remember);
  await setSessionCookie(token, remember);

  if (user.mustChangePassword) redirect("/stewards/change-password");
  redirect(safeNext(formData.get("next")) ?? "/account");
}

export async function logoutAction(): Promise<void> {
  await clearSessionCookie();
  redirect("/");
}

/**
 * Sends a password-reset link. Anti-enumeration: for any well-formed email we
 * return the same `{ sent: true }` response whether or not an account exists.
 * The token is bound to the current password hash, so it can only be used once
 * (a successful reset invalidates the link, even before it expires).
 */
export async function requestPasswordResetAction(
  _prev: ForgotState,
  formData: FormData,
): Promise<ForgotState> {
  const parsed = forgotPasswordSchema.safeParse({ email: formData.get("email") });
  if (!parsed.success) return { error: firstIssue(parsed.error.issues) };

  const user = await getUserByEmail(parsed.data.email);
  if (user && user.isActive) {
    const token = await signAuthToken(user.id, "reset-password", tokenBinding(user.passwordHash));
    const url = `${await baseUrl()}/reset-password?token=${encodeURIComponent(token)}`;
    const mail = passwordResetEmail(user.name, url);
    await sendAccountEmail({ to: user.email, ...mail, devLink: url });
  }
  return { sent: true };
}

/** Completes a password reset from the emailed token. Redirects to login on success. */
export async function resetPasswordAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const token = String(formData.get("token") ?? "");
  if (!token) return { error: "This reset link is invalid or has expired." };

  const parsed = resetPasswordSchema.safeParse({ password: formData.get("password") });
  if (!parsed.success) return { error: firstIssue(parsed.error.issues) };
  if (String(formData.get("confirm") ?? "") !== parsed.data.password) {
    return { error: "Passwords do not match." };
  }

  // Verify the token against the account's *current* password hash. If the hash
  // changed since the link was issued (e.g. it was already used) the binding no
  // longer matches and the link is rejected.
  const sub = await verifyAuthToken(token, "reset-password");
  if (!sub) return { error: "This reset link is invalid or has expired." };
  const account = await getUserById(sub);
  if (!account) return { error: "This reset link is invalid or has expired." };
  const stillValid = await verifyAuthToken(token, "reset-password", tokenBinding(account.passwordHash));
  if (!stillValid) return { error: "This reset link is invalid or has expired." };

  await updateUser(account.id, {
    passwordHash: hashPassword(parsed.data.password),
    mustChangePassword: false,
  });
  redirect("/login?reset=1");
}

/** A linked driver uploads their profile photo (overrides CSV photo_url). */
export async function uploadDriverPhotoAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!isDriverRole(user.roles) || !user.driverId) {
    return { error: "Only a linked driver can upload a photo." };
  }
  const file = formData.get("photo");
  if (!(file instanceof File) || file.size === 0) return { error: "Please choose an image." };
  try {
    const url = await saveDriverPhoto(user.driverId, file, new Date().toISOString());
    await setDriverPhotoUrl(user.id, url);
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Upload failed." };
  }
  redirect("/account?photo=1");
}

export async function changeOwnPasswordAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const current = String(formData.get("current") ?? "");
  if (!verifyPassword(current, user.passwordHash)) {
    return { error: "Your current password is incorrect." };
  }
  const parsed = passwordSchema.safeParse(formData.get("password"));
  if (!parsed.success) return { error: firstIssue(parsed.error.issues) };
  if (String(formData.get("confirm") ?? "") !== parsed.data) {
    return { error: "New passwords do not match." };
  }
  await updateUser(user.id, { passwordHash: hashPassword(parsed.data) });
  redirect("/account?pw=1");
}
