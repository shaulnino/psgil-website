import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { getSummary, markClicked } from "@/lib/notifications/repository";
import { clickSchema } from "@/lib/notifications/types";

/** Record a click (marks clicked + read) so opening an item clears its unread state. */
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user || !user.isActive) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const body = await request.json().catch(() => ({}));
  const parsed = clickSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "bad_request" }, { status: 400 });
  await markClicked(user.id, parsed.data.id);
  const summary = await getSummary(user.id);
  return NextResponse.json({ unread: summary.unread });
}
