/* ------------------------------------------------------------------ */
/*  Results & Standings data layer                                     */
/* ------------------------------------------------------------------ */

import { fetchCsv, parseCsv } from "@/lib/csv";

/* ------------------------------------------------------------------ */
/*  Race Result types                                                   */
/* ------------------------------------------------------------------ */

export type RaceResultRow = {
  event_id: string;
  position: string;
  position_change: string;
  driver_id: string;
  driver_name: string;
  team: string;
  time_or_gap: string;
  best_lap: string;
  laps: string;
  grid: string;
  stops: string;
  kph: string;
  overtakes: string;
  laps_led: string;
  distance_led: string;
  steward_penalty: string;
  game_penalty: string;
  points: string;
  status: string;
  fastest_lap: string;
  dotd: string;
};

/* ------------------------------------------------------------------ */
/*  Standings types                                                     */
/* ------------------------------------------------------------------ */

export type StandingsRow = {
  position: string;
  position_change: string;
  driver_id: string;
  driver_name: string;
  team: string;
  points: string;
  gain: string;
  interval: string;
  gap: string;
  p1: string;
  p2: string;
  p3: string;
  top5: string;
  top10: string;
  best_finish: string;
  best_quali: string;
  fastest_laps: string;
  poles: string;
  dotd: string;
  penalty_points: string;
  dnfs: string;
  races: string;
  /** e.g. "S1" … "S6". Defaults to "S6" when the CSV column is missing. */
  season: string;
  /** Drivers-main only: "overall" | "upper" | "lower". Empty for others. */
  bracket: "overall" | "upper" | "lower" | "";
  /** Fallback image path under /public (e.g. /tables/s3_drivers_upper.png). */
  table_image: string;
  /** "active" | "not_applicable". When "not_applicable", show note instead of table. */
  competition_status: string;
  /** Free-text note to display when competition_status is "not_applicable". */
  competition_note: string;
};

/* ------------------------------------------------------------------ */
/*  CSV URL templates – replace with real published sheet URLs          */
/* ------------------------------------------------------------------ */

export const CSV_URLS = {
  race_results:
    "https://docs.google.com/spreadsheets/d/e/2PACX-1vQSNGhBKLMDdmeIOy9wn3ZBS3Kk0-oBmWCMs0ANbg3qDrSsp9PbIXm8qLtTUQKA2HkvoNEpZg9Zf_Ps/pub?gid=1960669750&single=true&output=csv",
  drivers_standings_main:
    "https://docs.google.com/spreadsheets/d/e/2PACX-1vQSNGhBKLMDdmeIOy9wn3ZBS3Kk0-oBmWCMs0ANbg3qDrSsp9PbIXm8qLtTUQKA2HkvoNEpZg9Zf_Ps/pub?gid=174729634&single=true&output=csv",
  constructors_standings_main:
    "https://docs.google.com/spreadsheets/d/e/2PACX-1vQSNGhBKLMDdmeIOy9wn3ZBS3Kk0-oBmWCMs0ANbg3qDrSsp9PbIXm8qLtTUQKA2HkvoNEpZg9Zf_Ps/pub?gid=1965693345&single=true&output=csv",
  drivers_standings_wild:
    "https://docs.google.com/spreadsheets/d/e/2PACX-1vQSNGhBKLMDdmeIOy9wn3ZBS3Kk0-oBmWCMs0ANbg3qDrSsp9PbIXm8qLtTUQKA2HkvoNEpZg9Zf_Ps/pub?gid=1010201825&single=true&output=csv",
  constructors_standings_wild:
    "https://docs.google.com/spreadsheets/d/e/2PACX-1vQSNGhBKLMDdmeIOy9wn3ZBS3Kk0-oBmWCMs0ANbg3qDrSsp9PbIXm8qLtTUQKA2HkvoNEpZg9Zf_Ps/pub?gid=769074374&single=true&output=csv",
};

/* ------------------------------------------------------------------ */
/*  Mappers                                                             */
/* ------------------------------------------------------------------ */

function s(v: string | undefined): string {
  return (v ?? "").trim();
}

export function mapRaceResults(raw: Record<string, string>[]): RaceResultRow[] {
  return raw.map((row) => ({
    event_id: s(row.event_id),
    position: s(row.position),
    position_change: s(row.position_change),
    driver_id: s(row.driver_id),
    driver_name: s(row.driver_name),
    team: s(row.team),
    time_or_gap: s(row.time_or_gap),
    best_lap: s(row.best_lap),
    laps: s(row.laps),
    grid: s(row.grid),
    stops: s(row.stops),
    kph: s(row.kph),
    overtakes: s(row.overtakes),
    laps_led: s(row.laps_led),
    distance_led: s(row.distance_led),
    steward_penalty: s(row.steward_penalty),
    game_penalty: s(row.game_penalty),
    points: s(row.points),
    status: s(row.status),
    fastest_lap: s(row.fastest_lap),
    dotd: s(row.dotd),
  }));
}

export function mapStandings(raw: Record<string, string>[]): StandingsRow[] {
  return raw.map((row) => ({
    position: s(row.position),
    position_change: s(row.position_change),
    driver_id: s(row.driver_id),
    driver_name: s(row.driver_name),
    team: s(row.team),
    points: s(row.points),
    gain: s(row.gain),
    interval: s(row.interval),
    gap: s(row.gap),
    p1: s(row.p1),
    p2: s(row.p2),
    p3: s(row.p3),
    top5: s(row.top5),
    top10: s(row.top10),
    best_finish: s(row.best_finish),
    best_quali: s(row.best_quali),
    fastest_laps: s(row.fastest_laps),
    poles: s(row.poles),
    dotd: s(row.dotd),
    penalty_points: s(row.penalty_points),
    dnfs: s(row.dnfs),
    races: s(row.races),
    season: s(row.season) || "S6",
    bracket: (s(row.bracket).toLowerCase() || "") as StandingsRow["bracket"],
    table_image: s(row.table_image),
    competition_status: s(row.competition_status),
    competition_note: s(row.competition_note),
  }));
}

/* ------------------------------------------------------------------ */
/*  Fetchers                                                            */
/* ------------------------------------------------------------------ */

/**
 * Fetch all race results, optionally filter by event_id.
 * Returns empty array on failure (graceful fallback).
 */
export async function fetchRaceResults(
  eventId?: string,
): Promise<RaceResultRow[]> {
  try {
    const csv = await fetchCsv(CSV_URLS.race_results);
    const raw = parseCsv<Record<string, string>>(csv);
    const all = mapRaceResults(raw);
    if (eventId) return all.filter((r) => r.event_id === eventId);
    return all;
  } catch {
    return [];
  }
}

/**
 * Fetch standings from a given CSV URL.
 * Returns empty array on failure.
 */
export async function fetchStandings(url: string): Promise<StandingsRow[]> {
  try {
    const csv = await fetchCsv(url);
    const raw = parseCsv<Record<string, string>>(csv);
    return mapStandings(raw);
  } catch {
    return [];
  }
}

/**
 * Fetch race results for ALL events, grouped by event_id.
 */
export async function fetchAllRaceResults(): Promise<
  Record<string, RaceResultRow[]>
> {
  try {
    const csv = await fetchCsv(CSV_URLS.race_results);
    const raw = parseCsv<Record<string, string>>(csv);
    const all = mapRaceResults(raw);
    const grouped: Record<string, RaceResultRow[]> = {};
    for (const row of all) {
      if (!row.event_id) continue;
      if (!grouped[row.event_id]) grouped[row.event_id] = [];
      grouped[row.event_id].push(row);
    }
    return grouped;
  } catch {
    return {};
  }
}

/* ------------------------------------------------------------------ */
/*  Season helpers                                                     */
/* ------------------------------------------------------------------ */

/** Every supported season, newest first. */
export const ALL_SEASONS = ["S6", "S5", "S4", "S3", "S2", "S1"];

/**
 * Detect the latest (highest-numbered) season present across multiple
 * standings arrays. Returns "S6" when no data exists.
 */
export function getLatestSeason(...arrays: StandingsRow[][]): string {
  let highest = 0;
  for (const arr of arrays) {
    for (const row of arr) {
      const num = parseInt(row.season.replace(/\D/g, ""), 10) || 0;
      if (num > highest) highest = num;
    }
  }
  return highest > 0 ? `S${highest}` : "S6";
}

/** Filter standings to a single season. */
export function filterBySeason(
  standings: StandingsRow[],
  season: string,
): StandingsRow[] {
  return standings.filter((r) => r.season === season);
}

/**
 * Group driver standings by bracket (for S2/S3 upper/lower split).
 * Returns groups in display order: overall → upper → lower.
 * If every row has no bracket (or "overall"), one "overall" group is returned.
 */
export function groupByBracket(
  standings: StandingsRow[],
): { bracket: string; rows: StandingsRow[] }[] {
  const groups: Record<string, StandingsRow[]> = {};
  for (const row of standings) {
    const key = row.bracket || "overall";
    if (!groups[key]) groups[key] = [];
    groups[key].push(row);
  }
  const order = ["overall", "upper", "lower"];
  return order
    .filter((b) => groups[b]?.length)
    .map((b) => ({ bracket: b, rows: groups[b] }));
}

/**
 * Resolve the table_image path for a specific season (and optional bracket).
 * Looks at the first matching row's table_image field.
 * Returns "" when nothing found.
 */
export function getTableImage(
  standings: StandingsRow[],
  season: string,
  bracket?: string,
): string {
  const match = standings.find(
    (r) =>
      r.season === season &&
      (bracket === undefined || (r.bracket || "overall") === bracket),
  );
  return match?.table_image ?? "";
}
