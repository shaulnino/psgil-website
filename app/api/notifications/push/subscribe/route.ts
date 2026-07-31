import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { isPushConfigured } from "@/lib/notifications/pushConfig";
import { subscribePush } from "@/lib/notifications/pushRepository";
import { pushSubscriptionInputSchema } from "@/lib/notifications/types";

/** Store (or refresh) a Web Push subscription for the signed-in user's device. */
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user || !user.isActive) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!isPushConfigured()) {
    return NextResponse.json({ error: "push_unconfigured" }, { status: 503 });
  }
  const body = await request.json().catch(() => null);
  const parsed = pushSubscriptionInputSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "bad_request" }, { status: 400 });

  const userAgent = request.headers.get("user-agent");
  await subscribePush(user.id, parsed.data, userAgent);
  return NextResponse.json({ ok: true });
}
