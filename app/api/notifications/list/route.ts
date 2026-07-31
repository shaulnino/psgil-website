import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { listForUser } from "@/lib/notifications/repository";

/** Paginated notification list for the signed-in user (bell panel + full page). */
export async function GET(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user || !user.isActive) {
      return NextResponse.json({ items: [], total: 0, unread: 0 });
    }
    const { searchParams } = new URL(request.url);
    const limit = Number(searchParams.get("limit") ?? "20");
    const offset = Number(searchParams.get("offset") ?? "0");
    const result = await listForUser(user.id, {
      limit: Number.isFinite(limit) ? limit : 20,
      offset: Number.isFinite(offset) ? offset : 0,
    });
    return NextResponse.json(result);
  } catch {
    return NextResponse.json({ items: [], total: 0, unread: 0 });
  }
}
