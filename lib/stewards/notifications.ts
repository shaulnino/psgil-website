import nodemailer from "nodemailer";
import type { Appeal, AppealVerdict, PenaltyToServe, StewardCase, StewardUser, Verdict } from "@/lib/stewards/types";
import {
  C,
  calloutCard,
  ctaButton,
  emailShell,
  escapeHtml,
  heading,
  infoCard,
  noteText,
  paragraph,
  statusBadge,
} from "@/lib/email/theme";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------
// ISL league email — also the nodemailer SMTP auth account + "from" for all steward notifications.
// NOTE: GMAIL_APP_PASSWORD must be an App Password generated for THIS exact Gmail account, or sending fails.
const LEAGUE_EMAIL = "f1racingisl@gmail.com";
// Falls back to f1isl.com; NEXT_PUBLIC_SITE_URL overrides it in Netlify.
const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://f1isl.com").replace(/\/$/, "");

const esc = escapeHtml;

/** Strip simple tags/entities from steward email HTML fragments for plain-text fallback */
function htmlToPlainText(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|tr)>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

const transporter = () => {
  const pass = process.env.GMAIL_APP_PASSWORD;
  if (!pass) return null;
  return nodemailer.createTransport({ service: "gmail", auth: { user: LEAGUE_EMAIL, pass } });
};

const dedupe = (arr: string[]) => [...new Set(arr.filter(Boolean))];

async function send(subject: string, html: string, text: string, recipients: string[]) {
  const t = transporter();
  if (!t || recipients.length === 0) return;
  try {
    await t.sendMail({
      from: `"ISL Steward System" <${LEAGUE_EMAIL}>`,
      to: dedupe(recipients).join(", "),
      subject,
      html,
      text,
    });
  } catch (err) {
    console.error("[steward-notify] failed to send:", subject, err);
  }
}

// ---------------------------------------------------------------------------
// URL helpers
// ---------------------------------------------------------------------------
function caseUrl(caseId: string, view: "driver" | "steward") {
  return `${SITE_URL}/stewards/cases/${caseId}?view=${view}`;
}

// ---------------------------------------------------------------------------
// Status → badge tone (broadcast palette)
// ---------------------------------------------------------------------------
const STATUS_TONE: Record<
  string,
  "gold" | "success" | "warning" | "info" | "danger" | "muted"
> = {
  "Open": "warning",
  "Waiting for Response": "info",
  "Under Review": "gold",
  "Verdict Ready": "gold",
  "Closed": "success",
  "Archived": "muted",
  "Appeal Submitted": "info",
  "Decision Changed": "gold",
  "Original Decision Upheld": "success",
};

/** Map the legacy per-CTA hex overrides onto the dark-theme button variants. */
function ctaVariant(color?: string): "primary" | "success" | "neutral" {
  if (color === "#3f6b3a") return "success"; // upheld / positive outcome
  if (color === "#3a322a") return "neutral"; // informational, low emphasis
  return "primary"; // gold — default / action-required
}

type CaseSummaryFields = {
  caseNumber?: number | null;
  title: string;
  season: string;
  round: string;
  weekendSession: string;
  incidentLap?: number | null;
  complainantName: string;
  involvedNames: string[];
  status: string;
};

function caseSummaryCard(c: CaseSummaryFields) {
  const sessionVal = esc(c.weekendSession) + (c.incidentLap ? ` &middot; Lap ${c.incidentLap}` : "");
  return infoCard({
    label: c.caseNumber ? `Case #${c.caseNumber}` : "Case",
    title: c.title,
    rows: [
      ["Season / Round", `${esc(c.season)} &middot; ${esc(c.round)}`],
      ["Session", sessionVal],
      ["Complainant", esc(c.complainantName)],
      ["Involved drivers", esc(c.involvedNames.join(", ") || "—")],
      ["Status", statusBadge(c.status, STATUS_TONE[c.status] ?? "gold")],
    ],
  });
}

// ---------------------------------------------------------------------------
// Master email shell
// ---------------------------------------------------------------------------
type EmailParams = {
  eyebrow?: string;
  title: string;
  intro: string;
  /** If set, used for HTML intro paragraph; `intro` remains the plain-text source */
  introHtml?: string;
  summary?: CaseSummaryFields;
  action?: string | { title: string; body: string };
  cta: { label: string; url: string; color?: string };
  note?: string;
  /** Raw HTML injected after the summary card (use for custom content blocks) */
  customHtml?: string;
};

function buildEmail(p: EmailParams): { html: string; text: string } {
  const summaryHtml = p.summary ? caseSummaryCard(p.summary) : "";
  const actionHtml =
    typeof p.action === "object" && p.action
      ? calloutCard({
          label: "⚑ Action Required",
          bodyHtml: `<strong style="color:${C.ink}">${esc(p.action.title)}</strong><br>${p.action.body}`,
        })
      : typeof p.action === "string" && p.action
        ? calloutCard({ label: "⚑ Action Required", bodyHtml: esc(p.action) })
        : "";
  const extraHtml = p.customHtml ?? "";
  const noteHtml = p.note ? noteText(p.note) : "";

  const body = `
      ${heading(p.title, p.eyebrow)}
      ${paragraph(p.introHtml ?? esc(p.intro))}
      ${summaryHtml}
      ${actionHtml}
      ${extraHtml}
      ${ctaButton(p.cta.label, p.cta.url, ctaVariant(p.cta.color))}
      ${noteHtml}`;

  const html = emailShell({
    headerLabel: "Steward System",
    bodyHtml: body,
    preheader: p.intro,
    footerNote: "Automated message from the Steward System — please do not reply.",
  });

  // Plain-text fallback
  const textLines = [
    p.title,
    "─".repeat(48),
    p.intro,
    "",
    ...(p.summary
      ? [
          `Case: ${p.summary.title}`,
          `Season / Round: ${p.summary.season} · ${p.summary.round}`,
          `Session: ${p.summary.weekendSession}${p.summary.incidentLap ? ` · Lap ${p.summary.incidentLap}` : ""}`,
          `Complainant: ${p.summary.complainantName}`,
          `Involved: ${p.summary.involvedNames.join(", ") || "—"}`,
          `Status: ${p.summary.status}`,
          "",
        ]
      : []),
    ...(p.action
      ? typeof p.action === "object"
        ? [`ACTION REQUIRED: ${p.action.title}`, htmlToPlainText(p.action.body), ""]
        : [`ACTION REQUIRED: ${p.action}`, ""]
      : []),
    `${p.cta.label}: ${p.cta.url}`,
    ...(p.note ? ["", p.note] : []),
    "",
    "— ISL Steward System · f1isl.com",
  ];

  return { html, text: textLines.join("\n") };
}

// ---------------------------------------------------------------------------
// Data helpers
// ---------------------------------------------------------------------------
function toSummary(caseItem: StewardCase, users: StewardUser[]): CaseSummaryFields {
  return {
    caseNumber:     caseItem.caseNumber,
    title:          caseItem.title,
    season:         caseItem.season,
    round:          caseItem.round,
    weekendSession: caseItem.weekendSession,
    incidentLap:    caseItem.incidentLapNumber,
    complainantName: users.find((u) => u.id === caseItem.complainantId)?.name ?? "Unknown",
    involvedNames:  users.filter((u) => caseItem.involvedDriverIds.includes(u.id)).map((u) => u.name),
    status:         caseItem.status,
  };
}

const stewards    = (users: StewardUser[]) => users.filter((u) => u.isActive && u.roles.includes("steward"));
const adminsOnly  = (users: StewardUser[]) => users.filter((u) => u.isActive && u.roles.includes("admin") && !u.roles.includes("steward"));
const complainant = (caseItem: StewardCase, users: StewardUser[]) => users.find((u) => u.id === caseItem.complainantId);
const involved    = (caseItem: StewardCase, users: StewardUser[]) => users.filter((u) => caseItem.involvedDriverIds.includes(u.id));

// ---------------------------------------------------------------------------
// Public notification functions
// ---------------------------------------------------------------------------

/** Trigger 1 — case submitted */
export async function notifyCaseSubmitted(caseItem: StewardCase, users: StewardUser[]) {
  const summary = toSummary(caseItem, users);

  // Admins — informational only
  const adminRecipients = adminsOnly(users).map((u) => u.email);
  if (adminRecipients.length > 0) {
    const { html, text } = buildEmail({
      eyebrow: "Case Submitted",
      title: "New steward case submitted",
      intro: "A new case has been submitted and is now in the steward workflow. No action is required from you — this is for your information only.",
      summary,
      cta: { label: "View Case", url: caseUrl(caseItem.id, "steward"), color: "#3a322a" },
    });
    await send(`[ISL Stewards] New case: ${caseItem.title}`, html, text, adminRecipients);
  }

  // Stewards — review required
  const stewardRecipients = stewards(users).map((u) => u.email);
  if (stewardRecipients.length > 0) {
    const { html, text } = buildEmail({
      eyebrow: "New Case",
      title: "A new case has entered the steward queue",
      intro: "A complaint has been submitted and assigned to the steward panel. Review the case and monitor for incoming driver responses.",
      summary,
      cta: { label: "Review Case", url: caseUrl(caseItem.id, "steward"), color: "#7e2a1e" },
    });
    await send(`[ISL Stewards] New case submitted — ${caseItem.title}`, html, text, stewardRecipients);
  }

  // Complainant — confirmation
  const comp = complainant(caseItem, users);
  if (comp) {
    const { html, text } = buildEmail({
      eyebrow: "Complaint Submitted",
      title: "Your complaint has been submitted",
      intro: "Your complaint has been received and is now in the ISL steward review system. The stewards will begin their review once all involved drivers have submitted their responses.",
      summary,
      cta: { label: "View Case", url: caseUrl(caseItem.id, "driver") },
      note: "You will receive an email when steward review begins and when a verdict is published.",
    });
    await send(`[ISL Stewards] Case submitted — ${caseItem.title}`, html, text, [comp.email]);
  }

  // Involved drivers — response required (never the complainant: their side is
  // the complaint itself, even if they also listed themselves as involved)
  for (const driver of involved(caseItem, users)) {
    if (driver.id === caseItem.complainantId) continue;
    const { html, text } = buildEmail({
      eyebrow: "Action Required",
      title: "You have been named in a steward case",
      intro: `You have been named as an involved party in a ISL steward case. You are required to submit your statement through the case page as soon as possible.`,
      summary,
      action: "Log in to the ISL Steward System and submit your statement. Statements are final once submitted and cannot be edited.",
      cta: { label: "Submit Response", url: caseUrl(caseItem.id, "driver"), color: "#7e2a1e" },
      note: "Failure to respond does not prevent the stewards from issuing a verdict.",
    });
    await send(`[ISL Stewards] Response required — ${caseItem.title}`, html, text, [driver.email]);
  }
}

/** Trigger 2 — all required responses submitted */
export async function notifyAllResponsesSubmitted(caseItem: StewardCase, users: StewardUser[]) {
  const summary = toSummary(caseItem, users);

  // Stewards — start review
  const stewardRecipients = stewards(users).map((u) => u.email);
  if (stewardRecipients.length > 0) {
    const { html, text } = buildEmail({
      eyebrow: "Ready for Review",
      title: "All responses received — case is ready for review",
      intro: "Every required driver statement has been submitted. The case is now ready for steward deliberation and a verdict can be prepared.",
      summary,
      action: "Review all statements and prepare the verdict through the case management interface.",
      cta: { label: "Start Review", url: caseUrl(caseItem.id, "steward"), color: "#7e2a1e" },
    });
    await send(`[ISL Stewards] Case ready for review — ${caseItem.title}`, html, text, stewardRecipients);
  }

  // Complainant — review started
  const comp = complainant(caseItem, users);
  if (comp) {
    const { html, text } = buildEmail({
      eyebrow: "Case Update",
      title: "Steward review has begun",
      intro: "All driver statements have been submitted. The ISL stewards have started their review — you will receive another notification when a verdict is published.",
      summary,
      cta: { label: "View Case", url: caseUrl(caseItem.id, "driver") },
    });
    await send(`[ISL Stewards] Review started — ${caseItem.title}`, html, text, [comp.email]);
  }
}

/** Trigger 3 — response submitted (confirmation to responding driver only) */
export async function notifyResponseConfirmation(caseItem: StewardCase, driver: StewardUser, users: StewardUser[]) {
  const summary = toSummary(caseItem, users);
  const { html, text } = buildEmail({
    eyebrow: "Response Received",
    title: "Your statement has been submitted",
    intro: "Your response has been received and recorded by the ISL Steward System. The stewards will review all statements before issuing a verdict.",
    summary,
    cta: { label: "View Case", url: caseUrl(caseItem.id, "driver") },
    note: "Statements are final and cannot be modified once submitted.",
  });
  await send(`[ISL Stewards] Response recorded — ${caseItem.title}`, html, text, [driver.email]);
}

/** Trigger 4 — internal discussion comment posted */
export async function notifyInternalDiscussion(caseItem: StewardCase, authorName: string, users: StewardUser[]) {
  const summary = toSummary(caseItem, users);
  const stewardRecipients = stewards(users).map((u) => u.email);
  if (stewardRecipients.length === 0) return;
  const { html, text } = buildEmail({
    eyebrow: "Internal Discussion",
    title: "New comment in steward discussion",
    intro: `${authorName} posted a new comment in the internal steward discussion for this case.`,
    summary,
    cta: { label: "View Discussion", url: caseUrl(caseItem.id, "steward"), color: "#7e2a1e" },
  });
  await send(`[ISL Stewards] Discussion update — ${caseItem.title}`, html, text, stewardRecipients);
}

/** Trigger 5 — verdict published */
export async function notifyVerdictPublished(caseItem: StewardCase, verdict: Verdict, users: StewardUser[]) {
  const summary = { ...toSummary(caseItem, users), status: "Closed" };
  const decisionLine = verdict.verdict_summary ? `Decision: ${verdict.verdict_summary}` : undefined;

  // Stewards — record update
  const stewardRecipients = stewards(users).map((u) => u.email);
  if (stewardRecipients.length > 0) {
    const { html, text } = buildEmail({
      eyebrow: "Verdict Published",
      title: "A verdict has been published",
      intro: "The following case has been closed with a published verdict.",
      summary,
      cta: { label: "View Published Case", url: caseUrl(caseItem.id, "steward") },
      note: decisionLine,
    });
    await send(`[ISL Stewards] Verdict published — ${caseItem.title}`, html, text, stewardRecipients);
  }

  // Complainant
  const comp = complainant(caseItem, users);
  if (comp) {
    const { html, text } = buildEmail({
      eyebrow: "Verdict Published",
      title: "A verdict has been issued for your case",
      intro: "The ISL stewards have reached a decision on the following case. The full verdict is now available for review.",
      summary,
      cta: { label: "View Verdict", url: caseUrl(caseItem.id, "driver") },
    });
    await send(`[ISL Stewards] Verdict issued — ${caseItem.title}`, html, text, [comp.email]);
  }

  // Each involved driver
  for (const driver of involved(caseItem, users)) {
    const { html, text } = buildEmail({
      eyebrow: "Verdict Published",
      title: "A verdict has been issued for a case involving you",
      intro: "The ISL stewards have reached a final decision on a case you were named in. The full verdict is now available.",
      summary,
      cta: { label: "View Verdict", url: caseUrl(caseItem.id, "driver") },
    });
    await send(`[ISL Stewards] Verdict issued — ${caseItem.title}`, html, text, [driver.email]);
  }
}

/* ------------------------------------------------------------------ */
/*  Penalties to Serve notifications                                    */
/* ------------------------------------------------------------------ */

const penaltiesUrl = () => `${SITE_URL}/stewards/penalties-to-serve`;

function penaltySummaryBlock(p: PenaltyToServe): string {
  const rows: Array<[string, string]> = [
    ["Penalty", esc(p.penaltyLabel)],
    ["Assigned race", esc(p.assignedRaceLabel ?? "To be confirmed")],
    ["Status", esc(p.status.replace(/_/g, " "))],
    ...(p.penaltyDescription ? ([["Details", esc(p.penaltyDescription)]] as Array<[string, string]>) : []),
  ];
  return infoCard({ label: "Penalty", rows });
}

/** Notify driver when a new penalty-to-serve is first assigned */
export async function notifyPenaltyAssigned(penalty: PenaltyToServe, driver: StewardUser) {
  const { html, text } = buildEmail({
    eyebrow: "Disciplinary Notice",
    title: "You have a penalty to serve",
    intro: `A disciplinary penalty has been assigned to you and must be served in an upcoming ISL Main League race.`,
    action: {
      title: "Action Required",
      body: `You are required to serve a <strong>${esc(penalty.penaltyLabel)}</strong> in <strong>${esc(penalty.assignedRaceLabel ?? "the next Main League race")}</strong>. Please ensure you are available for that race.`,
    },
    customHtml: penaltySummaryBlock(penalty),
    cta: { label: "View Penalty Details", url: penaltiesUrl() },
    note: "If you believe this penalty was issued in error, contact the ISL stewards.",
  });
  await send(
    `[ISL Stewards] Penalty to serve — ${penalty.penaltyLabel}`,
    html,
    text,
    [driver.email],
  );
}

/** 48-hour race reminder — sent automatically before the assigned race */
export async function notifyPenaltyReminder(penalty: PenaltyToServe, driver: StewardUser) {
  const raceLabel = penalty.assignedRaceLabel ?? "the next Main League race";
  const { html, text } = buildEmail({
    eyebrow: "Race Reminder",
    title: "Reminder: you have a penalty to serve tomorrow",
    intro: `This is an automated reminder that you have an active penalty assigned to ${raceLabel}, which starts in approximately 48 hours.`,
    introHtml: `This is an automated reminder that you have an active penalty assigned to <strong>${esc(raceLabel)}</strong>, which starts in approximately 48 hours.`,
    action: {
      title: "Action Required",
      body: `You must serve your <strong>${esc(penalty.penaltyLabel)}</strong> in <strong>${esc(penalty.assignedRaceLabel ?? "the upcoming race")}</strong>. Make sure you are available and prepared to fulfil this penalty.`,
    },
    customHtml: penaltySummaryBlock(penalty),
    cta: { label: "View Penalty Details", url: penaltiesUrl() },
    note: "If you are unable to serve this penalty, contact the ISL stewards as soon as possible.",
  });
  await send(
    `[ISL Stewards] Reminder: penalty to serve — ${penalty.penaltyLabel}`,
    html,
    text,
    [driver.email],
  );
}

/** Notify driver when their penalty is rolled forward to the next race */
export async function notifyPenaltyRolledForward(penalty: PenaltyToServe, driver: StewardUser) {
  const { html, text } = buildEmail({
    eyebrow: "Penalty Update",
    title: "Your penalty has been moved to the next race",
    intro: `Your ${esc(penalty.penaltyLabel)} was not confirmed as served in the previous race and has been carried forward.`,
    action: {
      title: "Updated Assignment",
      body: `Your penalty is now assigned to <strong>${esc(penalty.assignedRaceLabel ?? "the next Main League race")}</strong>. It must be served in that race.`,
    },
    customHtml: penaltySummaryBlock(penalty),
    cta: { label: "View Penalty Details", url: penaltiesUrl() },
    note: "If you have questions about this decision, contact the ISL stewards.",
  });
  await send(
    `[ISL Stewards] Penalty carried forward — ${penalty.penaltyLabel}`,
    html,
    text,
    [driver.email],
  );
}

/* ------------------------------------------------------------------ */
/*  Appeal notifications                                                */
/* ------------------------------------------------------------------ */

function appealUrl(appealId: string) {
  return `${SITE_URL}/stewards/appeals/${appealId}`;
}

export async function notifyAppealSubmitted(
  appeal: Appeal,
  originalCase: StewardCase,
  submittedBy: StewardUser,
  recipients: StewardUser[],
) {
  const { html, text } = buildEmail({
    eyebrow: "Appeal Filed",
    title: "An appeal has been submitted",
    intro: `${esc(submittedBy.name)} has filed an appeal against the verdict in Case #${originalCase.caseNumber ?? "–"}.`,
    summary: {
      caseNumber: originalCase.caseNumber,
      title: originalCase.title,
      season: originalCase.season,
      round: originalCase.round,
      weekendSession: originalCase.weekendSession,
      complainantName: submittedBy.name,
      involvedNames: [],
      status: "Appeal Submitted",
    },
    customHtml: calloutCard({
      label: "Appeal Reason",
      bodyHtml: `${esc(appeal.description.substring(0, 300))}${appeal.description.length > 300 ? "…" : ""}`,
    }),
    action: "The appeal is now under steward review. Stewards will evaluate the submission and issue an appeal verdict.",
    cta: { label: "View Appeal", url: appealUrl(appeal.id), color: "#7e2a1e" },
    note: "This is an automated notification from the ISL Steward System.",
  });
  await send(
    `[ISL Stewards] Appeal filed — Case #${originalCase.caseNumber ?? "–"}: ${originalCase.title}`,
    html, text,
    dedupe(recipients.map((r) => r.email)),
  );
}

export async function notifyAppealVerdictPublished(
  appeal: Appeal,
  appealVerdict: AppealVerdict,
  originalCase: StewardCase,
  recipients: StewardUser[],
) {
  const changed = appealVerdict.outcomeType === "changed_decision";
  const outcomeLabel = changed ? "Decision Changed" : "Original Decision Upheld";
  const { html, text } = buildEmail({
    eyebrow: "Appeal Verdict",
    title: `Appeal verdict: ${outcomeLabel}`,
    intro: changed
      ? `The stewards have reviewed the appeal for Case #${originalCase.caseNumber ?? "–"} and have decided to change the original decision.`
      : `The stewards have reviewed the appeal for Case #${originalCase.caseNumber ?? "–"} and have upheld the original decision.`,
    summary: {
      caseNumber: originalCase.caseNumber,
      title: originalCase.title,
      season: originalCase.season,
      round: originalCase.round,
      weekendSession: originalCase.weekendSession,
      complainantName: "",
      involvedNames: [],
      status: changed ? "Decision Changed" : "Original Decision Upheld",
    },
    customHtml: appealVerdict.verdict_summary
      ? calloutCard({
          label: "Appeal Verdict Summary",
          bodyHtml: esc(appealVerdict.verdict_summary),
          tone: changed ? "gold" : "success",
        })
      : undefined,
    cta: { label: "View Full Verdict", url: appealUrl(appeal.id), color: changed ? "#7e2a1e" : "#3f6b3a" },
    note: "If you have questions about this decision, contact the ISL stewards.",
  });
  await send(
    `[ISL Stewards] Appeal verdict — Case #${originalCase.caseNumber ?? "–"}: ${outcomeLabel}`,
    html, text,
    dedupe(recipients.map((r) => r.email)),
  );
}
