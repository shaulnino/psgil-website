/**
 * Driver profile photos (PW-2e). A linked driver uploads a photo from their
 * account; it's stored dynamically and overrides the CSV `photo_url` on the
 * public drivers page.
 *
 * Storage mirrors steward attachments:
 *   - Production (Netlify): blob store "driver-photos", key = driverId.
 *     Served through /api/driver-photo/[driverId].
 *   - Local dev: written to public/uploads/drivers/{driverId}.{ext} and served
 *     statically at that path.
 *
 * The account stores the resolved (env-appropriate) URL in `driverPhotoUrl`.
 */
import path from "node:path";

const BLOB_STORE_NAME = "driver-photos";
const MAX_PHOTO_BYTES = 5 * 1024 * 1024; // 5 MB
const ALLOWED_EXTS = new Set([".jpg", ".jpeg", ".png", ".webp", ".gif"]);

function isNetlifyEnv(): boolean {
  return !!(process.env.NETLIFY_BLOBS_CONTEXT || process.env.NETLIFY_DEV);
}

/** Validate an uploaded image; returns the safe extension. Throws on bad input. */
function validateImage(file: File): string {
  if (file.size === 0) throw new Error("No file provided.");
  if (file.size > MAX_PHOTO_BYTES) throw new Error("Image exceeds the 5 MB limit.");
  const ext = path.extname(file.name || "").toLowerCase();
  const type = (file.type || "").toLowerCase();
  if (!ALLOWED_EXTS.has(ext) || !type.startsWith("image/")) {
    throw new Error("Unsupported image type. Use JPG, PNG, WebP, or GIF.");
  }
  return ext;
}

/**
 * Save a driver's photo and return its public URL (with a version query for
 * cache-busting). `version` is the upload timestamp.
 */
export async function saveDriverPhoto(driverId: string, file: File, version: string): Promise<string> {
  const ext = validateImage(file);
  const arrayBuffer = await file.arrayBuffer();
  const v = encodeURIComponent(version);

  if (isNetlifyEnv()) {
    const { getStore } = await import("@netlify/blobs");
    await getStore(BLOB_STORE_NAME).set(driverId, arrayBuffer, {
      metadata: { type: file.type || "image/jpeg" },
    });
    return `/api/driver-photo/${encodeURIComponent(driverId)}?v=${v}`;
  }

  const { mkdir, writeFile } = await import("node:fs/promises");
  const dir = path.join(process.cwd(), "public", "uploads", "drivers");
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, `${driverId}${ext}`), Buffer.from(arrayBuffer));
  return `/uploads/drivers/${encodeURIComponent(driverId)}${ext}?v=${v}`;
}

/**
 * Delete a driver's uploaded photo. Removes the Netlify blob in production, or
 * the local file(s) in dev. Safe to call when no photo exists.
 */
export async function deleteDriverPhoto(driverId: string): Promise<void> {
  if (isNetlifyEnv()) {
    const { getStore } = await import("@netlify/blobs");
    await getStore(BLOB_STORE_NAME).delete(driverId);
    return;
  }

  const { unlink } = await import("node:fs/promises");
  const dir = path.join(process.cwd(), "public", "uploads", "drivers");
  await Promise.all(
    [...ALLOWED_EXTS].map(async (ext) => {
      try {
        await unlink(path.join(dir, `${driverId}${ext}`));
      } catch {
        // Missing file for this extension is fine.
      }
    }),
  );
}

/** Read a driver's photo bytes (production blob path — used by the API route). */
export async function readDriverPhoto(
  driverId: string,
): Promise<{ body: ArrayBuffer; type: string } | null> {
  if (!isNetlifyEnv()) return null; // dev is served statically from /uploads
  const { getStore } = await import("@netlify/blobs");
  const store = getStore(BLOB_STORE_NAME);
  const result = await store.getWithMetadata(driverId, { type: "arrayBuffer" });
  if (!result) return null;
  const type = typeof result.metadata?.type === "string" ? result.metadata.type : "image/jpeg";
  return { body: result.data, type };
}
