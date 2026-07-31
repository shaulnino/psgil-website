/**
 * Notification repository (PW-4) — validated operations over the store.
 * Callers (service, API routes, actions) use these rather than the store
 * directly. All mutations are serialized per user via `withUserLock`.
 */
import { getTypeConfig } from "@/lib/notifications/registry";
import {
  defaultPreferences,
  hydratePreferences,
} from "@/lib/notifications/preferences";
import {
  readPreferences,
  readUserNotifications,
  withUserLock,
  writePreferences,
  writeUserNotifications,
} from "@/lib/notifications/store";
import type {
  NotificationParams,
  NotificationPreferences,
  NotificationType,
  UserNotification,
} from "@/lib/notifications/types";

export type CreateInput = {
  userId: string;
  type: NotificationType;
  params?: NotificationParams;
  dedupeKey: string;
  titleOverride?: string | null;
  bodyOverride?: string | null;
  /** Override the registry deep link (rarely needed). */
  deepLink?: string;
  expiresAt?: string | null;
};

/**
 * Create one in-app notification for a user. Idempotent: if a record with the
 * same `dedupeKey` already exists, nothing is created and the existing record is
 * returned. Returns null only on an unexpected empty write.
 */
export async function createNotification(input: CreateInput): Promise<UserNotification | null> {
  const cfg = getTypeConfig(input.type);
  return withUserLock(input.userId, async () => {
    const list = await readUserNotifications(input.userId);
    const existing = list.find((n) => n.dedupeKey === input.dedupeKey);
    if (existing) return existing;

    const params = input.params ?? {};
    const record: UserNotification = {
      id:
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : `n_${Date.now()}_${Math.random().toString(36).slice(2)}`,
      type: input.type,
      category: cfg.category,
      priority: cfg.priority,
      params,
      titleOverride: input.titleOverride ?? null,
      bodyOverride: input.bodyOverride ?? null,
      deepLink: input.deepLink ?? cfg.deepLink(params),
      localized: cfg.localized,
      dedupeKey: input.dedupeKey,
      createdAt: new Date().toISOString(),
      seenAt: null,
      readAt: null,
      clickedAt: null,
      expiresAt: input.expiresAt ?? null,
    };
    await writeUserNotifications(input.userId, [record, ...list]);
    return record;
  });
}

function isLive(n: UserNotification, now: number): boolean {
  return !n.expiresAt || new Date(n.expiresAt).getTime() > now;
}

export async function listForUser(
  userId: string,
  opts?: { limit?: number; offset?: number },
): Promise<{ items: UserNotification[]; total: number; unread: number }> {
  const now = Date.now();
  const all = (await readUserNotifications(userId))
    .filter((n) => isLive(n, now))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const offset = Math.max(0, opts?.offset ?? 0);
  const limit = Math.max(1, Math.min(opts?.limit ?? 20, 100));
  return {
    items: all.slice(offset, offset + limit),
    total: all.length,
    unread: all.filter((n) => !n.readAt).length,
  };
}

export async function getSummary(userId: string): Promise<{ unread: number; total: number }> {
  const now = Date.now();
  const all = (await readUserNotifications(userId)).filter((n) => isLive(n, now));
  return { unread: all.filter((n) => !n.readAt).length, total: all.length };
}

/** Mark all as *seen* (badge acknowledgement) without marking them read. */
export async function markAllSeen(userId: string): Promise<void> {
  await withUserLock(userId, async () => {
    const list = await readUserNotifications(userId);
    const nowIso = new Date().toISOString();
    let changed = false;
    const next = list.map((n) => {
      if (n.seenAt) return n;
      changed = true;
      return { ...n, seenAt: nowIso };
    });
    if (changed) await writeUserNotifications(userId, next);
  });
}

export async function markRead(userId: string, id: string): Promise<{ unread: number }> {
  await withUserLock(userId, async () => {
    const list = await readUserNotifications(userId);
    const nowIso = new Date().toISOString();
    let changed = false;
    const next = list.map((n) => {
      if (n.id !== id || n.readAt) return n;
      changed = true;
      return { ...n, readAt: nowIso, seenAt: n.seenAt ?? nowIso };
    });
    if (changed) await writeUserNotifications(userId, next);
  });
  return getSummary(userId).then((s) => ({ unread: s.unread }));
}

export async function markAllRead(userId: string): Promise<{ unread: number }> {
  await withUserLock(userId, async () => {
    const list = await readUserNotifications(userId);
    const nowIso = new Date().toISOString();
    let changed = false;
    const next = list.map((n) => {
      if (n.readAt) return n;
      changed = true;
      return { ...n, readAt: nowIso, seenAt: n.seenAt ?? nowIso };
    });
    if (changed) await writeUserNotifications(userId, next);
  });
  return { unread: 0 };
}

export async function markClicked(userId: string, id: string): Promise<void> {
  await withUserLock(userId, async () => {
    const list = await readUserNotifications(userId);
    const nowIso = new Date().toISOString();
    let changed = false;
    const next = list.map((n) => {
      if (n.id !== id) return n;
      changed = true;
      return {
        ...n,
        clickedAt: n.clickedAt ?? nowIso,
        readAt: n.readAt ?? nowIso,
        seenAt: n.seenAt ?? nowIso,
      };
    });
    if (changed) await writeUserNotifications(userId, next);
  });
}

/* ── Preferences ──────────────────────────────────────────────────────────── */

export async function getPreferences(userId: string): Promise<NotificationPreferences> {
  const stored = await readPreferences(userId);
  return stored ? hydratePreferences(userId, stored) : defaultPreferences(userId);
}

export async function savePreferences(
  prefs: NotificationPreferences,
): Promise<NotificationPreferences> {
  const next = { ...prefs, updatedAt: new Date().toISOString() };
  await writePreferences(next);
  return next;
}
