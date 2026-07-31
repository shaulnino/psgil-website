/* ------------------------------------------------------------------ */
/*  Head-to-Head profile selector                                      */
/*                                                                     */
/*  Direct, shared-events comparison of two drivers on the normalized  */
/*  dataset. Replaces the legacy lib/h2h.ts engine so H2H obeys the    */
/*  same cross-tab statistical contract as the other tabs.             */
/*                                                                     */
/*  Locked rules (approved plan):                                      */
/*   - Model A: shared events only.                                    */
/*   - A shared event counts only when BOTH drivers STARTED.           */
/*     If either DNS, the event is listed but excluded from win/lose.  */
/*   - DSQ stays in as an unclassified (behind any classified finish). */
/*   - Grid / pole / avg-grid exclude reverse-grid events.             */
/*   - Classified finish = status "finished"; classified beats DNF/DSQ.*/
/*   - Points = final CSV points (post-penalty).                       */
/* ------------------------------------------------------------------ */

import {
  filterRaces,
  sortChronological,
  type NormalizedRace,
  type ProfileFilters,
  type WeatherKind,
} from "@/lib/stats/normalizeRace";
import type { RaceFormat } from "@/lib/scheduleData";

export type H2HDriver = { id: string; name: string };

/** One shared event, both drivers side by side. */
export type H2HRaceLine = {
  eventId: string;
  raceName: string;
  raceNameHe?: string;
  track?: string;
  trackHe?: string;
  date: string;
  dateMs: number;
  seasonKey: string;
  league: "main" | "wild";
  format: RaceFormat;
  isPlayoff: boolean;
  reverseGrid: boolean;
  weather: WeatherKind;

  finishA: number | null;
  finishB: number | null;
  gridA: number | null; // non-reverse-grid only
  gridB: number | null;
  gridRawA: number | null;
  gridRawB: number | null;
  pointsA: number;
  pointsB: number;
  statusA: "finished" | "dnf" | "dns" | "dsq";
  statusB: "finished" | "dnf" | "dns" | "dsq";

  /** Both drivers started -> the race counts toward win/lose. */
  counts: boolean;
  winner: "a" | "b" | "tie" | null;
  gridWinner: "a" | "b" | null;
};

/** {a,b} value pair for a comparison card. */
export type H2HPair = { a: number | null; b: number | null };

export type H2HProfile = {
  driverA: H2HDriver;
  driverB: H2HDriver;

  /** Events both drivers entered (in scope). */
  sharedEvents: number;
  /** Events both drivers started (the fair comparison sample). */
  sharedStarts: number;
  /** Shared events excluded from win/lose because one driver DNS'd. */
  excludedDns: number;

  winsA: number;
  winsB: number;
  ties: number;

  /** Comparison values over the shared-start sample, keyed by metric id. */
  summary: Record<string, H2HPair>;

  /** Every shared event (both entered), chronological. */
  races: H2HRaceLine[];
};

/* ------------------------------------------------------------------ */
/*  Driver list                                                        */
/* ------------------------------------------------------------------ */

/** Unique drivers (id + latest-seen name) sorted by name. */
export function listH2HDrivers(allRaces: NormalizedRace[]): H2HDriver[] {
  const byId = new Map<string, string>();
  const chrono = sortChronological(allRaces);
  for (const r of chrono) {
    if (!r.driverId) continue;
    if (r.driverName) byId.set(r.driverId, r.driverName); // latest name wins
    else if (!byId.has(r.driverId)) byId.set(r.driverId, r.driverId);
  }
  return [...byId.entries()]
    .map(([id, name]) => ({ id, name }))
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));
}

/* ------------------------------------------------------------------ */
/*  Math helpers                                                       */
/* ------------------------------------------------------------------ */

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function mean(nums: number[]): number | null {
  if (nums.length === 0) return null;
  return round2(nums.reduce((s, n) => s + n, 0) / nums.length);
}

/* ------------------------------------------------------------------ */
/*  Compute                                                            */
/* ------------------------------------------------------------------ */

/** Per-driver aggregate over a set of shared-start races. */
function summarize(races: { self: NormalizedRace }[]): Record<string, number | null> {
  const starts = races.length;
  const classified = races.filter((r) => r.self.isClassified);
  const finishes = classified.map((r) => r.self.finish!);
  const grids = races.filter((r) => r.self.grid !== null).map((r) => r.self.grid!);
  const points = races.reduce((s, r) => s + r.self.points, 0);
  const wins = classified.filter((r) => r.self.finish === 1).length;
  const podiums = classified.filter((r) => r.self.finish! <= 3).length;
  const netRaces = races.filter((r) => r.self.netChange !== null);
  const net = netRaces.reduce((s, r) => s + (r.self.netChange ?? 0), 0);

  return {
    wins,
    podiums,
    points: round2(points),
    pointsPerStart: starts > 0 ? round2(points / starts) : null,
    avgFinish: mean(finishes),
    avgGrid: mean(grids),
    bestFinish: finishes.length ? Math.min(...finishes) : null,
    poles: races.filter((r) => r.self.pole).length,
    fastestLaps: races.filter((r) => r.self.fastestLap).length,
    dotd: races.filter((r) => r.self.dotd).length,
    netPositions: net,
    finishRate: starts > 0 ? round2((classified.length / starts) * 100) : null,
    dnf: races.filter((r) => r.self.status === "dnf" || r.self.status === "dsq").length,
  };
}

export function computeH2HProfile(
  allRaces: NormalizedRace[],
  driverIdA: string,
  driverIdB: string,
  filters: ProfileFilters,
): H2HProfile | null {
  if (!driverIdA || !driverIdB || driverIdA === driverIdB) return null;

  const filtered = filterRaces(allRaces, filters);
  const mapA = new Map<string, NormalizedRace>();
  const mapB = new Map<string, NormalizedRace>();
  let nameA = driverIdA;
  let nameB = driverIdB;
  for (const r of filtered) {
    if (r.driverId === driverIdA) {
      mapA.set(r.eventId, r);
      if (r.driverName) nameA = r.driverName;
    } else if (r.driverId === driverIdB) {
      mapB.set(r.eventId, r);
      if (r.driverName) nameB = r.driverName;
    }
  }

  const sharedIds: string[] = [];
  for (const eid of mapA.keys()) if (mapB.has(eid)) sharedIds.push(eid);

  const lines: H2HRaceLine[] = [];
  const countingA: { self: NormalizedRace }[] = [];
  const countingB: { self: NormalizedRace }[] = [];
  let winsA = 0;
  let winsB = 0;
  let ties = 0;
  let excludedDns = 0;

  for (const eid of sharedIds) {
    const a = mapA.get(eid)!;
    const b = mapB.get(eid)!;
    const counts = a.isStart && b.isStart;

    let winner: H2HRaceLine["winner"] = null;
    if (counts) {
      const aCls = a.isClassified;
      const bCls = b.isClassified;
      if (aCls && bCls) {
        if (a.finish! < b.finish!) winner = "a";
        else if (b.finish! < a.finish!) winner = "b";
        else winner = "tie";
      } else if (aCls && !bCls) winner = "a";
      else if (bCls && !aCls) winner = "b";
      else winner = "tie"; // both started, neither classified

      if (winner === "a") winsA++;
      else if (winner === "b") winsB++;
      else ties++;

      countingA.push({ self: a });
      countingB.push({ self: b });
    } else {
      excludedDns++;
    }

    let gridWinner: H2HRaceLine["gridWinner"] = null;
    if (a.grid !== null && b.grid !== null) {
      gridWinner = a.grid < b.grid ? "a" : b.grid < a.grid ? "b" : null;
    }

    lines.push({
      eventId: eid,
      raceName: a.raceName,
      raceNameHe: a.raceNameHe,
      track: a.track,
      trackHe: a.trackHe,
      date: a.date,
      dateMs: a.dateMs,
      seasonKey: a.seasonKey,
      league: a.league,
      format: a.format,
      isPlayoff: a.isPlayoff,
      reverseGrid: a.reverseGrid,
      weather: a.weather,
      finishA: a.finish,
      finishB: b.finish,
      gridA: a.grid,
      gridB: b.grid,
      gridRawA: a.gridRaw,
      gridRawB: b.gridRaw,
      pointsA: a.points,
      pointsB: b.points,
      statusA: a.status,
      statusB: b.status,
      counts,
      winner,
      gridWinner,
    });
  }

  lines.sort((x, y) => {
    if (Number.isFinite(x.dateMs) && Number.isFinite(y.dateMs) && x.dateMs !== y.dateMs) {
      return x.dateMs - y.dateMs;
    }
    return x.eventId.localeCompare(y.eventId);
  });

  const sa = summarize(countingA);
  const sb = summarize(countingB);
  const summary: Record<string, H2HPair> = {};
  for (const key of Object.keys(sa)) {
    summary[key] = { a: sa[key], b: sb[key] };
  }
  // Head-to-head win counts + qualifying head-to-head as comparison pairs.
  summary.h2hWins = { a: winsA, b: winsB };
  summary.gridWins = {
    a: lines.filter((l) => l.gridWinner === "a").length,
    b: lines.filter((l) => l.gridWinner === "b").length,
  };

  return {
    driverA: { id: driverIdA, name: nameA },
    driverB: { id: driverIdB, name: nameB },
    sharedEvents: sharedIds.length,
    sharedStarts: countingA.length,
    excludedDns,
    winsA,
    winsB,
    ties,
    summary,
    races: lines,
  };
}
