/* ------------------------------------------------------------------ */
/*  Stats V2 — Multi-driver Head-to-Head                                */
/*                                                                     */
/*  Compares up to 4 drivers across any filter scope. Builds:          */
/*    - Co-race finish matrix (who beat whom in shared races)          */
/*    - Per-metric side-by-side ranks                                  */
/*    - Career trajectory data points                                  */
/* ------------------------------------------------------------------ */

import type { RaceResultRow } from "@/lib/resultsData";
import type { RaceEvent } from "@/lib/scheduleData";
import type { DriverMetrics } from "./metrics";
import type { DriverDna } from "./dna";

export type H2HShare = {
  driver_id: string;
  driver_name: string;
  /** Wins in head-to-head (finished ahead of *all* other selected drivers in shared races). */
  outright_wins: number;
  /** Pairwise win-loss-tie record vs each other selected driver. */
  pairwise: Record<string, { wins: number; losses: number; ties: number }>;
};

export type H2HMatrix = {
  driver_ids: string[];
  shared_races: number;
  shares: H2HShare[];
  /** Per-driver, per-shared-race finish positions. */
  per_race: Array<{
    event_id: string;
    event_label: string;
    finishes: Record<string, number | null>;
  }>;
};

export type H2HMetricRow = {
  metric_key: keyof DriverMetrics;
  label: string;
  values: Array<number | null>;
  /** Index of best (1-based rank) — for highlighting. Multiple may tie. */
  best_indices: number[];
  /** "high" = higher is better, "low" = lower is better. */
  direction: "high" | "low";
  /** "raw" = display as-is, "pct" = format as percentage. */
  format: "raw" | "pct" | "decimal";
};

/* ------------------------------------------------------------------ */

function parsePos(val: string): number | null {
  const n = parseInt(val, 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/* ------------------------------------------------------------------ */
/*  Head-to-head matrix in shared races                                 */
/* ------------------------------------------------------------------ */

export function computeH2HMatrix(
  results: RaceResultRow[],
  events: RaceEvent[],
  driverIds: string[],
): H2HMatrix {
  const ids = driverIds.map((id) => id.trim()).filter(Boolean);
  if (ids.length < 2) {
    return { driver_ids: ids, shared_races: 0, shares: [], per_race: [] };
  }

  const eventMap = new Map<string, RaceEvent>();
  for (const e of events) eventMap.set(e.event_id.toLowerCase(), e);

  // Index: event_id → driver_id → finish position
  const byEvent = new Map<string, Map<string, number | null>>();
  const namesById = new Map<string, string>();
  for (const r of results) {
    if (!ids.includes(r.driver_id)) continue;
    const eid = r.event_id.toLowerCase();
    if (!byEvent.has(eid)) byEvent.set(eid, new Map());
    byEvent.get(eid)!.set(r.driver_id, parsePos(r.position));
    if (r.driver_name && !namesById.has(r.driver_id)) {
      namesById.set(r.driver_id, r.driver_name);
    }
  }

  const sharedEvents = [...byEvent.entries()].filter(
    ([, posMap]) => ids.every((id) => posMap.has(id)),
  );

  // Initialise shares
  const shares: H2HShare[] = ids.map((id) => ({
    driver_id: id,
    driver_name: namesById.get(id) ?? id,
    outright_wins: 0,
    pairwise: Object.fromEntries(
      ids.filter((other) => other !== id).map((other) => [other, { wins: 0, losses: 0, ties: 0 }]),
    ),
  }));
  const shareById = new Map(shares.map((s) => [s.driver_id, s]));

  const per_race: H2HMatrix["per_race"] = [];

  for (const [eid, posMap] of sharedEvents) {
    const ev = eventMap.get(eid);
    const finishes: Record<string, number | null> = {};
    for (const id of ids) finishes[id] = posMap.get(id) ?? null;
    per_race.push({
      event_id: eid,
      event_label: ev ? `S${ev.season} R${ev.race_number} (${ev.league})` : eid,
      finishes,
    });

    // Pairwise update
    for (let i = 0; i < ids.length; i++) {
      for (let j = 0; j < ids.length; j++) {
        if (i === j) continue;
        const a = posMap.get(ids[i]) ?? null;
        const b = posMap.get(ids[j]) ?? null;
        if (a === null && b === null) continue;
        const slot = shareById.get(ids[i])!.pairwise[ids[j]];
        if (a !== null && (b === null || a < b)) slot.wins++;
        else if (b !== null && (a === null || b < a)) slot.losses++;
        else slot.ties++;
      }
    }

    // Outright winner of this race among the group
    const ranked = ids
      .map((id) => ({ id, pos: posMap.get(id) ?? null }))
      .filter((x) => x.pos !== null)
      .sort((a, b) => (a.pos as number) - (b.pos as number));
    if (ranked.length === ids.length) {
      shareById.get(ranked[0].id)!.outright_wins++;
    }
  }

  // Sort per_race by event chronological order if possible
  per_race.sort((a, b) => {
    const ea = eventMap.get(a.event_id);
    const eb = eventMap.get(b.event_id);
    const sa = parseInt(ea?.season ?? "0", 10);
    const sb = parseInt(eb?.season ?? "0", 10);
    if (sa !== sb) return sa - sb;
    const ra = parseInt(ea?.race_number ?? "0", 10);
    const rb = parseInt(eb?.race_number ?? "0", 10);
    return ra - rb;
  });

  return {
    driver_ids: ids,
    shared_races: sharedEvents.length,
    shares,
    per_race,
  };
}

/* ------------------------------------------------------------------ */
/*  Side-by-side metric comparison                                      */
/* ------------------------------------------------------------------ */

const COMPARISON_METRICS: Array<{
  key: keyof DriverMetrics;
  label: string;
  direction: "high" | "low";
  format: "raw" | "pct" | "decimal";
}> = [
  { key: "events", label: "Races", direction: "high", format: "raw" },
  { key: "wins", label: "Wins", direction: "high", format: "raw" },
  { key: "podiums", label: "Podiums", direction: "high", format: "raw" },
  { key: "poles", label: "Poles", direction: "high", format: "raw" },
  { key: "fastest_laps", label: "Fastest Laps", direction: "high", format: "raw" },
  { key: "dotd", label: "DOTD", direction: "high", format: "raw" },
  { key: "total_points", label: "Total Points", direction: "high", format: "raw" },
  { key: "avg_finish", label: "Avg. Finish", direction: "low", format: "decimal" },
  { key: "avg_grid", label: "Avg. Grid", direction: "low", format: "decimal" },
  { key: "avg_position_change", label: "Avg. Pos. Gain", direction: "high", format: "decimal" },
  { key: "finish_rate", label: "Finish Rate", direction: "high", format: "pct" },
  { key: "pace_index", label: "Pace Index", direction: "high", format: "decimal" },
  { key: "race_craft_score", label: "Race Craft", direction: "high", format: "decimal" },
  { key: "clutch_score", label: "Clutch", direction: "high", format: "decimal" },
  { key: "wet_delta", label: "Wet Δ", direction: "high", format: "decimal" },
  { key: "peer_adjusted_points", label: "PAP", direction: "high", format: "decimal" },
];

export function buildH2HMetricRows(metricsList: DriverMetrics[]): H2HMetricRow[] {
  return COMPARISON_METRICS.map((spec) => {
    const values = metricsList.map((m) => {
      const v = m[spec.key];
      return typeof v === "number" ? v : null;
    });
    const definedValues = values.filter((v): v is number => v !== null);
    let bestIndices: number[] = [];
    if (definedValues.length > 0) {
      const best = spec.direction === "high"
        ? Math.max(...definedValues)
        : Math.min(...definedValues);
      bestIndices = values.map((v, i) => (v === best ? i : -1)).filter((i) => i >= 0);
    }
    return {
      metric_key: spec.key,
      label: spec.label,
      values,
      best_indices: bestIndices,
      direction: spec.direction,
      format: spec.format,
    };
  });
}

/* ------------------------------------------------------------------ */
/*  DNA overlay payload                                                  */
/* ------------------------------------------------------------------ */

export type DnaOverlayDataPoint = {
  axis: string;
  /** One value per selected driver, in the same order as driverIds. */
  values: Array<number | null>;
};

import { DNA_AXIS_LABELS, type DnaAxis } from "./dna";

export function buildDnaOverlayData(
  driverIds: string[],
  dnaByDriver: Map<string, DriverDna>,
): DnaOverlayDataPoint[] {
  const axes: DnaAxis[] = [
    "one_lap_pace",
    "race_pace",
    "race_craft",
    "consistency",
    "wet_conditions",
    "tyre_management",
    "reliability",
    "clutch",
  ];
  return axes.map((a) => ({
    axis: DNA_AXIS_LABELS[a],
    values: driverIds.map((id) => dnaByDriver.get(id)?.[a] ?? null),
  }));
}
