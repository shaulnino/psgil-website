import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/session";
import { unsubscribePush } from "@/lib/notifications/pushRepository";

const schema = z.object({ endpoint: z.string().url().max(2000) });

/** Remove a Web Push subscription (this device) for the signed-in user. */
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user || !user.isActive) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "bad_request" }, { status: 400 });
  await unsubscribePush(user.id, parsed.data.endpoint);
  return NextResponse.json({ ok: true });
}
