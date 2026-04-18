/* ------------------------------------------------------------------ */
/*  Stats V2 — Season-level analytics                                  */
/*                                                                     */
/*  Tells the story of each PSGiL season:                              */
/*    - Champion, runner-up, # races, # unique winners                 */
/*    - Competitiveness Index (composite 0-100)                         */
/*    - Dominance Score (top driver win share)                          */
/*    - Midfield Compression (P5–P10 spread)                            */
/*    - Overtake density, DNF trends                                    */
/* ------------------------------------------------------------------ */

import type { RaceResultRow } from "@/lib/resultsData";
import type { RaceEvent } from "@/lib/scheduleData";
import type { SeasonConfig } from "@/lib/seasonConfig";
import { matchesSeason } from "@/lib/seasonConfig";

export type SeasonAnalytics = {
  season_key: string;
  season_label: string;
  total_races: number;
  total_drivers: number;
  champion: { driver_id: string; driver_name: string; points: number } | null;
  runner_up: { driver_id: string; driver_name: string; points: number } | null;
  unique_winners: number;
  /** Composite 0-100 score (higher = more competitive). */
  competitiveness_index: number;
  /** Top driver's share of wins (0-1). */
  dominance_share: number | null;
  /** Spread between P5 and P10 in points / total points. */
  midfield_compression: number | null;
  /** Overtakes per race average. */
  overtake_density: number | null;
  /** DNF rate. */
  dnf_rate: number;
  /** Cumulative points for the title race (winner vs runner-up across rounds). */
  title_race: { round: number; leader_points: number; runner_up_points: number }[];
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

/** Gini coefficient of a numeric array (0 = perfect equality, 1 = total inequality). */
function gini(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const n = sorted.length;
  const sum = sorted.reduce((s, v) => s + v, 0);
  if (sum === 0) return 0;
  let cumulative = 0;
  for (let i = 0; i < n; i++) cumulative += (i + 1) * sorted[i];
  return (2 * cumulative) / (n * sum) - (n + 1) / n;
}

/* ------------------------------------------------------------------ */

export function computeSeasonAnalytics(
  results: RaceResultRow[],
  events: RaceEvent[],
  seasons: SeasonConfig[],
): SeasonAnalytics[] {
  const eventMap = new Map<string, RaceEvent>();
  for (const e of events) eventMap.set(e.event_id.toLowerCase(), e);

  const out: SeasonAnalytics[] = [];

  for (const season of seasons) {
    const seasonEvents = events.filter(
      (e) => matchesSeason(e.season, season.season_key) && e.status.toLowerCase() === "completed",
    );
    if (seasonEvents.length === 0) continue;

    const eventIds = new Set(seasonEvents.map((e) => e.event_id.toLowerCase()));
    const seasonResults = results.filter((r) => eventIds.has(r.event_id.toLowerCase()));
    if (seasonResults.length === 0) continue;

    // Aggregate by driver
    const ptsByDriver = new Map<string, number>();
    const winsByDriver = new Map<string, number>();
    const nameByDriver = new Map<string, string>();
    const winners = new Set<string>();
    const driversSet = new Set<string>();
    let dnfCount = 0;
    let entryCount = 0;
    let overtakeSum = 0;
    let overtakeRaces = 0;

    for (const r of seasonResults) {
      const id = (r.driver_id || "").trim();
      if (!id) continue;
      driversSet.add(id);
      if (r.driver_name) nameByDriver.set(id, r.driver_name);

      const pts = parseNum(r.points) ?? 0;
      ptsByDriver.set(id, (ptsByDriver.get(id) ?? 0) + pts);

      const pos = parsePos(r.position);
      if (pos === 1) {
        winners.add(id);
        winsByDriver.set(id, (winsByDriver.get(id) ?? 0) + 1);
      }

      const status = (r.status ?? "").trim().toLowerCase();
      if (["dnf", "dns", "dsq", "disqualified"].includes(status)) dnfCount++;
      entryCount++;

      const ov = parseNum(r.overtakes);
      if (ov !== null) {
        overtakeSum += ov;
        overtakeRaces++;
      }
    }

    const sortedDrivers = [...ptsByDriver.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([id, points]) => ({
        driver_id: id,
        driver_name: nameByDriver.get(id) ?? id,
        points,
      }));

    const champion = sortedDrivers[0] ?? null;
    const runnerUp = sortedDrivers[1] ?? null;

    // Dominance share
    const totalWins = [...winsByDriver.values()].reduce((s, n) => s + n, 0);
    const topWins = totalWins > 0 ? Math.max(...winsByDriver.values()) : 0;
    const dominance = totalWins > 0 ? topWins / totalWins : null;

    // Midfield compression: (P5_pts - P10_pts) / total_points
    const totalPts = sortedDrivers.reduce((s, d) => s + d.points, 0);
    let midfield: number | null = null;
    if (sortedDrivers.length >= 10 && totalPts > 0) {
      const span = sortedDrivers[4].points - sortedDrivers[9].points;
      midfield = Math.round((span / totalPts) * 1000) / 1000;
    }

    // Competitiveness Index — composite of:
    //   - Inverse Gini of points distribution (more equal = more competitive)
    //   - # of unique winners / # races
    //   - Inverse dominance share
    const giniRaw = gini(sortedDrivers.map((d) => d.points));
    const giniInv = 1 - giniRaw; // higher = more equal
    const winnerVariety = seasonEvents.length > 0 ? winners.size / seasonEvents.length : 0;
    const dominanceInv = dominance !== null ? 1 - dominance : 1;
    const compIdx = Math.round((giniInv * 0.4 + winnerVariety * 0.4 + dominanceInv * 0.2) * 100);

    // Title race: cumulative points by round for top 2
    const titleRace: SeasonAnalytics["title_race"] = [];
    if (champion && runnerUp) {
      const orderedEvents = [...seasonEvents].sort((a, b) => {
        const na = parseInt(a.race_number, 10) || 0;
        const nb = parseInt(b.race_number, 10) || 0;
        return na - nb;
      });
      let leadPts = 0;
      let runPts = 0;
      orderedEvents.forEach((ev, idx) => {
        for (const r of seasonResults) {
          if (r.event_id.toLowerCase() !== ev.event_id.toLowerCase()) continue;
          const pts = parseNum(r.points) ?? 0;
          if (r.driver_id === champion.driver_id) leadPts += pts;
          if (r.driver_id === runnerUp.driver_id) runPts += pts;
        }
        titleRace.push({ round: idx + 1, leader_points: leadPts, runner_up_points: runPts });
      });
    }

    out.push({
      season_key: season.season_key,
      season_label: season.season_label || season.season_key,
      total_races: seasonEvents.length,
      total_drivers: driversSet.size,
      champion,
      runner_up: runnerUp,
      unique_winners: winners.size,
      competitiveness_index: compIdx,
      dominance_share: dominance !== null ? Math.round(dominance * 100) / 100 : null,
      midfield_compression: midfield,
      overtake_density: overtakeRaces > 0 ? Math.round((overtakeSum / overtakeRaces) * 10) / 10 : null,
      dnf_rate: entryCount > 0 ? Math.round((dnfCount / entryCount) * 1000) / 1000 : 0,
      title_race: titleRace,
    });
  }

  return out;
}
