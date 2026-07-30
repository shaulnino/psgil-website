/* ------------------------------------------------------------------ */
/*  Reusable sharing system — shared types                             */
/*  ----------------------------------------------------------------  */
/*  One payload shape for every shareable content type. Builders in    */
/*  `lib/share/builders.ts` produce a SharePayload; the ShareButton /   */
/*  useShare hook consume it. Extend `ShareableContentType` (and add a  */
/*  builder) to make a new content type shareable later.                */
/* ------------------------------------------------------------------ */

export type ShareableContentType = "article" | "raceResult";

/** Everything the UI + native share sheet + platform links need. */
export type SharePayload = {
  /** Absolute, canonical, locale-correct URL to share. */
  url: string;
  /** Localized share title (OS share-sheet title + fallback text). */
  title: string;
  /** Longer localized message/lead used as the share body text. */
  text: string;
  /** For analytics + keys — not shown to the user. */
  contentType: ShareableContentType;
  contentId: string;
  /** Active locale of the shared page (drives share-message language). */
  locale: string;
};

/** How a user completed (or attempted) a share — for analytics. */
export type ShareMethod = "native" | "copy" | "whatsapp" | "telegram" | "x" | "email";

/**
 * Minimal translator shape accepted by the pure share builders so they work
 * with both `useTranslations()` (client) and `getTranslations()` (server)
 * without importing next-intl. Cast the next-intl translator at the call site.
 */
export type ShareTranslator = (
  key: string,
  values?: Record<string, string | number>,
) => string;
