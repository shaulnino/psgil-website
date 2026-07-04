// ---------------------------------------------------------------------------
// Shared email design kit — "Race Control" broadcast theme
// ---------------------------------------------------------------------------
// Every ISL email (contact form + steward system) renders through these
// helpers so the whole system shares one look. Values mirror the site's dark
// charcoal + gold palette (see app/globals.css --isl-* tokens), flattened to
// solid hex because email clients strip CSS variables, rgba compositing and
// external stylesheets.
//
// Rules of the road for email HTML:
//   • Inline styles only, table-based layout, solid hex colours.
//   • No web fonts load in mail — approximate the site's Oswald/Public Sans
//     with condensed + system stacks; use a mono stack for broadcast numerals.
//   • border-radius / box-shadow degrade gracefully (ignored) in old Outlook.
// ---------------------------------------------------------------------------

/** Dark broadcast palette (flattened from app/globals.css --isl-* tokens). */
export const C = {
  bg: "#08090a", // outer page background (near-void)
  surface: "#141719", // email card surface
  surfaceAlt: "#1c2025", // elevated panels, header, footer, cards
  sink: "#0f1113", // recessed strips / card headers
  ink: "#f3f1ec", // primary text / headings
  ink2: "#cbc7bf", // secondary text, data values
  meta: "#918c82", // meta / captions
  faint: "#6a655c", // tertiary
  gold: "#c9a24b", // restrained metallic gold — the accent
  goldBright: "#e2c274", // brighter gold for emphasis
  brass: "#b8934a",
  hairline: "#2b2f33", // solid stand-in for white@10% on dark
  hairlineStrong: "#3b4045",
  success: "#5fa457",
  warning: "#d6a63c",
  danger: "#e0584a",
  info: "#5a9ab5",
  onGold: "#0b0d0f", // text colour that sits on a gold/coloured fill
} as const;

/** Condensed display stack — stands in for Oswald. */
export const FONT_DISPLAY = "'Arial Narrow','Helvetica Neue',Arial,sans-serif";
/** Body stack — stands in for Public Sans. */
export const FONT_BODY = "'Helvetica Neue',Arial,Helvetica,sans-serif";
/** Monospace stack — broadcast numerals, stands in for Spline Mono. */
export const FONT_MONO = "'Courier New',Courier,monospace";

const SITE = "https://f1isl.com";

export function escapeHtml(str: string): string {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// ---------------------------------------------------------------------------
// Outer shell — header (ISL wordmark + context label), body slot, footer
// ---------------------------------------------------------------------------
type ShellOpts = {
  /** Small caps context label shown in the header, e.g. "Steward System". */
  headerLabel: string;
  /** Pre-built, already-escaped body HTML. */
  bodyHtml: string;
  /** Hidden inbox-preview text. */
  preheader?: string;
  /** Extra footer line (already escaped / safe HTML). */
  footerNote?: string;
};

export function emailShell({ headerLabel, bodyHtml, preheader, footerNote }: ShellOpts): string {
  const pre = preheader
    ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:${C.bg};font-size:1px;line-height:1px">${escapeHtml(preheader)}</div>`
    : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="dark">
<meta name="supported-color-schemes" content="dark">
</head>
<body style="margin:0;padding:0;background:${C.bg};color-scheme:dark">
${pre}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.bg};padding:36px 14px">
<tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:${C.surface};border:1px solid ${C.hairline};border-radius:3px;overflow:hidden">

  <!-- Gold top rule -->
  <tr><td bgcolor="${C.gold}" style="height:3px;font-size:0;line-height:0">&nbsp;</td></tr>

  <!-- Header -->
  <tr>
    <td style="background:${C.surfaceAlt};border-bottom:1px solid ${C.hairline};padding:20px 28px">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td style="vertical-align:middle">
            <span style="font-family:${FONT_DISPLAY};font-size:26px;font-weight:700;letter-spacing:.18em;color:${C.gold}">ISL</span>
            <div style="margin-top:3px;font-family:${FONT_BODY};font-size:10px;font-weight:600;letter-spacing:.16em;text-transform:uppercase;color:${C.meta}">F1 Israeli Super League</div>
          </td>
          <td align="right" style="vertical-align:middle;padding-left:16px">
            <span style="display:inline-block;font-family:${FONT_MONO};font-size:10px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:${C.ink2};border:1px solid ${C.hairlineStrong};border-radius:2px;padding:5px 10px">${escapeHtml(headerLabel)}</span>
          </td>
        </tr>
      </table>
    </td>
  </tr>

  <!-- Body -->
  <tr>
    <td style="background:${C.surface};padding:30px 28px 24px">
      ${bodyHtml}
    </td>
  </tr>

  <!-- Footer -->
  <tr>
    <td style="background:${C.surfaceAlt};border-top:1px solid ${C.hairline};padding:18px 28px">
      <p style="margin:0;font-family:${FONT_BODY};font-size:11px;color:${C.meta};line-height:1.7">
        <span style="color:${C.ink2};font-weight:600">ISL</span> — F1 Israeli Super League&nbsp;&middot;&nbsp;<a href="${SITE}" style="color:${C.gold};text-decoration:none">f1isl.com</a>${
          footerNote ? `<br>${footerNote}` : ""
        }
      </p>
    </td>
  </tr>

</table>
</td></tr>
</table>
</body>
</html>`;
}

// ---------------------------------------------------------------------------
// Content building blocks
// ---------------------------------------------------------------------------

/** Gold eyebrow + display heading. Both args are plain text (escaped here). */
export function heading(title: string, eyebrow?: string): string {
  const eb = eyebrow
    ? `<p style="margin:0 0 8px;font-family:${FONT_MONO};font-size:10px;font-weight:700;letter-spacing:.16em;text-transform:uppercase;color:${C.gold}">${escapeHtml(eyebrow)}</p>`
    : "";
  return `${eb}<h1 style="margin:0 0 14px;font-family:${FONT_DISPLAY};font-size:24px;font-weight:700;letter-spacing:.01em;color:${C.ink};line-height:1.22">${escapeHtml(title)}</h1>`;
}

/** Body paragraph. `html` is pre-built / already escaped. */
export function paragraph(html: string): string {
  return `<p style="margin:0 0 14px;font-family:${FONT_BODY};font-size:14px;color:${C.ink2};line-height:1.65">${html}</p>`;
}

/** Small muted footnote paragraph. Plain text (escaped here). */
export function noteText(text: string): string {
  return `<p style="margin:20px 0 0;font-family:${FONT_BODY};font-size:11px;color:${C.meta};line-height:1.6">${escapeHtml(text)}</p>`;
}

type CtaVariant = "primary" | "success" | "neutral";

/** Broadcast CTA button. Label & url are plain text (escaped here). */
export function ctaButton(label: string, url: string, variant: CtaVariant = "primary"): string {
  const fill = variant === "success" ? C.success : variant === "neutral" ? C.surfaceAlt : C.gold;
  const textColor = variant === "neutral" ? C.ink : C.onGold;
  const border = variant === "neutral" ? `border:1px solid ${C.hairlineStrong};` : "";
  return `
<table role="presentation" cellpadding="0" cellspacing="0" style="margin:26px 0 6px">
  <tr>
    <td bgcolor="${fill}" style="border-radius:2px;${border}">
      <a href="${escapeHtml(url)}" style="display:inline-block;padding:13px 32px;font-family:${FONT_BODY};font-size:13px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:${textColor};text-decoration:none">${escapeHtml(label)}&nbsp;&rarr;</a>
    </td>
  </tr>
</table>`;
}

/** Colored status pill. Label plain text (escaped here). */
export function statusBadge(label: string, tone: "gold" | "success" | "warning" | "info" | "danger" | "muted" = "gold"): string {
  const map: Record<string, string> = {
    gold: C.gold,
    success: C.success,
    warning: C.warning,
    info: C.info,
    danger: C.danger,
    muted: C.meta,
  };
  const color = map[tone];
  return `<span style="display:inline-block;font-family:${FONT_MONO};font-size:10px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:${color};border:1px solid ${color};border-radius:2px;padding:3px 9px">${escapeHtml(label)}</span>`;
}

/**
 * Key/value card on an elevated surface, optionally with a header strip.
 * Row values are pre-built HTML (caller escapes); labels are plain text.
 */
export function infoCard(opts: {
  label?: string; // header-strip eyebrow (plain text)
  title?: string; // header-strip title (plain text)
  rows: Array<[string, string]>; // [label(plain), value(html)]
}): string {
  const header =
    opts.label || opts.title
      ? `<tr><td style="background:${C.sink};border-bottom:1px solid ${C.hairline};padding:12px 16px">
          ${opts.label ? `<p style="margin:0;font-family:${FONT_MONO};font-size:10px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:${C.gold}">${escapeHtml(opts.label)}</p>` : ""}
          ${opts.title ? `<p style="margin:${opts.label ? "5px" : "0"} 0 0;font-family:${FONT_DISPLAY};font-size:16px;font-weight:700;color:${C.ink};line-height:1.3">${escapeHtml(opts.title)}</p>` : ""}
        </td></tr>`
      : "";

  const body = opts.rows
    .map(
      ([k, v]) =>
        `<tr>
          <td style="padding:6px 0;font-family:${FONT_BODY};font-size:11px;color:${C.meta};width:140px;vertical-align:top;white-space:nowrap;text-transform:uppercase;letter-spacing:.04em">${escapeHtml(k)}</td>
          <td style="padding:6px 0;font-family:${FONT_BODY};font-size:13px;color:${C.ink2};line-height:1.45">${v}</td>
        </tr>`,
    )
    .join("");

  return `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:22px 0;background:${C.surfaceAlt};border:1px solid ${C.hairline};border-radius:3px;overflow:hidden">
  ${header}
  <tr><td style="padding:14px 16px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0">${body}</table></td></tr>
</table>`;
}

/**
 * Left-accented callout. `label` is plain text; `bodyHtml` is pre-built.
 * Used for "Action Required", appeal reasons, verdict summaries, etc.
 */
export function calloutCard(opts: {
  label: string;
  bodyHtml: string;
  tone?: "gold" | "success" | "danger";
}): string {
  const accent = opts.tone === "success" ? C.success : opts.tone === "danger" ? C.danger : C.gold;
  return `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:20px 0">
  <tr>
    <td style="background:${C.surfaceAlt};border:1px solid ${C.hairline};border-left:3px solid ${accent};border-radius:0 3px 3px 0;padding:13px 16px">
      <p style="margin:0 0 4px;font-family:${FONT_MONO};font-size:10px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:${accent}">${escapeHtml(opts.label)}</p>
      <p style="margin:0;font-family:${FONT_BODY};font-size:13px;color:${C.ink2};line-height:1.55">${opts.bodyHtml}</p>
    </td>
  </tr>
</table>`;
}
