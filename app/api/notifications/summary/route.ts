import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { getSummary } from "@/lib/notifications/repository";

/** Lightweight badge poll: unread + total for the signed-in user. */
export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user || !user.isActive) return NextResponse.json({ unread: 0, total: 0 });
    const summary = await getSummary(user.id);
    return NextResponse.json(summary);
  } catch {
    return NextResponse.json({ unread: 0, total: 0 });
  }
}
