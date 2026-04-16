/**
 * GET /api/debug-stats-comparison
 *
 * Development/validation endpoint that compares legacy stats CSV values
 * against values computed by lib/statsComputed.ts.
 *
 * Usage: http://localhost:3000/api/debug-stats-comparison
 *        http://localhost:3000/api/debug-stats-comparison?season=S6
 *        http://localhost:3000/api/debug-stats-comparison?season=S6&driver=alex
 *
 * Protected in production: only accessible when NODE_ENV=development or
 * when the request includes a valid X-Debug-Token header matching
 * process.env.DEBUG_STATS_TOKEN (if set).
 */

import { NextRequest, NextResponse } from "next/server";
import { fetchSeasonsConfig, GLOBAL_CSV_URLS } from "@/lib/seasonConfig";
import { fetchAllRaceResults, fetchStandings } from "@/lib/resultsData";
import { fetchCsv, parseCsv } from "@/lib/csv";
import { mapRaceEvents } from "@/lib/scheduleData";
import { mapDrivers, mapTeams } from "@/lib/driversData";
import {
  augmentStatsRowsWithRewards,
  buildConstructorsChampionCountsFromRewards,
  fetchRewards,
} from "@/lib/rewardsData";
import { fetchAllStatsData } from "@/lib/statsData";
import { computeDriverStats } from "@/lib/statsComputed";

function isAuthorised(req: NextRequest): boolean {
  if (process.env.NODE_ENV === "development") return true;
  const token = process.env.DEBUG_STATS_TOKEN;
  if (!token) return false;
  return req.headers.get("x-debug-token") === token;
}

export async function GET(req: NextRequest) {
  if (!isAuthorised(req)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const filterSeason = searchParams.get("season") ?? undefined; // e.g. "S6"
  const filterDriver = (searchParams.get("driver") ?? "").toLowerCase();

  const seasons = await fetchSeasonsConfig();

  const [data, raceResultsByEvent, scheduleCsv, driversCsv, teamsCsv, rewards, driversStandingsMain] =
    await Promise.all([
      fetchAllStatsData(seasons),
      fetchAllRaceResults(GLOBAL_CSV_URLS.raceResults),
      fetchCsv(GLOBAL_CSV_URLS.schedule).catch(() => ""),
      fetchCsv(GLOBAL_CSV_URLS.drivers).catch(() => ""),
      fetchCsv(GLOBAL_CSV_URLS.teams).catch(() => ""),
      fetchRewards(GLOBAL_CSV_URLS.rewards),
      fetchStandings(GLOBAL_CSV_URLS.driversStandingsMain),
    ]);

  const events = scheduleCsv ? mapRaceEvents(parseCsv<Record<string, string>>(scheduleCsv)) : [];
  const drivers = driversCsv ? mapDrivers(parseCsv<Record<string, string>>(driversCsv)) : [];
  const teams   = teamsCsv   ? mapTeams  (parseCsv<Record<string, string>>(teamsCsv))   : [];

  const nameToDriverId = new Map(drivers.map((d) => [d.name.trim().toLowerCase(), d.driver_id]));
  const teamNameByKey  = new Map(teams.map((t) => [t.team_key, t.team_name]));

  const constructorsCounts = buildConstructorsChampionCountsFromRewards(
    rewards, driversStandingsMain, teamNameByKey,
  );
  const constructorsChampionCountResolver = (driverId: string, seasonId?: number) =>
    seasonId && constructorsCounts.bySeasonByDriver.has(seasonId)
      ? (constructorsCounts.bySeasonByDriver.get(seasonId)?.get(driverId) ?? 0)
      : (constructorsCounts.allTimeByDriver.get(driverId) ?? 0);

  // Build legacy enriched rows (same pipeline as stats/page.tsx)
  const enriched = {
    driversAllTime: {
      ...data.driversAllTime,
      rows: augmentStatsRowsWithRewards(
        data.driversAllTime.rows, rewards, nameToDriverId, undefined, constructorsChampionCountResolver,
      ),
    },
    driversBySeason: Object.fromEntries(
      Object.entries(data.driversBySeason).map(([key, val]) => {
        const sid = parseInt(key.replace(/^S/i, ""), 10);
        return [key, {
          ...val,
          rows: augmentStatsRowsWithRewards(
            val.rows, rewards, nameToDriverId,
            Number.isFinite(sid) ? sid : undefined,
            constructorsChampionCountResolver,
          ),
        }];
      }),
    ),
  };

  // Computed rows
  const allResults = Object.values(raceResultsByEvent).flat();

  type DriverDiff = {
    metric: string;
    legacy: number | null;
    computed: number | null;
    delta: number;
  };

  type Comparison = {
    season: string;
    drivers_legacy: number;
    drivers_computed: number;
    diffs: Record<string, DriverDiff[]>;
    matches: string[];
  };

  const comparisons: Comparison[] = [];

  /**
   * Normalise a metric key for comparison purposes:
   *   - lowercase + trim
   *   - strip trailing asterisk
   *   - strip leading "event " prefix (legacy tabs used short names like
   *     "Top 10 Finishes", newer computed uses "Event Top 10 Finishes")
   *   - normalise "points per events" / "avg. points per event" → same key
   * This removes false-positive diffs caused purely by naming differences.
   */
  function normalizeMetricKey(k: string): string {
    let n = k.trim().toLowerCase().replace(/\*$/, "").trim();
    // Strip "event " prefix so "event top 10 finishes" === "top 10 finishes"
    if (n.startsWith("event ")) n = n.slice(6).trim();
    // Normalise "participation %" variants
    if (n === "participation %") n = "participation %";
    // Normalise points-per-event variants
    if (n === "points per events" || n === "avg. points per event") n = "avg. points per event";
    return n;
  }

  /**
   * Collapse a metrics map to normalised keys.
   * When multiple keys collapse to the same normalised key (asterisk variants),
   * the non-null value is kept, preferring the non-asterisk version.
   */
  function collapseMetrics(m: Record<string, number>): Map<string, number> {
    const out = new Map<string, number>();
    for (const [k, v] of Object.entries(m)) {
      const nk = normalizeMetricKey(k);
      if (!out.has(nk)) out.set(nk, v);
    }
    return out;
  }

  function compareDatasets(
    label: string,
    legacyRows: { driver_name: string; metrics: Record<string, number> }[],
    computedRows: { driver_name: string; metrics: Record<string, number> }[],
  ) {
    const legMap = new Map(legacyRows.map((r) => [r.driver_name.trim().toLowerCase(), collapseMetrics(r.metrics)]));
    const comMap = new Map(computedRows.map((r) => [r.driver_name.trim().toLowerCase(), collapseMetrics(r.metrics)]));
    const allNames = new Set([...legMap.keys(), ...comMap.keys()]);

    const driverDiffs: Record<string, DriverDiff[]> = {};
    const matches: string[] = [];

    for (const name of allNames) {
      if (filterDriver && !name.includes(filterDriver)) continue;
      const leg = legMap.get(name) ?? new Map();
      const com = comMap.get(name) ?? new Map();
      const allMetrics = new Set([...leg.keys(), ...com.keys()]);
      const d: DriverDiff[] = [];

      for (const m of allMetrics) {
        const lv = leg.get(m) ?? null;
        const cv = com.get(m) ?? null;
        if (lv === null && cv === null) continue;
        // Skip metrics that only exist on one side with a small absolute value
        // (these are often new metrics added by computed that legacy doesn't track yet)
        if (lv === null && (cv ?? 0) < 1) continue;
        if (cv === null && (lv ?? 0) < 1) continue;
        const delta = Math.abs((lv ?? 0) - (cv ?? 0));
        if (delta > 0.1) d.push({ metric: m, legacy: lv, computed: cv, delta: Math.round(delta * 100) / 100 });
      }

      if (d.length === 0) matches.push(name);
      else driverDiffs[name] = d.sort((a, b) => b.delta - a.delta);
    }

    comparisons.push({
      season: label,
      drivers_legacy: legMap.size,
      drivers_computed: comMap.size,
      diffs: driverDiffs,
      matches,
    });
  }

  // All-time comparison (unless a season is specified)
  if (!filterSeason) {
    const { rows: compAllTime } = computeDriverStats(allResults, events, rewards, seasons);
    compareDatasets("all-time", enriched.driversAllTime.rows, compAllTime);
  }

  // Per-season (all seasons or just the one requested)
  const seasonKeys = filterSeason
    ? [filterSeason]
    : seasons.map((s) => s.season_key);

  for (const sk of seasonKeys) {
    const legacyRows = enriched.driversBySeason[sk]?.rows ?? [];
    const { rows: compSeason } = computeDriverStats(allResults, events, rewards, seasons, { season: sk });
    compareDatasets(sk, legacyRows, compSeason);
  }

  const totalDiffs = comparisons.reduce((s, c) => s + Object.keys(c.diffs).length, 0);
  const totalMatches = comparisons.reduce((s, c) => s + c.matches.length, 0);

  return NextResponse.json({
    generated_at: new Date().toISOString(),
    summary: {
      total_comparisons: comparisons.length,
      total_drivers_with_diffs: totalDiffs,
      total_drivers_matching: totalMatches,
    },
    comparisons,
  });
}
