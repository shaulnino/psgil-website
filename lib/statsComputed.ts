/* ------------------------------------------------------------------ */
/*  Stats computation engine                                            */
/*  Derives all statistics from the raw website-feed tabs:             */
/*    • csv_race_results  → RaceResultRow[]                            */
/*    • csv website schedule → RaceEvent[]                             */
/*    • rewards → Reward[]                                             */
/*    • csv_seasons_config → SeasonConfig[]                            */
/*                                                                     */
/*  Replaces the dedicated stats tabs (Drivers All-Time, S1–S6,        */
/*  League Statistics, Circuits Statistics).                           */
/*                                                                     */
/*  Output types match DriverStatRow / CircuitStatRow / LeagueStatRow  */
/*  exactly so StatsPageContent requires no changes.                   */
/* ------------------------------------------------------------------ */

import type { RaceResultRow, StandingsRow } from "@/lib/resultsData";
import type { RaceEvent } from "@/lib/scheduleData";
import type { Reward } from "@/lib/rewardsData";
import type { SeasonConfig } from "@/lib/seasonConfig";
import type { DriverStatRow, CircuitStatRow, LeagueStatRow } from "@/lib/statsData";
import {
  buildRewardCountsForDriver,
  buildConstructorsChampionCountsFromRewards,
} from "@/lib/rewardsData";
import { matchesSeason } from "@/lib/seasonConfig";

/* ------------------------------------------------------------------ */
/*  Public filter type                                                  */
/* ------------------------------------------------------------------ */

export type StatsFilters = {
  /** Season key, e.g. "S6". Undefined = all-time. */
  season?: string;
  /** Race format filter. Undefined = all formats. */
  format?: "50%" | "25%" | "sprint";
  /** Competition / league filter. Undefined = all. Case-insensitive. */
  competition?: "main" | "wild";
  /** Round type filter. Undefined = all rounds. */
  roundType?: "regular" | "playoff";
};

/* ------------------------------------------------------------------ */
/*  Computed driver rating output                                       */
/* ------------------------------------------------------------------ */

export type ComputedDriverRating = {
  driver_id: string;
  driver_name: string;
  /** Total race events in the scope (used to replace sheet-sourced `events` / `season_events`) */
  events: number;
  /** null when insufficient data (e.g. no races) */
  speed: number | null;
  consistency: number | null;
  performance: number | null;
  /** null when no rain/changing-weather races found */
  agility: number | null;
  overall: number | null;
  /** Computed quick-stats derived from the same intermediates. null = no data. */
  total_points: number;
  wins: number;
  podiums: number;
  poles: number;
  avg_finish: number | null;
  dnfs: number;
  avg_grid: number | null;
  avg_points: number | null;
};

/* ------------------------------------------------------------------ */
/*  Metric key constants — must match DRIVER_CHART_METRICS and         */
/*  DRIVER_RATING_METRICS exactly for charts to resolve correctly.     */
/* ------------------------------------------------------------------ */

const M = {
  // Participation
  EVENTS:              "Events Participation",
  RACES:               "Races Participation",
  SPRINTS:             "Sprints Participation",
  RACES_25:            "25% Races Participation",
  DRY_EVENTS:          "Dry Events Participation",
  RAINY_EVENTS:        "Rainy Events Participation",
  CHANGING_EVENTS:     "Changing Weather Events Participation",
  PARTICIPATION_PCT:   "Event Participation %",
  // Results
  TOP10:               "Event Top 10 Finishes",
  TOP10_PCT:           "Event Top 10 Finishes %",
  TOP5:                "Event Top 5 Finishes",
  TOP5_PCT:            "Event Top 5 Finishes %",
  PODIUMS:             "Event Podiums",
  PODIUM_PCT:          "Event Top 3 Finishes %",
  P3:                  "Event 3rd Place",
  P2:                  "Event 2nd Place",
  WINS:                "Event Wins",
  RACE_WINS:           "Race Wins",
  SPRINT_WINS:         "Sprint Wins",
  WINS_25:             "Race 25% Wins",
  WIN_PCT:             "Event Winning %",
  DNF:                 "DNF",
  DNS:                 "DNS",
  DSQ:                 "DSQ",
  // Points
  TOTAL_POINTS:        "Total Points",
  POINTS_PER_EVENT:    "Points per Events",
  POINTS_DRY:          "Points in Dry",
  POINTS_RAIN:         "Points in Rain",
  POINTS_CHANGING:     "Points in Changing Weather",
  AVG_POINTS:          "Avg. Points per Event",
  // Positions & Grid
  POS_CHANGES:         "Position Changes",
  AVG_POS_CHANGES:     "Avg. Position Changes per Race",
  AVG_GRID:            "Avg. Grid Position",
  BEST_FINISH:         "Best Final Position",
  BEST_GRID:           "Best Grid Position",
  WORST_FINISH:        "Lowest Final Position",
  WORST_GRID:          "Lowest Grid Position",
  AVG_FINISH:          "Avg. Final Position",
  AVG_FINISH_DRY:      "Avg. Final Positions - Dry",
  AVG_FINISH_RAIN:     "Avg. Final Positions - Rain",
  AVG_FINISH_CHANGING: "Avg. Final Positions - Changing Weather",
  // Records
  FASTEST_LAPS:        "Fastest Laps",
  DOTD:                "Driver of the Day",
  POLES:               "Pole Positions",
  // Ratings — must match DRIVER_RATING_METRICS exactly
  SPEED:               "Speed",
  CONSISTENCY:         "Consistency",
  PERFORMANCE:         "Performance",
  AGILITY:             "Agility",
  DRIVER_RATING:       "Driver Rating",
  // Grid & Qualifying (all-season)
  WINS_FROM_POLE:      "Wins from Pole",
  FRONT_ROW:           "Front Row Starts",
  POLE_WIN_RATE:       "Pole to Win Rate %",
  BEST_GRID_WIN:       "Best Grid for a Win",
  // Streaks (all-season)
  WIN_STREAK:          "Longest Win Streak",
  PODIUM_STREAK:       "Longest Podium Streak",
  POINTS_STREAK:       "Longest Points Scoring Streak",
  DNF_FREE_STREAK:     "Longest DNF-Free Streak",
  // Performance splits (all-season)
  SEASONS_COUNT:       "Seasons Competed",
  P4_COUNT:            "P4 Finishes",
  FINISH_RATE:         "Finish Rate %",
  OVERPERFORM_RATE:    "Over-performance Rate %",
  POSITIONS_GAINED:    "Total Positions Gained",
  AVG_POSITIONS_GAINED:"Avg. Positions Gained per Race",
  BEST_RACE_POINTS:    "Best Single Race Points",
  BEST_FINISH_BACK:    "Best Finish from P10+ Grid",
  AVG_POINTS_PLAYOFF:  "Avg. Points (Playoffs)",
  AVG_POINTS_REGULAR:  "Avg. Points (Regular Season)",
  // Racecraft & Strategy (S6+ only, suppressed in all-time view)
  OVERTAKES:           "Overtakes",
  AVG_OVERTAKES:       "Avg. Overtakes per Race",
  LAPS_LED:            "Laps Led",
  AVG_LAPS_LED:        "Avg. Laps Led per Race",
  PIT_STOPS:           "Pit Stops",
  AVG_STOPS:           "Avg. Pit Stops per Race",
  STEWARD_PENALTIES:   "Steward Penalties",
  GAME_PENALTIES:      "Game Penalties",
} as const;

/** Ordered header list for driver stats (determines column display order). */
const DRIVER_HEADERS: string[] = [
  M.EVENTS, M.RACES, M.SPRINTS, M.RACES_25,
  M.DRY_EVENTS, M.RAINY_EVENTS, M.CHANGING_EVENTS, M.PARTICIPATION_PCT,
  M.TOP10, M.TOP10_PCT, M.TOP5, M.TOP5_PCT,
  M.PODIUMS, M.PODIUM_PCT, M.P3, M.P2, M.WINS, M.RACE_WINS, M.SPRINT_WINS, M.WINS_25,
  M.WIN_PCT, M.DNF, M.DNS, M.DSQ,
  M.TOTAL_POINTS, M.POINTS_PER_EVENT, M.POINTS_DRY, M.POINTS_RAIN, M.POINTS_CHANGING,
  M.AVG_POINTS, "Avg. Points per Event*",
  M.POS_CHANGES, "Position Changes*", M.AVG_POS_CHANGES,
  M.AVG_GRID, "Avg. Grid Position*",
  M.BEST_FINISH, M.BEST_GRID, M.WORST_FINISH, M.WORST_GRID,
  M.AVG_FINISH, M.AVG_FINISH_DRY, "Avg. Final Positions - Dry*",
  M.AVG_FINISH_RAIN, "Avg. Final Positions - Rain*", M.AVG_FINISH_CHANGING,
  M.FASTEST_LAPS, M.DOTD, M.POLES,
  "Championships",
  M.SPEED, M.CONSISTENCY, M.PERFORMANCE, M.AGILITY, M.DRIVER_RATING,
  // Grid & Qualifying
  M.WINS_FROM_POLE, M.FRONT_ROW, M.POLE_WIN_RATE, M.BEST_GRID_WIN,
  // Streaks
  M.WIN_STREAK, M.PODIUM_STREAK, M.POINTS_STREAK, M.DNF_FREE_STREAK,
  // Performance splits
  M.SEASONS_COUNT, M.P4_COUNT, M.FINISH_RATE, M.OVERPERFORM_RATE,
  M.POSITIONS_GAINED, M.AVG_POSITIONS_GAINED, M.BEST_RACE_POINTS, M.BEST_FINISH_BACK,
  M.AVG_POINTS_PLAYOFF, M.AVG_POINTS_REGULAR,
  // Racecraft & Strategy (S6+ only)
  M.OVERTAKES, M.AVG_OVERTAKES, M.LAPS_LED, M.AVG_LAPS_LED,
  M.PIT_STOPS, M.AVG_STOPS, M.STEWARD_PENALTIES, M.GAME_PENALTIES,
];

/* ------------------------------------------------------------------ */
/*  Internal helpers                                                    */
/* ------------------------------------------------------------------ */

/** Build event_id → RaceEvent lookup map. */
function buildEventMap(events: RaceEvent[]): Map<string, RaceEvent> {
  const map = new Map<string, RaceEvent>();
  for (const e of events) map.set(e.event_id.toLowerCase(), e);
  return map;
}

/** Parse a result's position as an integer, or null if invalid/DNF/etc. */
function parsePos(val: string): number | null {
  const n = parseInt(val, 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** Parse a numeric field, returning null for empty/dash/non-numeric. */
function parseNum(val: string): number | null {
  if (!val || val === "-" || val === "N/A") return null;
  const n = parseFloat(val.replace(/,/g, ""));
  return Number.isFinite(n) ? n : null;
}

/** Average of a number array. Returns null for empty arrays. */
function avg(nums: number[]): number | null {
  if (nums.length === 0) return null;
  return nums.reduce((s, n) => s + n, 0) / nums.length;
}

/** Round to 2 decimal places. */
function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Normalise a map of values to [50, 100] where higher rawValue = higher score. */
function normHigherBetter(
  values: Map<string, number>,
): Map<string, number> {
  const vals = [...values.values()];
  const mn = Math.min(...vals);
  const mx = Math.max(...vals);
  const range = mx - mn;
  const out = new Map<string, number>();
  for (const [k, v] of values) {
    out.set(k, range === 0 ? 75 : 50 + ((v - mn) / range) * 50);
  }
  return out;
}

/** Normalise a map of values where lower rawValue = higher score (inverted). */
function normLowerBetter(
  values: Map<string, number>,
): Map<string, number> {
  const vals = [...values.values()];
  const mn = Math.min(...vals);
  const mx = Math.max(...vals);
  const range = mx - mn;
  const out = new Map<string, number>();
  for (const [k, v] of values) {
    out.set(k, range === 0 ? 75 : 100 - ((v - mn) / range) * 50);
  }
  return out;
}

/** Identify weather category from RaceEvent.weather string. */
function weatherCategory(
  weather: string | undefined,
): "dry" | "rain" | "changing" | null {
  const w = (weather ?? "").toLowerCase();
  if (!w) return null;
  if (w.includes("dry") || w === "clear") return "dry";
  if (w.includes("wet") || w.includes("rain")) return "rain";
  if (w.includes("mix") || w.includes("chang")) return "changing";
  return null;
}

/**
 * Filter RaceResultRow[] using StatsFilters.
 * Requires the event map for format/competition/playoff lookups.
 */
function filterResults(
  results: RaceResultRow[],
  eventMap: Map<string, RaceEvent>,
  filters: StatsFilters,
): RaceResultRow[] {
  return results.filter((r) => {
    const ev = eventMap.get(r.event_id.toLowerCase());
    if (!ev) return false;
    if (filters.season && !matchesSeason(ev.season, filters.season)) return false;
    if (filters.format && ev.race_format !== filters.format) return false;
    if (filters.competition) {
      const league = ev.league.toLowerCase();
      if (filters.competition === "main" && league !== "main") return false;
      if (filters.competition === "wild" && league !== "wild") return false;
    }
    if (filters.roundType) {
      if (filters.roundType === "playoff" && !ev.is_playoff) return false;
      if (filters.roundType === "regular" && ev.is_playoff) return false;
    }
    return true;
  });
}

/** Filter events by filters (no result dependency). */
function filterEvents(
  events: RaceEvent[],
  filters: StatsFilters,
): RaceEvent[] {
  return events.filter((ev) => {
    if (ev.status.toLowerCase() !== "completed") return false;
    if (filters.season && !matchesSeason(ev.season, filters.season)) return false;
    if (filters.format && ev.race_format !== filters.format) return false;
    if (filters.competition) {
      const league = ev.league.toLowerCase();
      if (filters.competition === "main" && league !== "main") return false;
      if (filters.competition === "wild" && league !== "wild") return false;
    }
    if (filters.roundType) {
      if (filters.roundType === "playoff" && !ev.is_playoff) return false;
      if (filters.roundType === "regular" && ev.is_playoff) return false;
    }
    return true;
  });
}

/* ------------------------------------------------------------------ */
/*  Per-driver intermediate stats                                       */
/*  Computed before normalization/ratings; used by both driver stats   */
/*  and rating computation.                                             */
/* ------------------------------------------------------------------ */

type DriverIntermediate = {
  driver_id: string;
  driver_name: string;
  // Participation
  events: number;
  races_50: number;
  sprints: number;
  races_25: number;
  dry_events: number;
  rainy_events: number;
  changing_events: number;
  // Results
  wins: number;
  wins_50: number;   // wins in 50% races
  wins_sprint: number; // wins in sprint races
  wins_25: number;   // wins in 25% races
  p2: number;
  p3: number;
  p4: number;
  top5: number;
  top10: number;
  dnf: number;
  dns: number;
  dsq: number;
  finish_count: number; // races completed (no DNF/DNS/DSQ)
  // Points
  total_points: number;
  points_dry: number;
  points_rain: number;
  points_changing: number;
  points_playoff: number;
  events_playoff: number;
  points_regular: number;
  events_regular: number;
  max_points_single: number;
  // Position/grid arrays (for avg/best/worst)
  finish_positions: number[];
  grid_positions: number[];
  finish_pos_dry: number[];
  finish_pos_rain: number[];
  finish_pos_changing: number[];
  // Position changes (sum, for speed & display formulas)
  position_changes_sum: number;
  // Sum of |per-race absolute position change| — used for consistency avg
  position_changes_abs_sum: number;
  // Number of races where both grid and finish position are known (excl. reverse grid)
  races_with_grid_and_finish: number;
  // Events where points were actually awarded (excludes no-points races)
  events_with_points: number;
  // Records
  fastest_laps: number;
  dotd: number;
  poles: number;
  // Grid & Qualifying (all-season derived)
  wins_from_pole: number;        // wins where grid=1
  front_row_starts: number;      // starts where grid≤2 (non-reverse-grid)
  best_comeback_grid: number;    // highest grid number from which they won
  // Performance analytics (all-season derived)
  positions_gained_sum: number;  // sum of (grid - pos) when grid > pos
  positions_gained_races: number;// races where driver finished ahead of grid
  overperform_races: number;     // races where finish < grid (same condition, alias)
  best_finish_from_back: number; // best finish position when starting P10+
  seasons_set: Set<string>;      // distinct seasons competed
  // S6-only racecraft fields (only accumulated when row has data)
  overtakes: number;
  laps_led: number;
  pit_stops: number;
  steward_penalties: number;
  game_penalties: number;
};

function buildIntermediates(
  results: RaceResultRow[],
  eventMap: Map<string, RaceEvent>,
  filters: StatsFilters,
): Map<string, DriverIntermediate> {
  const filtered = filterResults(results, eventMap, filters);

  // Pre-compute events that awarded zero points to everyone (no-points races like China S6)
  const pointsByEvent = new Map<string, number>();
  for (const row of filtered) {
    const eid = row.event_id.toLowerCase();
    pointsByEvent.set(eid, (pointsByEvent.get(eid) ?? 0) + (parseNum(row.points) ?? 0));
  }
  const noPointsEvents = new Set<string>(
    [...pointsByEvent.entries()].filter(([, total]) => total === 0).map(([eid]) => eid),
  );

  const map = new Map<string, DriverIntermediate>();

  for (const row of filtered) {
    const id = (row.driver_id || "").trim();
    const name = (row.driver_name || "").trim();
    if (!id) continue;

    if (!map.has(id)) {
      map.set(id, {
        driver_id: id,
        driver_name: name,
        events: 0, races_50: 0, sprints: 0, races_25: 0,
        dry_events: 0, rainy_events: 0, changing_events: 0,
        wins: 0, wins_50: 0, wins_sprint: 0, wins_25: 0,
        p2: 0, p3: 0, p4: 0, top5: 0, top10: 0,
        dnf: 0, dns: 0, dsq: 0, finish_count: 0,
        total_points: 0, points_dry: 0, points_rain: 0, points_changing: 0,
        points_playoff: 0, events_playoff: 0,
        points_regular: 0, events_regular: 0,
        max_points_single: 0,
        finish_positions: [], grid_positions: [],
        finish_pos_dry: [], finish_pos_rain: [], finish_pos_changing: [],
        position_changes_sum: 0,
        position_changes_abs_sum: 0,
        races_with_grid_and_finish: 0,
        events_with_points: 0,
        fastest_laps: 0, dotd: 0, poles: 0,
        wins_from_pole: 0, front_row_starts: 0, best_comeback_grid: 0,
        positions_gained_sum: 0, positions_gained_races: 0, overperform_races: 0,
        best_finish_from_back: 999,
        seasons_set: new Set<string>(),
        overtakes: 0, laps_led: 0, pit_stops: 0,
        steward_penalties: 0, game_penalties: 0,
      });
    }

    const d = map.get(id)!;
    const eid = row.event_id.toLowerCase();
    const ev = eventMap.get(eid);
    const weather = weatherCategory(ev?.weather);
    const fmt = ev?.race_format ?? "50%";
    const isReverseGrid = (ev?.reverse_grid ?? "").trim().toLowerCase() === "yes";
    const isNoPointsEvent = noPointsEvents.has(eid);
    const isPlayoff = ev?.is_playoff ?? false;
    const pos = parsePos(row.position);
    const grid = parsePos(row.grid);
    const pts = parseNum(row.points) ?? 0;
    const posChange = parseNum(row.position_change) ?? 0;
    const status = (row.status ?? "").trim().toLowerCase();
    const isFinished = status !== "dnf" && status !== "dns" && status !== "dsq" && status !== "disqualified";
    // DNS = qualified but never started the race. The CSV still carries a
    // placeholder finishing position (e.g. Gadi P17 in s1_r01_main) and 0
    // points, neither of which reflect on-track performance. We keep the DNS
    // count and the (real) qualifying grid, but exclude the race itself from
    // all finish/points/consistency aggregates.
    const isDNS = status === "dns";

    d.events++;
    if (fmt === "sprint") d.sprints++;
    else if (fmt === "25%") d.races_25++;
    else d.races_50++;

    if (weather === "dry")      d.dry_events++;
    else if (weather === "rain")     d.rainy_events++;
    else if (weather === "changing") d.changing_events++;

    if (status === "dnf") d.dnf++;
    else if (status === "dns") d.dns++;
    else if (status === "dsq" || status === "disqualified") d.dsq++;
    if (isFinished) d.finish_count++;

    d.total_points += pts;
    if (weather === "dry")      d.points_dry += pts;
    else if (weather === "rain")     d.points_rain += pts;
    else if (weather === "changing") d.points_changing += pts;
    // Skip DNS from playoff/regular averages — a forced 0 from a race the
    // driver never started would deflate his points-per-event denominator.
    if (!isDNS) {
      if (isPlayoff) { d.points_playoff += pts; d.events_playoff++; }
      else           { d.points_regular += pts; d.events_regular++; }
    }
    if (pts > d.max_points_single) d.max_points_single = pts;

    // Track season participation
    if (ev?.season) d.seasons_set.add(ev.season);

    if (pos !== null && !isDNS) {
      d.finish_positions.push(pos);
      if (pos === 1) {
        d.wins++;
        if (fmt === "sprint") d.wins_sprint++;
        else if (fmt === "25%") d.wins_25++;
        else d.wins_50++;
      }
      if (pos === 2) d.p2++;
      if (pos === 3) d.p3++;
      if (pos === 4) d.p4++;
      if (pos <= 5)  d.top5++;
      if (pos <= 10) d.top10++;

      if (weather === "dry")      d.finish_pos_dry.push(pos);
      else if (weather === "rain")     d.finish_pos_rain.push(pos);
      else if (weather === "changing") d.finish_pos_changing.push(pos);

      // Best finish from back of grid (P10+)
      if (grid !== null && grid >= 10 && pos < d.best_finish_from_back) {
        d.best_finish_from_back = pos;
      }
    }

    // Skip grid positions for reverse grid events — they reflect artificial placement,
    // not actual qualifying performance. Also skip for poles and consistency calc.
    if (grid !== null && !isReverseGrid) {
      d.grid_positions.push(grid);
      if (grid === 1) d.poles++;
      if (grid <= 2) d.front_row_starts++;

      // Wins from pole & best comeback grid win
      if (pos === 1) {
        if (grid === 1) d.wins_from_pole++;
        if (grid > d.best_comeback_grid) d.best_comeback_grid = grid;
      }
    }

    if (!isDNS) d.position_changes_sum += posChange;
    // Per-race absolute change (grid → finish) for consistency average
    // Only use races with normal grids so reverse-grid events don't distort the metric.
    // DNS is excluded — the placeholder finish position is not a real race result.
    if (pos !== null && grid !== null && !isReverseGrid && !isDNS) {
      d.position_changes_abs_sum += Math.abs(pos - grid);
      d.races_with_grid_and_finish++;
      // Over-performance: finished ahead of grid position
      if (pos < grid) {
        d.positions_gained_sum += (grid - pos);
        d.positions_gained_races++;
        d.overperform_races++;
      }
    }

    // Track events that awarded points for the Avg. Points denominator.
    // Exclude DNS: the driver never started, so a forced 0 must not deflate
    // his points-per-event average.
    if (!isNoPointsEvent && !isDNS) {
      d.events_with_points++;
    }

    if (row.fastest_lap === "1" || row.fastest_lap?.toLowerCase() === "yes" || row.fastest_lap?.toLowerCase() === "true") {
      d.fastest_laps++;
    }
    if (row.dotd === "1" || row.dotd?.toLowerCase() === "yes" || row.dotd?.toLowerCase() === "true") {
      d.dotd++;
    }

    // S6+ racecraft fields — accumulated regardless of season filter;
    // they are only *output* to metrics when a season filter is active.
    const ov = parseNum(row.overtakes);
    if (ov !== null) d.overtakes += ov;
    const ll = parseNum(row.laps_led);
    if (ll !== null) d.laps_led += ll;
    const st = parseNum(row.stops);
    if (st !== null) d.pit_stops += st;
    const sp = parseNum(row.steward_penalty);
    if (sp !== null) d.steward_penalties += sp;
    const gp = parseNum(row.game_penalty);
    if (gp !== null) d.game_penalties += gp;
  }

  return map;
}

/* ------------------------------------------------------------------ */
/*  Streak computation                                                  */
/*  Processes results in chronological date order per driver.          */
/* ------------------------------------------------------------------ */

type DriverStreaks = {
  maxWinStreak: number;
  maxPodiumStreak: number;
  maxPointsStreak: number;
  maxDNFFreeStreak: number;
};

function computeDriverStreaks(
  results: RaceResultRow[],
  events: RaceEvent[],
  filters: StatsFilters,
): Map<string, DriverStreaks> {
  const eventMap = buildEventMap(events);
  const filtered = filterResults(results, eventMap, filters);

  // Build a date-sorted list of event IDs
  const eventOrder = new Map<string, number>(); // event_id → sort index
  const sortedEvents = [...events]
    .filter((e) => {
      if (!filters.season) return true;
      return matchesSeason(e.season, filters.season);
    })
    .sort((a, b) => {
      const da = new Date(a.date || "").getTime();
      const db = new Date(b.date || "").getTime();
      return da - db;
    });
  sortedEvents.forEach((e, i) => eventOrder.set(e.event_id.toLowerCase(), i));

  // Group results by driver, then sort by event order
  const byDriver = new Map<string, { order: number; pos: number | null; pts: number; status: string }[]>();
  for (const row of filtered) {
    const id = (row.driver_id || "").trim();
    if (!id) continue;
    const eid = row.event_id.toLowerCase();
    const order = eventOrder.get(eid) ?? -1;
    if (order < 0) continue;
    if (!byDriver.has(id)) byDriver.set(id, []);
    byDriver.get(id)!.push({
      order,
      pos: parsePos(row.position),
      pts: parseNum(row.points) ?? 0,
      status: (row.status ?? "").trim().toLowerCase(),
    });
  }

  const out = new Map<string, DriverStreaks>();

  for (const [id, races] of byDriver) {
    races.sort((a, b) => a.order - b.order);

    let maxWin = 0, curWin = 0;
    let maxPod = 0, curPod = 0;
    let maxPts = 0, curPts = 0;
    let maxDNFFree = 0, curDNFFree = 0;

    for (const r of races) {
      // DNS = qualified but never started. Treat it as neutral: it neither
      // breaks nor extends any streak (including the DNF-free streak).
      if (r.status === "dns") continue;
      const isDNF = r.status === "dnf" || r.status === "dsq" || r.status === "disqualified";
      const isWin    = r.pos === 1;
      const isPodium = r.pos !== null && r.pos <= 3;
      const isPoints = r.pts > 0;

      curWin    = isWin    ? curWin + 1    : 0;
      curPod    = isPodium ? curPod + 1    : 0;
      curPts    = isPoints ? curPts + 1    : 0;
      curDNFFree = !isDNF  ? curDNFFree + 1 : 0;

      if (curWin     > maxWin)     maxWin     = curWin;
      if (curPod     > maxPod)     maxPod     = curPod;
      if (curPts     > maxPts)     maxPts     = curPts;
      if (curDNFFree > maxDNFFree) maxDNFFree = curDNFFree;
    }

    out.set(id, {
      maxWinStreak: maxWin,
      maxPodiumStreak: maxPod,
      maxPointsStreak: maxPts,
      maxDNFFreeStreak: maxDNFFree,
    });
  }

  return out;
}

/* ------------------------------------------------------------------ */
/*  Rating computation (min-max normalization across all drivers)      */
/*                                                                     */
/*  Formulas provided by ISL:                                        */
/*  Speed:       0.65×avgGrid_inv + 0.25×avgFinish_inv                 */
/*               + 0.05×posChanges_norm + 0.05×poles_ratio_norm        */
/*  Consistency: 100 − (0.5×posChangeAbs_norm + 0.5×dnfRate_norm) × 50*/
/*  Performance: 0.2×top10pct + 0.15×top5pct + 0.1×top3pct            */
/*               + 0.05×winpct + 0.2×avgPts + 0.25×avgFinish_inv      */
/*               + 0.05×dotd_norm → scaled to [50,100]                 */
/*  Agility:     0.4×avgFinish_rain_inv + 0.5×avgFinish_changing_inv   */
/*               + 0.1×posChanges_norm (N/A if no weather data)        */
/*  Driver Rating: Speed×0.3 + Consistency×0.3 + Performance×0.3      */
/*                 + Agility×0.1 (or equal thirds if Agility=N/A)      */
/* ------------------------------------------------------------------ */

function computeRatings(
  intermediates: Map<string, DriverIntermediate>,
): Map<string, ComputedDriverRating> {
  const ids = [...intermediates.keys()];
  if (ids.length === 0) return new Map();

  // ── Build raw metric arrays for normalization ──────────────────────

  const avgGrid      = new Map<string, number>();
  const avgFinish    = new Map<string, number>();
  const posChgAbs    = new Map<string, number>();
  const polesRatio   = new Map<string, number>();
  const dnfRate      = new Map<string, number>();
  const top10pct     = new Map<string, number>();
  const top5pct      = new Map<string, number>();
  const top3pct      = new Map<string, number>();
  const winPct       = new Map<string, number>();
  const avgPts       = new Map<string, number>();
  const dotdNorm     = new Map<string, number>();
  const avgFinishRain     = new Map<string, number>();
  const avgFinishChanging = new Map<string, number>();

  for (const [id, d] of intermediates) {
    if (d.events === 0) continue;

    const ag = avg(d.grid_positions);
    const af = avg(d.finish_positions);
    if (ag !== null) avgGrid.set(id, ag);
    if (af !== null) avgFinish.set(id, af);

    // Average |position change| per race — lower = more consistent
    const racesWithData = d.races_with_grid_and_finish;
    posChgAbs.set(id, racesWithData > 0 ? d.position_changes_abs_sum / racesWithData : 0);
    polesRatio.set(id, d.poles);
    dnfRate.set(id, d.events > 0 ? d.dnf / d.events : 1);

    top10pct.set(id, d.top10 / d.events);
    top5pct.set(id,  d.top5  / d.events);
    top3pct.set(id,  (d.wins + d.p2 + d.p3) / d.events);
    winPct.set(id,   d.wins  / d.events);
    avgPts.set(id,   d.events_with_points > 0 ? d.total_points / d.events_with_points : 0);
    dotdNorm.set(id, d.dotd);

    const afRain = avg(d.finish_pos_rain);
    const afCh   = avg(d.finish_pos_changing);
    if (afRain !== null) avgFinishRain.set(id, afRain);
    if (afCh   !== null) avgFinishChanging.set(id, afCh);
  }

  // ── Normalize ─────────────────────────────────────────────────────

  const normAvgGrid     = normLowerBetter(avgGrid);     // lower grid = better
  const normAvgFinish   = normLowerBetter(avgFinish);   // lower finish pos = better
  const normPosChgAbs   = normLowerBetter(posChgAbs);   // lower abs change = more consistent
  const normPolesRatio  = normHigherBetter(polesRatio);
  const normDnfRate     = normLowerBetter(dnfRate);     // lower dnf rate = more consistent
  const normTop10       = normHigherBetter(top10pct);
  const normTop5        = normHigherBetter(top5pct);
  const normTop3        = normHigherBetter(top3pct);
  const normWinPct      = normHigherBetter(winPct);
  const normAvgPts      = normHigherBetter(avgPts);
  const normDotd        = normHigherBetter(dotdNorm);
  const normPosChanges  = normHigherBetter(posChgAbs);  // more changes = more agile (Speed formula)
  const normAfRain      = normLowerBetter(avgFinishRain);
  const normAfChanging  = normLowerBetter(avgFinishChanging);

  // ── Apply formula weights ──────────────────────────────────────────

  const result = new Map<string, ComputedDriverRating>();

  for (const [id, d] of intermediates) {
    if (d.events === 0) {
      result.set(id, {
        driver_id: id, driver_name: d.driver_name, events: 0,
        speed: null, consistency: null, performance: null,
        agility: null, overall: null,
        total_points: 0, wins: 0, podiums: 0, poles: 0,
        avg_finish: null, dnfs: 0, avg_grid: null, avg_points: null,
      });
      continue;
    }

    // Speed
    let speed: number | null = null;
    const sg = normAvgGrid.get(id);
    const sf = normAvgFinish.get(id);
    if (sg !== null && sg !== undefined && sf !== null && sf !== undefined) {
      const ab = normPosChanges.get(id) ?? 75;
      const pr = normPolesRatio.get(id) ?? 0;
      const pRatio = d.events > 0 ? d.poles / d.events : 0;
      const adNorm = pRatio > 0 ? pr * pRatio : 0;
      speed = round2(sg * 0.65 + sf * 0.25 + ab * 0.05 + adNorm * 0.05);
    }

    // Consistency (score: 100 − inconsistency×50, range [50,100])
    const cpca = normPosChgAbs.get(id);
    const cdnf = normDnfRate.get(id);
    let consistency: number | null = null;
    if (cpca !== null && cpca !== undefined && cdnf !== null && cdnf !== undefined) {
      // Invert normLowerBetter output (it returns [50,100] where lower=100)
      // so inconsistencyScore = (1 - normalized_relative_score) equivalent
      const normPcaRaw   = posChgAbs.has(id) ? posChgAbs.get(id)! : 0;
      const normDnfRaw   = dnfRate.has(id) ? dnfRate.get(id)! : 0;
      const maxPca = Math.max(...posChgAbs.values(), 0);
      const maxDnf = Math.max(...dnfRate.values(), 0);
      const nPca = maxPca === 0 ? 0 : normPcaRaw / maxPca;
      const nDnf = maxDnf === 0 ? 0 : normDnfRaw / maxDnf;
      const inconsistency = nPca * 0.5 + nDnf * 0.5;
      consistency = round2(100 - inconsistency * 50);
    }

    // Performance → [50, 100]
    const pt10 = normTop10.get(id) ?? 75;
    const pt5  = normTop5.get(id)  ?? 75;
    const pt3  = normTop3.get(id)  ?? 75;
    const pwn  = normWinPct.get(id) ?? 75;
    const ppts = normAvgPts.get(id) ?? 75;
    const paf  = normAvgFinish.get(id) ?? 75;
    const pdtd = normDotd.get(id)   ?? 0;
    let performance: number | null = null;
    if (normAvgFinish.has(id)) {
      const score = (pt10 - 50) / 50 * 0.20
                  + (pt5  - 50) / 50 * 0.15
                  + (pt3  - 50) / 50 * 0.10
                  + (pwn  - 50) / 50 * 0.05
                  + (ppts - 50) / 50 * 0.20
                  + (paf  - 50) / 50 * 0.25
                  + (pdtd - 50) / 50 * 0.05;
      performance = round2(50 + score * 50);
    }

    // Agility — N/A when no rain AND no changing-weather races
    let agility: number | null = null;
    const hasRain     = avgFinishRain.has(id);
    const hasChanging = avgFinishChanging.has(id);
    const abScore = normPosChanges.get(id) ?? 75;
    if (hasRain || hasChanging) {
      const aiW = hasRain     ? 0.4 : 0;
      const ajW = hasChanging ? 0.5 : 0;
      const abW = 0.1;
      const total = aiW + ajW + abW;
      const aiS = hasRain     ? (normAfRain.get(id)     ?? 75) : 0;
      const ajS = hasChanging ? (normAfChanging.get(id) ?? 75) : 0;
      agility = round2((aiS * aiW + ajS * ajW + abScore * abW) / total);
    }

    // Driver Rating
    let overall: number | null = null;
    if (speed !== null && consistency !== null && performance !== null) {
      if (agility !== null) {
        overall = round2(speed * 0.3 + consistency * 0.3 + performance * 0.3 + agility * 0.1);
      } else {
        overall = round2((speed + consistency + performance) / 3);
      }
    }

    const avgFinish = d.finish_positions.length > 0
      ? d.finish_positions.reduce((a, b) => a + b, 0) / d.finish_positions.length
      : null;
    const avgGrid = d.grid_positions.length > 0
      ? d.grid_positions.reduce((a, b) => a + b, 0) / d.grid_positions.length
      : null;
    const avgPoints = d.events_with_points > 0
      ? d.total_points / d.events_with_points
      : null;

    result.set(id, {
      driver_id: id,
      driver_name: d.driver_name,
      events: d.events,
      speed,
      consistency,
      performance,
      agility,
      overall,
      total_points: d.total_points,
      wins: d.wins,
      podiums: d.wins + d.p2 + d.p3,
      poles: d.poles,
      avg_finish: avgFinish,
      dnfs: d.dnf,
      avg_grid: avgGrid,
      avg_points: avgPoints,
    });
  }

  return result;
}

/* ------------------------------------------------------------------ */
/*  Public: computeDriverRatings                                        */
/*  For the driver modal pipeline (merging into Driver objects).        */
/* ------------------------------------------------------------------ */

export function computeDriverRatings(
  results: RaceResultRow[],
  events: RaceEvent[],
  filters?: StatsFilters,
): ComputedDriverRating[] {
  const eventMap = buildEventMap(events);
  const intermediates = buildIntermediates(results, eventMap, filters ?? {});
  const ratings = computeRatings(intermediates);
  return [...ratings.values()];
}

/**
 * Compute ratings + stats for all 6 scopes (time × competition) in one call,
 * building the event map only once.
 *
 * Returned keys:
 *   allTime, season            – "All" competition (existing behaviour)
 *   allTimeMain, allTimeWild   – all-time filtered to Main / Wild
 *   seasonMain, seasonWild     – current season filtered to Main / Wild
 */
export function computeDriverRatingsAll(
  results: RaceResultRow[],
  events: RaceEvent[],
  seasonKey: string,
): {
  allTime: ComputedDriverRating[];
  season: ComputedDriverRating[];
  allTimeMain: ComputedDriverRating[];
  allTimeWild: ComputedDriverRating[];
  seasonMain: ComputedDriverRating[];
  seasonWild: ComputedDriverRating[];
} {
  const eventMap = buildEventMap(events);
  const toArr = (f: StatsFilters) => [...computeRatings(buildIntermediates(results, eventMap, f)).values()];
  return {
    allTime:    toArr({}),
    season:     toArr({ season: seasonKey }),
    allTimeMain: toArr({ competition: "main" }),
    allTimeWild: toArr({ competition: "wild" }),
    seasonMain:  toArr({ season: seasonKey, competition: "main" }),
    seasonWild:  toArr({ season: seasonKey, competition: "wild" }),
  };
}

/** @deprecated Use computeDriverRatingsAll instead. */
export function computeDriverRatingsBoth(
  results: RaceResultRow[],
  events: RaceEvent[],
  seasonKey: string,
): { allTime: ComputedDriverRating[]; season: ComputedDriverRating[] } {
  const { allTime, season } = computeDriverRatingsAll(results, events, seasonKey);
  return { allTime, season };
}

/* ------------------------------------------------------------------ */
/*  Public: computeDriverStats                                          */
/*  Full driver stats including ratings and reward metrics.             */
/* ------------------------------------------------------------------ */

export function computeDriverStats(
  results: RaceResultRow[],
  events: RaceEvent[],
  rewards: Reward[],
  seasons: SeasonConfig[],
  filters?: StatsFilters,
): { rows: DriverStatRow[]; headers: string[] } {
  const f = filters ?? {};
  const eventMap = buildEventMap(events);
  const intermediates = buildIntermediates(results, eventMap, f);
  if (intermediates.size === 0) return { rows: [], headers: DRIVER_HEADERS };

  const ratings = computeRatings(intermediates);

  // Total events in scope for participation %
  const scopedEvents = filterEvents(events, f);
  const totalEventsInScope = scopedEvents.length;

  // Resolve season_id for rewards scoping
  const seasonId = f.season
    ? parseInt(f.season.replace(/^S/i, ""), 10) || undefined
    : undefined;

  // Constructors champion counts
  const teamNameByKey = new Map<string, string>(); // not available here; rewards use team keys
  // Build from results: driver_id → team name per season
  const driverTeamBySeason = new Map<string, Map<string, string>>();
  for (const r of results) {
    const ev = eventMap.get(r.event_id.toLowerCase());
    if (!ev) continue;
    const seasonKey = `S${ev.season.replace(/^S/i, "")}`;
    if (!driverTeamBySeason.has(seasonKey)) driverTeamBySeason.set(seasonKey, new Map());
    driverTeamBySeason.get(seasonKey)!.set(r.driver_id, r.team);
  }

  // Build constructors champion counts from rewards
  // We need StandingsRow-like data — approximate from results
  const standingsProxy = [...intermediates.values()].flatMap((d) => {
    // Collect all season appearances to build a standings-like structure
    const appearances: { driver_id: string; driver_name: string; team: string; season: string }[] = [];
    const seen = new Set<string>();
    for (const r of results.filter((rr) => rr.driver_id === d.driver_id)) {
      const ev = eventMap.get(r.event_id.toLowerCase());
      if (!ev) continue;
      const sKey = `S${ev.season.replace(/^S/i, "")}`;
      const comboKey = `${sKey}:${r.team}`;
      if (!seen.has(comboKey)) {
        seen.add(comboKey);
        appearances.push({ driver_id: d.driver_id, driver_name: d.driver_name, team: r.team, season: sKey });
      }
    }
    return appearances;
  });

  const constructorsCounts = buildConstructorsChampionCountsFromRewards(
    rewards,
    standingsProxy.map<StandingsRow>((a) => ({
      position: "", position_change: "", driver_id: a.driver_id,
      driver_name: a.driver_name, team: a.team, team_key: "", points: "", gain: "",
      interval: "", gap: "", p1: "", p2: "", p3: "", top5: "", top10: "",
      best_finish: "", best_quali: "", fastest_laps: "", poles: "", dotd: "",
      penalty_points: "", dnfs: "", races: "", season: a.season, bracket: "",
      table_image: "", competition_status: "", competition_note: "",
    })),
    teamNameByKey,
  );

  // Compute streaks for all drivers in the current filter scope
  const streaks = computeDriverStreaks(results, events, f);

  const rows: DriverStatRow[] = [];

  for (const [id, d] of intermediates) {
    const rat = ratings.get(id);
    const n = d.events;
    if (n === 0) continue;

    const streak = streaks.get(id);
    const totalPodiums = d.wins + d.p2 + d.p3;
    // Use events_with_points as denominator so no-points races (e.g. China S6) don't deflate the average
    const avgPts = d.events_with_points > 0 ? round2(d.total_points / d.events_with_points) : 0;
    const avgFin = avg(d.finish_positions);
    const avgGrd = avg(d.grid_positions);
    const avgFinDry = avg(d.finish_pos_dry);
    const avgFinRain = avg(d.finish_pos_rain);
    const avgFinCh = avg(d.finish_pos_changing);
    const posChangesTotal = d.position_changes_sum;
    const avgPosChg = n > 0 ? round2(posChangesTotal / n) : 0;
    const participationPct = totalEventsInScope > 0 ? round2((n / totalEventsInScope) * 100) : 0;

    const constructorCountAllTime = constructorsCounts.allTimeByDriver.get(id) ?? 0;
    const constructorCountSeason = seasonId
      ? constructorsCounts.bySeasonByDriver.get(seasonId)?.get(id) ?? 0
      : constructorCountAllTime;

    // Season-scoped rewards (Driver of the Season, Mr. Consistent, etc.)
    const rewardMetrics = buildRewardCountsForDriver(
      id,
      rewards,
      seasonId,
      constructorCountSeason,
    );

    // All-time championship counts — never season-scoped, matches legacy tab behaviour
    // where per-season views still show the driver's total career titles.
    const rewardMetricsAllTime = buildRewardCountsForDriver(id, rewards, undefined, constructorCountAllTime);
    const allTimeChampionships = (rewardMetricsAllTime["Main Champion Titles"] ?? 0)
      + (rewardMetricsAllTime["Lower Champion Titles"] ?? 0)
      + (rewardMetricsAllTime["Wild Champion Titles"] ?? 0);

    const metrics: Record<string, number> = {
      [M.EVENTS]:              n,
      [M.RACES]:               d.races_50,
      [M.SPRINTS]:             d.sprints,
      [M.RACES_25]:            d.races_25,
      [M.DRY_EVENTS]:          d.dry_events,
      [M.RAINY_EVENTS]:        d.rainy_events,
      [M.CHANGING_EVENTS]:     d.changing_events,
      [M.PARTICIPATION_PCT]:   participationPct,
      [M.TOP10]:               d.top10,
      [M.TOP10_PCT]:           n > 0 ? round2((d.top10 / n) * 100) : 0,
      [M.TOP5]:                d.top5,
      [M.TOP5_PCT]:            n > 0 ? round2((d.top5  / n) * 100) : 0,
      [M.PODIUMS]:             totalPodiums,
      [M.PODIUM_PCT]:          n > 0 ? round2((totalPodiums / n) * 100) : 0,
      [M.P3]:                  d.p3,
      [M.P2]:                  d.p2,
      [M.WINS]:                d.wins,
      [M.RACE_WINS]:           d.wins_50,
      [M.SPRINT_WINS]:         d.wins_sprint,
      [M.WINS_25]:             d.wins_25,
      [M.WIN_PCT]:             n > 0 ? round2((d.wins  / n) * 100) : 0,
      [M.DNF]:                 d.dnf,
      [M.DNS]:                 d.dns,
      [M.DSQ]:                 d.dsq,
      [M.TOTAL_POINTS]:        d.total_points,
      [M.POINTS_PER_EVENT]:    avgPts,
      [M.POINTS_DRY]:          d.points_dry,
      [M.POINTS_RAIN]:         d.points_rain,
      [M.POINTS_CHANGING]:     d.points_changing,
      [M.AVG_POINTS]:          avgPts,
      // Asterisk variants — legacy stats tabs used these column names;
      // output both so comparison and SKIP_COLS matching work correctly.
      "Avg. Points per Event*":    avgPts,
      [M.POS_CHANGES]:         posChangesTotal,
      "Position Changes*":         posChangesTotal,
      [M.AVG_POS_CHANGES]:     avgPosChg,
      ...(avgGrd !== null  ? { [M.AVG_GRID]: round2(avgGrd), "Avg. Grid Position*": round2(avgGrd) } : {}),
      ...(d.finish_positions.length > 0 ? { [M.BEST_FINISH]:  Math.min(...d.finish_positions) } : {}),
      ...(d.grid_positions.length > 0   ? { [M.BEST_GRID]:    Math.min(...d.grid_positions)   } : {}),
      ...(d.finish_positions.length > 0 ? { [M.WORST_FINISH]: Math.max(...d.finish_positions) } : {}),
      ...(d.grid_positions.length > 0   ? { [M.WORST_GRID]:   Math.max(...d.grid_positions)   } : {}),
      ...(avgFin !== null  ? { [M.AVG_FINISH]:          round2(avgFin)  } : {}),
      ...(avgFinDry  !== null ? {
        [M.AVG_FINISH_DRY]:          round2(avgFinDry),
        "Avg. Final Positions - Dry*": round2(avgFinDry),
      } : {}),
      ...(avgFinRain !== null ? {
        [M.AVG_FINISH_RAIN]:           round2(avgFinRain),
        "Avg. Final Positions - Rain*": round2(avgFinRain),
      } : {}),
      ...(avgFinCh   !== null ? { [M.AVG_FINISH_CHANGING]: round2(avgFinCh) } : {}),
      [M.FASTEST_LAPS]:        d.fastest_laps,
      [M.DOTD]:                d.dotd,
      [M.POLES]:               d.poles,
      // Ratings — stored as rounded integers for display
      ...(rat?.speed        !== null && rat?.speed        !== undefined ? { [M.SPEED]:         Math.round(rat.speed!)        } : {}),
      ...(rat?.consistency  !== null && rat?.consistency  !== undefined ? { [M.CONSISTENCY]:   Math.round(rat.consistency!)  } : {}),
      ...(rat?.performance  !== null && rat?.performance  !== undefined ? { [M.PERFORMANCE]:   Math.round(rat.performance!)  } : {}),
      ...(rat?.agility      !== null && rat?.agility      !== undefined ? { [M.AGILITY]:       Math.round(rat.agility!)      } : {}),
      ...(rat?.overall      !== null && rat?.overall      !== undefined ? { [M.DRIVER_RATING]: Math.round(rat.overall!)      } : {}),
      // Reward metrics (season-scoped for seasonal awards like DotS, Grid Climber, etc.)
      ...rewardMetrics,
      // "Championships" = all-time career title count, matching legacy tab behaviour
      Championships: allTimeChampionships,
      // ── Grid & Qualifying (all-season) ──────────────────────────────
      [M.WINS_FROM_POLE]:  d.wins_from_pole,
      [M.FRONT_ROW]:       d.front_row_starts,
      ...(d.poles > 0 ? { [M.POLE_WIN_RATE]: round2((d.wins_from_pole / d.poles) * 100) } : {}),
      ...(d.wins > 0 ? { [M.BEST_GRID_WIN]: d.best_comeback_grid } : {}),
      // ── Streaks (all-season) ─────────────────────────────────────────
      ...(streak ? {
        [M.WIN_STREAK]:      streak.maxWinStreak,
        [M.PODIUM_STREAK]:   streak.maxPodiumStreak,
        [M.POINTS_STREAK]:   streak.maxPointsStreak,
        [M.DNF_FREE_STREAK]: streak.maxDNFFreeStreak,
      } : {}),
      // ── Performance splits (all-season) ─────────────────────────────
      [M.SEASONS_COUNT]:    d.seasons_set.size,
      [M.P4_COUNT]:         d.p4,
      [M.FINISH_RATE]:      round2((d.finish_count / n) * 100),
      ...(d.races_with_grid_and_finish > 0 ? {
        [M.OVERPERFORM_RATE]: round2((d.overperform_races / d.races_with_grid_and_finish) * 100),
      } : {}),
      ...(d.positions_gained_races > 0 ? {
        [M.POSITIONS_GAINED]:     d.positions_gained_sum,
        [M.AVG_POSITIONS_GAINED]: round2(d.positions_gained_sum / d.positions_gained_races),
      } : {}),
      [M.BEST_RACE_POINTS]: d.max_points_single,
      ...(d.best_finish_from_back < 999 ? { [M.BEST_FINISH_BACK]: d.best_finish_from_back } : {}),
      ...(d.events_playoff > 0 ? {
        [M.AVG_POINTS_PLAYOFF]:  round2(d.points_playoff / d.events_playoff),
      } : {}),
      ...(d.events_regular > 0 ? {
        [M.AVG_POINTS_REGULAR]:  round2(d.points_regular / d.events_regular),
      } : {}),
      // ── Racecraft & Strategy — S6+ only, only output when season filter is active ──
      ...(f.season ? {
        [M.LAPS_LED]:           d.laps_led,
        [M.AVG_LAPS_LED]:       d.events > 0 ? round2(d.laps_led / d.events) : 0,
        [M.PIT_STOPS]:          d.pit_stops,
        [M.AVG_STOPS]:          d.events > 0 ? round2(d.pit_stops / d.events) : 0,
        [M.STEWARD_PENALTIES]:  d.steward_penalties,
        [M.GAME_PENALTIES]:     d.game_penalties,
      } : {}),
    };

    // Build raw record from metrics (as strings, matching legacy CSV behaviour)
    const raw: Record<string, string> = {};
    for (const [k, v] of Object.entries(metrics)) {
      raw[k] = String(v);
    }

    rows.push({ driver_id: id, driver_name: d.driver_name, raw, metrics });
  }

  // Sort by total points descending (consistent ordering)
  rows.sort((a, b) => (b.metrics[M.TOTAL_POINTS] ?? 0) - (a.metrics[M.TOTAL_POINTS] ?? 0));

  return { rows, headers: DRIVER_HEADERS };
}

/* ------------------------------------------------------------------ */
/**
 * Build a podium-position string from an event_id → driver_name map.
 * Drivers who appear more than once get a "×N" suffix so nothing is hidden.
 * e.g. { e1→"Shaul", e2→"Guy", e3→"Shaul" } → "Shaul (×2), Guy"
 */
function buildPodiumString(map: Map<string, string>): string {
  const counts = new Map<string, number>();
  for (const name of map.values()) {
    if (name) counts.set(name, (counts.get(name) ?? 0) + 1);
  }
  // Sort by count descending so most-frequent appears first
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([name, n]) => (n > 1 ? `${name} (×${n})` : name))
    .join(", ");
}

/*  Public: computeCircuitStats                                         */
/* ------------------------------------------------------------------ */

const CIRCUIT_HEADERS_BASE = [
  "Circuit",
  "Events Held", "Races Held", "Sprints Held",
  "Spots Occupied", "Participation %",
  "Dry Events", "DE Spots Occupied", "DE Participation %",
  "Rainy Events", "RE Spots Occupied", "RE Participation %",
  "Changing Weather Events", "CWE Spots Occupied", "CWE Participation %",
  "Safety Car Events", "Safety Car Rate %",
  "Rain & Mixed Events", "Rain Frequency %",
  "Avg. Field Size", "Avg. Position Changes",
  "Winners", "2nd Place", "3rd Place",
];

export function computeCircuitStats(
  results: RaceResultRow[],
  events: RaceEvent[],
  seasons: SeasonConfig[],
  filters?: StatsFilters,
): { rows: CircuitStatRow[]; headers: string[] } {
  const f = filters ?? {};
  const eventMap = buildEventMap(events);
  const filtered = filterResults(results, eventMap, f);
  const scopedEvents = filterEvents(events, f);

  // Max entries per event (proxy for grid capacity)
  const entriesPerEvent = new Map<string, number>();
  for (const r of filtered) {
    entriesPerEvent.set(r.event_id, (entriesPerEvent.get(r.event_id) ?? 0) + 1);
  }
  const maxGridSize = Math.max(...entriesPerEvent.values(), 1);

  // Group results by circuit (track)
  type CircuitAccum = {
    circuit: string;
    events: Set<string>;
    races50: Set<string>;
    sprints: Set<string>;
    spotsTotal: number;
    // weather breakdowns
    dryEvents: Set<string>; drySpots: number;
    rainEvents: Set<string>; rainSpots: number;
    changingEvents: Set<string>; changingSpots: number;
    // podium finishers per event
    winners: Map<string, string>; // event_id → driver_name
    p2s: Map<string, string>;
    p3s: Map<string, string>;
    // season appearances
    seasonsPresent: Set<string>;
    // New metrics
    scEvents: Set<string>;          // events with at least 1 safety car
    posChangesAbsSum: number;       // sum of |position_change| across all results
    posChangesCount: number;        // result rows with valid position_change
    fieldSizeByEvent: Map<string, number>; // event_id → driver count
  };

  const circuitMap = new Map<string, CircuitAccum>();

  for (const r of filtered) {
    const ev = eventMap.get(r.event_id.toLowerCase());
    const track = (ev?.track ?? "Unknown").trim();
    if (!track) continue;

    if (!circuitMap.has(track)) {
      circuitMap.set(track, {
        circuit: track,
        events: new Set(), races50: new Set(), sprints: new Set(),
        spotsTotal: 0,
        dryEvents: new Set(), drySpots: 0,
        rainEvents: new Set(), rainSpots: 0,
        changingEvents: new Set(), changingSpots: 0,
        winners: new Map(), p2s: new Map(), p3s: new Map(),
        seasonsPresent: new Set(),
        scEvents: new Set(),
        posChangesAbsSum: 0, posChangesCount: 0,
        fieldSizeByEvent: new Map(),
      });
    }

    const c = circuitMap.get(track)!;
    const weather = weatherCategory(ev?.weather);
    const fmt = ev?.race_format ?? "50%";
    const pos = parsePos(r.position);
    const eid = r.event_id;
    const seasonKey = ev ? `S${ev.season.replace(/^S/i, "")}` : "";

    c.events.add(eid);
    c.spotsTotal++;
    if (fmt === "sprint") c.sprints.add(eid);
    else c.races50.add(eid);
    if (seasonKey) c.seasonsPresent.add(seasonKey);

    if (weather === "dry")      { c.dryEvents.add(eid); c.drySpots++; }
    else if (weather === "rain")     { c.rainEvents.add(eid); c.rainSpots++; }
    else if (weather === "changing") { c.changingEvents.add(eid); c.changingSpots++; }

    if (pos === 1) c.winners.set(eid, r.driver_name);
    if (pos === 2) c.p2s.set(eid, r.driver_name);
    if (pos === 3) c.p3s.set(eid, r.driver_name);

    // Safety car events
    if ((ev?.safety_cars ?? 0) > 0) c.scEvents.add(eid);

    // Position changes (absolute) for excitement metric
    const pc = parseNum(r.position_change);
    if (pc !== null) {
      c.posChangesAbsSum += Math.abs(pc);
      c.posChangesCount++;
    }

    // Field size per event
    c.fieldSizeByEvent.set(eid, (c.fieldSizeByEvent.get(eid) ?? 0) + 1);
  }

  const seasonKeys = seasons.map((s) => s.season_key).sort();
  const seasonHeaders = seasonKeys.map((k) => `Season ${k.replace(/^S/i, "")}`);
  const headers = [...CIRCUIT_HEADERS_BASE, ...seasonHeaders];

  const rows: CircuitStatRow[] = [];

  for (const [, c] of circuitMap) {
    const numEvents = c.events.size;
    const cap = numEvents * maxGridSize;

    const capDry      = c.dryEvents.size * maxGridSize;
    const capRain     = c.rainEvents.size * maxGridSize;
    const capChanging = c.changingEvents.size * maxGridSize;

    const uniqueWinners = buildPodiumString(c.winners);
    const uniqueP2s     = buildPodiumString(c.p2s);
    const uniqueP3s     = buildPodiumString(c.p3s);

    const scCount = c.scEvents.size;
    const rainMixedEvents = c.rainEvents.size + c.changingEvents.size;
    const avgFieldSize = numEvents > 0
      ? round2([...c.fieldSizeByEvent.values()].reduce((s, v) => s + v, 0) / numEvents)
      : 0;
    const avgPosChange = c.posChangesCount > 0
      ? round2(c.posChangesAbsSum / c.posChangesCount)
      : 0;

    const metrics: Record<string, number> = {
      "Events Held":             numEvents,
      "Races Held":              c.races50.size,
      "Sprints Held":            c.sprints.size,
      "Spots Occupied":          c.spotsTotal,
      "Participation %":         cap > 0 ? round2((c.spotsTotal / cap) * 100) : 0,
      "Dry Events":              c.dryEvents.size,
      "DE Spots Occupied":       c.drySpots,
      "DE Participation %":      capDry > 0 ? round2((c.drySpots / capDry) * 100) : 0,
      "Rainy Events":            c.rainEvents.size,
      "RE Spots Occupied":       c.rainSpots,
      "RE Participation %":      capRain > 0 ? round2((c.rainSpots / capRain) * 100) : 0,
      "Changing Weather Events": c.changingEvents.size,
      "CWE Spots Occupied":      c.changingSpots,
      "CWE Participation %":     capChanging > 0 ? round2((c.changingSpots / capChanging) * 100) : 0,
      // New all-season circuit metrics
      "Safety Car Events":       scCount,
      "Safety Car Rate %":       numEvents > 0 ? round2((scCount / numEvents) * 100) : 0,
      "Rain & Mixed Events":     rainMixedEvents,
      "Rain Frequency %":        numEvents > 0 ? round2((rainMixedEvents / numEvents) * 100) : 0,
      "Avg. Field Size":         avgFieldSize,
      "Avg. Position Changes":   avgPosChange,
    };

    // Season presence checkmarks (1 = appeared, 0 = not)
    for (const sk of seasonKeys) {
      const label = `Season ${sk.replace(/^S/i, "")}`;
      metrics[label] = c.seasonsPresent.has(sk) ? 1 : 0;
    }

    const raw: Record<string, string> = {};
    for (const [k, v] of Object.entries(metrics)) raw[k] = String(v);
    raw["Winners"]   = uniqueWinners;
    raw["2nd Place"] = uniqueP2s;
    raw["3rd Place"] = uniqueP3s;

    rows.push({ circuit: c.circuit, raw, metrics });
  }

  // Sort by events held descending
  rows.sort((a, b) => (b.metrics["Events Held"] ?? 0) - (a.metrics["Events Held"] ?? 0));

  return { rows, headers };
}

/* ------------------------------------------------------------------ */
/*  Home page hero figures (aligned with computeLeagueStats totals)     */
/* ------------------------------------------------------------------ */

/**
 * Same definitions as the League stats table built by `computeLeagueStats`:
 * - **Total events** — schedule rows with status "completed" only.
 * - **Unique drivers** — distinct `driver_id` values in race results for those events.
 * - **Unique winners** — distinct `driver_id` with at least one finishing position P1
 *   (replaces the old Circuits sheet "Winners" name list, but keyed by id).
 */
export function computeHomePageSnapshot(
  results: RaceResultRow[],
  events: RaceEvent[],
): {
  totalRaces: string;
  totalDrivers: string;
  uniqueWinners: number;
} {
  const completed = events.filter((e) => e.status.toLowerCase().trim() === "completed");
  const eventIdSet = new Set(completed.map((e) => e.event_id.toLowerCase()));
  const relevant = results.filter((r) => eventIdSet.has(r.event_id.toLowerCase()));

  const driverIds = new Set<string>();
  const winners = new Set<string>();
  for (const r of relevant) {
    const id = (r.driver_id ?? "").trim();
    if (!id) continue;
    driverIds.add(id);
    if (parsePos(r.position) === 1) winners.add(id);
  }

  return {
    totalRaces: String(completed.length),
    totalDrivers: String(driverIds.size),
    uniqueWinners: winners.size,
  };
}

/* ------------------------------------------------------------------ */
/*  Public: computeLeagueStats                                          */
/*  Returns a pivot table: each row = a metric, columns = seasons.     */
/* ------------------------------------------------------------------ */

export function computeLeagueStats(
  results: RaceResultRow[],
  events: RaceEvent[],
  seasons: SeasonConfig[],
): LeagueStatRow[] {
  const completedEvents = events.filter((e) => e.status.toLowerCase() === "completed");
  const seasonKeys = seasons.map((s) => s.season_key).sort();

  function forSeason(sk: string | null): RaceEvent[] {
    if (!sk) return completedEvents;
    return completedEvents.filter((e) => matchesSeason(e.season, sk));
  }

  function uniqueDriversInResults(evs: RaceEvent[]): number {
    const ids = new Set(evs.flatMap((e) => {
      const eventId = e.event_id.toLowerCase();
      return results
        .filter((r) => r.event_id.toLowerCase() === eventId)
        .map((r) => r.driver_id)
        .filter(Boolean);
    }));
    return ids.size;
  }

  function avgParticipation(evs: RaceEvent[]): number {
    if (evs.length === 0) return 0;
    const total = evs.reduce((sum, e) => {
      const cnt = results.filter((r) => r.event_id.toLowerCase() === e.event_id.toLowerCase()).length;
      return sum + cnt;
    }, 0);
    return round2(total / evs.length);
  }

  function countBroadcasted(evs: RaceEvent[]): number {
    return evs.filter((e) => !!(e.youtube_url ?? "").trim()).length;
  }

  function resultsForEvents(evs: RaceEvent[]): RaceResultRow[] {
    const ids = new Set(evs.map((e) => e.event_id.toLowerCase()));
    return results.filter((r) => ids.has(r.event_id.toLowerCase()));
  }

  function countDNFs(evs: RaceEvent[]): number {
    return resultsForEvents(evs).filter((r) => (r.status ?? "").trim().toLowerCase() === "dnf").length;
  }

  function dnfRate(evs: RaceEvent[]): number {
    const rows = resultsForEvents(evs);
    if (rows.length === 0) return 0;
    const dnfs = rows.filter((r) => (r.status ?? "").trim().toLowerCase() === "dnf").length;
    return round2((dnfs / rows.length) * 100);
  }

  function countPoleToWin(evs: RaceEvent[]): number {
    // Count events where the P1-grid driver also finished P1
    let count = 0;
    for (const ev of evs) {
      const rows = results.filter((r) => r.event_id.toLowerCase() === ev.event_id.toLowerCase());
      const poleDriver = rows.find((r) => parsePos(r.grid) === 1)?.driver_id;
      const winnerDriver = rows.find((r) => parsePos(r.position) === 1)?.driver_id;
      if (poleDriver && winnerDriver && poleDriver === winnerDriver) count++;
    }
    return count;
  }

  function countReverseGrid(evs: RaceEvent[]): number {
    return evs.filter((e) => (e.reverse_grid ?? "").trim().toLowerCase() === "yes").length;
  }

  function totalOvertakes(evs: RaceEvent[]): number {
    return resultsForEvents(evs).reduce((s, r) => s + (parseNum(r.overtakes) ?? 0), 0);
  }

  function avgOvertakesPerRace(evs: RaceEvent[]): number {
    return evs.length > 0 ? round2(totalOvertakes(evs) / evs.length) : 0;
  }

  function totalPitStops(evs: RaceEvent[]): number {
    return resultsForEvents(evs).reduce((s, r) => s + (parseNum(r.stops) ?? 0), 0);
  }

  function avgPitStopsPerRace(evs: RaceEvent[]): number {
    return evs.length > 0 ? round2(totalPitStops(evs) / evs.length) : 0;
  }

  function normalizeGameVersion(v: string): string {
    // Accept "F1 23", "F1 2023", "F123" → normalise to "f1 23" / "f1 24" / "f1 25"
    return v.toLowerCase()
      .replace(/f1\s*20(\d{2})/, "f1 $1") // "F1 2023" → "f1 23"
      .replace(/f1(\d{2})/, "f1 $1")       // "F123" → "f1 23"
      .trim();
  }

  function countByGameVersion(evs: RaceEvent[], version: string, seasonList: SeasonConfig[]): number {
    const needle = normalizeGameVersion(version);
    return evs.filter((e) => {
      const sc = seasonList.find((s) => matchesSeason(e.season, s.season_key));
      if (!sc) return false;
      const gv = normalizeGameVersion(sc.game_version ?? "");
      return gv.includes(needle);
    }).length;
  }

  type Metric = {
    name: string;
    fn: (evs: RaceEvent[]) => number | string;
  };

  const metrics: Metric[] = [
    { name: "Amount of Races 50%",         fn: (evs) => evs.filter((e) => e.race_format === "50%").length },
    { name: "Amount of Sprints",            fn: (evs) => evs.filter((e) => e.race_format === "sprint").length },
    { name: "Amount of Races 25%",          fn: (evs) => evs.filter((e) => e.race_format === "25%").length },
    { name: "Playoff Events",               fn: (evs) => evs.filter((e) => e.is_playoff).length },
    { name: "Reverse Grid Events",          fn: countReverseGrid },
    { name: "Total Events",                 fn: (evs) => evs.length },
    { name: "Avg. Participation",           fn: avgParticipation },
    { name: "Broadcasted Events",           fn: countBroadcasted },
    { name: "Events on F1 23",              fn: (evs) => countByGameVersion(evs, "F1 23", seasons) },
    { name: "Events on F1 24",              fn: (evs) => countByGameVersion(evs, "F1 24", seasons) },
    { name: "Events on F1 25",              fn: (evs) => countByGameVersion(evs, "F1 25", seasons) },
    { name: "Safety Cars",                  fn: (evs) => evs.reduce((s, e) => s + (e.safety_cars ?? 0), 0) },
    { name: "# Safety Cars per Event",      fn: (evs) => evs.length > 0
        ? round2(evs.reduce((s, e) => s + (e.safety_cars ?? 0), 0) / evs.length) : 0 },
    { name: "# Drivers Participating*",     fn: (evs) => uniqueDriversInResults(evs) },
    // ── All-season derived stats ──────────────────────────────────────
    { name: "Total DNFs",                   fn: countDNFs },
    { name: "DNF Rate %",                   fn: dnfRate },
    { name: "Pole to Win Conversions",      fn: countPoleToWin },
    { name: "Total Pit Stops",              fn: totalPitStops },
    { name: "Avg. Pit Stops per Race",      fn: avgPitStopsPerRace },
  ];

  return metrics.map((m) => {
    const allEvs = completedEvents;
    const total  = String(m.fn(allEvs));
    const seasonValues: Record<string, string> = {};
    for (const sk of seasonKeys) {
      const label = `Season ${sk.replace(/^S/i, "")}`;
      seasonValues[label] = String(m.fn(forSeason(sk)));
    }
    return { metric: m.name, total, seasons: seasonValues };
  });
}
