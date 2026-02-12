export const dynamic = "force-dynamic";

import { GLOBAL_CSV_URLS, SEASONS_CONFIG_CSV_URL } from "@/lib/seasonConfig";

export async function GET() {
  const rawUrls = {
    SEASONS_CONFIG_CSV_URL,
    schedule: GLOBAL_CSV_URLS.schedule,
    drivers: GLOBAL_CSV_URLS.drivers,
  };

  const fetchResults: Record<string, { status: number; length: number; preview: string; error?: string }> = {};

  for (const [name, url] of Object.entries(GLOBAL_CSV_URLS)) {
    try {
      const res = await fetch(url, { cache: "no-store" });
      const text = await res.text();
      fetchResults[name] = {
        status: res.status,
        length: text.length,
        preview: text.substring(0, 120),
      };
    } catch (err: unknown) {
      fetchResults[name] = {
        status: 0,
        length: 0,
        preview: "",
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  return Response.json({ rawUrls, fetchResults }, {
    headers: { "Cache-Control": "no-store" },
  });
}
