/**
 * Notifications (PW-4) — core types.
 *
 * The notification system is data-driven: a record stores a stable `type` key
 * plus structured `params`, NOT frozen rendered text. In-app items render in the
 * viewer's current locale; push (Phase 2) renders in the recipient's saved locale
 * at send time. See `registry.ts` for per-type config and `templates.*` in the
 * `notifications` i18n namespace for copy.
 */
import { z } from "zod";

export type NotificationCategory =
  | "attendance"
  | "race"
  | "steward"
  | "articles"
  | "results"
  | "admin";

export const NOTIFICATION_CATEGORIES: NotificationCategory[] = [
  "attendance",
  "race",
  "steward",
  "articles",
  "results",
  "admin",
];

export type NotificationPriority = "critical" | "important" | "standard" | "low";

/**
 * Stable notification type keys (launch taxonomy). Producers for most of these
 * land in later phases (attendance/steward in Phase 1, reminders + content diffs
 * in Phase 3). `test` is a self-service in-app test used from the settings page.
 */
export type NotificationType =
  | "attendance_opened"
  | "attendance_missing"
  | "attendance_changed_by_admin"
  | "race_time_changed"
  | "race_cancelled"
  | "race_postponed"
  | "race_restored"
  | "race_upcoming"
  | "steward_case_involved"
  | "steward_response_needed"
  | "steward_verdict_published"
  | "steward_penalty_assigned"
  | "appeal_verdict_published"
  | "article_published"
  | "results_official"
  | "results_corrected"
  | "admin_broadcast"
  | "test";

export type NotificationParams = Record<string, string | number>;

export type UserNotification = {
  id: string;
  type: NotificationType;
  category: NotificationCategory;
  priority: NotificationPriority;
  /** Structured params for localized rendering (title/body built from i18n). */
  params: NotificationParams;
  /** Free-text overrides (e.g. admin broadcast). When set, used verbatim. */
  titleOverride?: string | null;
  bodyOverride?: string | null;
  /** Destination path. Locale-prefixed at render time when `localized` is true. */
  deepLink: string;
  /** Whether `deepLink` is a localized ([locale]) route (true) or absolute (false, e.g. /stewards). */
  localized: boolean;
  /** Idempotency key — one record per (type, entity, user, stage). */
  dedupeKey: string;
  createdAt: string;
  seenAt: string | null;
  readAt: string | null;
  clickedAt: string | null;
  expiresAt: string | null;
};

export type ChannelPrefs = { inApp: boolean; push: boolean };

export type NotificationPreferences = {
  userId: string;
  /** Master push switch for the account (per-device permission is separate; Phase 2). */
  pushGlobal: boolean;
  /** Pause all *optional* notifications — mandatory types still deliver in-app. */
  pauseOptional: boolean;
  /** Per-category channel prefs. */
  categories: Record<NotificationCategory, ChannelPrefs>;
  /** Articles: when true, only "announcements" push; other categories stay in-app. */
  articleAnnouncementsPushOnly: boolean;
  updatedAt: string;
};

/* ── Validation ─────────────────────────────────────────────────────────── */

/** A single Web Push subscription for one device/browser of one user. */
export type PushSubscriptionRecord = {
  /** Stable id derived from the endpoint (dedupes re-subscribes on one device). */
  id: string;
  userId: string;
  endpoint: string;
  keys: { p256dh: string; auth: string };
  userAgent: string | null;
  createdAt: string;
  lastSuccessAt: string | null;
  lastFailureAt: string | null;
  failureCount: number;
};

export const pushSubscriptionInputSchema = z.object({
  endpoint: z.string().url().max(2000),
  keys: z.object({
    p256dh: z.string().min(1).max(500),
    auth: z.string().min(1).max(500),
  }),
});

export const channelPrefsSchema = z.object({
  inApp: z.boolean(),
  push: z.boolean(),
});

export const markReadSchema = z.object({
  id: z.string().min(1).optional(),
  all: z.boolean().optional(),
});

export const clickSchema = z.object({ id: z.string().min(1) });
