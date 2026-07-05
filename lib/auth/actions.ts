"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { hashPassword, verifyPassword } from "@/lib/stewards/crypto";
import {
  createUser,
  getUserByEmail,
  getUserById,
  setEmailVerified,
  updateUser,
} from "@/lib/accounts/repository";
import {
  clearSessionCookie,
  createSession,
  getCurrentUser,
  setSessionCookie,
} from "@/lib/auth/session";
import { signAuthToken, verifyAuthToken } from "@/lib/auth/tokens";
import { sendAccountEmail, verificationEmail } from "@/lib/auth/mailer";
import { loginSchema, passwordSchema, registerSchema } from "@/lib/auth/schemas";

export type FormState = { error?: string } | undefined;

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

async function sendVerification(accountId: string, name: string, email: string) {
  const token = await signAuthToken(accountId, "verify-email");
  const url = `${await baseUrl()}/verify?token=${encodeURIComponent(token)}`;
  const mail = verificationEmail(name, url);
  await sendAccountEmail({ to: email, ...mail, devLink: url });
}

export async function registerAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = registerSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) return { error: firstIssue(parsed.error.issues) };

  const { name, email, password } = parsed.data;
  if (String(formData.get("confirm") ?? "") !== password) {
    return { error: "Passwords do not match." };
  }
  if (await getUserByEmail(email)) {
    return { error: "An account with this email already exists." };
  }

  const account = await createUser({
    name,
    email,
    passwordHash: hashPassword(password),
    roles: ["registered_user"],
    mustChangePassword: false,
    emailVerified: false,
  });

  await sendVerification(account.id, account.name, account.email);

  // Auto sign-in (unverified users may browse; sensitive actions gate on verified).
  const token = await createSession(account, false);
  await setSessionCookie(token, false);
  redirect("/account?welcome=1");
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

/** Verifies an email-verification token (called from the /verify page). */
export async function verifyEmailAction(token: string): Promise<{ ok: boolean; error?: string }> {
  const sub = await verifyAuthToken(token, "verify-email");
  if (!sub) return { ok: false, error: "This verification link is invalid or has expired." };
  const account = await getUserById(sub);
  if (!account) return { ok: false, error: "Account not found." };
  if (!account.emailVerified) await setEmailVerified(sub, true);
  return { ok: true };
}

export async function resendVerificationAction(): Promise<{ ok: boolean; error?: string }> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "You must be signed in." };
  if (user.emailVerified) return { ok: true };
  await sendVerification(user.id, user.name, user.email);
  return { ok: true };
}

export async function updateProfileAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const name = String(formData.get("name") ?? "").trim();
  if (name.length < 1 || name.length > 120) return { error: "Please enter a valid name." };
  await updateUser(user.id, { name });
  redirect("/account?saved=1");
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
