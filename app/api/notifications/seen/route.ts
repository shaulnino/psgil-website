import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { getSummary, markAllSeen } from "@/lib/notifications/repository";

/** Acknowledge the badge: mark everything seen (does NOT mark read). */
export async function POST() {
  const user = await getCurrentUser();
  if (!user || !user.isActive) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  await markAllSeen(user.id);
  const summary = await getSummary(user.id);
  return NextResponse.json(summary);
}
