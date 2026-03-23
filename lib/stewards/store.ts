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
  if (!data.driverVerdicts)   data.driverVerdicts   = [];
  if (!data.penaltiesToServe) data.penaltiesToServe = [];
  // ── Users ────────────────────────────────────────────────────
  for (const u of data.users ?? []) {
    if (!("mustChangePassword" in u))    (u as Record<string, unknown>).mustChangePassword = false;
    if (!Array.isArray((u as Record<string, unknown>).roles))
      (u as Record<string, unknown>).roles = [];
  }
  // ── Cases ────────────────────────────────────────────────────
  for (const c of data.cases ?? []) {
    const cr = c as Record<string, unknown>;
    if (!Array.isArray(cr.attachments))       cr.attachments       = [];
    if (!Array.isArray(cr.links))             cr.links             = [];
    if (!Array.isArray(cr.involvedDriverIds)) cr.involvedDriverIds = [];
    if (!Array.isArray(cr.responseIds))       cr.responseIds       = [];
    if (!Array.isArray(cr.internalCommentIds))cr.internalCommentIds= [];
  }
  // ── Case responses ───────────────────────────────────────────
  for (const r of data.responses ?? []) {
    const rr = r as Record<string, unknown>;
    if (!Array.isArray(rr.attachments)) rr.attachments = [];
    if (!Array.isArray(rr.links))       rr.links       = [];
  }
  // ── Penalties to serve ───────────────────────────────────────
  for (const p of data.penaltiesToServe ?? []) {
    const pr = p as Record<string, unknown>;
    if (!("sourceRuleId"    in pr)) pr.sourceRuleId    = null;
    if (!("sourceRuleIndex" in pr)) pr.sourceRuleIndex = 1;
    if (!Array.isArray(pr.sourceCaseIds)) pr.sourceCaseIds = [];
  }
  // ── Appeal collections ───────────────────────────────────────
  if (!data.appeals)                data.appeals                = [];
  if (!data.appealVerdicts)         data.appealVerdicts         = [];
  if (!data.appealDriverVerdicts)   data.appealDriverVerdicts   = [];
  if (!data.appealInternalComments) data.appealInternalComments = [];
  for (const a of data.appeals) {
    const ar = a as Record<string, unknown>;
    if (!Array.isArray(ar.attachments))        ar.attachments        = [];
    if (!Array.isArray(ar.links))              ar.links              = [];
    if (!Array.isArray(ar.internalCommentIds)) ar.internalCommentIds = [];
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
    if (!store.driverVerdicts)   store.driverVerdicts   = [];
    if (!store.penaltiesToServe) store.penaltiesToServe = [];
    // ── Users ──────────────────────────────────────────────────
    for (const u of store.users ?? []) {
      if (!("mustChangePassword" in u))    (u as Record<string, unknown>).mustChangePassword = false;
      if (!Array.isArray((u as Record<string, unknown>).roles))
        (u as Record<string, unknown>).roles = [];
    }
    // ── Cases ──────────────────────────────────────────────────
    for (const c of store.cases ?? []) {
      const cr = c as Record<string, unknown>;
      if (!Array.isArray(cr.attachments))       cr.attachments       = [];
      if (!Array.isArray(cr.links))             cr.links             = [];
      if (!Array.isArray(cr.involvedDriverIds)) cr.involvedDriverIds = [];
      if (!Array.isArray(cr.responseIds))       cr.responseIds       = [];
      if (!Array.isArray(cr.internalCommentIds))cr.internalCommentIds= [];
    }
    // ── Case responses ─────────────────────────────────────────
    for (const r of store.responses ?? []) {
      const rr = r as Record<string, unknown>;
      if (!Array.isArray(rr.attachments)) rr.attachments = [];
      if (!Array.isArray(rr.links))       rr.links       = [];
    }
    // ── Penalties to serve ─────────────────────────────────────
    for (const p of store.penaltiesToServe ?? []) {
      const pr = p as Record<string, unknown>;
      if (!("sourceRuleId"    in pr)) pr.sourceRuleId    = null;
      if (!("sourceRuleIndex" in pr)) pr.sourceRuleIndex = 1;
      if (!Array.isArray(pr.sourceCaseIds)) pr.sourceCaseIds = [];
    }
    // ── Appeal collections ─────────────────────────────────────
    if (!store.appeals)                store.appeals                = [];
    if (!store.appealVerdicts)         store.appealVerdicts         = [];
    if (!store.appealDriverVerdicts)   store.appealDriverVerdicts   = [];
    if (!store.appealInternalComments) store.appealInternalComments = [];
    for (const a of store.appeals) {
      const ar = a as Record<string, unknown>;
      if (!Array.isArray(ar.attachments))        ar.attachments        = [];
      if (!Array.isArray(ar.links))              ar.links              = [];
      if (!Array.isArray(ar.internalCommentIds)) ar.internalCommentIds = [];
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
