import { NextRequest, NextResponse } from "next/server";
import { getCurrentStewardUser } from "@/lib/stewards/auth";

export async function GET(req: NextRequest) {
  const user = await getCurrentStewardUser();
  if (!user || !user.isActive) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const key = req.nextUrl.searchParams.get("key");
  if (!key) {
    return NextResponse.json({ error: "Missing key" }, { status: 400 });
  }

  try {
    const { getStore } = await import("@netlify/blobs");
    const blobStore = getStore("steward-files");

    const [buffer, meta] = await Promise.all([
      blobStore.get(key, { type: "arrayBuffer" }),
      blobStore.getMetadata(key),
    ]);

    if (!buffer) {
      return NextResponse.json({ error: "Attachment not found" }, { status: 404 });
    }

    const contentType =
      (meta?.metadata?.type as string | undefined) || "application/octet-stream";
    const fileName =
      (meta?.metadata?.name as string | undefined) || key;

    return new NextResponse(buffer, {
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `inline; filename="${fileName.replace(/"/g, "")}"`,
        // Must be private — authenticated content must never be cached by a shared CDN.
        "Cache-Control": "private, no-store",
      },
    });
  } catch (err) {
    console.error("[steward-attachment] error serving attachment:", err);
    return NextResponse.json({ error: "Failed to load attachment" }, { status: 500 });
  }
}
