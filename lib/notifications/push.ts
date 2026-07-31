/**
 * Web Push delivery (PW-4, Phase 2).
 *
 * `enqueuePush` is called by the notification service for each recipient the
 * preferences say should receive push. It renders the copy in the RECIPIENT's
 * language, sends to every active subscription (device) of that user, and prunes
 * subscriptions the push service reports as gone. Push is independent of the
 * in-app record: a push failure never affects the stored notification.
 *
 * Steward copy stays generic (the registry templates carry no case details), so
 * nothing sensitive appears on a lock screen.
 */
import webpush from "web-push";
import { getPathname } from "@/i18n/navigation";
import { getUserById } from "@/lib/accounts/repository";
import { getVapidDetails, isPushConfigured } from "@/lib/notifications/pushConfig";
import { createNotificationTranslator } from "@/lib/notifications/i18nServer";
import {
  applySendResults,
  listPushSubscriptions,
} from "@/lib/notifications/pushRepository";
import type { NotificationParams, NotificationType } from "@/lib/notifications/types";

export type PushEnqueueInput = {
  userId: string;
  type: NotificationType;
  params: NotificationParams;
  deepLink: string;
  localized: boolean;
  titleOverride?: string | null;
  bodyOverride?: string | null;
};

let vapidReady = false;
function ensureVapid(): boolean {
  if (!isPushConfigured()) return false;
  if (!vapidReady) {
    const { subject, publicKey, privateKey } = getVapidDetails();
    webpush.setVapidDetails(subject, publicKey, privateKey);
    vapidReady = true;
  }
  return true;
}

/** Build the app-relative URL the SW should open, in the recipient's locale. */
function buildUrl(deepLink: string, localized: boolean, locale: string): string {
  if (!localized) return deepLink; // absolute route (e.g. /stewards/...)
  const [path, hash] = deepLink.split("#");
  const localizedPath = getPathname({ href: path, locale });
  return hash ? `${localizedPath}#${hash}` : localizedPath;
}

export async function enqueuePush(input: PushEnqueueInput): Promise<void> {
  if (!ensureVapid()) {
    if (process.env.NODE_ENV !== "production") {
      console.debug(`[notifications] push not configured — skipping ${input.type}`);
    }
    return;
  }

  const subs = await listPushSubscriptions(input.userId);
  if (subs.length === 0) return;

  const account = await getUserById(input.userId).catch(() => null);
  const locale = account?.locale === "he" ? "he" : "en";
  const t = await createNotificationTranslator(locale);

  const title = input.titleOverride ?? t(`templates.${input.type}.title`, input.params);
  const body = input.bodyOverride ?? t(`templates.${input.type}.body`, input.params);
  const url = buildUrl(input.deepLink, input.localized, locale);

  const payload = JSON.stringify({
    title,
    body,
    url,
    type: input.type,
    // Collapse repeats to the same destination; renotify so a new one still alerts.
    tag: url,
  });

  const results = await Promise.all(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: sub.keys },
          payload,
          { TTL: 60 * 60 * 24 },
        );
        return { id: sub.id, ok: true, gone: false };
      } catch (err) {
        const statusCode = (err as { statusCode?: number }).statusCode;
        const gone = statusCode === 404 || statusCode === 410;
        return { id: sub.id, ok: false, gone };
      }
    }),
  );

  await applySendResults(input.userId, results);
}
