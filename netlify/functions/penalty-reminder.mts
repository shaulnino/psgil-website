import type { Config } from "@netlify/functions";

/**
 * Netlify scheduled function — runs every 2 hours.
 * Calls the Next.js API route that sends 48-hour penalty reminder emails.
 *
 * Required env vars (set in Netlify dashboard):
 *   CRON_SECRET  — shared secret between this function and the API route
 *   URL          — automatically set by Netlify to the site URL (e.g. https://psgil.com)
 */
export default async function handler() {
  const secret  = process.env.CRON_SECRET;
  const siteUrl = (process.env.URL ?? "").replace(/\/$/, "");

  if (!secret) {
    console.error("[penalty-reminder] CRON_SECRET env var is not set — skipping");
    return;
  }
  if (!siteUrl) {
    console.error("[penalty-reminder] URL env var is not set — skipping");
    return;
  }

  const res = await fetch(`${siteUrl}/api/stewards/send-penalty-reminders`, {
    method: "POST",
    headers: { authorization: `Bearer ${secret}` },
  });

  const body = await res.json().catch(() => ({}));
  console.log(`[penalty-reminder] API responded ${res.status}:`, JSON.stringify(body));
}

export const config: Config = {
  schedule: "0 */2 * * *", // every 2 hours
};
