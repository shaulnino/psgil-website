/* ------------------------------------------------------------------ */
/*  Google Analytics 4 helpers                                         */
/*  ----------------------------------------------------------------  */
/*  • gaEvent() — fire custom events (no-op when GA is disabled)       */
/*  • GA_ID     — the measurement ID from env vars                     */
/*  • isGaEnabled() — runtime check for production + correct domain    */
/* ------------------------------------------------------------------ */

export const GA_ID = process.env.NEXT_PUBLIC_GA_ID ?? "";

/**
 * Returns true only when:
 *  1. A GA measurement ID is configured
 *  2. The app is running in production mode
 *  3. The hostname is a production domain (skips localhost & deploy previews)
 */
export function isGaEnabled(): boolean {
  if (!GA_ID) return false;
  if (typeof window === "undefined") return false;
  if (process.env.NODE_ENV !== "production") return false;
  // f1isl.com is the live domain; psgil.com is retained during the migration
  // (it 301-redirects to f1isl.com) so analytics never gap during cutover.
  const host = window.location.hostname;
  return host.endsWith("f1isl.com") || host.endsWith("psgil.com");
}

/* ------------------------------------------------------------------ */
/*  gtag type helpers (window.gtag injected by the script tag)         */
/* ------------------------------------------------------------------ */

type GTagEvent = {
  action: string;
  category?: string;
  label?: string;
  value?: number;
};

/**
 * Fire a GA4 event.  No-op when GA is not loaded.
 *
 * Usage:
 *   gaEvent({ action: "click_join_now" })
 *   gaEvent({ action: "open_driver_card", label: "Shaul Ezra" })
 */
export function gaEvent({ action, category, label, value }: GTagEvent): void {
  if (!isGaEnabled()) return;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const gtag = (window as any).gtag;
  if (typeof gtag !== "function") return;

  gtag("event", action, {
    event_category: category,
    event_label: label,
    value,
  });
}

/* ------------------------------------------------------------------ */
/*  Pre-defined event helpers for key site actions                     */
/* ------------------------------------------------------------------ */

/** User clicks "Join Now" (Discord link) */
export const gaClickJoinNow = () =>
  gaEvent({ action: "click_join_now", category: "engagement" });

/** User clicks "Watch on YouTube" */
export const gaClickWatchYouTube = (raceLabel?: string) =>
  gaEvent({
    action: "click_watch_youtube",
    category: "engagement",
    label: raceLabel,
  });

/** User opens "Race Results" */
export const gaClickRaceResults = (raceLabel?: string) =>
  gaEvent({
    action: "click_race_results",
    category: "engagement",
    label: raceLabel,
  });

/** User opens a Driver Card modal */
export const gaOpenDriverCard = (driverName?: string) =>
  gaEvent({
    action: "open_driver_card",
    category: "engagement",
    label: driverName,
  });
