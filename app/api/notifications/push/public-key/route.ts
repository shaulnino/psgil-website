import { NextResponse } from "next/server";
import { VAPID_PUBLIC_KEY, isPushConfigured } from "@/lib/notifications/pushConfig";

/** The client needs the VAPID public key to create a subscription. */
export async function GET() {
  return NextResponse.json({
    configured: isPushConfigured(),
    publicKey: isPushConfigured() ? VAPID_PUBLIC_KEY : null,
  });
}
