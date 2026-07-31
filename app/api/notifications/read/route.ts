import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { markAllRead, markRead } from "@/lib/notifications/repository";
import { markReadSchema } from "@/lib/notifications/types";

/** Mark one (`{ id }`) or all (`{ all: true }`) of the user's notifications read. */
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user || !user.isActive) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const body = await request.json().catch(() => ({}));
  const parsed = markReadSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "bad_request" }, { status: 400 });

  if (parsed.data.all) {
    const { unread } = await markAllRead(user.id);
    return NextResponse.json({ unread });
  }
  if (parsed.data.id) {
    const { unread } = await markRead(user.id, parsed.data.id);
    return NextResponse.json({ unread });
  }
  return NextResponse.json({ error: "bad_request" }, { status: 400 });
}
