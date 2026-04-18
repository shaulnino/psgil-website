/* ------------------------------------------------------------------ */
/*  Stats V2 — Circuit-level stats and character tags                  */
/* ------------------------------------------------------------------ */

import type { RaceResultRow } from "@/lib/resultsData";
import type { RaceEvent } from "@/lib/scheduleData";

export type CircuitCharacterTag =
  | "High-Overtake"
  | "Chaos Track"
  | "Pole Decides"
  | "Race-Craft Track"
  | "Qualifying Track";

export type CircuitStats = {
  track: string;
  /** All event_ids that took place at this track. */
  event_ids: string[];
  /** Total race entries (driver-race rows). */
  entries: number;
  /** Unique winners. */
  unique_winners: number;
  /** Drivers who have raced here (driver_id). */
  driver_ids: string[];
  /** Average position change per entry (|grid - finish|). */
  avg_abs_position_change: number | null;
  /** Average overtakes per race (sum overtakes / # races). */
  avg_overtakes_per_race: number | null;
  /** DNF rate. */
  dnf_rate: number;
  /** Pole-to-win conversion rate at this track. */
  pole_to_win: number | null;
  /** Steward penalty rate per entry. */
  steward_penalty_rate: number;
  /** Character tags. */
  tags: CircuitCharacterTag[];
  /** All-time top driver here (lowest avg finish, min 2 races). */
  specialist: { driver_id: string; driver_name: string; avg_finish: number; races: number } | null;
};

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

/**
 * Compute per-circuit statistics from a flat list of race results.
 */
export function computeCircuitStatsList(
  results: RaceResultRow[],
  events: RaceEvent[],
): CircuitStats[] {
  // Group events by track
  const eventsByTrack = new Map<string, RaceEvent[]>();
  for (const e of events) {
    if (e.status.toLowerCase() !== "completed") continue;
    const t = (e.track ?? "").trim();
    if (!t) continue;
    if (!eventsByTrack.has(t)) eventsByTrack.set(t, []);
    eventsByTrack.get(t)!.push(e);
  }

  const eventMap = new Map<string, RaceEvent>();
  for (const e of events) eventMap.set(e.event_id.toLowerCase(), e);

  const out: CircuitStats[] = [];

  for (const [track, trackEvents] of eventsByTrack) {
    const eventIds = new Set(trackEvents.map((e) => e.event_id.toLowerCase()));
    const trackResults = results.filter((r) => eventIds.has(r.event_id.toLowerCase()));

    if (trackResults.length === 0) continue;

    const winners = new Set<string>();
    const drivers = new Set<string>();
    const finishByDriver = new Map<string, number[]>();
    const driverNames = new Map<string, string>();

    let absChangeSum = 0;
    let absChangeCount = 0;
    let overtakeSum = 0;
    let overtakeRaces = 0;
    let dnfCount = 0;
    let entryCount = 0;
    let polePosResults = 0;
    let polePosWins = 0;
    let stewardSum = 0;

    for (const r of trackResults) {
      entryCount++;
      const id = (r.driver_id || "").trim();
      if (id) {
        drivers.add(id);
        if (!driverNames.has(id) && r.driver_name) driverNames.set(id, r.driver_name);
      }

      const pos = parsePos(r.position);
      const grid = parsePos(r.grid);
      const status = (r.status ?? "").trim().toLowerCase();
      const isDNF = ["dnf", "dns", "dsq", "disqualified"].includes(status);

      if (isDNF) dnfCount++;

      const ev = eventMap.get(r.event_id.toLowerCase());
      const isReverseGrid = (ev?.reverse_grid ?? "").trim().toLowerCase() === "yes";

      if (pos !== null && grid !== null && !isReverseGrid) {
        absChangeSum += Math.abs(pos - grid);
        absChangeCount++;
        if (grid === 1) {
          polePosResults++;
          if (pos === 1) polePosWins++;
        }
      }

      if (pos === 1 && id) winners.add(id);

      if (pos !== null && id) {
        if (!finishByDriver.has(id)) finishByDriver.set(id, []);
        finishByDriver.get(id)!.push(pos);
      }

      const ov = parseNum(r.overtakes);
      if (ov !== null) {
        overtakeSum += ov;
        overtakeRaces++;
      }

      const sp = parseNum(r.steward_penalty);
      if (sp !== null) stewardSum += sp;
    }

    const avgAbsChange = absChangeCount > 0 ? absChangeSum / absChangeCount : null;
    const avgOvertakes = overtakeRaces > 0 ? overtakeSum / overtakeRaces : null;
    const dnfRate = entryCount > 0 ? dnfCount / entryCount : 0;
    const polToWin = polePosResults > 0 ? polePosWins / polePosResults : null;
    const stewardRate = entryCount > 0 ? stewardSum / entryCount : 0;

    // Specialist: driver with lowest avg finish here, min 2 races
    let specialist: CircuitStats["specialist"] = null;
    let bestAvg = Infinity;
    for (const [id, positions] of finishByDriver) {
      if (positions.length < 2) continue;
      const a = positions.reduce((s, n) => s + n, 0) / positions.length;
      if (a < bestAvg) {
        bestAvg = a;
        specialist = {
          driver_id: id,
          driver_name: driverNames.get(id) ?? id,
          avg_finish: Math.round(a * 100) / 100,
          races: positions.length,
        };
      }
    }

    // Character tags (rule-based)
    const tags: CircuitCharacterTag[] = [];
    if (avgOvertakes !== null && avgOvertakes >= 30) tags.push("High-Overtake");
    if (dnfRate >= 0.18 || stewardRate >= 1.5) tags.push("Chaos Track");
    if (polToWin !== null && polToWin >= 0.6) tags.push("Pole Decides");
    if (polToWin !== null && polToWin <= 0.2 && polePosResults >= 2) tags.push("Race-Craft Track");
    if (avgAbsChange !== null && avgAbsChange <= 1.5) tags.push("Qualifying Track");

    out.push({
      track,
      event_ids: [...eventIds],
      entries: entryCount,
      unique_winners: winners.size,
      driver_ids: [...drivers],
      avg_abs_position_change: avgAbsChange !== null ? Math.round(avgAbsChange * 100) / 100 : null,
      avg_overtakes_per_race: avgOvertakes !== null ? Math.round(avgOvertakes * 10) / 10 : null,
      dnf_rate: Math.round(dnfRate * 1000) / 1000,
      pole_to_win: polToWin !== null ? Math.round(polToWin * 100) / 100 : null,
      steward_penalty_rate: Math.round(stewardRate * 100) / 100,
      tags,
      specialist,
    });
  }

  return out.sort((a, b) => a.track.localeCompare(b.track));
}

/* ------------------------------------------------------------------ */

export function findCircuit(
  list: CircuitStats[],
  track: string,
): CircuitStats | undefined {
  const t = track.trim().toLowerCase();
  return list.find((c) => c.track.toLowerCase() === t);
}

/** Per-driver record at a single circuit. */
export type DriverCircuitRecord = {
  driver_id: string;
  driver_name: string;
  races: number;
  wins: number;
  podiums: number;
  best_finish: number | null;
  avg_finish: number | null;
};

export function computeDriverRecordsAtCircuit(
  results: RaceResultRow[],
  events: RaceEvent[],
  track: string,
): DriverCircuitRecord[] {
  const wantTrack = track.trim().toLowerCase();
  const eventIds = new Set(
    events
      .filter((e) => (e.track ?? "").trim().toLowerCase() === wantTrack)
      .map((e) => e.event_id.toLowerCase()),
  );
  if (eventIds.size === 0) return [];

  const trackResults = results.filter((r) => eventIds.has(r.event_id.toLowerCase()));
  const map = new Map<string, DriverCircuitRecord>();

  for (const r of trackResults) {
    const id = (r.driver_id || "").trim();
    if (!id) continue;
    if (!map.has(id)) {
      map.set(id, {
        driver_id: id,
        driver_name: (r.driver_name || "").trim(),
        races: 0, wins: 0, podiums: 0,
        best_finish: null, avg_finish: null,
      });
    }
    const row = map.get(id)!;
    row.races++;
    const pos = parsePos(r.position);
    if (pos !== null) {
      if (pos === 1) row.wins++;
      if (pos <= 3) row.podiums++;
      row.best_finish = row.best_finish === null ? pos : Math.min(row.best_finish, pos);
    }
  }

  // avg_finish second pass
  for (const id of map.keys()) {
    const positions: number[] = [];
    for (const r of trackResults) {
      if (r.driver_id !== id) continue;
      const pos = parsePos(r.position);
      if (pos !== null) positions.push(pos);
    }
    const row = map.get(id)!;
    row.avg_finish = positions.length
      ? Math.round((positions.reduce((s, n) => s + n, 0) / positions.length) * 100) / 100
      : null;
  }

  return [...map.values()].sort((a, b) => {
    if (a.avg_finish === null) return 1;
    if (b.avg_finish === null) return -1;
    return a.avg_finish - b.avg_finish;
  });
}
