import type { UserNotification } from "@/lib/notifications/types";

type Translator = (key: string, values?: Record<string, string | number>) => string;

/** Render a notification's title/body in the current locale from its template +
 *  params, honouring free-text overrides (admin broadcasts). */
export function renderNotification(t: Translator, n: UserNotification): {
  title: string;
  body: string;
} {
  const title = n.titleOverride ?? t(`templates.${n.type}.title`, n.params);
  const body = n.bodyOverride ?? t(`templates.${n.type}.body`, n.params);
  return { title, body };
}

/** Compact relative timestamp ("Just now", "5m ago", "3h ago", "2d ago"). */
export function relativeTime(t: Translator, iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diffMs / 60000);
  if (min < 1) return t("time.now");
  if (min < 60) return t("time.minute", { count: min });
  const hr = Math.floor(min / 60);
  if (hr < 24) return t("time.hour", { count: hr });
  const day = Math.floor(hr / 24);
  return t("time.day", { count: day });
}
