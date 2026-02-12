export const dynamic = "force-dynamic";

import { GLOBAL_CSV_URLS, SEASONS_CONFIG_CSV_URL } from "@/lib/seasonConfig";

export async function GET() {
  const results: Record<string, { status: number; length: number; preview: string; error?: string }> = {};

  const urls: Record<string, string> = {
    seasonsConfig: SEASONS_CONFIG_CSV_URL,
    schedule: GLOBAL_CSV_URLS.schedule,
    driversStandingsMain: GLOBAL_CSV_URLS.driversStandingsMain,
    drivers: GLOBAL_CSV_URLS.drivers,
    teams: GLOBAL_CSV_URLS.teams,
    raceResults: GLOBAL_CSV_URLS.raceResults,
  };

  for (const [name, url] of Object.entries(urls)) {
    try {
      const res = await fetch(url, { cache: "no-store" });
      const text = await res.text();
      results[name] = {
        status: res.status,
        length: text.length,
        preview: text.substring(0, 200),
      };
    } catch (err: unknown) {
      results[name] = {
        status: 0,
        length: 0,
        preview: "",
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  return Response.json(results, {
    headers: { "Cache-Control": "no-store" },
  });
}
