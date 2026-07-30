/* ------------------------------------------------------------------ */
/*  Safe URL helpers for the sharing system                            */
/*  ----------------------------------------------------------------  */
/*  • Locale-correct absolute canonical URLs (he unprefixed, en /en/*) */
/*  • Correctly-encoded platform intent URLs (WhatsApp/Telegram/X/…)   */
/*  Pure + SSR-safe: `window` is feature-detected, never assumed.      */
/* ------------------------------------------------------------------ */

/**
 * Resolve the site's origin. In the browser we trust the live origin (works on
 * f1isl.com and inside the installed PWA); on the server we fall back to the
 * public env var, then the production domain.
 */
export function getSiteBaseUrl(): string {
  if (typeof window !== "undefined" && window.location?.origin) {
    return window.location.origin;
  }
  const env =
    process.env.NEXT_PUBLIC_SITE_URL || process.env.SITE_BASE_URL || "";
  return (env || "https://f1isl.com").trim().replace(/\/+$/, "");
}

/**
 * Prefix a locale-agnostic app path with the locale segment, matching the
 * next-intl routing config (defaultLocale "he" is unprefixed with
 * localePrefix "as-needed"; "en" is served at /en/*).
 */
export function localePath(locale: string, path: string): string {
  const clean = path.startsWith("/") ? path : `/${path}`;
  return locale === "en" ? `/en${clean}` : clean;
}

/** Build a locale-correct absolute URL for the given app path. */
export function absoluteUrl(locale: string, path: string): string {
  return `${getSiteBaseUrl()}${localePath(locale, path)}`;
}

/* ------------------------------------------------------------------ */
/*  Platform intent URLs (all values encodeURIComponent-escaped)       */
/* ------------------------------------------------------------------ */

/** WhatsApp share (text + url combined — WhatsApp has no separate url field). */
export function whatsappShareUrl(text: string, url: string): string {
  const body = encodeURIComponent(`${text}\n${url}`);
  return `https://wa.me/?text=${body}`;
}

/** Telegram share (separate url + text fields). */
export function telegramShareUrl(text: string, url: string): string {
  return `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`;
}

/** X / Twitter intent (separate url + text fields). */
export function xShareUrl(text: string, url: string): string {
  return `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`;
}

/** mailto: link (url appended to the body so it's always present). */
export function emailShareUrl(subject: string, text: string, url: string): string {
  const body = encodeURIComponent(`${text}\n\n${url}`);
  return `mailto:?subject=${encodeURIComponent(subject)}&body=${body}`;
}
