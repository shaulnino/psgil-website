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
  // Use strong consistency so reads always reflect the latest write, bypassing CDN cache.
  // This prevents 404s right after case creation and stale UI after any mutation.
  const blobStore = getStore({ name: BLOB_STORE_NAME, consistency: "strong" });
  const data = await blobStore.get(BLOB_KEY, { type: "json" }) as StewardStore | null;
  if (!data) {
    const initial = buildDefaultStore();
    await blobStore.setJSON(BLOB_KEY, initial);
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
    if (!("historical" in cr)) {
      const title = typeof cr.title === "string" ? cr.title : "";
      cr.historical = title.includes("(historical)");
    }
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
    if (!("reminderSentAt"  in pr)) pr.reminderSentAt  = null;
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
      if (!("historical" in cr)) {
        const title = typeof cr.title === "string" ? cr.title : "";
        cr.historical = title.includes("(historical)");
      }
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
    if (!("reminderSentAt"  in pr)) pr.reminderSentAt  = null;
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

/* ------------------------------------------------------------------ */
/*  Public API                                                          */
/* ------------------------------------------------------------------ */

/**
 * Raw steward store as persisted — WITHOUT hydrating users from the accounts
 * store. Used only by the accounts migration (lib/accounts/store.ts) to read
 * the legacy `users[]` as a one-time import source, avoiding a read cycle.
 */
export async function readRawStore(): Promise<StewardStore> {
  return isNetlifyEnv() ? readFromBlob() : readFromFile();
}

/**
 * Public read. Users are the platform accounts (PW-2a): the accounts store is
 * the source of truth, so we hydrate `store.users` from it on every read. This
 * keeps every existing `store.users.find(...)` lookup in the repository working
 * unchanged while there is a single source of truth for identity. The `users`
 * array is a derived projection and is never written back (see writeStore).
 */
export async function readStore(): Promise<StewardStore> {
  const store = await readRawStore();
  const { listAccounts } = await import("@/lib/accounts/store");
  store.users = await listAccounts();
  return store;
}

/**
 * Serialize all writes (Netlify Blobs + local file) through one queue so
 * read-modify-write cycles don't clobber each other on the same instance.
 */
export async function writeStore(store: StewardStore): Promise<void> {
  // Users live in the accounts store (PW-2a) — never persist the hydrated
  // projection back into the monolith, so there's no stale duplicate source.
  const toPersist: StewardStore = { ...store, users: [] };
  _writeQueue = _writeQueue.then(async () => {
    if (isNetlifyEnv()) {
      const { getStore } = await import("@netlify/blobs");
      await getStore(BLOB_STORE_NAME).setJSON(BLOB_KEY, toPersist);
    } else {
      const { mkdir, writeFile } = await import("node:fs/promises");
      const path = await import("node:path");
      const DATA_DIR = path.join(process.cwd(), "data", "stewards");
      const STORE_PATH = path.join(DATA_DIR, "store.json");
      await mkdir(DATA_DIR, { recursive: true });
      await writeFile(STORE_PATH, JSON.stringify(toPersist, null, 2), "utf8");
    }
  });
  return _writeQueue;
}
