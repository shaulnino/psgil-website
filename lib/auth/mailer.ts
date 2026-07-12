/**
 * Account email (PW-2b): verification links (and later password reset).
 *
 * Uses the same Gmail transport as steward notifications. When
 * GMAIL_APP_PASSWORD is not set (local dev) or a send fails, we log the link to
 * the server console instead of throwing — so registration never breaks and the
 * flow stays testable in dev. Sends are fire-and-forget from the caller's view.
 *
 * NOTE: transport creation is duplicated from lib/stewards/notifications.ts for
 * now; a shared mailer util is a fine future consolidation (not needed yet).
 */
const LEAGUE_EMAIL = "f1racingisl@gmail.com";

type AccountEmail = {
  to: string;
  subject: string;
  html: string;
  text: string;
  /** Logged in dev so the flow is testable without a configured inbox. */
  devLink?: string;
};

export async function sendAccountEmail({ to, subject, html, text, devLink }: AccountEmail): Promise<void> {
  const pass = process.env.GMAIL_APP_PASSWORD;

  // No transport configured (typical in dev) — log the link and return.
  if (!pass) {
    if (devLink) console.info(`[auth] email not configured — link for ${to}: ${devLink}`);
    return;
  }

  try {
    const nodemailer = await import("nodemailer");
    const transport = nodemailer.default.createTransport({
      service: "gmail",
      auth: { user: LEAGUE_EMAIL, pass },
    });
    await transport.sendMail({ from: `F1ISL <${LEAGUE_EMAIL}>`, to, subject, html, text });
  } catch (err) {
    // Never break the user flow on a mail failure — log and, in dev, the link.
    console.error("[auth] failed to send account email:", err);
    if (devLink) console.info(`[auth] link for ${to}: ${devLink}`);
  }
}

/** Branded (dark) verification email. Inline hex — email clients can't use CSS vars. */
export function verificationEmail(name: string, url: string): { subject: string; html: string; text: string } {
  const first = (name || "").trim().split(/\s+/)[0] || "there";
  const subject = "Verify your F1ISL account";
  const text =
    `Hi ${first},\n\nConfirm your email address to finish setting up your F1ISL account:\n${url}\n\n` +
    `This link expires in 24 hours. If you didn't create an account, you can ignore this email.`;
  const html = `<div style="background:#0f1113;color:#f3f1ec;font-family:Arial,Helvetica,sans-serif;padding:32px">
  <div style="max-width:480px;margin:0 auto">
    <div style="width:56px;height:2px;background:#c9a24b;margin-bottom:20px"></div>
    <h1 style="font-size:18px;letter-spacing:0.06em;text-transform:uppercase;margin:0 0 12px">Verify your email</h1>
    <p style="color:#cbc7bf;line-height:1.6;margin:0 0 20px">Hi ${first}, confirm your email address to finish setting up your F1ISL account.</p>
    <a href="${url}" style="display:inline-block;background:#c9a24b;color:#0f1113;text-decoration:none;font-weight:bold;text-transform:uppercase;letter-spacing:0.06em;padding:12px 22px;border-radius:2px">Verify email</a>
    <p style="color:#918c82;font-size:13px;line-height:1.6;margin:22px 0 0">This link expires in 24 hours. If you didn't create an account, you can ignore this email.</p>
  </div>
</div>`;
  return { subject, html, text };
}

/** Branded (dark) password-reset email. Inline hex — email clients can't use CSS vars. */
export function passwordResetEmail(name: string, url: string): { subject: string; html: string; text: string } {
  const first = (name || "").trim().split(/\s+/)[0] || "there";
  const subject = "Reset your F1ISL password";
  const text =
    `Hi ${first},\n\nWe received a request to reset your F1ISL password. Use the link below to choose a new one:\n${url}\n\n` +
    `This link expires in 1 hour and can only be used once. If you didn't request this, you can ignore this email — your password won't change.`;
  const html = `<div style="background:#0f1113;color:#f3f1ec;font-family:Arial,Helvetica,sans-serif;padding:32px">
  <div style="max-width:480px;margin:0 auto">
    <div style="width:56px;height:2px;background:#c9a24b;margin-bottom:20px"></div>
    <h1 style="font-size:18px;letter-spacing:0.06em;text-transform:uppercase;margin:0 0 12px">Reset your password</h1>
    <p style="color:#cbc7bf;line-height:1.6;margin:0 0 20px">Hi ${first}, we received a request to reset your F1ISL password. Choose a new one using the button below.</p>
    <a href="${url}" style="display:inline-block;background:#c9a24b;color:#0f1113;text-decoration:none;font-weight:bold;text-transform:uppercase;letter-spacing:0.06em;padding:12px 22px;border-radius:2px">Reset password</a>
    <p style="color:#918c82;font-size:13px;line-height:1.6;margin:22px 0 0">This link expires in 1 hour and can only be used once. If you didn't request this, you can ignore this email — your password won't change.</p>
  </div>
</div>`;
  return { subject, html, text };
}
