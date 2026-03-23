/**
 * Steward data store — backed by Netlify Blobs in production/preview,
 * and a local JSON file when running outside of Netlify (e.g. `npm run dev`).
 *
 * Only this file knows about the storage backend.
 * Everything else in the steward module uses readStore / writeStore.
 */

import { buildDefaultStore } from "@/lib/stewards/seed";
import type { StewardStore } from "@/lib/stewards/types";

const BLOB_STORE_NAME = "stewards";
const BLOB_KEY        = "store";

/* ------------------------------------------------------------------ */
/*  Detect environment                                                  */
/* ------------------------------------------------------------------ */

/**
 * True when running inside a real Netlify environment at runtime.
 * NETLIFY_BLOBS_CONTEXT is injected by the Netlify runtime on every function
 * invocation (production + preview). NETLIFY_DEV is injected by `netlify dev`.
 * Note: process.env.NETLIFY is only available at BUILD time, not runtime.
 */
function isNetlifyEnv(): boolean {
  return !!(process.env.NETLIFY_BLOBS_CONTEXT || process.env.NETLIFY_DEV);
}

/* ------------------------------------------------------------------ */
/*  Netlify Blobs backend                                               */
/* ------------------------------------------------------------------ */

async function readFromBlob(): Promise<StewardStore> {
  const { getStore } = await import("@netlify/blobs");
  const blobStore = getStore(BLOB_STORE_NAME);
  const data = await blobStore.get(BLOB_KEY, { type: "json" }) as StewardStore | null;
  if (!data) {
    const initial = buildDefaultStore();
    await writeToBlob(initial);
    return initial;
  }
  if (!data.driverVerdicts) data.driverVerdicts = [];
  if (!data.penaltiesToServe) data.penaltiesToServe = [];
  // Backfill new fields on existing penalty records
  for (const p of data.penaltiesToServe) {
    if (!("sourceRuleId" in p)) (p as Record<string, unknown>).sourceRuleId = null;
    if (!("sourceRuleIndex" in p)) (p as Record<string, unknown>).sourceRuleIndex = 1;
  }
  // Backfill mustChangePassword on existing users
  for (const u of data.users) {
    if (!("mustChangePassword" in u)) (u as Record<string, unknown>).mustChangePassword = false;
  }
  // Backfill attachments/links on case responses that predate the field
  for (const r of data.responses ?? []) {
    if (!Array.isArray((r as Record<string, unknown>).attachments))
      (r as Record<string, unknown>).attachments = [];
    if (!Array.isArray((r as Record<string, unknown>).links))
      (r as Record<string, unknown>).links = [];
  }
  // Backfill attachments/links on cases
  for (const c of data.cases ?? []) {
    if (!Array.isArray((c as Record<string, unknown>).attachments))
      (c as Record<string, unknown>).attachments = [];
    if (!Array.isArray((c as Record<string, unknown>).links))
      (c as Record<string, unknown>).links = [];
  }
  // Backfill appeal collections
  if (!data.appeals)                data.appeals                = [];
  if (!data.appealVerdicts)         data.appealVerdicts         = [];
  if (!data.appealDriverVerdicts)   data.appealDriverVerdicts   = [];
  if (!data.appealInternalComments) data.appealInternalComments = [];
  // Backfill attachments/links on appeals
  for (const a of data.appeals) {
    if (!Array.isArray((a as Record<string, unknown>).attachments))
      (a as Record<string, unknown>).attachments = [];
    if (!Array.isArray((a as Record<string, unknown>).links))
      (a as Record<string, unknown>).links = [];
  }
  return data;
}

async function writeToBlob(store: StewardStore): Promise<void> {
  const { getStore } = await import("@netlify/blobs");
  const blobStore = getStore(BLOB_STORE_NAME);
  await blobStore.setJSON(BLOB_KEY, store);
}

/* ------------------------------------------------------------------ */
/*  Local filesystem fallback                                           */
/* ------------------------------------------------------------------ */

async function readFromFile(): Promise<StewardStore> {
  const { mkdir, readFile, writeFile } = await import("node:fs/promises");
  const path = await import("node:path");
  const DATA_DIR   = path.join(process.cwd(), "data", "stewards");
  const STORE_PATH = path.join(DATA_DIR, "store.json");

  await mkdir(DATA_DIR, { recursive: true });

  try {
    const raw = await readFile(STORE_PATH, "utf8");
    const store = JSON.parse(raw) as StewardStore;
    if (!store.driverVerdicts) store.driverVerdicts = [];
    if (!store.penaltiesToServe) store.penaltiesToServe = [];
    for (const p of store.penaltiesToServe) {
      if (!("sourceRuleId" in p)) (p as Record<string, unknown>).sourceRuleId = null;
      if (!("sourceRuleIndex" in p)) (p as Record<string, unknown>).sourceRuleIndex = 1;
    }
    for (const u of store.users) {
      if (!("mustChangePassword" in u)) (u as Record<string, unknown>).mustChangePassword = false;
    }
    for (const r of store.responses ?? []) {
      if (!Array.isArray((r as Record<string, unknown>).attachments))
        (r as Record<string, unknown>).attachments = [];
      if (!Array.isArray((r as Record<string, unknown>).links))
        (r as Record<string, unknown>).links = [];
    }
    for (const c of store.cases ?? []) {
      if (!Array.isArray((c as Record<string, unknown>).attachments))
        (c as Record<string, unknown>).attachments = [];
      if (!Array.isArray((c as Record<string, unknown>).links))
        (c as Record<string, unknown>).links = [];
    }
    if (!store.appeals)                store.appeals                = [];
    if (!store.appealVerdicts)         store.appealVerdicts         = [];
    if (!store.appealDriverVerdicts)   store.appealDriverVerdicts   = [];
    if (!store.appealInternalComments) store.appealInternalComments = [];
    for (const a of store.appeals) {
      if (!Array.isArray((a as Record<string, unknown>).attachments))
        (a as Record<string, unknown>).attachments = [];
      if (!Array.isArray((a as Record<string, unknown>).links))
        (a as Record<string, unknown>).links = [];
    }
    return store;
  } catch {
    const initial = buildDefaultStore();
    await writeFile(STORE_PATH, JSON.stringify(initial, null, 2), "utf8");
    return initial;
  }
}

let _writeQueue = Promise.resolve();

async function writeToFile(store: StewardStore): Promise<void> {
  const { mkdir, writeFile } = await import("node:fs/promises");
  const path = await import("node:path");
  const DATA_DIR   = path.join(process.cwd(), "data", "stewards");
  const STORE_PATH = path.join(DATA_DIR, "store.json");

  await mkdir(DATA_DIR, { recursive: true });

  _writeQueue = _writeQueue.then(() =>
    writeFile(STORE_PATH, JSON.stringify(store, null, 2), "utf8"),
  );
  await _writeQueue;
}

/* ------------------------------------------------------------------ */
/*  Public API                                                          */
/* ------------------------------------------------------------------ */

export async function readStore(): Promise<StewardStore> {
  return isNetlifyEnv() ? readFromBlob() : readFromFile();
}

export async function writeStore(store: StewardStore): Promise<void> {
  return isNetlifyEnv() ? writeToBlob(store) : writeToFile(store);
}
