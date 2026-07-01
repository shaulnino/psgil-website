import { NextRequest, NextResponse } from "next/server";
import nodemailer from "nodemailer";

const LEAGUE_EMAIL = "psgileague@gmail.com";

// ---------------------------------------------------------------------------
// Simple in-memory rate limiter (per serverless cold-start window)
// ---------------------------------------------------------------------------
const recentSubmissions = new Map<string, number[]>();
const RATE_WINDOW_MS = 60_000;
const RATE_MAX = 5;

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const timestamps = (recentSubmissions.get(ip) ?? []).filter(
    (t) => now - t < RATE_WINDOW_MS,
  );
  if (timestamps.length >= RATE_MAX) return true;
  timestamps.push(now);
  recentSubmissions.set(ip, timestamps);
  return false;
}

// ---------------------------------------------------------------------------
// POST handler
// ---------------------------------------------------------------------------
export async function POST(req: NextRequest) {
  try {
    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
    if (isRateLimited(ip)) {
      return NextResponse.json(
        { error: "Too many requests. Please try again in a minute." },
        { status: 429 },
      );
    }

    const body = await req.json();
    const { type, name, email, subject, message, _hp, birthdate, platform, experience } = body as {
      type?: "signup" | "question";
      name: string;
      email: string;
      subject?: string;
      message?: string;
      _hp?: string;
      birthdate?: string;
      platform?: string;
      experience?: string;
    };

    // Honeypot — if the hidden field has a value it's a bot
    if (_hp) {
      // Return 200 so bots think it worked
      return NextResponse.json({ ok: true });
    }

    const isSignup = type === "signup";

    if (!name?.trim() || !email?.trim()) {
      return NextResponse.json(
        { error: "Name and email are required." },
        { status: 400 },
      );
    }

    if (!isSignup && !message?.trim()) {
      return NextResponse.json(
        { error: "Message is required." },
        { status: 400 },
      );
    }

    if (isSignup && (!birthdate?.trim() || !platform?.trim() || !experience?.trim())) {
      return NextResponse.json(
        { error: "Birth date, platform, and experience are required." },
        { status: 400 },
      );
    }

    const safeName = sanitiseHeader(name);
    const safeEmail = sanitiseHeader(email);
    const safeSubject = sanitiseHeader(subject ?? "");

    const appPassword = process.env.GMAIL_APP_PASSWORD;
    if (!appPassword) {
      console.error("GMAIL_APP_PASSWORD is not set");
      return NextResponse.json(
        { error: "Email service is not configured." },
        { status: 500 },
      );
    }

    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: { user: LEAGUE_EMAIL, pass: appPassword },
    });

    // ------ Admin notification ------
    if (isSignup) {
      await transporter.sendMail({
        from: `"ISL Website" <${LEAGUE_EMAIL}>`,
        replyTo: `"${safeName}" <${safeEmail}>`,
        to: LEAGUE_EMAIL,
        subject: `[ISL Sign-Up] ${safeName}`,
        text: [
          `New sign-up interest:`,
          `Name: ${name}`,
          `Email: ${email}`,
          `Date of Birth: ${birthdate ?? "—"}`,
          `Platform: ${platform ?? "—"}`,
          `Experience: ${experience ?? "—"}`,
        ].join("\n"),
        html: adminSignupHtml(name, email, birthdate, platform, experience),
      });
    } else {
      await transporter.sendMail({
        from: `"ISL Contact Form" <${LEAGUE_EMAIL}>`,
        replyTo: `"${safeName}" <${safeEmail}>`,
        to: LEAGUE_EMAIL,
        subject: safeSubject.trim()
          ? `[ISL Contact] ${safeSubject.trim()}`
          : `[ISL Contact] Message from ${safeName}`,
        text: [
          `Name: ${name}`,
          `Email: ${email}`,
          subject?.trim() ? `Subject: ${subject}` : "",
          "",
          "Message:",
          message,
        ]
          .filter(Boolean)
          .join("\n"),
        html: adminQuestionHtml(name, email, subject, message!),
      });
    }

    // ------ Auto-reply to user ------
    try {
      await transporter.sendMail(
        isSignup
          ? {
              from: `"ISL" <${LEAGUE_EMAIL}>`,
              to: `"${safeName}" <${safeEmail}>`,
              subject: "ISL — Sign up received 🏁",
              text: autoReplySignupText(name),
              html: autoReplySignupHtml(name),
            }
          : {
              from: `"ISL" <${LEAGUE_EMAIL}>`,
              to: `"${safeName}" <${safeEmail}>`,
              subject: "ISL — We got your message ✅",
              text: autoReplyQuestionText(name),
              html: autoReplyQuestionHtml(name),
            },
      );
    } catch (replyErr) {
      // Auto-reply failure should not break the user experience
      console.error("Auto-reply failed:", replyErr);
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Contact form error:", err);
    return NextResponse.json(
      { error: "Failed to send message. Please try again." },
      { status: 500 },
    );
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function sanitiseHeader(str: string): string {
  return str.replace(/[\r\n\0]/g, "").trim();
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// ---------------------------------------------------------------------------
// Shared email wrapper
// ---------------------------------------------------------------------------
function emailShell(content: string): string {
  return `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0e0e12;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0e0e12;padding:40px 16px">
    <tr><td align="center">
      <table width="100%" style="max-width:520px;background:#18181f;border-radius:16px;border:1px solid rgba(255,255,255,0.08);overflow:hidden">
        <!-- Purple top bar -->
        <tr><td style="height:4px;background:linear-gradient(90deg,#7020B0,#D4AF37)"></td></tr>
        <tr><td style="padding:32px 28px 28px">
          ${content}
        </td></tr>
        <!-- Footer -->
        <tr><td style="padding:0 28px 24px">
          <table width="100%" style="border-top:1px solid rgba(255,255,255,0.06);padding-top:16px">
            <tr><td style="font-size:11px;color:rgba(255,255,255,0.3);line-height:1.5">
              ISL — F1 Israeli Super League<br>
              <a href="https://psgil.com" style="color:#7020B0;text-decoration:none">psgil.com</a>
            </td></tr>
          </table>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`.trim();
}

// ---------------------------------------------------------------------------
// Auto-reply: Sign-up
// ---------------------------------------------------------------------------
function autoReplySignupText(name: string): string {
  return [
    `Hi ${name},`,
    "",
    "Thanks for signing up for ISL! We've got your details.",
    "",
    "We'll reach out to you by email before the next season starts or when a seat opens up.",
    "",
    "In the meantime, check out our latest standings and schedule at psgil.com.",
    "",
    "See you on track!",
    "— The ISL Team",
  ].join("\n");
}

function autoReplySignupHtml(name: string): string {
  return emailShell(`
    <h1 style="margin:0 0 8px;font-size:22px;color:#fff">Welcome to ISL! 🏁</h1>
    <p style="margin:0 0 20px;font-size:14px;color:rgba(255,255,255,0.6);line-height:1.6">
      Hi ${escapeHtml(name)},
    </p>
    <p style="margin:0 0 16px;font-size:14px;color:rgba(255,255,255,0.6);line-height:1.6">
      Thanks for signing up — we&rsquo;ve got your details. We&rsquo;ll reach out to you by email before the next season starts or when a seat opens up.
    </p>
    <p style="margin:0 0 24px;font-size:14px;color:rgba(255,255,255,0.6);line-height:1.6">
      In the meantime, check out our latest standings and schedule:
    </p>
    <table cellpadding="0" cellspacing="0"><tr><td style="background:#7020B0;border-radius:24px;padding:10px 28px">
      <a href="https://psgil.com" style="color:#fff;text-decoration:none;font-size:14px;font-weight:600">Visit psgil.com</a>
    </td></tr></table>
    <p style="margin:24px 0 0;font-size:14px;color:rgba(255,255,255,0.6);line-height:1.6">
      See you on track!<br>
      <span style="color:rgba(255,255,255,0.35)">— The ISL Team</span>
    </p>
  `);
}

// ---------------------------------------------------------------------------
// Auto-reply: Question
// ---------------------------------------------------------------------------
function autoReplyQuestionText(name: string): string {
  return [
    `Hi ${name},`,
    "",
    "Thanks for reaching out! We received your message and will reply to you by email as soon as possible.",
    "",
    "If your matter is urgent you can also email us directly at psgileague@gmail.com.",
    "",
    "— The ISL Team",
  ].join("\n");
}

function autoReplyQuestionHtml(name: string): string {
  return emailShell(`
    <h1 style="margin:0 0 8px;font-size:22px;color:#fff">Message received &#x2705;</h1>
    <p style="margin:0 0 20px;font-size:14px;color:rgba(255,255,255,0.6);line-height:1.6">
      Hi ${escapeHtml(name)},
    </p>
    <p style="margin:0 0 16px;font-size:14px;color:rgba(255,255,255,0.6);line-height:1.6">
      Thanks for reaching out! We received your message and will reply to you by email as soon as possible.
    </p>
    <p style="margin:0 0 0;font-size:14px;color:rgba(255,255,255,0.6);line-height:1.6">
      If your matter is urgent you can also email us directly at
      <a href="mailto:psgileague@gmail.com" style="color:#7020B0;text-decoration:none">psgileague@gmail.com</a>.
    </p>
    <p style="margin:24px 0 0;font-size:14px;color:rgba(255,255,255,0.6);line-height:1.6">
      <span style="color:rgba(255,255,255,0.35)">— The ISL Team</span>
    </p>
  `);
}

// ---------------------------------------------------------------------------
// Admin notification templates
// ---------------------------------------------------------------------------
function adminSignupHtml(
  name: string,
  email: string,
  birthdate?: string,
  platform?: string,
  experience?: string,
): string {
  const row = (label: string, value: string) =>
    `<tr style="border-bottom:1px solid rgba(255,255,255,0.06)">
      <td style="padding:10px 14px;font-size:12px;font-weight:600;color:rgba(255,255,255,0.4);text-transform:uppercase;letter-spacing:.05em;white-space:nowrap;width:130px">${label}</td>
      <td style="padding:10px 14px;font-size:14px;color:#fff">${value}</td>
    </tr>`;

  const platformBadge = platform
    ? `<span style="display:inline-block;padding:2px 10px;border-radius:99px;font-size:12px;font-weight:700;background:${platform === "PC" ? "#1a3a5c" : platform === "PS5" ? "#00439c" : "#107c10"};color:#fff">${escapeHtml(platform)}</span>`
    : "—";

  return emailShell(`
    <h1 style="margin:0 0 4px;font-size:20px;color:#fff">New Sign-Up Interest 🏁</h1>
    <p style="margin:0 0 20px;font-size:12px;color:rgba(255,255,255,0.35)">Someone wants to join ISL</p>
    <table style="border-collapse:collapse;width:100%;background:rgba(255,255,255,0.03);border-radius:10px;overflow:hidden;border:1px solid rgba(255,255,255,0.08)">
      ${row("Name", escapeHtml(name))}
      ${row("Email", `<a href="mailto:${escapeHtml(email)}" style="color:#7020B0;text-decoration:none">${escapeHtml(email)}</a>`)}
      ${row("Date of Birth", birthdate ? escapeHtml(birthdate) : "—")}
      ${row("Platform", platformBadge)}
      ${row("Experience", experience ? escapeHtml(experience) : "—")}
    </table>
  `);
}

function adminQuestionHtml(
  name: string,
  email: string,
  subject: string | undefined,
  message: string,
): string {
  return `
    <div style="font-family:sans-serif;max-width:600px">
      <h2 style="color:#7020B0;margin-bottom:16px">New Contact Form Submission</h2>
      <table style="border-collapse:collapse;width:100%">
        <tr><td style="padding:8px 12px;font-weight:bold;color:#555;width:80px">Name</td><td style="padding:8px 12px">${escapeHtml(name)}</td></tr>
        <tr><td style="padding:8px 12px;font-weight:bold;color:#555">Email</td><td style="padding:8px 12px"><a href="mailto:${escapeHtml(email)}">${escapeHtml(email)}</a></td></tr>
        ${subject?.trim() ? `<tr><td style="padding:8px 12px;font-weight:bold;color:#555">Subject</td><td style="padding:8px 12px">${escapeHtml(subject)}</td></tr>` : ""}
      </table>
      <div style="margin-top:16px;padding:16px;background:#f5f5f5;border-radius:8px;white-space:pre-wrap">${escapeHtml(message)}</div>
    </div>`;
}
