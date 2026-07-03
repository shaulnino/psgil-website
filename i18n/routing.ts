import { defineRouting } from "next-intl/routing";

/**
 * Public-site locale routing (Phase 9b).
 * Hebrew is the default and served without a prefix ("/"); English lives at
 * "/en/*". "/he/*" redirects to the unprefixed form. Steward, API, and RSS
 * routes are NOT locale-prefixed (see proxy.ts matcher + i18n/request.ts).
 */
export const routing = defineRouting({
  locales: ["he", "en"],
  defaultLocale: "he",
  localePrefix: "as-needed",
  // "/" always serves Hebrew (the chosen default) — do not auto-switch to the
  // visitor's Accept-Language. English is reachable explicitly at /en/*.
  localeDetection: false,
});

export type AppLocale = (typeof routing.locales)[number];
