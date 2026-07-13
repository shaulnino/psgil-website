/**
 * Attendance storage (PW-3) — mirrors the per-record account store.
 *
 *   - Production/preview (Netlify): one blob PER RSVP, keyed
 *     `rsvp/{raceId}/{driverId}`. Per-record keys mean a driver's RSVP write
 *     never rewrites a shared document, so concurrent submissions across
 *     serverless instances can't clobber each other (the monolithic-store
 *     failure mode). Roster reads list by the `rsvp/{raceId}/` prefix.
 *   - Local dev: a single JSON file (data/attendance/store.json).
 *
 * The backend is hidden behind this file; callers use the repository.
 */
import type { AttendanceRecord, AttendanceStatus } from "@/lib/attendance/types";

const BLOB_STORE_NAME = "attendance";
const RSVP_PREFIX = "rsvp/";

function isNetlifyEnv(): boolean {
  return !!(process.env.NETLIFY_BLOBS_CONTEXT || process.env.NETLIFY_DEV);
}

const key = (raceId: string, driverId: string) => `${RSVP_PREFIX}${raceId}/${driverId}`;

function hydrate(raw: Partial<AttendanceRecord>): AttendanceRecord | null {
  if (!raw.raceId || !raw.driverId || !raw.status) return null;
  return {
    raceId: raw.raceId,
    driverId: raw.driverId,
    accountId: raw.accountId ?? "",
    status: raw.status as AttendanceStatus,
    updatedAt: raw.updatedAt ?? new Date(0).toISOString(),
  };
}

/* ── Netlify Blobs backend (per-record keys) ─────────────────────────────── */

async function blobStore() {
  const { getStore } = await import("@netlify/blobs");
  return getStore({ name: BLOB_STORE_NAME, consistency: "strong" });
}

async function blobListByPrefix(prefix: string): Promise<AttendanceRecord[]> {
  const store = await blobStore();
  const { blobs } = await store.list({ prefix });
  const records = await Promise.all(
    blobs.map((b) => store.get(b.key, { type: "json" }) as Promise<Partial<AttendanceRecord> | null>),
  );
  return records.map((r) => (r ? hydrate(r) : null)).filter((r): r is AttendanceRecord => !!r);
}

/* ── Local file backend (dev) ────────────────────────────────────────────── */

type FileShape = { records: AttendanceRecord[] };

async function filePaths() {
  const path = await import("node:path");
  const dir = path.join(process.cwd(), "data", "attendance");
  return { dir, file: path.join(dir, "store.json") };
}

async function fileReadAll(): Promise<AttendanceRecord[]> {
  const { readFile } = await import("node:fs/promises");
  const { file } = await filePaths();
  try {
    const parsed = JSON.parse(await readFile(file, "utf8")) as FileShape;
    return (parsed.records ?? []).map(hydrate).filter((r): r is AttendanceRecord => !!r);
  } catch {
    return [];
  }
}

async function fileWriteAll(records: AttendanceRecord[]): Promise<void> {
  const { mkdir, writeFile } = await import("node:fs/promises");
  const { dir, file } = await filePaths();
  await mkdir(dir, { recursive: true });
  await writeFile(file, JSON.stringify({ records } satisfies FileShape, null, 2), "utf8");
}

/* ── Public API ──────────────────────────────────────────────────────────── */

export async function putAttendance(record: AttendanceRecord): Promise<void> {
  if (isNetlifyEnv()) {
    const store = await blobStore();
    await store.setJSON(key(record.raceId, record.driverId), record);
    return;
  }
  const all = await fileReadAll();
  const next = all.filter((r) => !(r.raceId === record.raceId && r.driverId === record.driverId));
  next.push(record);
  await fileWriteAll(next);
}

export async function getAttendance(raceId: string, driverId: string): Promise<AttendanceRecord | null> {
  if (isNetlifyEnv()) {
    const store = await blobStore();
    const rec = (await store.get(key(raceId, driverId), { type: "json" })) as Partial<AttendanceRecord> | null;
    return rec ? hydrate(rec) : null;
  }
  const all = await fileReadAll();
  return all.find((r) => r.raceId === raceId && r.driverId === driverId) ?? null;
}

/** All RSVPs for one race-day group (admin roster). */
export async function listAttendanceForRace(raceId: string): Promise<AttendanceRecord[]> {
  if (isNetlifyEnv()) return blobListByPrefix(`${RSVP_PREFIX}${raceId}/`);
  const all = await fileReadAll();
  return all.filter((r) => r.raceId === raceId);
}

/** All RSVPs a driver has submitted (across races). */
export async function listAttendanceForDriver(driverId: string): Promise<AttendanceRecord[]> {
  if (isNetlifyEnv()) {
    const all = await blobListByPrefix(RSVP_PREFIX);
    return all.filter((r) => r.driverId === driverId);
  }
  const all = await fileReadAll();
  return all.filter((r) => r.driverId === driverId);
}
