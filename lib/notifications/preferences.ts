/**
 * Notification preferences (PW-4) — defaults, presets, and channel resolution.
 *
 * `resolveDelivery` is the one place that decides, for a given type + a user's
 * prefs, whether an event delivers in-app and/or push. It folds in: the type's
 * mandatory flag (can't be silenced in-app), the category channel prefs, the
 * master push switch, the "pause optional" switch, and the article-announcements
 * nuance. Producers/service call this — never re-implement it inline.
 */
import { getTypeConfig } from "@/lib/notifications/registry";
import {
  NOTIFICATION_CATEGORIES,
  type ChannelPrefs,
  type NotificationCategory,
  type NotificationParams,
  type NotificationPreferences,
  type NotificationType,
} from "@/lib/notifications/types";

export type PreferencePreset = "recommended" | "importantOnly" | "all" | "pushOff";

function categoryDefault(category: NotificationCategory): ChannelPrefs {
  // Recommended defaults: attendance/race/steward/admin push on; articles/results
  // in-app only (results.corrected pushes via its type default, handled below).
  switch (category) {
    case "attendance":
    case "race":
    case "steward":
    case "admin":
      return { inApp: true, push: true };
    case "articles":
    case "results":
      return { inApp: true, push: false };
  }
}

export function defaultPreferences(userId: string): NotificationPreferences {
  const categories = Object.fromEntries(
    NOTIFICATION_CATEGORIES.map((c) => [c, categoryDefault(c)]),
  ) as Record<NotificationCategory, ChannelPrefs>;
  return {
    userId,
    pushGlobal: true,
    pauseOptional: false,
    categories,
    articleAnnouncementsPushOnly: true,
    updatedAt: new Date(0).toISOString(),
  };
}

/** Fill any missing fields on a stored prefs object with recommended defaults. */
export function hydratePreferences(
  userId: string,
  stored: Partial<NotificationPreferences> | null,
): NotificationPreferences {
  const base = defaultPreferences(userId);
  if (!stored) return base;
  const categories = { ...base.categories };
  for (const c of NOTIFICATION_CATEGORIES) {
    const s = stored.categories?.[c];
    if (s) categories[c] = { inApp: !!s.inApp, push: !!s.push };
  }
  return {
    userId,
    pushGlobal: stored.pushGlobal ?? base.pushGlobal,
    pauseOptional: stored.pauseOptional ?? base.pauseOptional,
    categories,
    articleAnnouncementsPushOnly:
      stored.articleAnnouncementsPushOnly ?? base.articleAnnouncementsPushOnly,
    updatedAt: stored.updatedAt ?? base.updatedAt,
  };
}

export function applyPreset(
  userId: string,
  preset: PreferencePreset,
): NotificationPreferences {
  const base = defaultPreferences(userId);
  switch (preset) {
    case "recommended":
      return base;
    case "all":
      return {
        ...base,
        pushGlobal: true,
        pauseOptional: false,
        articleAnnouncementsPushOnly: false,
        categories: Object.fromEntries(
          NOTIFICATION_CATEGORIES.map((c) => [c, { inApp: true, push: true }]),
        ) as Record<NotificationCategory, ChannelPrefs>,
      };
    case "importantOnly":
      // In-app everywhere; push only for the operationally important categories.
      return {
        ...base,
        pushGlobal: true,
        pauseOptional: false,
        categories: Object.fromEntries(
          NOTIFICATION_CATEGORIES.map((c) => [
            c,
            { inApp: true, push: c === "attendance" || c === "race" || c === "steward" },
          ]),
        ) as Record<NotificationCategory, ChannelPrefs>,
      };
    case "pushOff":
      return { ...base, pushGlobal: false };
  }
}

/** Resolved delivery decision for a single event. */
export type Delivery = { inApp: boolean; push: boolean };

export function resolveDelivery(
  type: NotificationType,
  prefs: NotificationPreferences,
  params?: NotificationParams,
): Delivery {
  const cfg = getTypeConfig(type);
  const category = prefs.categories[cfg.category] ?? { inApp: true, push: false };
  const mandatory = !cfg.disableAllowed;

  // In-app: mandatory always shows; optional respects category + pause switch.
  const inApp = mandatory
    ? true
    : category.inApp && !(cfg.optional && prefs.pauseOptional);

  // Push: needs the master switch AND (mandatory OR category push), and is
  // suppressed for optional types while "pause optional" is on.
  let push =
    prefs.pushGlobal &&
    (mandatory || category.push) &&
    !(cfg.optional && prefs.pauseOptional);

  // Articles nuance: when the user only wants announcement pushes, a non-
  // announcement article never pushes (still shows in-app).
  if (type === "article_published" && prefs.articleAnnouncementsPushOnly) {
    const isAnnouncement = String(params?.category ?? "").toLowerCase() === "announcement";
    if (!isAnnouncement) push = false;
  }

  return { inApp, push };
}
