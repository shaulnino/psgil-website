/**
 * Account email: password-reset links (PW-2f). Email verification was removed
 * when public self-registration was dropped (accounts are admin-provisioned).
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

/** Branded (dark) password-reset email. Inline hex — email clients can't use CSS vars. */
export function passwordResetEmail(name: string, url: string): { subject: string; html: string; text: string } {
  const first = (name || "").trim().split(/\s+/)[0] || "there";
  const subject = "Reset your F1ISL password";
  const text =
    `Hi ${first},\n\nWe received a request to reset your F1ISL password. Use the link below to choose a new one:\n${url}\n\n` +
    `This link expires in 1 hour and can only be used once. If you didn't request this, you can ignore this email - your password won't change.`;
  const html = `<div style="background:#0f1113;color:#f3f1ec;font-family:Arial,Helvetica,sans-serif;padding:32px">
  <div style="max-width:480px;margin:0 auto">
    <div style="width:56px;height:2px;background:#c9a24b;margin-bottom:20px"></div>
    <h1 style="font-size:18px;letter-spacing:0.06em;text-transform:uppercase;margin:0 0 12px">Reset your password</h1>
    <p style="color:#cbc7bf;line-height:1.6;margin:0 0 20px">Hi ${first}, we received a request to reset your F1ISL password. Choose a new one using the button below.</p>
    <a href="${url}" style="display:inline-block;background:#c9a24b;color:#0f1113;text-decoration:none;font-weight:bold;text-transform:uppercase;letter-spacing:0.06em;padding:12px 22px;border-radius:2px">Reset password</a>
    <p style="color:#918c82;font-size:13px;line-height:1.6;margin:22px 0 0">This link expires in 1 hour and can only be used once. If you didn't request this, you can ignore this email - your password won't change.</p>
  </div>
</div>`;
  return { subject, html, text };
}

/**
 * Branded (dark, RTL Hebrew) welcome email for an admin-provisioned account.
 * States the login email + temporary password and links to the login page; the
 * user is forced to change the password on first sign-in. Inline hex — email
 * clients can't use CSS vars. Credentials render LTR inside the RTL shell.
 */
export function accountCreatedEmail(
  name: string,
  email: string,
  tempPassword: string,
  loginUrl: string,
): { subject: string; html: string; text: string } {
  const first = (name || "").trim().split(/\s+/)[0] || "";
  const hello = first ? `שלום ${first},` : "שלום,";
  const subject = "החשבון שלך ב-ISL נוצר";
  const text =
    `${hello}\n\nנוצר עבורך חשבון באתר ISL. זהו אימייל אוטומטי עם פרטי הכניסה שלך.\n\n` +
    `אימייל לכניסה: ${email}\nסיסמה זמנית: ${tempPassword}\n\n` +
    `כניסה לחשבון: ${loginUrl}\n\n` +
    `בכניסה הראשונה תתבקש להחליף את הסיסמה הזמנית בסיסמה אישית שרק אתם מכירים.`;
  const html = `<div dir="rtl" style="background:#0f1113;color:#f3f1ec;font-family:Arial,Helvetica,sans-serif;padding:32px;text-align:right">
  <div style="max-width:480px;margin:0 auto">
    <div style="width:56px;height:2px;background:#c9a24b;margin-bottom:20px"></div>
    <h1 style="font-size:18px;letter-spacing:0.02em;margin:0 0 12px">החשבון שלך ב-ISL נוצר</h1>
    <p style="color:#cbc7bf;line-height:1.7;margin:0 0 20px">${hello} נוצר עבורך חשבון באתר ISL. זהו אימייל אוטומטי עם פרטי הכניסה שלך.</p>
    <div style="background:#171a1e;border:1px solid rgba(240,236,228,0.15);border-radius:2px;padding:16px;margin:0 0 20px">
      <p style="color:#918c82;font-size:12px;margin:0 0 4px">אימייל לכניסה</p>
      <p dir="ltr" style="color:#f3f1ec;font-size:15px;font-weight:bold;margin:0 0 14px;text-align:left">${email}</p>
      <p style="color:#918c82;font-size:12px;margin:0 0 4px">סיסמה זמנית</p>
      <p dir="ltr" style="color:#d8b45f;font-size:18px;font-weight:bold;letter-spacing:0.1em;margin:0;text-align:left">${tempPassword}</p>
    </div>
    <a href="${loginUrl}" style="display:inline-block;background:#c9a24b;color:#0f1113;text-decoration:none;font-weight:bold;padding:12px 22px;border-radius:2px">כניסה לחשבון</a>
    <p style="color:#918c82;font-size:13px;line-height:1.7;margin:22px 0 0">בכניסה הראשונה תתבקש להחליף את הסיסמה הזמנית בסיסמה אישית שרק אתם מכירים.</p>
  </div>
</div>`;
  return { subject, html, text };
}
