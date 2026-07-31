/**
 * Notification type registry (PW-4) — the single source of truth for how each
 * notification type behaves: its category, priority, whether users may disable
 * it, default channels, whether it's "optional" (subject to Pause all), and how
 * to build its deep link from params.
 *
 * Adding a new notification type = one entry here + copy under the
 * `notifications.templates.<type>` i18n key. No logic changes elsewhere.
 */
import type {
  NotificationCategory,
  NotificationParams,
  NotificationPriority,
  NotificationType,
} from "@/lib/notifications/types";

export type TypeConfig = {
  category: NotificationCategory;
  priority: NotificationPriority;
  /** Whether the user may turn it off. Mandatory types (false) always deliver in-app. */
  disableAllowed: boolean;
  /** Counts toward the "Pause all optional notifications" switch. */
  optional: boolean;
  /** Default in-app channel when the user has no explicit category override. */
  defaultInApp: boolean;
  /** Default push channel when the user has no explicit category override. */
  defaultPush: boolean;
  /** Locale-relative ([locale]) route (true) or absolute app route like /stewards (false). */
  localized: boolean;
  /** Build the destination path from params. */
  deepLink: (p: NotificationParams) => string;
};

const s = (v: unknown) => String(v ?? "").trim();

export const NOTIFICATION_REGISTRY: Record<NotificationType, TypeConfig> = {
  // ── Attendance ──────────────────────────────────────────────────────────
  attendance_opened: {
    category: "attendance",
    priority: "important",
    disableAllowed: true,
    optional: true,
    defaultInApp: true,
    defaultPush: true,
    localized: true,
    deepLink: () => "/account#attendance",
  },
  attendance_missing: {
    category: "attendance",
    priority: "important",
    disableAllowed: true,
    optional: true,
    defaultInApp: true,
    defaultPush: true,
    localized: true,
    deepLink: () => "/account#attendance",
  },
  attendance_changed_by_admin: {
    category: "attendance",
    priority: "important",
    disableAllowed: false, // mandatory: someone changed your RSVP
    optional: false,
    defaultInApp: true,
    defaultPush: true,
    localized: true,
    deepLink: () => "/account#attendance",
  },

  // ── Race operations ───────────────────────────────────────────────────────
  race_time_changed: {
    category: "race",
    priority: "critical",
    disableAllowed: false,
    optional: false,
    defaultInApp: true,
    defaultPush: true,
    localized: true,
    deepLink: (p) => `/schedule/${s(p.eventId)}`,
  },
  race_cancelled: {
    category: "race",
    priority: "critical",
    disableAllowed: false,
    optional: false,
    defaultInApp: true,
    defaultPush: true,
    localized: true,
    deepLink: (p) => `/schedule/${s(p.eventId)}`,
  },
  race_postponed: {
    category: "race",
    priority: "critical",
    disableAllowed: false,
    optional: false,
    defaultInApp: true,
    defaultPush: true,
    localized: true,
    deepLink: (p) => `/schedule/${s(p.eventId)}`,
  },
  race_restored: {
    category: "race",
    priority: "important",
    disableAllowed: false,
    optional: false,
    defaultInApp: true,
    defaultPush: true,
    localized: true,
    deepLink: (p) => `/schedule/${s(p.eventId)}`,
  },
  race_upcoming: {
    category: "race",
    priority: "standard",
    disableAllowed: true,
    optional: true,
    defaultInApp: true,
    defaultPush: true,
    localized: true,
    deepLink: (p) => `/schedule/${s(p.eventId)}`,
  },

  // ── Steward (personal; push copy stays generic — see Phase 2) ─────────────
  steward_case_involved: {
    category: "steward",
    priority: "critical",
    disableAllowed: false,
    optional: false,
    defaultInApp: true,
    defaultPush: true,
    localized: false,
    deepLink: (p) => `/stewards/cases/${s(p.caseId)}?view=driver`,
  },
  steward_response_needed: {
    category: "steward",
    priority: "important",
    disableAllowed: true,
    optional: true,
    defaultInApp: true,
    defaultPush: true,
    localized: false,
    deepLink: (p) => `/stewards/cases/${s(p.caseId)}?view=driver`,
  },
  steward_verdict_published: {
    category: "steward",
    priority: "important",
    disableAllowed: true,
    optional: true,
    defaultInApp: true,
    defaultPush: true,
    localized: false,
    deepLink: (p) => `/stewards/cases/${s(p.caseId)}?view=driver`,
  },
  steward_penalty_assigned: {
    category: "steward",
    priority: "critical",
    disableAllowed: false,
    optional: false,
    defaultInApp: true,
    defaultPush: true,
    localized: false,
    deepLink: () => "/stewards/penalties-to-serve",
  },
  appeal_verdict_published: {
    category: "steward",
    priority: "important",
    disableAllowed: true,
    optional: true,
    defaultInApp: true,
    defaultPush: true,
    localized: false,
    deepLink: (p) => `/stewards/appeals/${s(p.appealId)}`,
  },

  // ── Articles ──────────────────────────────────────────────────────────────
  article_published: {
    category: "articles",
    priority: "standard",
    disableAllowed: true,
    optional: true,
    defaultInApp: true,
    defaultPush: false, // announcements override to push via prefs (see preferences.ts)
    localized: true,
    deepLink: (p) => `/news/${s(p.slug)}`,
  },

  // ── Results ─────────────────────────────────────────────────────────────
  results_official: {
    category: "results",
    priority: "standard",
    disableAllowed: true,
    optional: true,
    defaultInApp: true,
    defaultPush: false,
    localized: true,
    deepLink: (p) => `/schedule/${s(p.eventId)}`,
  },
  results_corrected: {
    category: "results",
    priority: "important",
    disableAllowed: true,
    optional: true,
    defaultInApp: true,
    defaultPush: true, // personal position/points change
    localized: true,
    deepLink: (p) => `/schedule/${s(p.eventId)}`,
  },

  // ── Admin ─────────────────────────────────────────────────────────────
  admin_broadcast: {
    category: "admin",
    priority: "important",
    disableAllowed: true,
    optional: false,
    defaultInApp: true,
    defaultPush: true,
    localized: true,
    deepLink: (p) => s(p.url) || "/",
  },

  // ── Test (self-service) ─────────────────────────────────────────────────
  test: {
    category: "admin",
    priority: "low",
    disableAllowed: true,
    optional: true,
    defaultInApp: true,
    defaultPush: false,
    localized: true,
    deepLink: () => "/account/notifications",
  },
};

export function getTypeConfig(type: NotificationType): TypeConfig {
  return NOTIFICATION_REGISTRY[type];
}
