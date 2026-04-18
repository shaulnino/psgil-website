/* ------------------------------------------------------------------ */
/*  Stats V2 — Driver DNA (8-axis identity fingerprint)                */
/*                                                                     */
/*  Each axis is a 0–100 percentile within the active filter scope.    */
/* ------------------------------------------------------------------ */

import type { DriverMetrics } from "./metrics";

export type DnaAxis =
  | "one_lap_pace"
  | "race_pace"
  | "race_craft"
  | "consistency"
  | "wet_conditions"
  | "tyre_management"
  | "reliability"
  | "clutch";

export const DNA_AXIS_LABELS: Record<DnaAxis, string> = {
  one_lap_pace: "One-Lap Pace",
  race_pace: "Race Pace",
  race_craft: "Race Craft",
  consistency: "Consistency",
  wet_conditions: "Wet Conditions",
  tyre_management: "Tyre Management",
  reliability: "Reliability",
  clutch: "Clutch",
};

export type DriverDna = Record<DnaAxis, number | null>;

/* ------------------------------------------------------------------ */
/*  Helpers                                                             */
/* ------------------------------------------------------------------ */

/** Percentile rank of v within sorted ascending array. 0..100. */
function percentile(v: number, sortedAsc: number[], invert = false): number {
  if (sortedAsc.length === 0) return 50;
  let i = 0;
  while (i < sortedAsc.length && sortedAsc[i] < v) i++;
  // Average rank for ties
  let j = i;
  while (j < sortedAsc.length && sortedAsc[j] === v) j++;
  const rank = (i + j - 1) / 2;
  const pct = (rank / Math.max(1, sortedAsc.length - 1)) * 100;
  return Math.round(invert ? 100 - pct : pct);
}

function safeDivide(a: number, b: number): number | null {
  return b > 0 ? a / b : null;
}

/* ------------------------------------------------------------------ */
/*  DNA computation                                                     */
/* ------------------------------------------------------------------ */

/**
 * Compute the 8-axis DNA for every driver, using the league population
 * as the percentile reference.
 *
 * Axes that lack source data (e.g. wet axis without wet races) are null.
 */
export function computeDriverDnaMap(
  metrics: DriverMetrics[],
): Map<string, DriverDna> {
  const out = new Map<string, DriverDna>();
  if (metrics.length === 0) return out;

  // Build sorted arrays for each axis source value.
  const oneLapVals = metrics.map((m) => m.avg_grid).filter((v): v is number => v !== null).sort((a, b) => a - b);
  const racePaceVals = metrics.map((m) => m.avg_finish).filter((v): v is number => v !== null).sort((a, b) => a - b);
  const raceCraftVals = metrics.map((m) => m.race_craft_score).filter((v): v is number => v !== null).sort((a, b) => a - b);

  // Consistency proxy: stdev approximation = abs avg position change. Lower is better.
  const consistencyVals = metrics
    .map((m) => (m.avg_position_change !== null ? Math.abs(m.avg_position_change) : null))
    .filter((v): v is number => v !== null)
    .sort((a, b) => a - b);

  // Wet axis: avg finish in wet/mixed races. Lower is better.
  const wetVals = metrics
    .map((m) => {
      const a = m.avg_finish_wet;
      const b = m.avg_finish_mixed;
      if (a === null && b === null) return null;
      if (a === null) return b;
      if (b === null) return a;
      return (a + b) / 2;
    })
    .filter((v): v is number => v !== null)
    .sort((a, b) => a - b);

  // Tyre management proxy: races / total stops. Higher = better tyre life.
  // Lacking explicit pit-stop data, we use laps_led / events as a coarse proxy
  // (drivers who lead more laps tend to manage their tyres better).
  const tyreVals = metrics
    .map((m) => safeDivide(m.laps_led, m.events))
    .filter((v): v is number => v !== null)
    .sort((a, b) => a - b);

  // Reliability: finish rate − (steward penalty rate × 0.5). Higher = cleaner & more reliable.
  const reliabilityVals = metrics
    .map((m) => m.finish_rate - (m.steward_penalty_points / Math.max(1, m.events)) * 0.05)
    .sort((a, b) => a - b);

  // Clutch axis: clutch_score (already normalised 0..100). Treat directly as percentile-ish.
  const clutchVals = metrics
    .map((m) => m.clutch_score)
    .filter((v): v is number => v !== null)
    .sort((a, b) => a - b);

  for (const m of metrics) {
    const wetAvg = ((): number | null => {
      const a = m.avg_finish_wet;
      const b = m.avg_finish_mixed;
      if (a === null && b === null) return null;
      if (a === null) return b;
      if (b === null) return a;
      return (a + b) / 2;
    })();

    const consistencyRaw = m.avg_position_change !== null ? Math.abs(m.avg_position_change) : null;
    const tyreRaw = safeDivide(m.laps_led, m.events);
    const reliabilityRaw = m.finish_rate - (m.steward_penalty_points / Math.max(1, m.events)) * 0.05;

    const dna: DriverDna = {
      one_lap_pace: m.avg_grid !== null
        ? percentile(m.avg_grid, oneLapVals, true) // lower grid = better
        : null,
      race_pace: m.avg_finish !== null
        ? percentile(m.avg_finish, racePaceVals, true) // lower finish = better
        : null,
      race_craft: m.race_craft_score !== null
        ? percentile(m.race_craft_score, raceCraftVals, false) // higher = better
        : null,
      consistency: consistencyRaw !== null
        ? percentile(consistencyRaw, consistencyVals, true) // lower change = more consistent
        : null,
      wet_conditions: wetAvg !== null
        ? percentile(wetAvg, wetVals, true) // lower finish in wet = better
        : null,
      tyre_management: tyreRaw !== null
        ? percentile(tyreRaw, tyreVals, false)
        : null,
      reliability: percentile(reliabilityRaw, reliabilityVals, false),
      clutch: m.clutch_score !== null
        ? percentile(m.clutch_score, clutchVals, false)
        : null,
    };
    out.set(m.driver_id, dna);
  }

  return out;
}

/** Average of available DNA axes (ignores null axes). */
export function dnaAverage(dna: DriverDna): number | null {
  const vals: number[] = [];
  for (const v of Object.values(dna)) if (v !== null) vals.push(v);
  if (vals.length === 0) return null;
  return Math.round(vals.reduce((s, n) => s + n, 0) / vals.length);
}

/** Return the top N axis names for a driver, sorted by score desc. */
export function topAxes(dna: DriverDna, n: number): { axis: DnaAxis; score: number }[] {
  const entries: { axis: DnaAxis; score: number }[] = [];
  for (const [k, v] of Object.entries(dna) as [DnaAxis, number | null][]) {
    if (v !== null) entries.push({ axis: k, score: v });
  }
  entries.sort((a, b) => b.score - a.score);
  return entries.slice(0, n);
}
