/* ------------------------------------------------------------------ */
/*  Stats V2 — Derived metrics (Layer 1 raw + Layer 2 derived)         */
/*                                                                     */
/*  All computation is done in one pass over filtered race results.    */
/*  Output is a list of DriverMetrics, one per driver, that powers      */
/*  every page in /stats-v2.                                           */
/* ------------------------------------------------------------------ */

import type { RaceResultRow } from "@/lib/resultsData";
import type { RaceEvent } from "@/lib/scheduleData";
import { eventWeather } from "./filters";

/* ------------------------------------------------------------------ */
/*  Public output type                                                  */
/* ------------------------------------------------------------------ */

export type DriverMetrics = {
  driver_id: string;
  driver_name: string;
  team: string;

  /* ---------- Layer 1: raw counting stats ---------- */
  events: number;
  wins: number;
  podiums: number;
  poles: number;
  fastest_laps: number;
  dotd: number;
  top5: number;
  top10: number;
  dnfs: number;
  finishes: number;
  total_points: number;
  laps_led: number;
  overtakes_gross: number;
  steward_penalty_points: number;

  /* ---------- Position aggregates ---------- */
  avg_finish: number | null;
  avg_grid: number | null;
  best_finish: number | null;
  worst_finish: number | null;
  /** Mean of (grid - finish), positive = gainer. Excludes reverse-grid races. */
  avg_position_change: number | null;

  /* ---------- Conversion rates ---------- */
  /** wins / poles. null if no poles. */
  pole_to_win: number | null;
  /** wins / front-row starts (grid≤2). null if none. */
  front_row_to_win: number | null;
  /** podiums / top-3 starts (grid≤3). null if none. */
  top3_grid_to_podium: number | null;
  /** finishes / events. */
  finish_rate: number;

  /* ---------- Layer 2: derived performance metrics ---------- */
  /** Pace Index: 100 - (avg_finish_normalised), higher = faster on average finish. */
  pace_index: number | null;
  /** Race Craft Score: weighted positions gained, normalised. */
  race_craft_score: number | null;
  /** Clutch Score: late-race position-change rate. Approximated via overall position-change avg in scope. */
  clutch_score: number | null;
  /** Wet Performance Δ: avg_finish_dry - avg_finish_wet. Positive = better in wet. null if no wet races. */
  wet_delta: number | null;
  /** Format Adaptability: 100 - stdev(avg_finish_per_format). null if <2 formats with data. */
  format_adaptability: number | null;
  /** Peer-Adjusted Points: total_points − expected_points_for_grid. */
  peer_adjusted_points: number | null;

  /* ---------- Splits ---------- */
  events_dry: number;
  events_wet: number;
  events_mixed: number;
  avg_finish_dry: number | null;
  avg_finish_wet: number | null;
  avg_finish_mixed: number | null;
  avg_finish_50: number | null;
  avg_finish_25: number | null;
  avg_finish_sprint: number | null;

  /* ---------- Rivalry / co-race tracking ---------- */
  /** Set of seasons participated in. */
  seasons_set: Set<string>;
};

/* ------------------------------------------------------------------ */
/*  Internal helpers                                                    */
/* ------------------------------------------------------------------ */

function parsePos(val: string): number | null {
  const n = parseInt(val, 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function parseNum(val: string): number | null {
  if (!val || val === "-" || val === "N/A") return null;
  const n = parseFloat(val.replace(/,/g, ""));
  return Number.isFinite(n) ? n : null;
}

function avg(nums: number[]): number | null {
  if (nums.length === 0) return null;
  return nums.reduce((s, n) => s + n, 0) / nums.length;
}

function stdev(nums: number[]): number | null {
  if (nums.length < 2) return null;
  const m = nums.reduce((s, n) => s + n, 0) / nums.length;
  const variance = nums.reduce((s, n) => s + (n - m) ** 2, 0) / nums.length;
  return Math.sqrt(variance);
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Normalise a value v in [min,max] to [0,100]. Lower = better when invert=true. */
function normalise(v: number, min: number, max: number, invert = false): number {
  if (max === min) return 75;
  const t = (v - min) / (max - min);
  return invert ? round2(100 * (1 - t)) : round2(100 * t);
}

/* ------------------------------------------------------------------ */
/*  Main computation                                                    */
/* ------------------------------------------------------------------ */

type Intermediate = {
  driver_id: string;
  driver_name: string;
  team: string;
  events: number;
  wins: number;
  p2: number;
  p3: number;
  top5: number;
  top10: number;
  poles: number;
  front_row_starts: number;
  top3_grid_starts: number;
  fastest_laps: number;
  dotd: number;
  dnfs: number;
  finishes: number;
  total_points: number;
  laps_led: number;
  overtakes_gross: number;
  steward_penalty_points: number;

  finish_positions: number[];
  grid_positions: number[];
  position_changes: number[];

  finish_pos_dry: number[];
  finish_pos_wet: number[];
  finish_pos_mixed: number[];
  finish_pos_50: number[];
  finish_pos_25: number[];
  finish_pos_sprint: number[];

  events_dry: number;
  events_wet: number;
  events_mixed: number;

  positions_gained_weighted: number;
  positions_gained_races: number;

  /** Sum of expected points based on grid slot, for PAP. */
  expected_points_sum: number;

  seasons_set: Set<string>;
};

/**
 * Approximate F1-style "expected points" curve for a given grid slot.
 * Used to compute Peer-Adjusted Points.
 * Slots P1..P10 → expected ~25 → 1, then 0 below.
 */
const POINTS_BY_GRID: number[] = [25, 18, 15, 12, 10, 8, 6, 4, 2, 1];
function expectedPointsForGrid(grid: number | null): number {
  if (grid === null || grid < 1 || grid > 10) return 0;
  return POINTS_BY_GRID[grid - 1] ?? 0;
}

/**
 * Compute DriverMetrics for every driver present in the filtered results.
 *
 * @param results   — race results pre-filtered by the caller
 * @param eventMap  — lower-cased event_id → RaceEvent
 */
export function computeDriverMetrics(
  results: RaceResultRow[],
  eventMap: Map<string, RaceEvent>,
): DriverMetrics[] {
  const map = new Map<string, Intermediate>();

  for (const row of results) {
    const id = (row.driver_id || "").trim();
    if (!id) continue;

    if (!map.has(id)) {
      map.set(id, {
        driver_id: id,
        driver_name: (row.driver_name || "").trim(),
        team: (row.team || "").trim(),
        events: 0,
        wins: 0, p2: 0, p3: 0, top5: 0, top10: 0,
        poles: 0, front_row_starts: 0, top3_grid_starts: 0,
        fastest_laps: 0, dotd: 0,
        dnfs: 0, finishes: 0,
        total_points: 0, laps_led: 0,
        overtakes_gross: 0, steward_penalty_points: 0,
        finish_positions: [], grid_positions: [], position_changes: [],
        finish_pos_dry: [], finish_pos_wet: [], finish_pos_mixed: [],
        finish_pos_50: [], finish_pos_25: [], finish_pos_sprint: [],
        events_dry: 0, events_wet: 0, events_mixed: 0,
        positions_gained_weighted: 0, positions_gained_races: 0,
        expected_points_sum: 0,
        seasons_set: new Set<string>(),
      });
    }

    const d = map.get(id)!;
    const ev = eventMap.get(row.event_id.toLowerCase());
    const weather = ev ? eventWeather(ev) : null;
    const fmt = ev?.race_format ?? "50%";
    const isReverseGrid = (ev?.reverse_grid ?? "").trim().toLowerCase() === "yes";

    const pos = parsePos(row.position);
    const grid = parsePos(row.grid);
    const pts = parseNum(row.points) ?? 0;
    const status = (row.status ?? "").trim().toLowerCase();
    const isFinished = !["dnf", "dns", "dsq", "disqualified"].includes(status);

    d.events++;
    d.total_points += pts;
    if (ev?.season) d.seasons_set.add(ev.season);

    if (isFinished) d.finishes++;
    else d.dnfs++;

    if (pos !== null) {
      d.finish_positions.push(pos);
      if (pos === 1) d.wins++;
      else if (pos === 2) d.p2++;
      else if (pos === 3) d.p3++;
      if (pos <= 5) d.top5++;
      if (pos <= 10) d.top10++;

      if (weather === "dry") d.finish_pos_dry.push(pos);
      else if (weather === "wet") d.finish_pos_wet.push(pos);
      else if (weather === "mixed") d.finish_pos_mixed.push(pos);

      if (fmt === "50%") d.finish_pos_50.push(pos);
      else if (fmt === "25%") d.finish_pos_25.push(pos);
      else if (fmt === "sprint") d.finish_pos_sprint.push(pos);
    }

    if (weather === "dry") d.events_dry++;
    else if (weather === "wet") d.events_wet++;
    else if (weather === "mixed") d.events_mixed++;

    if (grid !== null && !isReverseGrid) {
      d.grid_positions.push(grid);
      if (grid === 1) d.poles++;
      if (grid <= 2) d.front_row_starts++;
      if (grid <= 3) d.top3_grid_starts++;

      if (pos !== null) {
        const change = grid - pos; // positive = gained positions
        d.position_changes.push(change);
        if (change > 0) {
          // Weight: gaining from a lower starting slot is harder.
          // Linear weight: weight = grid (deeper start = more credit per position gained).
          d.positions_gained_weighted += change * grid;
          d.positions_gained_races++;
        }
        d.expected_points_sum += expectedPointsForGrid(grid);
      }
    }

    const truthy = (v: string) =>
      v === "1" || v.toLowerCase() === "yes" || v.toLowerCase() === "true";
    if (truthy(row.fastest_lap || "")) d.fastest_laps++;
    if (truthy(row.dotd || "")) d.dotd++;

    const ll = parseNum(row.laps_led);
    if (ll !== null) d.laps_led += ll;
    const ov = parseNum(row.overtakes);
    if (ov !== null) d.overtakes_gross += ov;
    const sp = parseNum(row.steward_penalty);
    if (sp !== null) d.steward_penalty_points += sp;
  }

  // ── Compute league-wide ranges for normalisation of derived metrics ──
  const allAvgFinish: number[] = [];
  const allRaceCraftRaw: number[] = [];
  const allClutchRaw: number[] = [];

  for (const d of map.values()) {
    if (d.events < 1) continue;
    const af = avg(d.finish_positions);
    if (af !== null) allAvgFinish.push(af);
    const rc = d.events > 0 ? d.positions_gained_weighted / d.events : 0;
    allRaceCraftRaw.push(rc);
    const apc = avg(d.position_changes);
    if (apc !== null) allClutchRaw.push(apc);
  }

  const minAF = allAvgFinish.length ? Math.min(...allAvgFinish) : 0;
  const maxAF = allAvgFinish.length ? Math.max(...allAvgFinish) : 0;
  const minRC = allRaceCraftRaw.length ? Math.min(...allRaceCraftRaw) : 0;
  const maxRC = allRaceCraftRaw.length ? Math.max(...allRaceCraftRaw) : 0;
  const minCL = allClutchRaw.length ? Math.min(...allClutchRaw) : 0;
  const maxCL = allClutchRaw.length ? Math.max(...allClutchRaw) : 0;

  // ── Build output ──────────────────────────────────────────────────────

  const out: DriverMetrics[] = [];
  for (const d of map.values()) {
    const af = avg(d.finish_positions);
    const ag = avg(d.grid_positions);
    const apc = avg(d.position_changes);

    const afDry = avg(d.finish_pos_dry);
    const afWet = avg(d.finish_pos_wet);
    const afMixed = avg(d.finish_pos_mixed);
    const af50 = avg(d.finish_pos_50);
    const af25 = avg(d.finish_pos_25);
    const afSprint = avg(d.finish_pos_sprint);

    const paceIndex = af !== null ? normalise(af, minAF, maxAF, true) : null;
    const rcRaw = d.events > 0 ? d.positions_gained_weighted / d.events : 0;
    const raceCraft = allRaceCraftRaw.length
      ? normalise(rcRaw, minRC, maxRC, false)
      : null;
    const clutch = apc !== null && allClutchRaw.length
      ? normalise(apc, minCL, maxCL, false)
      : null;

    const wetDelta = afDry !== null && afWet !== null
      ? round2(afDry - afWet) // positive = better in wet
      : null;

    const formatAvgs = [af50, af25, afSprint].filter((v): v is number => v !== null);
    const formatAdaptability = formatAvgs.length >= 2
      ? round2(100 - (stdev(formatAvgs) ?? 0) * 10) // scaled
      : null;

    const pap = d.events > 0
      ? round2(d.total_points - d.expected_points_sum)
      : null;

    out.push({
      driver_id: d.driver_id,
      driver_name: d.driver_name,
      team: d.team,
      events: d.events,
      wins: d.wins,
      podiums: d.wins + d.p2 + d.p3,
      poles: d.poles,
      fastest_laps: d.fastest_laps,
      dotd: d.dotd,
      top5: d.top5,
      top10: d.top10,
      dnfs: d.dnfs,
      finishes: d.finishes,
      total_points: d.total_points,
      laps_led: d.laps_led,
      overtakes_gross: d.overtakes_gross,
      steward_penalty_points: d.steward_penalty_points,

      avg_finish: af !== null ? round2(af) : null,
      avg_grid: ag !== null ? round2(ag) : null,
      best_finish: d.finish_positions.length ? Math.min(...d.finish_positions) : null,
      worst_finish: d.finish_positions.length ? Math.max(...d.finish_positions) : null,
      avg_position_change: apc !== null ? round2(apc) : null,

      pole_to_win: d.poles > 0 ? round2(d.wins / d.poles) : null,
      front_row_to_win: d.front_row_starts > 0 ? round2(d.wins / d.front_row_starts) : null,
      top3_grid_to_podium: d.top3_grid_starts > 0
        ? round2((d.wins + d.p2 + d.p3) / d.top3_grid_starts)
        : null,
      finish_rate: d.events > 0 ? round2(d.finishes / d.events) : 0,

      pace_index: paceIndex,
      race_craft_score: raceCraft,
      clutch_score: clutch,
      wet_delta: wetDelta,
      format_adaptability: formatAdaptability,
      peer_adjusted_points: pap,

      events_dry: d.events_dry,
      events_wet: d.events_wet,
      events_mixed: d.events_mixed,
      avg_finish_dry: afDry !== null ? round2(afDry) : null,
      avg_finish_wet: afWet !== null ? round2(afWet) : null,
      avg_finish_mixed: afMixed !== null ? round2(afMixed) : null,
      avg_finish_50: af50 !== null ? round2(af50) : null,
      avg_finish_25: af25 !== null ? round2(af25) : null,
      avg_finish_sprint: afSprint !== null ? round2(afSprint) : null,

      seasons_set: d.seasons_set,
    });
  }

  return out;
}

/* ------------------------------------------------------------------ */
/*  Helpers used by other v2 modules                                    */
/* ------------------------------------------------------------------ */

export function findDriverMetrics(
  metrics: DriverMetrics[],
  driverId: string,
): DriverMetrics | undefined {
  const id = driverId.trim().toLowerCase();
  return metrics.find((m) => m.driver_id.toLowerCase() === id);
}
