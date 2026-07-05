import { readDriverPhoto } from "@/lib/drivers/photoStore";

/**
 * Serves an uploaded driver photo from Netlify Blobs (production). In dev,
 * photos are served statically from /uploads/drivers, so this returns 404
 * there. Cached at the CDN; the ?v= version query busts it on re-upload.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ driverId: string }> },
) {
  const { driverId } = await params;
  const photo = await readDriverPhoto(driverId).catch(() => null);
  if (!photo) return new Response("Not found", { status: 404 });
  return new Response(photo.body, {
    headers: {
      "Content-Type": photo.type,
      "Cache-Control": "public, max-age=300, stale-while-revalidate=86400",
    },
  });
}
