/**
 * Notifications storage (PW-4) — mirrors the attendance/steward store pattern.
 *
 *   - Production/preview (Netlify): Netlify Blobs store "notifications".
 *     One blob per user holds that user's notification list (`user/{userId}`),
 *     one blob per user holds preferences (`prefs/{userId}`). Per-user documents
 *     keep the header/unread-count read to a single fetch, which matters because
 *     the bell polls. Writes are serialized per user (below) to make the
 *     read-modify-write safe within an instance.
 *   - Local dev: a single JSON file (data/notifications/store.json).
 *
 * At league scale (tens–low-hundreds of accounts, capped history per user) a
 * per-user document is cheap. If write contention ever becomes real, migrate to
 * per-record keys like the attendance store.
 */
import type {
  NotificationPreferences,
  PushSubscriptionRecord,
  UserNotification,
} from "@/lib/notifications/types";

const BLOB_STORE_NAME = "notifications";
const USER_PREFIX = "user/";
const PREFS_PREFIX = "prefs/";
const PUSH_PREFIX = "push/";
const SNAPSHOT_PREFIX = "snapshot/";

/** Keep only the most recent N notifications per user (retention safety net). */
export const MAX_PER_USER = 200;

function isNetlifyEnv(): boolean {
  return !!(process.env.NETLIFY_BLOBS_CONTEXT || process.env.NETLIFY_DEV);
}

/* ── Per-user write serialization (within one instance) ──────────────────── */

const queues = new Map<string, Promise<unknown>>();

/** Serialize read-modify-write cycles for a single user so concurrent creates
 *  and read-state updates on the same instance don't clobber each other. */
export async function withUserLock<T>(userId: string, fn: () => Promise<T>): Promise<T> {
  const prev = queues.get(userId) ?? Promise.resolve();
  const run = prev.then(fn, fn);
  queues.set(
    userId,
    run.then(
      () => undefined,
      () => undefined,
    ),
  );
  return run;
}

/* ── Netlify Blobs backend ──────────────────────────────────────────────── */

async function blobStore() {
  const { getStore } = await import("@netlify/blobs");
  return getStore({ name: BLOB_STORE_NAME, consistency: "strong" });
}

/* ── Local file backend (dev) ────────────────────────────────────────────── */

type FileShape = {
  byUser: Record<string, UserNotification[]>;
  prefs: Record<string, NotificationPreferences>;
  pushSubs: Record<string, PushSubscriptionRecord[]>;
  snapshots: Record<string, unknown>;
};

async function filePaths() {
  const path = await import("node:path");
  const dir = path.join(process.cwd(), "data", "notifications");
  return { dir, file: path.join(dir, "store.json") };
}

async function fileRead(): Promise<FileShape> {
  const { readFile } = await import("node:fs/promises");
  const { file } = await filePaths();
  try {
    const parsed = JSON.parse(await readFile(file, "utf8")) as Partial<FileShape>;
    return {
      byUser: parsed.byUser ?? {},
      prefs: parsed.prefs ?? {},
      pushSubs: parsed.pushSubs ?? {},
      snapshots: parsed.snapshots ?? {},
    };
  } catch {
    return { byUser: {}, prefs: {}, pushSubs: {}, snapshots: {} };
  }
}

async function fileWrite(data: FileShape): Promise<void> {
  const { mkdir, writeFile } = await import("node:fs/promises");
  const { dir, file } = await filePaths();
  await mkdir(dir, { recursive: true });
  await writeFile(file, JSON.stringify(data, null, 2), "utf8");
}

/* ── Public API ──────────────────────────────────────────────────────────── */

export async function readUserNotifications(userId: string): Promise<UserNotification[]> {
  if (isNetlifyEnv()) {
    const store = await blobStore();
    const list = (await store.get(`${USER_PREFIX}${userId}`, { type: "json" })) as
      | UserNotification[]
      | null;
    return Array.isArray(list) ? list : [];
  }
  const data = await fileRead();
  return data.byUser[userId] ?? [];
}

export async function writeUserNotifications(
  userId: string,
  list: UserNotification[],
): Promise<void> {
  // Newest first, capped.
  const capped = [...list]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, MAX_PER_USER);
  if (isNetlifyEnv()) {
    const store = await blobStore();
    await store.setJSON(`${USER_PREFIX}${userId}`, capped);
    return;
  }
  const data = await fileRead();
  data.byUser[userId] = capped;
  await fileWrite(data);
}

export async function readPreferences(userId: string): Promise<NotificationPreferences | null> {
  if (isNetlifyEnv()) {
    const store = await blobStore();
    return (await store.get(`${PREFS_PREFIX}${userId}`, { type: "json" })) as
      | NotificationPreferences
      | null;
  }
  const data = await fileRead();
  return data.prefs[userId] ?? null;
}

export async function writePreferences(prefs: NotificationPreferences): Promise<void> {
  if (isNetlifyEnv()) {
    const store = await blobStore();
    await store.setJSON(`${PREFS_PREFIX}${prefs.userId}`, prefs);
    return;
  }
  const data = await fileRead();
  data.prefs[prefs.userId] = prefs;
  await fileWrite(data);
}

/* ── Push subscriptions (per user) ───────────────────────────────────────── */

export async function readPushSubscriptions(
  userId: string,
): Promise<PushSubscriptionRecord[]> {
  if (isNetlifyEnv()) {
    const store = await blobStore();
    const list = (await store.get(`${PUSH_PREFIX}${userId}`, { type: "json" })) as
      | PushSubscriptionRecord[]
      | null;
    return Array.isArray(list) ? list : [];
  }
  const data = await fileRead();
  return data.pushSubs[userId] ?? [];
}

export async function writePushSubscriptions(
  userId: string,
  subs: PushSubscriptionRecord[],
): Promise<void> {
  if (isNetlifyEnv()) {
    const store = await blobStore();
    await store.setJSON(`${PUSH_PREFIX}${userId}`, subs);
    return;
  }
  const data = await fileRead();
  data.pushSubs[userId] = subs;
  await fileWrite(data);
}

/* ── Engine snapshots (diff baselines for CSV/time-derived events) ─────────── */

export async function readSnapshot<T>(key: string): Promise<T | null> {
  if (isNetlifyEnv()) {
    const store = await blobStore();
    return ((await store.get(`${SNAPSHOT_PREFIX}${key}`, { type: "json" })) as T | null) ?? null;
  }
  const data = await fileRead();
  return (data.snapshots[key] as T | undefined) ?? null;
}

export async function writeSnapshot<T>(key: string, value: T): Promise<void> {
  if (isNetlifyEnv()) {
    const store = await blobStore();
    await store.setJSON(`${SNAPSHOT_PREFIX}${key}`, value);
    return;
  }
  const data = await fileRead();
  data.snapshots[key] = value;
  await fileWrite(data);
}
