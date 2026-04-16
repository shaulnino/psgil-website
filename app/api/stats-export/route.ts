/**
 * GET /api/stats-export
 *
 * JSON data bridge for the PSGiL Editor agent.
 * Returns fully-computed driver stats, circuit stats, league stats,
 * and driver ratings — the same data that would previously have come
 * from the deprecated Google Sheets stats tabs.
 *
 * Query params:
 *   season    – filter by season key, e.g. "S6" (omit for all-time)
 *   format    – "50%" | "25%" | "sprint"
 *   competition – "main" | "wild"
 *   round_type  – "regular" | "playoff"
 *
 * Auth: requires X-Api-Key header matching STATS_EXPORT_API_KEY env var.
 *       In development the header check is skipped.
 *
 * Response shape:
 * {
 *   generated_at: string,
 *   filters: {...},
 *   drivers: { headers: string[], rows: DriverStatRow[] },
 *   circuits: { headers: string[], rows: CircuitStatRow[] },
 *   league: LeagueStatRow[],
 *   ratings: ComputedDriverRating[],
 * }
 */

import { NextRequest, NextResponse } from "next/server";
import { fetchSeasonsConfig, GLOBAL_CSV_URLS } from "@/lib/seasonConfig";
import { fetchAllRaceResults } from "@/lib/resultsData";
import { fetchCsv, parseCsv } from "@/lib/csv";
import { mapRaceEvents } from "@/lib/scheduleData";
import { fetchRewards } from "@/lib/rewardsData";
import {
  computeDriverStats,
  computeCircuitStats,
  computeLeagueStats,
  computeDriverRatings,
  type StatsFilters,
} from "@/lib/statsComputed";

function isAuthorised(req: NextRequest): boolean {
  if (process.env.NODE_ENV === "development") return true;
  const key = process.env.STATS_EXPORT_API_KEY;
  if (!key) return false;
  return req.headers.get("x-api-key") === key;
}

export async function GET(req: NextRequest) {
  if (!isAuthorised(req)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);

  const filters: StatsFilters = {};
  const seasonParam = searchParams.get("season");
  if (seasonParam) filters.season = seasonParam;

  const formatParam = searchParams.get("format");
  if (formatParam === "50%" || formatParam === "25%" || formatParam === "sprint") {
    filters.format = formatParam;
  }

  const compParam = searchParams.get("competition");
  if (compParam === "main" || compParam === "wild") {
    filters.competition = compParam;
  }

  const rtParam = searchParams.get("round_type");
  if (rtParam === "regular" || rtParam === "playoff") {
    filters.roundType = rtParam;
  }

  const seasons  = await fetchSeasonsConfig();
  const [raceResultsByEvent, scheduleCsv, rewards] = await Promise.all([
    fetchAllRaceResults(GLOBAL_CSV_URLS.raceResults),
    fetchCsv(GLOBAL_CSV_URLS.schedule).catch(() => ""),
    fetchRewards(GLOBAL_CSV_URLS.rewards),
  ]);

  const events     = scheduleCsv ? mapRaceEvents(parseCsv<Record<string, string>>(scheduleCsv)) : [];
  const allResults = Object.values(raceResultsByEvent).flat();

  const [driversResult, circuitsResult, leagueRows, ratingsResult] = await Promise.all([
    Promise.resolve(computeDriverStats (allResults, events, rewards, seasons, filters)),
    Promise.resolve(computeCircuitStats(allResults, events, seasons,          filters)),
    Promise.resolve(computeLeagueStats (allResults, events, seasons)),
    Promise.resolve(computeDriverRatings(allResults, events, filters)),
  ]);

  return NextResponse.json(
    {
      generated_at: new Date().toISOString(),
      filters,
      drivers: {
        headers: driversResult.headers,
        rows: driversResult.rows,
      },
      circuits: {
        headers: circuitsResult.headers,
        rows: circuitsResult.rows,
      },
      league: leagueRows,
      ratings: ratingsResult,
    },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}
