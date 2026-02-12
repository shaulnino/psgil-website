/* ------------------------------------------------------------------ */
/*  Results & Standings data layer                                     */
/* ------------------------------------------------------------------ */

import { fetchCsv, parseCsv } from "@/lib/csv";
import { matchesSeason } from "@/lib/seasonConfig";

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
  /** e.g. "S1" … "S7". May be empty for per-season CSVs. */
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
    season: s(row.season),
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
 * Fetch standings from a given CSV URL.
 * Returns empty array on failure.
 */
export async function fetchStandings(url: string): Promise<StandingsRow[]> {
  if (!url) return [];
  try {
    const csv = await fetchCsv(url);
    const raw = parseCsv<Record<string, string>>(csv);
    return mapStandings(raw);
  } catch {
    return [];
  }
}

/**
 * Fetch race results from the given CSV URL, optionally filtering by event_id.
 * Returns empty array on failure.
 */
export async function fetchRaceResults(
  url: string,
  eventId?: string,
): Promise<RaceResultRow[]> {
  if (!url) return [];
  try {
    const csv = await fetchCsv(url);
    const raw = parseCsv<Record<string, string>>(csv);
    const all = mapRaceResults(raw);
    if (eventId) return all.filter((r) => r.event_id === eventId);
    return all;
  } catch {
    return [];
  }
}

/**
 * Fetch race results for ALL events from the given CSV URL, grouped by event_id.
 */
export async function fetchAllRaceResults(
  url: string,
): Promise<Record<string, RaceResultRow[]>> {
  if (!url) return {};
  try {
    const csv = await fetchCsv(url);
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

/** Filter standings to a single season key (e.g. "S6"). */
export function filterBySeason(
  standings: StandingsRow[],
  seasonKey: string,
): StandingsRow[] {
  return standings.filter((r) => matchesSeason(r.season, seasonKey));
}

/**
 * Group driver standings by bracket (for upper/lower playoff split).
 * Returns groups in display order: overall → upper → lower.
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
 * Resolve the table_image path for standings (optional season + bracket filter).
 * Returns "" when nothing found.
 */
export function getTableImage(
  standings: StandingsRow[],
  season?: string,
  bracket?: string,
): string {
  const match = standings.find(
    (r) =>
      (!season || r.season === season) &&
      (bracket === undefined || (r.bracket || "overall") === bracket),
  );
  return match?.table_image ?? "";
}
