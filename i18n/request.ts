import { cookies } from "next/headers";
import { getRequestConfig } from "next-intl/server";
import { routing } from "./routing";
import { getCurrentStewardUser } from "@/lib/stewards/auth";

/**
 * next-intl request config (Phase 9b).
 * Locale comes from the [locale] route segment for public pages (he | en).
 * Non-localized routes (stewards, api, rss) have no segment → render English;
 * steward locale becomes a user preference in Phase 9e.
 *
 * English is loaded as the base and the active locale is deep-merged over it,
 * so any not-yet-translated key gracefully falls back to English.
 */
const NAMESPACES = [
  "common",
  "home",
  "drivers",
  "schedule",
  "stats",
  "news",
  "rewards",
  "forms",
  "stewards",
  "errors",
  "account",
  "attendance",
  "admin",
  "share",
  "notifications",
] as const;

type Dict = Record<string, unknown>;

function deepMerge(base: Dict, over: Dict): Dict {
  const out: Dict = { ...base };
  for (const k of Object.keys(over)) {
    const b = base[k];
    const o = over[k];
    out[k] =
      b && o && typeof b === "object" && typeof o === "object" && !Array.isArray(o)
        ? deepMerge(b as Dict, o as Dict)
        : o;
  }
  return out;
}

export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  let locale: string;
  if (requested && (routing.locales as readonly string[]).includes(requested)) {
    // Public [locale] route.
    locale = requested;
  } else {
    // Non-localized route (steward portal / api). Inherit the locale the user
    // was last browsing in: the next-intl middleware writes a `NEXT_LOCALE`
    // cookie on every public page, and the steward toggle writes it too. So
    // arriving at /stewards from a Hebrew page stays Hebrew. Fall back to the
    // account's saved preference, then English.
    const cookieLocale = (await cookies()).get("NEXT_LOCALE")?.value;
    if (cookieLocale && (routing.locales as readonly string[]).includes(cookieLocale)) {
      locale = cookieLocale;
    } else {
      let stewardLocale: string | undefined;
      try {
        stewardLocale = (await getCurrentStewardUser())?.locale;
      } catch {
        stewardLocale = undefined;
      }
      locale = stewardLocale === "he" ? "he" : "en";
    }
  }

  const enEntries = await Promise.all(
    NAMESPACES.map(async (ns) => [ns, (await import(`../messages/en/${ns}.json`)).default] as const),
  );
  const en = Object.fromEntries(enEntries) as Record<string, Dict>;

  if (locale === "en") {
    return { locale, messages: en };
  }

  const messages: Record<string, Dict> = {};
  for (const ns of NAMESPACES) {
    const overlay = (await import(`../messages/${locale}/${ns}.json`)).default as Dict;
    messages[ns] = deepMerge(en[ns], overlay);
  }
  return { locale, messages };
});
