/* ------------------------------------------------------------------ */
/*  Circuit profile selector                                           */
/*                                                                     */
/*  Produces every section of the redesigned Circuits tab for a single */
/*  selected circuit, from the normalized race dataset. Transparent    */
/*  formulas only (no black-box scores).                               */
/*                                                                     */
/*  Locked product rules (see plan + approved answers):                */
/*   - Scope = ISL only (legacy filtered upstream if ever added).      */
/*   - One venue = one circuit (canonical id via circuitIdentity).     */
/*   - Denominator for driver rates/averages = STARTS (entries − DNS). */
/*   - Average finish excludes DNF/DNS/DSQ; classification shown apart. */
/*   - Grid-to-finish movement EXCLUDES DNF/DNS/DSQ (reported apart).   */
/*   - Official grid (reverse-grid excluded) drives qualifying/grid.    */
/*   - Sprint + main combined (a format filter can split them).        */
/*   - Records are all-time for the circuit (ignore active filters).   */
/*   - Clean race = zero time penalty.                                 */
/*   - No negative individual-driver rankings.                         */
/* ------------------------------------------------------------------ */

import type { RaceEvent, RaceFormat } from "@/lib/scheduleData";
import {
  filterRaces,
  sortChronological,
  type NormalizedRace,
  type ProfileFilters,
  type WeatherKind,
} from "@/lib/stats/normalizeRace";
import { resolveCircuitId } from "@/lib/stats/circuitIdentity";

/** Minimum sample below which a driver rate/average is flagged as thin. */
export const MIN_SAMPLE = 3;
/** Weather coverage below which weather-dependent sections are suppressed. */
export const MIN_WEATHER_COVERAGE = 0.5;

/* ------------------------------------------------------------------ */
/*  Public shapes                                                      */
/* ------------------------------------------------------------------ */

/** A compact reference to one race, for links + record holders. */
export type CircuitRaceRef = {
  eventId: string;
  seasonKey: string;
  raceNumber: number;
  raceName: string;
  raceNameHe?: string;
  date: string;
  dateMs: number;
  weather: WeatherKind;
  format: RaceFormat;
  league: "main" | "wild";
  isPlayoff: boolean;
};

/** Per-event summary at this circuit (one row per completed race). */
export type CircuitEventRow = CircuitRaceRef & {
  starters: number;
  classified: number;
  dnf: number;
  fieldSize: number;
  reverseGrid: boolean;
  safetyCars: number | null;
  winnerName?: string;
  winnerId?: string;
  winnerGrid: number | null;
  poleName?: string;
  poleId?: string;
  podium: { name: string; id: string; finish: number }[];
  fastestLapName?: string;
};

/** A rate-based driver row for the "top performers here" table. */
export type CircuitDriverRow = {
  driverId: string;
  driverName: string;
  starts: number;
  wins: number;
  podiums: number;
  poles: number;
  points: number;
  pointsPerStart: number | null;
  avgFinish: number | null;
  bestFinish: number | null;
  podiumRate: number | null;
  netPositions: number;
  thin: boolean;
};

export type CircuitWeatherSplit = {
  key: WeatherKind;
  races: number;
  starts: number;
  dnfRate: number | null;
  avgWinningGrid: number | null;
  avgFinishSpread: number | null;
  thin: boolean;
};

export type CircuitExtreme = { value: number; race: CircuitRaceRef; holder?: string } | null;

/** A single point for the grid-vs-finish scatter. */
export type GridFinishPoint = {
  eventId: string;
  driverName: string;
  grid: number;
  finish: number | null; // null for DNF/DNS/DSQ (shown distinctly)
  status: "finished" | "dnf" | "dns" | "dsq";
};

export type CircuitProfile = {
  id: string;
  name: string;
  nameHe?: string;
  countryCode?: string;
  grandPrix?: string;
  grandPrixHe?: string;

  // ── Sample / context ─────────────────────────────────────────
  islRaces: number; // completed events in the filtered scope
  totalStarts: number;
  seasonsFeatured: number;
  firstRace: CircuitRaceRef | null;
  mostRecentRace: CircuitEventRow | null;

  // ── Snapshot ─────────────────────────────────────────────────
  snapshot: {
    islRaces: number;
    uniqueWinners: number;
    uniquePoleSitters: number;
    avgFieldSize: number | null;
    classificationRate: number | null;
    dnfRate: number | null;
    poleToWinRate: number | null;
    avgWinningGrid: number | null;
  };

  // ── Qualifying vs race ───────────────────────────────────────
  qualifying: {
    poleToWinRate: number | null;
    poleToWinSample: number; // events with a known pole sitter + winner
    frontRowToWinRate: number | null;
    frontRowToPodiumRate: number | null;
    avgWinningGrid: number | null;
    avgWinningGridSample: number;
    avgPodiumGrid: number | null;
    winnerGridDistribution: { grid: number; count: number }[];
    gridVsFinish: GridFinishPoint[];
  };

  // ── Race characteristics (movement + reliability) ────────────
  characteristics: {
    avgAbsMovement: number | null;
    avgNetMovement: number | null;
    movementSample: number; // starters with grid + classified finish
    pctImproved: number | null;
    racesGained: number;
    racesLost: number;
    classificationRate: number | null;
    dnfRate: number | null;
    bestRecovery: CircuitExtreme;
    worstLoss: CircuitExtreme;
  };

  // ── Conditions & discipline ──────────────────────────────────
  conditions: {
    weatherCoverage: number; // fraction of events with known weather
    weatherSplits: CircuitWeatherSplit[];
    wetRate: number | null;
    safetyCarCoverage: number; // fraction of events with a known SC count
    safetyCarRate: number | null;
    cleanRaceRate: number | null; // % of driver-starts with zero penalty
    penaltiesPerRace: number | null;
  };

  // ── Specialists (rate-based, positive only) ──────────────────
  specialists: CircuitDriverRow[];

  // ── History (per event, newest first) ────────────────────────
  history: CircuitEventRow[];

  // ── Records (all-time for the circuit, ignore filters) ───────
  records: {
    firstWinner: { race: CircuitRaceRef; holder: string } | null;
    mostWins: { value: number; holder: string; driverId: string } | null;
    mostPoles: { value: number; holder: string; driverId: string } | null;
    mostPodiums: { value: number; holder: string; driverId: string } | null;
    bestRecovery: CircuitExtreme;
    biggestGrid: { value: number; race: CircuitRaceRef } | null;
  };
};

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

function stdev(nums: number[]): number | null {
  if (nums.length < 2) return null;
  const m = nums.reduce((s, n) => s + n, 0) / nums.length;
  const variance = nums.reduce((s, n) => s + (n - m) * (n - m), 0) / nums.length;
  return round2(Math.sqrt(variance));
}

function pct(numerator: number, denominator: number): number | null {
  if (denominator <= 0) return null;
  return round2((numerator / denominator) * 100);
}

function toRaceRef(r: NormalizedRace): CircuitRaceRef {
  return {
    eventId: r.eventId,
    seasonKey: r.seasonKey,
    raceNumber: r.raceNumber,
    raceName: r.raceName,
    raceNameHe: r.raceNameHe,
    date: r.date,
    dateMs: r.dateMs,
    weather: r.weather,
    format: r.format,
    league: r.league,
    isPlayoff: r.isPlayoff,
  };
}

/* ------------------------------------------------------------------ */
/*  Per-event aggregation                                              */
/* ------------------------------------------------------------------ */

function buildEventRow(
  rows: NormalizedRace[],
  safetyCars: number | null,
): CircuitEventRow {
  const first = rows[0];
  const starters = rows.filter((r) => r.isStart).length;
  const classifiedRows = rows.filter((r) => r.isClassified);
  const dnf = rows.filter((r) => r.status === "dnf" || r.status === "dsq").length;

  const winner = classifiedRows.find((r) => r.finish === 1);
  const poleRow = rows.find((r) => r.pole);
  const fastest = rows.find((r) => r.fastestLap);
  const podium = classifiedRows
    .filter((r) => r.finish !== null && r.finish <= 3)
    .sort((a, b) => (a.finish ?? 0) - (b.finish ?? 0))
    .map((r) => ({ name: r.driverName, id: r.driverId, finish: r.finish! }));

  return {
    ...toRaceRef(first),
    starters,
    classified: classifiedRows.length,
    dnf,
    fieldSize: rows.length,
    reverseGrid: first.reverseGrid,
    safetyCars,
    winnerName: winner?.driverName,
    winnerId: winner?.driverId,
    winnerGrid: winner ? winner.grid : null,
    poleName: poleRow?.driverName,
    poleId: poleRow?.driverId,
    podium,
    fastestLapName: fastest?.driverName,
  };
}

/* ------------------------------------------------------------------ */
/*  Public: computeCircuitProfile                                      */
/* ------------------------------------------------------------------ */

/**
 * @param allRaces   normalized dataset for ALL drivers/events (full history)
 * @param events     schedule events (for safety-car coverage + identity names)
 * @param circuitId  canonical circuit id (from circuitIdentity.resolveCircuitId)
 * @param filters    scope + advanced filters (applied to everything except records)
 */
export function computeCircuitProfile(
  allRaces: NormalizedRace[],
  events: RaceEvent[],
  circuitId: string,
  filters: ProfileFilters,
): CircuitProfile | null {
  if (!circuitId) return null;

  // Safety-car count per event id (only completed events carry results).
  const scByEvent = new Map<string, number | null>();
  for (const ev of events) {
    scByEvent.set(
      ev.event_id.toLowerCase(),
      ev.safety_cars === undefined || ev.safety_cars === null
        ? null
        : ev.safety_cars,
    );
  }
  // Career (unfiltered) races AT THIS CIRCUIT — for records/milestones.
  const careerAll = sortChronological(
    allRaces.filter((r) => resolveCircuitId(r.track) === circuitId),
  );
  if (careerAll.length === 0) return null;

  // Filter-aware set — everything except records.
  const filtered = sortChronological(
    filterRaces(
      careerAll,
      // The circuit is already narrowed; strip any circuit filter to avoid
      // double-filtering on the raw-track match inside filterRaces.
      { ...filters, circuit: undefined },
    ),
  );

  const latest = careerAll[careerAll.length - 1];

  /* ---------- Group both sets by event ---------- */
  const groupByEvent = (rows: NormalizedRace[]): Map<string, NormalizedRace[]> => {
    const m = new Map<string, NormalizedRace[]>();
    for (const r of rows) {
      const key = r.eventId;
      if (!m.has(key)) m.set(key, []);
      m.get(key)!.push(r);
    }
    return m;
  };

  const filteredEventsMap = groupByEvent(filtered);
  const eventRows: CircuitEventRow[] = [...filteredEventsMap.entries()]
    .map(([eid, rows]) => buildEventRow(rows, scByEvent.get(eid.toLowerCase()) ?? null))
    .sort((a, b) => b.dateMs - a.dateMs || b.seasonKey.localeCompare(a.seasonKey));

  const islRaces = eventRows.length;
  const totalStarts = filtered.filter((r) => r.isStart).length;

  /* ---------- Snapshot aggregates ---------- */
  const eventsWithWinner = eventRows.filter((e) => e.winnerName);
  const uniqueWinners = new Set(eventsWithWinner.map((e) => e.winnerId)).size;
  const uniquePoleSitters = new Set(
    eventRows.filter((e) => e.poleId).map((e) => e.poleId),
  ).size;
  const avgFieldSize = mean(eventRows.map((e) => e.starters));

  const classifiedCount = filtered.filter((r) => r.isClassified).length;
  const dnfCount = filtered.filter((r) => r.status === "dnf" || r.status === "dsq").length;
  const classificationRate = pct(classifiedCount, totalStarts);
  const dnfRate = pct(dnfCount, totalStarts);

  /* ---------- Qualifying vs race ---------- */
  // Pole conversion: among events with BOTH a known pole sitter and a winner.
  const poleConvEvents = eventRows.filter((e) => e.poleId && e.winnerId);
  const poleWins = poleConvEvents.filter((e) => e.poleId === e.winnerId).length;
  const poleToWinRate = pct(poleWins, poleConvEvents.length);

  const winnerGrids = eventsWithWinner
    .filter((e) => e.winnerGrid !== null)
    .map((e) => e.winnerGrid!);
  const avgWinningGrid = mean(winnerGrids);
  const frontRowWins = eventsWithWinner.filter(
    (e) => e.winnerGrid !== null && e.winnerGrid <= 2,
  ).length;
  const frontRowToWinRate = pct(
    frontRowWins,
    eventsWithWinner.filter((e) => e.winnerGrid !== null).length,
  );

  // Podium starting grid (per podium finisher with a known grid).
  const podiumGrids: number[] = [];
  let frontRowPodiums = 0;
  let podiumWithGrid = 0;
  for (const r of filtered) {
    if (r.isClassified && r.finish !== null && r.finish <= 3 && r.grid !== null) {
      podiumGrids.push(r.grid);
      podiumWithGrid++;
      if (r.grid <= 2) frontRowPodiums++;
    }
  }
  const avgPodiumGrid = mean(podiumGrids);
  const frontRowToPodiumRate = pct(frontRowPodiums, podiumWithGrid);

  // Winner grid distribution (histogram).
  const winnerGridDist = new Map<number, number>();
  for (const g of winnerGrids) winnerGridDist.set(g, (winnerGridDist.get(g) ?? 0) + 1);
  const winnerGridDistribution = [...winnerGridDist.entries()]
    .map(([grid, count]) => ({ grid, count }))
    .sort((a, b) => a.grid - b.grid);

  // Grid vs finish scatter (starters with a known grid).
  const gridVsFinish: GridFinishPoint[] = filtered
    .filter((r) => r.isStart && r.grid !== null)
    .map((r) => ({
      eventId: r.eventId,
      driverName: r.driverName,
      grid: r.grid!,
      finish: r.isClassified ? r.finish : null,
      status: r.status,
    }));

  /* ---------- Race characteristics (movement) ---------- */
  // Movement EXCLUDES DNF/DNS/DSQ: classified starters with grid + finish.
  const movementRows = filtered.filter(
    (r) => r.isClassified && r.grid !== null && r.finish !== null,
  );
  const movementDeltas = movementRows.map((r) => r.grid! - r.finish!); // +gain
  const avgAbsMovement = mean(movementDeltas.map((d) => Math.abs(d)));
  const avgNetMovement = mean(movementDeltas);
  const racesGained = movementDeltas.filter((d) => d > 0).length;
  const racesLost = movementDeltas.filter((d) => d < 0).length;
  const pctImproved = pct(racesGained, movementRows.length);

  // Best recovery / worst loss within the filtered scope (from netChange).
  const withNet = filtered.filter((r) => r.isStart && r.netChange !== null);
  let bestRecovery: CircuitExtreme = null;
  let worstLoss: CircuitExtreme = null;
  for (const r of withNet) {
    const v = r.netChange ?? 0;
    if (v > 0 && (bestRecovery === null || v > bestRecovery.value)) {
      bestRecovery = { value: v, race: toRaceRef(r), holder: r.driverName };
    }
    if (v < 0 && (worstLoss === null || v < worstLoss.value)) {
      worstLoss = { value: v, race: toRaceRef(r), holder: r.driverName };
    }
  }

  /* ---------- Conditions & discipline ---------- */
  const knownWeatherEvents = eventRows.filter((e) => e.weather !== "unknown");
  const weatherCoverage = eventRows.length
    ? round2(knownWeatherEvents.length / eventRows.length)
    : 0;
  const wetEvents = eventRows.filter(
    (e) => e.weather === "wet" || e.weather === "mixed",
  ).length;
  const wetRate = knownWeatherEvents.length
    ? pct(wetEvents, knownWeatherEvents.length)
    : null;

  const weatherSplits: CircuitWeatherSplit[] = (["dry", "wet", "mixed"] as const).map(
    (w) => {
      const evs = eventRows.filter((e) => e.weather === w);
      const rows = filtered.filter((r) => r.weather === w);
      const starts = rows.filter((r) => r.isStart).length;
      const dnf = rows.filter((r) => r.status === "dnf" || r.status === "dsq").length;
      const wGrids = evs
        .filter((e) => e.winnerGrid !== null)
        .map((e) => e.winnerGrid!);
      const finishes = rows.filter((r) => r.isClassified).map((r) => r.finish!);
      return {
        key: w,
        races: evs.length,
        starts,
        dnfRate: pct(dnf, starts),
        avgWinningGrid: mean(wGrids),
        avgFinishSpread: stdev(finishes),
        thin: evs.length > 0 && evs.length < MIN_SAMPLE,
      };
    },
  );

  // The schedule mapper coerces a blank safety-car cell to 0, so we cannot
  // tell "no data" from "genuinely zero". We therefore only surface a safety
  // car rate once at least one event has a positive count (i.e. the column is
  // actually being populated); otherwise the section is suppressed.
  const scEvents = eventRows.filter((e) => (e.safetyCars ?? 0) > 0).length;
  const hasScData = scEvents > 0;
  const safetyCarCoverage = hasScData ? 1 : 0;
  const safetyCarRate = hasScData ? pct(scEvents, eventRows.length) : null;

  const cleanStarts = filtered.filter((r) => r.isStart && r.penaltySeconds === 0).length;
  const cleanRaceRate = pct(cleanStarts, totalStarts);
  const totalPenaltyEvents = filtered.filter(
    (r) => r.isStart && r.penaltySeconds > 0,
  ).length;
  const penaltiesPerRace = islRaces > 0 ? round2(totalPenaltyEvents / islRaces) : null;

  /* ---------- Specialists (rate-based, positive only) ---------- */
  const byDriver = new Map<string, NormalizedRace[]>();
  for (const r of filtered) {
    const key = r.driverId || r.driverName;
    if (!key) continue;
    if (!byDriver.has(key)) byDriver.set(key, []);
    byDriver.get(key)!.push(r);
  }
  const specialists: CircuitDriverRow[] = [...byDriver.values()]
    .map((rows) => {
      const starts = rows.filter((r) => r.isStart).length;
      const classifiedRows = rows.filter((r) => r.isClassified);
      const finishes = classifiedRows.map((r) => r.finish!);
      const points = rows.reduce((s, r) => s + r.points, 0);
      const wins = classifiedRows.filter((r) => r.finish === 1).length;
      const podiums = classifiedRows.filter((r) => r.finish! <= 3).length;
      const poles = rows.filter((r) => r.pole).length;
      const last = rows[rows.length - 1];
      return {
        driverId: last.driverId,
        driverName: last.driverName,
        starts,
        wins,
        podiums,
        poles,
        points,
        pointsPerStart: starts > 0 ? round2(points / starts) : null,
        avgFinish: mean(finishes),
        bestFinish: finishes.length ? Math.min(...finishes) : null,
        podiumRate: pct(podiums, starts),
        netPositions: rows.reduce((s, r) => s + (r.netChange ?? 0), 0),
        thin: starts > 0 && starts < MIN_SAMPLE,
      };
    })
    .filter((d) => d.starts > 0)
    // Positive-only ordering (no "worst driver" ranking).
    .sort(
      (a, b) =>
        b.wins - a.wins ||
        b.podiums - a.podiums ||
        (b.podiumRate ?? 0) - (a.podiumRate ?? 0) ||
        (b.pointsPerStart ?? 0) - (a.pointsPerStart ?? 0) ||
        b.starts - a.starts,
    );

  /* ---------- Records (all-time for the circuit) ---------- */
  const careerEventsMap = groupByEvent(careerAll);
  const careerEventRows: CircuitEventRow[] = [...careerEventsMap.entries()]
    .map(([eid, rows]) => buildEventRow(rows, scByEvent.get(eid.toLowerCase()) ?? null))
    .sort((a, b) => a.dateMs - b.dateMs);

  const firstWinnerEvent = careerEventRows.find((e) => e.winnerName) ?? null;

  const tallyBy = (
    predicate: (r: NormalizedRace) => boolean,
  ): { value: number; holder: string; driverId: string } | null => {
    const counts = new Map<string, { count: number; name: string }>();
    for (const r of careerAll) {
      if (!predicate(r)) continue;
      const key = r.driverId || r.driverName;
      const cur = counts.get(key) ?? { count: 0, name: r.driverName };
      cur.count += 1;
      cur.name = r.driverName;
      counts.set(key, cur);
    }
    let best: { value: number; holder: string; driverId: string } | null = null;
    for (const [id, { count, name }] of counts) {
      if (best === null || count > best.value) {
        best = { value: count, holder: name, driverId: id };
      }
    }
    return best;
  };

  const mostWins = tallyBy((r) => r.isClassified && r.finish === 1);
  const mostPoles = tallyBy((r) => r.pole);
  const mostPodiums = tallyBy((r) => r.isClassified && r.finish !== null && r.finish <= 3);

  let recBestRecovery: CircuitExtreme = null;
  for (const r of careerAll) {
    const v = r.netChange ?? 0;
    if (r.isStart && v > 0 && (recBestRecovery === null || v > recBestRecovery.value)) {
      recBestRecovery = { value: v, race: toRaceRef(r), holder: r.driverName };
    }
  }
  let biggestGrid: { value: number; race: CircuitRaceRef } | null = null;
  for (const e of careerEventRows) {
    if (biggestGrid === null || e.starters > biggestGrid.value) {
      biggestGrid = { value: e.starters, race: e };
    }
  }

  const firstRaceRef = careerAll.find((r) => r.isStart) ?? careerAll[0];

  return {
    id: circuitId,
    name: latest.track ?? circuitId,
    nameHe: latest.trackHe,
    countryCode: undefined, // filled from identity in the UI layer
    grandPrix: latest.raceName,
    grandPrixHe: latest.raceNameHe,

    islRaces,
    totalStarts,
    seasonsFeatured: new Set(filtered.map((r) => r.seasonKey)).size,
    firstRace: firstRaceRef ? toRaceRef(firstRaceRef) : null,
    mostRecentRace: eventRows[0] ?? null,

    snapshot: {
      islRaces,
      uniqueWinners,
      uniquePoleSitters,
      avgFieldSize,
      classificationRate,
      dnfRate,
      poleToWinRate,
      avgWinningGrid,
    },

    qualifying: {
      poleToWinRate,
      poleToWinSample: poleConvEvents.length,
      frontRowToWinRate,
      frontRowToPodiumRate,
      avgWinningGrid,
      avgWinningGridSample: winnerGrids.length,
      avgPodiumGrid,
      winnerGridDistribution,
      gridVsFinish,
    },

    characteristics: {
      avgAbsMovement,
      avgNetMovement,
      movementSample: movementRows.length,
      pctImproved,
      racesGained,
      racesLost,
      classificationRate,
      dnfRate,
      bestRecovery,
      worstLoss,
    },

    conditions: {
      weatherCoverage,
      weatherSplits,
      wetRate,
      safetyCarCoverage,
      safetyCarRate,
      cleanRaceRate,
      penaltiesPerRace,
    },

    specialists,

    history: eventRows,

    records: {
      firstWinner: firstWinnerEvent
        ? { race: firstWinnerEvent, holder: firstWinnerEvent.winnerName! }
        : null,
      mostWins,
      mostPoles,
      mostPodiums,
      bestRecovery: recBestRecovery,
      biggestGrid,
    },
  };
}

/* ------------------------------------------------------------------ */
/*  Circuit universe (which circuits have completed ISL history)       */
/* ------------------------------------------------------------------ */

export type CircuitListEntry = {
  id: string;
  races: number;
  latestMs: number;
};

/**
 * The set of circuits that have at least one completed ISL race, most-recent
 * first. Drives the selector and the default selection.
 */
export function listCircuitsWithHistory(
  allRaces: NormalizedRace[],
): CircuitListEntry[] {
  const acc = new Map<string, { events: Set<string>; latestMs: number }>();
  for (const r of allRaces) {
    const id = resolveCircuitId(r.track);
    if (!id) continue;
    const cur = acc.get(id) ?? { events: new Set<string>(), latestMs: Number.NEGATIVE_INFINITY };
    cur.events.add(r.eventId);
    if (Number.isFinite(r.dateMs)) cur.latestMs = Math.max(cur.latestMs, r.dateMs);
    acc.set(id, cur);
  }
  return [...acc.entries()]
    .map(([id, { events, latestMs }]) => ({ id, races: events.size, latestMs }))
    .sort((a, b) => b.latestMs - a.latestMs || b.races - a.races || a.id.localeCompare(b.id));
}
