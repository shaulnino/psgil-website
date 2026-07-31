/**
 * Scheduled notification tick (PW-4, Phase 3).
 *
 * Runs every ~10 minutes. This thin function only TRIGGERS the app's internal
 * tick endpoint with the shared secret — the actual work (snapshot diffs,
 * reminder eligibility, in-app + push delivery) runs inside the Next.js runtime
 * where Netlify Blobs and the data layer are available.
 *
 * Netlify injects `process.env.URL` (the site's primary URL) at runtime.
 */
export default async () => {
  const base = process.env.URL || process.env.DEPLOY_PRIME_URL || "";
  const secret = process.env.NOTIFICATIONS_TICK_SECRET || "";
  if (!base) {
    return new Response(JSON.stringify({ error: "no_base_url" }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  }

  const res = await fetch(`${base}/api/notifications/tick`, {
    method: "POST",
    headers: { "x-tick-key": secret },
  });
  const body = await res.text();
  return new Response(body, {
    status: res.status,
    headers: { "content-type": "application/json" },
  });
};

export const config = { schedule: "*/10 * * * *" };
