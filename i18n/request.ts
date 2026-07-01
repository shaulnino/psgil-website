import { getRequestConfig } from "next-intl/server";

/**
 * next-intl request config — Phase 8 (English-only, NO i18n routing yet).
 * The locale is fixed to "en" here. Phase 9 introduces the app/[locale]
 * segment + middleware and derives the locale from the route / user.
 * Messages are namespaced by feature under messages/{locale}/*.json and
 * merged into a single object keyed by namespace.
 */
export const LOCALES = ["en"] as const;
export const DEFAULT_LOCALE = "en";

const NAMESPACES = [
  "common",
  "home",
  "drivers",
  "schedule",
  "stats",
  "news",
  "forms",
  "stewards",
  "errors",
] as const;

export default getRequestConfig(async () => {
  const locale = DEFAULT_LOCALE;
  const entries = await Promise.all(
    NAMESPACES.map(async (ns) => [ns, (await import(`../messages/${locale}/${ns}.json`)).default] as const),
  );
  return {
    locale,
    messages: Object.fromEntries(entries),
  };
});
