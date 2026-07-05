/**
 * Account storage (PW-2a) — the source of truth for platform identity.
 *
 * Backend is swappable and hidden behind this file (mirrors lib/stewards/store.ts):
 *   - Production/preview (Netlify): one blob PER account, keyed `acct/{id}`,
 *     plus an email index `email/{normalizedEmail}` → { id }. Per-record keys
 *     mean registration / attendance writes never rewrite a shared document, so
 *     concurrent writes across serverless instances don't clobber each other —
 *     the failure mode of the monolithic steward store.
 *   - Local dev: a single JSON file (data/accounts/store.json). One instance,
 *     no concurrency, so a whole-file read/write is fine.
 *
 * TRIPWIRE → real DB: if relational needs appear (team dashboards, reliability
 * scores, cross-entity reporting, large notification fan-out), swap this file's
 * backend for a datastore. Callers use the repository, so that's a backend swap,
 * not an app rewrite.
 */
import type { Account } from "@/lib/accounts/types";

const BLOB_STORE_NAME = "accounts";
const ACCT_PREFIX = "acct/";
const EMAIL_PREFIX = "email/";

function isNetlifyEnv(): boolean {
  return !!(process.env.NETLIFY_BLOBS_CONTEXT || process.env.NETLIFY_DEV);
}

const normEmail = (email: string) => email.trim().toLowerCase();

/** Back-fill fields that legacy/migrated records may lack, so every returned
 *  object is a complete Account. */
function hydrate(raw: Partial<Account> & { id: string }): Account {
  return {
    id: raw.id,
    name: raw.name ?? "",
    email: normEmail(raw.email ?? ""),
    roles: Array.isArray(raw.roles) ? raw.roles : [],
    passwordHash: raw.passwordHash ?? "",
    isActive: raw.isActive ?? true,
    status: raw.status ?? "approved", // grandfather pre-existing/migrated users
    mustChangePassword: raw.mustChangePassword ?? false,
    emailVerified: raw.emailVerified ?? true, // grandfather pre-existing users
    driverId: raw.driverId ?? null,
    locale: raw.locale,
    createdAt: raw.createdAt ?? new Date(0).toISOString(),
    updatedAt: raw.updatedAt ?? new Date(0).toISOString(),
  };
}

/* ── Netlify Blobs backend (per-record keys) ─────────────────────────────── */

async function blobStore() {
  const { getStore } = await import("@netlify/blobs");
  return getStore({ name: BLOB_STORE_NAME, consistency: "strong" });
}

async function blobList(): Promise<Account[]> {
  const store = await blobStore();
  const { blobs } = await store.list({ prefix: ACCT_PREFIX });
  const records = await Promise.all(
    blobs.map((b) => store.get(b.key, { type: "json" }) as Promise<Account | null>),
  );
  return records.filter((r): r is Account => !!r).map(hydrate);
}

async function blobPut(account: Account): Promise<void> {
  const store = await blobStore();
  await store.setJSON(`${ACCT_PREFIX}${account.id}`, account);
  await store.setJSON(`${EMAIL_PREFIX}${normEmail(account.email)}`, { id: account.id });
}

async function blobGetByEmail(email: string): Promise<Account | null> {
  const store = await blobStore();
  const idx = (await store.get(`${EMAIL_PREFIX}${normEmail(email)}`, { type: "json" })) as
    | { id: string }
    | null;
  if (!idx?.id) return null;
  const rec = (await store.get(`${ACCT_PREFIX}${idx.id}`, { type: "json" })) as Account | null;
  return rec ? hydrate(rec) : null;
}

async function blobDelete(id: string): Promise<void> {
  const store = await blobStore();
  const rec = (await store.get(`${ACCT_PREFIX}${id}`, { type: "json" })) as Account | null;
  await store.delete(`${ACCT_PREFIX}${id}`);
  if (rec?.email) await store.delete(`${EMAIL_PREFIX}${normEmail(rec.email)}`);
}

/* ── Local file backend (dev) ────────────────────────────────────────────── */

type FileShape = { accounts: Account[] };

async function filePaths() {
  const path = await import("node:path");
  const dir = path.join(process.cwd(), "data", "accounts");
  return { dir, file: path.join(dir, "store.json") };
}

async function fileReadAll(): Promise<Account[]> {
  const { readFile } = await import("node:fs/promises");
  const { file } = await filePaths();
  try {
    const parsed = JSON.parse(await readFile(file, "utf8")) as FileShape;
    return (parsed.accounts ?? []).map(hydrate);
  } catch {
    return [];
  }
}

async function fileWriteAll(accounts: Account[]): Promise<void> {
  const { mkdir, writeFile } = await import("node:fs/promises");
  const { dir, file } = await filePaths();
  await mkdir(dir, { recursive: true });
  await writeFile(file, JSON.stringify({ accounts } satisfies FileShape, null, 2), "utf8");
}

/* ── One-time migration from the monolithic steward store ─────────────────── */

let _initPromise: Promise<void> | null = null;

/**
 * On first access, if no accounts exist yet, import the users from the steward
 * monolith (`readRawStore().users`) — which is itself seeded with defaults on a
 * fresh install. Uses the RAW steward read (no account hydration) to avoid a
 * read cycle. Idempotent: importing the same ids just overwrites the same keys.
 */
async function ensureInitialized(): Promise<void> {
  if (_initPromise) return _initPromise;
  _initPromise = (async () => {
    const existing = isNetlifyEnv() ? await blobList() : await fileReadAll();
    if (existing.length > 0) return;

    const { readRawStore } = await import("@/lib/stewards/store");
    const raw = await readRawStore();
    const source = (raw.users ?? []) as (Partial<Account> & { id: string })[];
    if (source.length === 0) return;

    const migrated = source.map(hydrate);
    if (isNetlifyEnv()) {
      for (const a of migrated) await blobPut(a);
    } else {
      await fileWriteAll(migrated);
    }
  })();
  return _initPromise;
}

/* ── Public API ──────────────────────────────────────────────────────────── */

export async function listAccounts(): Promise<Account[]> {
  await ensureInitialized();
  return isNetlifyEnv() ? blobList() : fileReadAll();
}

export async function getAccountById(id: string): Promise<Account | null> {
  const all = await listAccounts();
  return all.find((a) => a.id === id) ?? null;
}

export async function getAccountByEmail(email: string): Promise<Account | null> {
  await ensureInitialized();
  if (isNetlifyEnv()) return blobGetByEmail(email);
  const all = await fileReadAll();
  return all.find((a) => normEmail(a.email) === normEmail(email)) ?? null;
}

export async function putAccount(account: Account): Promise<void> {
  await ensureInitialized();
  if (isNetlifyEnv()) {
    await blobPut(account);
  } else {
    const all = await fileReadAll();
    const next = all.filter((a) => a.id !== account.id);
    next.push(account);
    await fileWriteAll(next);
  }
}

export async function deleteAccount(id: string): Promise<void> {
  await ensureInitialized();
  if (isNetlifyEnv()) {
    await blobDelete(id);
  } else {
    const all = await fileReadAll();
    await fileWriteAll(all.filter((a) => a.id !== id));
  }
}
