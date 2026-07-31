import { NextResponse } from "next/server";
import { runTick } from "@/lib/notifications/engine/tick";

/**
 * Scheduled notification tick (PW-4, Phase 3).
 *
 * Invoked by the Netlify Scheduled Function every ~10 minutes. Protected by a
 * shared secret (`NOTIFICATIONS_TICK_SECRET`) passed as the `x-tick-key` header
 * or `?key=`. When the secret is unset it only runs in non-production (local
 * dev convenience); in production an unset secret is a hard 503 so the endpoint
 * can never be triggered anonymously.
 */
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function authorize(request: Request): { ok: boolean; status?: number } {
  const secret = process.env.NOTIFICATIONS_TICK_SECRET ?? "";
  if (!secret) {
    return process.env.NODE_ENV === "production" ? { ok: false, status: 503 } : { ok: true };
  }
  const url = new URL(request.url);
  const provided = request.headers.get("x-tick-key") ?? url.searchParams.get("key") ?? "";
  return provided === secret ? { ok: true } : { ok: false, status: 401 };
}

async function handle(request: Request) {
  const auth = authorize(request);
  if (!auth.ok) {
    return NextResponse.json({ error: "unauthorized" }, { status: auth.status ?? 401 });
  }
  const result = await runTick();
  return NextResponse.json(result, { status: result.ok ? 200 : 207 });
}

export async function POST(request: Request) {
  return handle(request);
}

export async function GET(request: Request) {
  return handle(request);
}
