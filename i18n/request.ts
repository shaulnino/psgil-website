import { getRequestConfig } from "next-intl/server";

/**
 * next-intl request config — Phase 8 (English-only, NO i18n routing yet).
 * The locale is fixed to "en" here. Phase 9 introduces the app/[locale]
 * segment + middleware and derives the locale from the route / user.
 * Messages are namespaced by feature under messages/{locale}/*.json.
 */
export const LOCALES = ["en"] as const;
export const DEFAULT_LOCALE = "en";

export default getRequestConfig(async () => {
  const locale = DEFAULT_LOCALE;
  return {
    locale,
    messages: {
      common: (await import(`../messages/${locale}/common.json`)).default,
    },
  };
});
