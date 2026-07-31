/**
 * Push subscription repository (PW-4, Phase 2).
 *
 * One user has many subscriptions (one per device/browser). Subscriptions are
 * keyed by a stable hash of the endpoint so re-subscribing on the same device
 * updates in place instead of piling up duplicates. Writes are serialized per
 * user (separate lock namespace from the notification list).
 */
import { createHash } from "node:crypto";
import {
  readPushSubscriptions,
  withUserLock,
  writePushSubscriptions,
} from "@/lib/notifications/store";
import type { PushSubscriptionRecord } from "@/lib/notifications/types";

/** Max consecutive failures before a subscription is pruned as dead. */
const MAX_FAILURES = 5;

const subId = (endpoint: string) =>
  createHash("sha256").update(endpoint).digest("hex").slice(0, 32);

const lockKey = (userId: string) => `push:${userId}`;

export async function subscribePush(
  userId: string,
  input: { endpoint: string; keys: { p256dh: string; auth: string } },
  userAgent: string | null,
): Promise<PushSubscriptionRecord> {
  return withUserLock(lockKey(userId), async () => {
    const list = await readPushSubscriptions(userId);
    const id = subId(input.endpoint);
    const now = new Date().toISOString();
    const existing = list.find((s) => s.id === id);
    if (existing) {
      existing.keys = input.keys;
      existing.userAgent = userAgent;
      existing.failureCount = 0;
      existing.lastFailureAt = null;
      await writePushSubscriptions(userId, list);
      return existing;
    }
    const record: PushSubscriptionRecord = {
      id,
      userId,
      endpoint: input.endpoint,
      keys: input.keys,
      userAgent,
      createdAt: now,
      lastSuccessAt: null,
      lastFailureAt: null,
      failureCount: 0,
    };
    await writePushSubscriptions(userId, [...list, record]);
    return record;
  });
}

export async function unsubscribePush(userId: string, endpoint: string): Promise<void> {
  await withUserLock(lockKey(userId), async () => {
    const list = await readPushSubscriptions(userId);
    const id = subId(endpoint);
    const next = list.filter((s) => s.id !== id);
    if (next.length !== list.length) await writePushSubscriptions(userId, next);
  });
}

export async function listPushSubscriptions(
  userId: string,
): Promise<PushSubscriptionRecord[]> {
  return readPushSubscriptions(userId);
}

export async function countActiveDevices(userId: string): Promise<number> {
  return (await readPushSubscriptions(userId)).length;
}

/**
 * Apply the outcome of a send batch: bump success/failure timestamps and drop
 * subscriptions that are gone (410/404) or have failed too many times.
 */
export async function applySendResults(
  userId: string,
  results: { id: string; ok: boolean; gone: boolean }[],
): Promise<void> {
  if (results.length === 0) return;
  await withUserLock(lockKey(userId), async () => {
    const list = await readPushSubscriptions(userId);
    const byId = new Map(results.map((r) => [r.id, r]));
    const now = new Date().toISOString();
    const next: PushSubscriptionRecord[] = [];
    for (const sub of list) {
      const r = byId.get(sub.id);
      if (!r) {
        next.push(sub);
        continue;
      }
      if (r.gone) continue; // prune
      if (r.ok) {
        next.push({ ...sub, lastSuccessAt: now, failureCount: 0, lastFailureAt: null });
      } else {
        const failureCount = sub.failureCount + 1;
        if (failureCount >= MAX_FAILURES) continue; // prune after too many failures
        next.push({ ...sub, lastFailureAt: now, failureCount });
      }
    }
    await writePushSubscriptions(userId, next);
  });
}
