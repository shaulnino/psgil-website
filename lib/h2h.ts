import type { RaceResultRow } from "@/lib/resultsData";
import type { RaceEvent } from "@/lib/scheduleData";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export type H2HSummary = {
  sharedRaces: number;
  winsA: number;
  winsB: number;
  ties: number;
  pointsA: number;
  pointsB: number;
  avgFinishA: number | null;
  avgFinishB: number | null;
  avgGridA: number | null;
  avgGridB: number | null;
  podiumsA: number;
  podiumsB: number;
  dnfsA: number;
  dnfsB: number;
  victoriesA: number;
  victoriesB: number;
  top5A: number;
  top5B: number;
  top10A: number;
  top10B: number;
  bestFinishA: number | null;
  bestFinishB: number | null;
  gridWinsA: number;
  gridWinsB: number;
  fastestLapsA: number;
  fastestLapsB: number;
  polesA: number;
  polesB: number;
  dotdsA: number;
  dotdsB: number;
  pointsPerRaceA: number | null;
  pointsPerRaceB: number | null;
  worstFinishA: number | null;
  worstFinishB: number | null;
  bestGridA: number | null;
  bestGridB: number | null;
  frontRowA: number;
  frontRowB: number;
  finishedA: number;
  finishedB: number;
  winRateA: number | null;
  winRateB: number | null;
  podiumRateA: number | null;
  podiumRateB: number | null;
};

export type H2HRaceRow = {
  eventId: string;
  raceName: string;
  date: string;
  league: string;
  season: string;
  circuit: string;
  finishA: number | null;
  finishB: number | null;
  pointsA: number;
  pointsB: number;
  gridA: number | null;
  gridB: number | null;
  statusA: string;
  statusB: string;
  winner: "a" | "b" | "tie" | null;
  /** Per-race fastest lap (for cumulative H2H trend charts). */
  fastestLapA: boolean;
  fastestLapB: boolean;
  /** Per-race Driver of the Day (for cumulative H2H trend charts). */
  dotdA: boolean;
  dotdB: boolean;
};

export type H2HResult = {
  summary: H2HSummary;
  races: H2HRaceRow[];
};

export type H2HFilters = {
  seasons?: string[];
  circuits?: string[];
  weather?: string[];
  format?: string;       // "50%" | "25%" | "sprint"
  competition?: string;  // "main" | "wild"
  roundType?: string;    // "regular" | "playoff"
};

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function safeInt(val: string | undefined): number | null {
  if (!val) return null;
  const n = parseInt(val, 10);
  return Number.isFinite(n) ? n : null;
}

function safeFloat(val: string | undefined): number {
  if (!val) return 0;
  const n = parseFloat(val);
  return Number.isFinite(n) ? n : 0;
}

function isDnf(status: string | undefined): boolean {
  if (!status) return false;
  const s = status.trim().toLowerCase();
  return s === "dnf" || s === "dsq" || s === "dns" || s === "retired";
}

function avg(values: (number | null)[]): number | null {
  const valid = values.filter((v): v is number => v !== null);
  if (valid.length === 0) return null;
  return valid.reduce((a, b) => a + b, 0) / valid.length;
}

function minVal(values: (number | null)[]): number | null {
  const valid = values.filter((v): v is number => v !== null);
  if (valid.length === 0) return null;
  return Math.min(...valid);
}

function maxVal(values: (number | null)[]): number | null {
  const valid = values.filter((v): v is number => v !== null);
  if (valid.length === 0) return null;
  return Math.max(...valid);
}

/* ------------------------------------------------------------------ */
/*  Build driver → event_id index                                      */
/* ------------------------------------------------------------------ */

export type DriverResultIndex = Map<string, Map<string, RaceResultRow>>;

export function buildDriverIndex(
  allResults: Record<string, RaceResultRow[]>,
): DriverResultIndex {
  const index: DriverResultIndex = new Map();
  for (const [eventId, rows] of Object.entries(allResults)) {
    for (const row of rows) {
      const name = (row.driver_name ?? "").trim();
      if (!name) continue;
      if (!index.has(name)) index.set(name, new Map());
      index.get(name)!.set(eventId, row);
    }
  }
  return index;
}

export function getDriverNames(index: DriverResultIndex): string[] {
  return Array.from(index.keys()).sort((a, b) =>
    a.localeCompare(b, undefined, { sensitivity: "base" }),
  );
}

/* ------------------------------------------------------------------ */
/*  Build event metadata lookup                                        */
/* ------------------------------------------------------------------ */

export type EventMeta = {
  raceName: string;
  date: string;
  league: string;
  season: string;
  circuit: string;
  weather: string;
  race_format: string;
  is_playoff: boolean;
};

export function buildEventMeta(
  events: RaceEvent[],
): Map<string, EventMeta> {
  const map = new Map<string, EventMeta>();
  for (const e of events) {
    map.set(e.event_id, {
      raceName: e.race_name || `Race ${e.race_number}`,
      date: e.date || "",
      league: e.league || "",
      season: e.season
        ? (e.season.startsWith("S") || e.season.startsWith("s") ? e.season.toUpperCase() : `S${e.season}`)
        : "",
      circuit: e.track || e.race_name || "",
      weather: (e.weather || "").trim().toLowerCase(),
      race_format: e.race_format || "50%",
      is_playoff: e.is_playoff ?? false,
    });
  }
  return map;
}

/** Extract unique seasons, circuits, and weather conditions from event metadata. */
export function getFilterOptions(eventMeta: Map<string, EventMeta>): {
  seasons: string[];
  circuits: string[];
  weather: string[];
} {
  const seasonSet = new Set<string>();
  const circuitSet = new Set<string>();
  const weatherSet = new Set<string>();
  for (const m of eventMeta.values()) {
    if (m.season) seasonSet.add(m.season);
    if (m.circuit) circuitSet.add(m.circuit);
    if (m.weather) weatherSet.add(m.weather);
  }
  const seasons = Array.from(seasonSet).sort((a, b) => {
    const na = parseInt(a.replace(/\D/g, ""), 10);
    const nb = parseInt(b.replace(/\D/g, ""), 10);
    return na - nb;
  });
  const circuits = Array.from(circuitSet).sort((a, b) =>
    a.localeCompare(b, undefined, { sensitivity: "base" }),
  );
  const weather = Array.from(weatherSet).sort();
  return { seasons, circuits, weather };
}

/* ------------------------------------------------------------------ */
/*  Compute H2H                                                        */
/* ------------------------------------------------------------------ */

export function computeH2H(
  index: DriverResultIndex,
  driverA: string,
  driverB: string,
  eventMeta: Map<string, EventMeta>,
  filters?: H2HFilters,
): H2HResult {
  const eventsA = index.get(driverA);
  const eventsB = index.get(driverB);

  if (!eventsA || !eventsB) {
    return { summary: emptySummary(), races: [] };
  }

  const sharedIds: string[] = [];
  for (const eid of eventsA.keys()) {
    if (!eventsB.has(eid)) continue;
    const meta = eventMeta.get(eid);
    if (filters?.seasons && filters.seasons.length > 0) {
      const eventSeason = meta?.season || extractSeason(eid);
      if (eventSeason && !filters.seasons.includes(eventSeason)) continue;
    }
    if (filters?.circuits && filters.circuits.length > 0 && meta) {
      if (!filters.circuits.some((c) => c.toLowerCase() === meta.circuit.toLowerCase())) continue;
    }
    if (filters?.weather && filters.weather.length > 0 && meta) {
      if (!filters.weather.some((w) => w.toLowerCase() === meta.weather.toLowerCase())) continue;
    }
    if (filters?.format && meta) {
      if (meta.race_format !== filters.format) continue;
    }
    if (filters?.competition && meta) {
      if (meta.league.toLowerCase() !== filters.competition.toLowerCase()) continue;
    }
    if (filters?.roundType && meta) {
      if (filters.roundType === "playoff" && !meta.is_playoff) continue;
      if (filters.roundType === "regular" && meta.is_playoff) continue;
    }
    sharedIds.push(eid);
  }

  sharedIds.sort();

  const races: H2HRaceRow[] = [];
  let winsA = 0, winsB = 0, ties = 0;
  let pointsA = 0, pointsB = 0;
  const finishesA: (number | null)[] = [];
  const finishesB: (number | null)[] = [];
  const gridsA: (number | null)[] = [];
  const gridsB: (number | null)[] = [];
  let podiumsA = 0, podiumsB = 0;
  let dnfsA = 0, dnfsB = 0;
  let victoriesA = 0, victoriesB = 0;
  let top5A = 0, top5B = 0;
  let top10A = 0, top10B = 0;
  let gridWinsA = 0, gridWinsB = 0;
  let fastestLapsA = 0, fastestLapsB = 0;
  let polesA = 0, polesB = 0;
  let dotdsA = 0, dotdsB = 0;

  for (const eid of sharedIds) {
    const rowA = eventsA.get(eid)!;
    const rowB = eventsB.get(eid)!;
    const meta = eventMeta.get(eid);

    const fA = safeInt(rowA.position);
    const fB = safeInt(rowB.position);
    const pA = safeFloat(rowA.points);
    const pB = safeFloat(rowB.points);
    const gA = safeInt(rowA.grid);
    const gB = safeInt(rowB.grid);

    let winner: H2HRaceRow["winner"] = null;
    if (fA !== null && fB !== null) {
      if (fA < fB) winner = "a";
      else if (fB < fA) winner = "b";
      else winner = "tie";
    } else if (fA !== null) {
      winner = "a";
    } else if (fB !== null) {
      winner = "b";
    }

    if (winner === "a") winsA++;
    else if (winner === "b") winsB++;
    else if (winner === "tie") ties++;

    pointsA += pA;
    pointsB += pB;
    finishesA.push(fA);
    finishesB.push(fB);
    gridsA.push(gA);
    gridsB.push(gB);

    if (fA !== null && fA <= 3) podiumsA++;
    if (fB !== null && fB <= 3) podiumsB++;
    if (fA === 1) victoriesA++;
    if (fB === 1) victoriesB++;
    if (fA !== null && fA <= 5) top5A++;
    if (fB !== null && fB <= 5) top5B++;
    if (fA !== null && fA <= 10) top10A++;
    if (fB !== null && fB <= 10) top10B++;
    if (isDnf(rowA.status)) dnfsA++;
    if (isDnf(rowB.status)) dnfsB++;

    // Position gain = grid - finish (positive = gained places)
    if (gA !== null && gB !== null) {
      if (gA < gB) gridWinsA++;
      else if (gB < gA) gridWinsB++;
    }

    // Fastest lap / DOTD (value is "yes"/"1"/"true" when set)
    const flA = (rowA.fastest_lap ?? "").trim().toLowerCase();
    const flB = (rowB.fastest_lap ?? "").trim().toLowerCase();
    const hasFlA = flA === "yes" || flA === "1" || flA === "true";
    const hasFlB = flB === "yes" || flB === "1" || flB === "true";
    if (hasFlA) fastestLapsA++;
    if (hasFlB) fastestLapsB++;

    if (gA === 1) polesA++;
    if (gB === 1) polesB++;

    const dotdAS = (rowA.dotd ?? "").trim().toLowerCase();
    const dotdBS = (rowB.dotd ?? "").trim().toLowerCase();
    const hasDotdA = dotdAS === "yes" || dotdAS === "1" || dotdAS === "true";
    const hasDotdB = dotdBS === "yes" || dotdBS === "1" || dotdBS === "true";
    if (hasDotdA) dotdsA++;
    if (hasDotdB) dotdsB++;

    races.push({
      eventId: eid,
      raceName: meta?.raceName ?? formatEventId(eid),
      date: meta?.date ?? "",
      league: meta?.league ?? "",
      season: meta?.season ?? extractSeason(eid) ?? "",
      circuit: meta?.circuit ?? "",
      finishA: fA,
      finishB: fB,
      pointsA: pA,
      pointsB: pB,
      gridA: gA,
      gridB: gB,
      statusA: rowA.status ?? "",
      statusB: rowB.status ?? "",
      winner,
      fastestLapA: hasFlA,
      fastestLapB: hasFlB,
      dotdA: hasDotdA,
      dotdB: hasDotdB,
    });
  }

  const sharedCount = sharedIds.length;

  return {
    summary: {
      sharedRaces: sharedCount,
      winsA, winsB, ties,
      pointsA, pointsB,
      avgFinishA: avg(finishesA),
      avgFinishB: avg(finishesB),
      avgGridA: avg(gridsA),
      avgGridB: avg(gridsB),
      podiumsA, podiumsB,
      dnfsA, dnfsB,
      victoriesA, victoriesB,
      top5A, top5B,
      top10A, top10B,
      bestFinishA: minVal(finishesA),
      bestFinishB: minVal(finishesB),
      gridWinsA, gridWinsB,
      fastestLapsA, fastestLapsB,
      polesA, polesB,
      dotdsA, dotdsB,
      pointsPerRaceA: sharedCount > 0 ? pointsA / sharedCount : null,
      pointsPerRaceB: sharedCount > 0 ? pointsB / sharedCount : null,
      worstFinishA: maxVal(finishesA),
      worstFinishB: maxVal(finishesB),
      bestGridA: minVal(gridsA),
      bestGridB: minVal(gridsB),
      frontRowA: gridsA.filter((g) => g !== null && g <= 2).length,
      frontRowB: gridsB.filter((g) => g !== null && g <= 2).length,
      finishedA: sharedCount - dnfsA,
      finishedB: sharedCount - dnfsB,
      winRateA: sharedCount > 0 ? (victoriesA / sharedCount) * 100 : null,
      winRateB: sharedCount > 0 ? (victoriesB / sharedCount) * 100 : null,
      podiumRateA: sharedCount > 0 ? (podiumsA / sharedCount) * 100 : null,
      podiumRateB: sharedCount > 0 ? (podiumsB / sharedCount) * 100 : null,
    },
    races,
  };
}

/* ------------------------------------------------------------------ */
/*  Utilities                                                          */
/* ------------------------------------------------------------------ */

function emptySummary(): H2HSummary {
  return {
    sharedRaces: 0,
    winsA: 0, winsB: 0, ties: 0,
    pointsA: 0, pointsB: 0,
    avgFinishA: null, avgFinishB: null,
    avgGridA: null, avgGridB: null,
    podiumsA: 0, podiumsB: 0,
    dnfsA: 0, dnfsB: 0,
    victoriesA: 0, victoriesB: 0,
    top5A: 0, top5B: 0,
    top10A: 0, top10B: 0,
    bestFinishA: null, bestFinishB: null,
    gridWinsA: 0, gridWinsB: 0,
    fastestLapsA: 0, fastestLapsB: 0,
    polesA: 0, polesB: 0,
    dotdsA: 0, dotdsB: 0,
    pointsPerRaceA: null, pointsPerRaceB: null,
    worstFinishA: null, worstFinishB: null,
    bestGridA: null, bestGridB: null,
    frontRowA: 0, frontRowB: 0,
    finishedA: 0, finishedB: 0,
    winRateA: null, winRateB: null,
    podiumRateA: null, podiumRateB: null,
  };
}

/** Extract season key (e.g. "S6") from event_id like "s6_r01_main". */
function extractSeason(eventId: string): string | null {
  const m = eventId.match(/^s(\d+)/i);
  return m ? `S${m[1]}` : null;
}

/** Human-readable fallback from event_id. */
function formatEventId(eid: string): string {
  return eid
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}
