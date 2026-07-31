/**
 * Server-side notification translator (PW-4, Phase 2/3).
 *
 * Push notifications (and any server-generated copy) must render in the
 * RECIPIENT's language, not the request locale. This builds a standalone
 * `notifications`-namespace translator for a given locale using the same
 * "English base + locale overlay" strategy as `i18n/request.ts`.
 */
import { createTranslator } from "next-intl";

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

async function loadNotificationMessages(locale: string): Promise<Dict> {
  const en = (await import("../../messages/en/notifications.json")).default as Dict;
  if (locale === "en") return en;
  try {
    const overlay = (await import(`../../messages/${locale}/notifications.json`)).default as Dict;
    return deepMerge(en, overlay);
  } catch {
    return en;
  }
}

export type NotifTranslator = (
  key: string,
  values?: Record<string, string | number>,
) => string;

export async function createNotificationTranslator(
  locale: string,
): Promise<NotifTranslator> {
  const messages = await loadNotificationMessages(locale);
  const t = createTranslator({
    locale,
    messages: { notifications: messages },
    namespace: "notifications",
  });
  return t as unknown as NotifTranslator;
}
