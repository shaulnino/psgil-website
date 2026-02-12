export const dynamic = "force-dynamic";

import { GLOBAL_CSV_URLS, SEASONS_CONFIG_CSV_URL } from "@/lib/seasonConfig";

export async function GET() {
  // First: show the raw URL values to check if they're intact
  const rawUrls = {
    SEASONS_CONFIG_CSV_URL,
    schedule: GLOBAL_CSV_URLS.schedule,
    drivers: GLOBAL_CSV_URLS.drivers,
    driversStandingsMain: GLOBAL_CSV_URLS.driversStandingsMain,
  };

  const fetchResults: Record<string, { status: number; length: number; preview: string; error?: string }> = {};

  // Test one hardcoded URL (not from constants) to see if fetch itself works
  const hardcodedUrl = "https://docs.google.com/spreadsheets/d/e/2PACX-1vQSNGhBKLMDdmeIOy9wn3ZBS3Kk0-oBmWCMs0ANbg3qDrSsp9PbIXm8qLtTUQKA2HkvoNEpZg9Zf_Ps/pub?gid=2105913561&single=true&output=csv";

  try {
    const res = await fetch(hardcodedUrl, { cache: "no-store" });
    const text = await res.text();
    fetchResults["hardcoded_schedule"] = {
      status: res.status,
      length: text.length,
      preview: text.substring(0, 200),
    };
  } catch (err: unknown) {
    fetchResults["hardcoded_schedule"] = {
      status: 0,
      length: 0,
      preview: "",
      error: err instanceof Error ? err.message : String(err),
    };
  }

  // Also test the imported constant
  try {
    const res = await fetch(GLOBAL_CSV_URLS.schedule, { cache: "no-store" });
    const text = await res.text();
    fetchResults["imported_schedule"] = {
      status: res.status,
      length: text.length,
      preview: text.substring(0, 200),
    };
  } catch (err: unknown) {
    fetchResults["imported_schedule"] = {
      status: 0,
      length: 0,
      preview: "",
      error: err instanceof Error ? err.message : String(err),
    };
  }

  return Response.json({ rawUrls, fetchResults }, {
    headers: { "Cache-Control": "no-store" },
  });
}
