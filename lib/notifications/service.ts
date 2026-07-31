/**
 * Notification service (PW-4) — the single entry point domain code calls to emit
 * a notification. It resolves the audience, applies each recipient's preferences
 * to decide channels (`resolveDelivery`), creates the in-app record idempotently
 * (per-user `dedupeKey`), and enqueues push for eligible recipients.
 *
 * Producers (attendance/steward/etc.) should call `notify` AFTER their domain
 * write has committed, so a failed transaction never emits a notification.
 */
import { getTypeConfig } from "@/lib/notifications/registry";
import { getPreferences } from "@/lib/notifications/repository";
import { createNotification } from "@/lib/notifications/repository";
import { resolveAudience, type AudienceSpec } from "@/lib/notifications/audience";
import { resolveDelivery } from "@/lib/notifications/preferences";
import { enqueuePush } from "@/lib/notifications/push";
import type { NotificationParams, NotificationType } from "@/lib/notifications/types";

export type NotifyInput = {
  type: NotificationType;
  audience: AudienceSpec;
  params?: NotificationParams;
  /**
   * Idempotency key SUFFIX shared by all recipients of this event — the final
   * per-user key is `${type}:${dedupeKey}`, so re-running a producer (double
   * click, job retry, re-import) never creates duplicates.
   */
  dedupeKey: string;
  titleOverride?: string | null;
  bodyOverride?: string | null;
  deepLink?: string;
  expiresAt?: string | null;
};

export type NotifyResult = { recipients: number; created: number; pushed: number };

export async function notify(input: NotifyInput): Promise<NotifyResult> {
  const cfg = getTypeConfig(input.type);
  const params = input.params ?? {};
  const userIds = await resolveAudience(input.audience);
  const dedupeKey = `${input.type}:${input.dedupeKey}`;

  let created = 0;
  let pushed = 0;

  await Promise.all(
    userIds.map(async (userId) => {
      const prefs = await getPreferences(userId);
      const delivery = resolveDelivery(input.type, prefs, params);

      if (!delivery.inApp) return;

      const rec = await createNotification({
        userId,
        type: input.type,
        params,
        dedupeKey,
        titleOverride: input.titleOverride ?? null,
        bodyOverride: input.bodyOverride ?? null,
        deepLink: input.deepLink,
        expiresAt: input.expiresAt ?? null,
      });
      // A null result means this event was already delivered (dedupe hit). Push
      // is gated on a FRESH in-app record so re-running a producer — or a reminder
      // whose stage window spans many scheduler ticks — never re-pushes.
      if (!rec) return;
      created += 1;

      if (delivery.push) {
        await enqueuePush({
          userId,
          type: input.type,
          params,
          deepLink: input.deepLink ?? cfg.deepLink(params),
          localized: cfg.localized,
          titleOverride: input.titleOverride ?? null,
          bodyOverride: input.bodyOverride ?? null,
        });
        pushed += 1;
      }
    }),
  );

  return { recipients: userIds.length, created, pushed };
}
