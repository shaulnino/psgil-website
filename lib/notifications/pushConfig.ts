/**
 * Web Push configuration (PW-4, Phase 2).
 *
 * VAPID keys come from env. Push is PWA-only by product decision, but the server
 * config is channel-agnostic. When keys are absent (e.g. local dev without them)
 * everything degrades gracefully: `isPushConfigured()` is false, sends no-op, and
 * the subscribe endpoint reports unconfigured — in-app notifications still work.
 *
 * Required env (see ARCHITECTURE.md):
 *   NEXT_PUBLIC_VAPID_PUBLIC_KEY  — exposed to the client to create subscriptions
 *   VAPID_PRIVATE_KEY             — server secret used to sign push
 *   VAPID_SUBJECT                 — "mailto:…" or site URL (defaults to the ISL mailbox)
 */
export const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY ?? "";
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || "mailto:f1racingisl@gmail.com";

export function isPushConfigured(): boolean {
  return !!(VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY);
}

export function getVapidDetails(): { subject: string; publicKey: string; privateKey: string } {
  return { subject: VAPID_SUBJECT, publicKey: VAPID_PUBLIC_KEY, privateKey: VAPID_PRIVATE_KEY };
}
