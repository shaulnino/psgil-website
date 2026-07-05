import { NextRequest, NextResponse } from "next/server";
import nodemailer from "nodemailer";
import {
  C,
  ctaButton,
  emailShell,
  escapeHtml,
  FONT_BODY,
  FONT_MONO,
  heading,
  infoCard,
  paragraph,
} from "@/lib/email/theme";

// ISL league email — also the nodemailer SMTP auth account (from/to for all contact-form mail).
// NOTE: GMAIL_APP_PASSWORD must be an App Password generated for THIS exact Gmail account, or sending fails.
const LEAGUE_EMAIL = "f1racingisl@gmail.com";

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
        { error: "rate-limited" },
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
        { error: "missing-name-email" },
        { status: 400 },
      );
    }

    if (!isSignup && !message?.trim()) {
      return NextResponse.json(
        { error: "missing-message" },
        { status: 400 },
      );
    }

    if (isSignup && (!birthdate?.trim() || !platform?.trim() || !experience?.trim())) {
      return NextResponse.json(
        { error: "missing-signup-fields" },
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
        { error: "email-not-configured" },
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
      { error: "send-failed" },
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
    "In the meantime, check out our latest standings and schedule at f1isl.com.",
    "",
    "See you on track!",
    "— The ISL Team",
  ].join("\n");
}

function autoReplySignupHtml(name: string): string {
  return emailShell({
    headerLabel: "Sign-Up",
    preheader: "Thanks for signing up for ISL — we've got your details.",
    bodyHtml: `
    ${heading("Welcome to ISL 🏁", "Registration Received")}
    ${paragraph(`Hi ${escapeHtml(name)},`)}
    ${paragraph("Thanks for signing up — we&rsquo;ve got your details. We&rsquo;ll reach out to you by email before the next season starts or when a seat opens up.")}
    ${paragraph("In the meantime, check out our latest standings and schedule:")}
    ${ctaButton("Visit f1isl.com", "https://f1isl.com", "primary")}
    <p style="margin:24px 0 0;font-family:${FONT_BODY};font-size:14px;color:${C.ink2};line-height:1.6">
      See you on track!<br>
      <span style="color:${C.meta}">— The ISL Team</span>
    </p>`,
  });
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
    `If your matter is urgent you can also email us directly at ${LEAGUE_EMAIL}.`,
    "",
    "— The ISL Team",
  ].join("\n");
}

function autoReplyQuestionHtml(name: string): string {
  return emailShell({
    headerLabel: "Contact",
    preheader: "We received your message and will reply as soon as possible.",
    bodyHtml: `
    ${heading("Message received ✅", "Contact Form")}
    ${paragraph(`Hi ${escapeHtml(name)},`)}
    ${paragraph("Thanks for reaching out! We received your message and will reply to you by email as soon as possible.")}
    ${paragraph(`If your matter is urgent you can also email us directly at <a href="mailto:${LEAGUE_EMAIL}" style="color:${C.gold};text-decoration:none">${LEAGUE_EMAIL}</a>.`)}
    <p style="margin:24px 0 0;font-family:${FONT_BODY};font-size:14px;color:${C.ink2};line-height:1.6">
      <span style="color:${C.meta}">— The ISL Team</span>
    </p>`,
  });
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
  const platformColor =
    platform === "PC" ? C.gold : platform === "PS5" ? C.info : C.success;
  const platformBadge = platform
    ? `<span style="display:inline-block;font-family:${FONT_MONO};font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:${platformColor};border:1px solid ${platformColor};border-radius:2px;padding:3px 9px">${escapeHtml(platform)}</span>`
    : "—";

  return emailShell({
    headerLabel: "Sign-Up",
    preheader: `New sign-up interest from ${name}`,
    bodyHtml: `
    ${heading("New Sign-Up Interest 🏁", "Someone wants to join ISL")}
    ${infoCard({
      rows: [
        ["Name", escapeHtml(name)],
        ["Email", `<a href="mailto:${escapeHtml(email)}" style="color:${C.gold};text-decoration:none">${escapeHtml(email)}</a>`],
        ["Date of Birth", birthdate ? escapeHtml(birthdate) : "—"],
        ["Platform", platformBadge],
        ["Experience", experience ? escapeHtml(experience) : "—"],
      ],
    })}`,
  });
}

function adminQuestionHtml(
  name: string,
  email: string,
  subject: string | undefined,
  message: string,
): string {
  const rows: Array<[string, string]> = [
    ["Name", escapeHtml(name)],
    ["Email", `<a href="mailto:${escapeHtml(email)}" style="color:${C.gold};text-decoration:none">${escapeHtml(email)}</a>`],
  ];
  if (subject?.trim()) rows.push(["Subject", escapeHtml(subject)]);

  return emailShell({
    headerLabel: "Contact",
    preheader: `New message from ${name}`,
    bodyHtml: `
    ${heading("New Contact Submission", "Contact Form")}
    ${infoCard({ rows })}
    <p style="margin:0 0 8px;font-family:${FONT_MONO};font-size:10px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:${C.gold}">Message</p>
    <div style="padding:16px;background:${C.surfaceAlt};border:1px solid ${C.hairline};border-radius:3px;font-family:${FONT_BODY};font-size:14px;color:${C.ink2};line-height:1.6;white-space:pre-wrap">${escapeHtml(message)}</div>`,
  });
}
