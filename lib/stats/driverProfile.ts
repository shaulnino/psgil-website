/* ------------------------------------------------------------------ */
/*  Driver profile selector                                            */
/*                                                                     */
/*  Produces every section of the redesigned Drivers tab for a single  */
/*  driver from the normalized race dataset. Transparent formulas only */
/*  (no black-box scores). Pool-relative ratings still come from the   */
/*  existing computeDriverStats engine and are merged in the UI.       */
/*                                                                     */
/*  Locked product rules (see plan):                                   */
/*   - Denominator for rates/averages = STARTS (entries minus DNS).    */
/*   - Average finish excludes DNF/DNS/DSQ; finish rate shown apart.   */
/*   - Recent form = last 5 races, transparent.                        */
/*   - Positions gained/lost = CSV position_change (netChange).        */
/*   - Clean race = zero time penalty.                                 */
/*   - Records/milestones are always career (unfiltered).             */
/* ------------------------------------------------------------------ */

import type { RaceFormat } from "@/lib/scheduleData";
import {
  filterRaces,
  sortChronological,
  type NormalizedRace,
  type ProfileFilters,
  type WeatherKind,
} from "@/lib/stats/normalizeRace";

export const RECENT_FORM_WINDOW = 5;
/** Minimum sample size below which a split/circuit average is flagged as thin. */
export const MIN_SAMPLE = 3;

/** A display-friendly race line used by tables, charts and records. */
export type RaceLine = {
  eventId: string;
  seasonKey: string;
  raceNumber: number;
  raceName: string;
  raceNameHe?: string;
  track?: string;
  trackHe?: string;
  date: string;
  dateMs: number;
  team: string;
  league: "main" | "wild";
  format: RaceFormat;
  weather: WeatherKind;
  isPlayoff: boolean;
  reverseGrid: boolean;
  grid: number | null;
  gridRaw: number | null;
  finish: number | null;
  netChange: number | null;
  points: number;
  status: "finished" | "dnf" | "dns" | "dsq";
  fastestLap: boolean;
  dotd: boolean;
  pole: boolean;
  penaltySeconds: number;
};

export type SplitRow = {
  /** Stable key for i18n + react key (e.g. "dry", "50%", "main"). */
  key: string;
  starts: number;
  avgFinish: number | null;
  pointsPerStart: number | null;
  podiumRate: number | null;
  dnfRate: number | null;
  netPositions: number;
  thin: boolean; // sample below MIN_SAMPLE
};

export type CircuitRow = {
  track: string;
  starts: number;
  avgFinish: number | null;
  pointsPerStart: number | null;
  bestFinish: number | null;
  wins: number;
  podiums: number;
  netPositions: number;
  thin: boolean;
};

export type Extreme = { value: number; race: RaceLine } | null;

export type DriverProfile = {
  driverName: string;
  driverId: string;
  team: string | null;
  seasonsCompeted: number;

  // ── B. Snapshot ──────────────────────────────────────────────
  entries: number;
  starts: number;
  classified: number;
  wins: number;
  podiums: number;
  points: number;
  pointsPerStart: number | null;
  avgFinish: number | null;
  finishRate: number | null;

  // ── C. Recent form (last N, chronological) ───────────────────
  recentForm: {
    window: number;
    races: RaceLine[]; // oldest -> newest within the window
    avgFinish: number | null;
    points: number;
    netPositions: number;
    prevAvgFinish: number | null;
    prevPoints: number | null;
    deltaAvgFinish: number | null; // improvement = negative (finished higher)
    deltaPoints: number | null;
  };

  // ── D. Results & achievements ────────────────────────────────
  results: {
    wins: number;
    podiums: number;
    top5: number;
    top10: number;
    pointsFinishes: number;
    poles: number;
    fastestLaps: number;
    dotd: number;
    winRate: number | null;
    podiumRate: number | null;
    top5Rate: number | null;
    top10Rate: number | null;
    pointsRate: number | null;
    poleRate: number | null;
    bestFinish: number | null;
    bestGrid: number | null;
  };

  // ── E. Grid & racecraft ──────────────────────────────────────
  racecraft: {
    avgGrid: number | null;
    gridSample: number;
    avgFinish: number | null;
    finishSample: number;
    medianFinish: number | null;
    netPositions: number;
    avgNetPerRace: number | null;
    racesGained: number;
    racesLost: number;
    bestRecovery: Extreme;
    worstLoss: Extreme;
  };

  // ── F. Consistency & reliability ─────────────────────────────
  consistency: {
    finishRate: number | null;
    dnf: number;
    dns: number;
    dsq: number;
    dnfRate: number | null;
    stdevFinish: number | null;
    distribution: { bucket: string; count: number }[];
    streaks: {
      finishCurrent: number;
      finishBest: number;
      pointsCurrent: number;
      pointsBest: number;
      podiumCurrent: number;
      podiumBest: number;
      winBest: number;
    };
  };

  // ── G. Discipline ────────────────────────────────────────────
  discipline: {
    penaltySeconds: number;
    /** Split of total penalty time by source (steward decisions vs in-game). */
    stewardSeconds: number;
    gameSeconds: number;
    penaltiesPerStart: number | null;
    cleanRaces: number;
    cleanRacePct: number | null;
    racesWithPenalty: number;
    penaltyRate: number | null;
  };

  // ── H. Splits ────────────────────────────────────────────────
  splits: {
    weather: SplitRow[];
    format: SplitRow[];
    league: SplitRow[];
    roundType: SplitRow[];
  };

  // ── I. Circuit performance ───────────────────────────────────
  circuits: CircuitRow[];

  // ── J. Race history (filter-aware, newest first) ─────────────
  history: RaceLine[];

  // ── K. Records & milestones (career, unfiltered) ─────────────
  records: {
    firstRace: RaceLine | null;
    firstPoints: RaceLine | null;
    firstPodium: RaceLine | null;
    firstWin: RaceLine | null;
    bestFinish: Extreme;
    bestGrid: Extreme;
    mostPointsRace: Extreme;
    bestRecovery: Extreme;
    longestFinishStreak: number;
    longestPointsStreak: number;
  };
};

/* ------------------------------------------------------------------ */
/*  Math helpers                                                        */
/* ------------------------------------------------------------------ */

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function mean(nums: number[]): number | null {
  if (nums.length === 0) return null;
  return round2(nums.reduce((s, n) => s + n, 0) / nums.length);
}

function median(nums: number[]): number | null {
  if (nums.length === 0) return null;
  const sorted = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? round2((sorted[mid - 1] + sorted[mid]) / 2)
    : round2(sorted[mid]);
}

function stdev(nums: number[]): number | null {
  if (nums.length < 2) return null;
  const m = nums.reduce((s, n) => s + n, 0) / nums.length;
  const variance =
    nums.reduce((s, n) => s + (n - m) * (n - m), 0) / nums.length;
  return round2(Math.sqrt(variance));
}

function pct(numerator: number, denominator: number): number | null {
  if (denominator <= 0) return null;
  return round2((numerator / denominator) * 100);
}

function toRaceLine(r: NormalizedRace): RaceLine {
  return {
    eventId: r.eventId,
    seasonKey: r.seasonKey,
    raceNumber: r.raceNumber,
    raceName: r.raceName,
    raceNameHe: r.raceNameHe,
    track: r.track,
    trackHe: r.trackHe,
    date: r.date,
    dateMs: r.dateMs,
    team: r.team,
    league: r.league,
    format: r.format,
    weather: r.weather,
    isPlayoff: r.isPlayoff,
    reverseGrid: r.reverseGrid,
    grid: r.grid,
    gridRaw: r.gridRaw,
    finish: r.finish,
    netChange: r.netChange,
    points: r.points,
    status: r.status,
    fastestLap: r.fastestLap,
    dotd: r.dotd,
    pole: r.pole,
    penaltySeconds: r.penaltySeconds,
  };
}

/* ------------------------------------------------------------------ */
/*  Split aggregation                                                   */
/* ------------------------------------------------------------------ */

function aggregateSplit(key: string, races: NormalizedRace[]): SplitRow {
  const starts = races.filter((r) => r.isStart).length;
  const finishes = races.filter((r) => r.isClassified).map((r) => r.finish!);
  const podiums = races.filter(
    (r) => r.isClassified && r.finish !== null && r.finish <= 3,
  ).length;
  const dnf = races.filter((r) => r.status === "dnf" || r.status === "dsq").length;
  const netPositions = races.reduce((s, r) => s + (r.netChange ?? 0), 0);
  const points = races.reduce((s, r) => s + r.points, 0);
  return {
    key,
    starts,
    avgFinish: mean(finishes),
    pointsPerStart: starts > 0 ? round2(points / starts) : null,
    podiumRate: pct(podiums, starts),
    dnfRate: pct(dnf, starts),
    netPositions,
    thin: starts > 0 && starts < MIN_SAMPLE,
  };
}

/* ------------------------------------------------------------------ */
/*  Streaks (chronological; DNS is neutral)                            */
/* ------------------------------------------------------------------ */

function computeStreaks(chrono: NormalizedRace[]) {
  let finishBest = 0,
    finishCur = 0,
    pointsBest = 0,
    pointsCur = 0,
    podiumBest = 0,
    podiumCur = 0,
    winBest = 0,
    winCur = 0;

  // current (trailing) streaks computed from the end
  let finishCurrent = 0,
    pointsCurrent = 0,
    podiumCurrent = 0;

  for (const r of chrono) {
    if (r.status === "dns") continue; // neutral
    const isFinish = r.status === "finished";
    const isPoints = r.points > 0;
    const isPodium = r.finish !== null && r.finish <= 3;
    const isWin = r.finish === 1;

    finishCur = isFinish ? finishCur + 1 : 0;
    pointsCur = isPoints ? pointsCur + 1 : 0;
    podiumCur = isPodium ? podiumCur + 1 : 0;
    winCur = isWin ? winCur + 1 : 0;

    if (finishCur > finishBest) finishBest = finishCur;
    if (pointsCur > pointsBest) pointsBest = pointsCur;
    if (podiumCur > podiumBest) podiumBest = podiumCur;
    if (winCur > winBest) winBest = winCur;
  }

  // trailing streaks
  for (let i = chrono.length - 1; i >= 0; i--) {
    const r = chrono[i];
    if (r.status === "dns") continue;
    if (r.status === "finished") finishCurrent++;
    else break;
  }
  for (let i = chrono.length - 1; i >= 0; i--) {
    const r = chrono[i];
    if (r.status === "dns") continue;
    if (r.points > 0) pointsCurrent++;
    else break;
  }
  for (let i = chrono.length - 1; i >= 0; i--) {
    const r = chrono[i];
    if (r.status === "dns") continue;
    if (r.finish !== null && r.finish <= 3) podiumCurrent++;
    else break;
  }

  return {
    finishCurrent,
    finishBest,
    pointsCurrent,
    pointsBest,
    podiumCurrent,
    podiumBest,
    winBest,
  };
}

/* ------------------------------------------------------------------ */
/*  Public: computeDriverProfile                                        */
/* ------------------------------------------------------------------ */

/**
 * @param allRaces  normalized dataset for ALL drivers (full history)
 * @param driverName selected driver
 * @param filters   scope + advanced filters (applied to stats/charts only)
 */
export function computeDriverProfile(
  allRaces: NormalizedRace[],
  driverName: string,
  filters: ProfileFilters,
): DriverProfile | null {
  const target = driverName.trim().toLowerCase();

  // Career (unfiltered) races for this driver — for records/milestones.
  const careerAll = sortChronological(
    allRaces.filter((r) => r.driverName.trim().toLowerCase() === target),
  );
  if (careerAll.length === 0) return null;

  // Filter-aware set for this driver — for every other section.
  const filtered = sortChronological(
    filterRaces(careerAll, filters),
  );

  const driverId = careerAll[careerAll.length - 1].driverId;
  const team = careerAll[careerAll.length - 1].team || null;

  // ── Denominators ──────────────────────────────────────────────
  const entries = filtered.length;
  const starts = filtered.filter((r) => r.isStart).length;
  const classifiedRaces = filtered.filter((r) => r.isClassified);
  const classified = classifiedRaces.length;
  const finishPositions = classifiedRaces.map((r) => r.finish!);
  const points = filtered.reduce((s, r) => s + r.points, 0);

  const wins = classifiedRaces.filter((r) => r.finish === 1).length;
  const podiums = classifiedRaces.filter((r) => r.finish! <= 3).length;
  const top5 = classifiedRaces.filter((r) => r.finish! <= 5).length;
  const top10 = classifiedRaces.filter((r) => r.finish! <= 10).length;
  const pointsFinishes = filtered.filter((r) => r.points > 0).length;
  const poles = filtered.filter((r) => r.pole).length;
  const fastestLaps = filtered.filter((r) => r.fastestLap).length;
  const dotd = filtered.filter((r) => r.dotd).length;

  const gridPositions = filtered
    .filter((r) => r.grid !== null)
    .map((r) => r.grid!);

  const avgFinish = mean(finishPositions);
  const finishRate = pct(classified, starts);

  // ── Recent form (last N chronological) ────────────────────────
  const recentAll = filtered.filter((r) => r.isStart);
  const windowRaces = recentAll.slice(-RECENT_FORM_WINDOW);
  const prevWindow = recentAll.slice(
    -RECENT_FORM_WINDOW * 2,
    -RECENT_FORM_WINDOW,
  );
  const windowFinishes = windowRaces
    .filter((r) => r.isClassified)
    .map((r) => r.finish!);
  const prevFinishes = prevWindow
    .filter((r) => r.isClassified)
    .map((r) => r.finish!);
  const windowAvg = mean(windowFinishes);
  const prevAvg = mean(prevFinishes);
  const windowPoints = windowRaces.reduce((s, r) => s + r.points, 0);
  const prevPoints = prevWindow.length
    ? prevWindow.reduce((s, r) => s + r.points, 0)
    : null;

  // ── Racecraft (net positions from CSV position_change) ────────
  const withNet = filtered.filter((r) => r.netChange !== null);
  const netPositions = withNet.reduce((s, r) => s + (r.netChange ?? 0), 0);
  const racesGained = withNet.filter((r) => (r.netChange ?? 0) > 0).length;
  const racesLost = withNet.filter((r) => (r.netChange ?? 0) < 0).length;

  let bestRecovery: Extreme = null;
  let worstLoss: Extreme = null;
  for (const r of withNet) {
    const v = r.netChange ?? 0;
    if (v > 0 && (bestRecovery === null || v > bestRecovery.value)) {
      bestRecovery = { value: v, race: toRaceLine(r) };
    }
    if (v < 0 && (worstLoss === null || v < worstLoss.value)) {
      worstLoss = { value: v, race: toRaceLine(r) };
    }
  }

  // ── Consistency ───────────────────────────────────────────────
  const dnf = filtered.filter((r) => r.status === "dnf").length;
  const dns = filtered.filter((r) => r.status === "dns").length;
  const dsq = filtered.filter((r) => r.status === "dsq").length;

  const distributionBuckets: { bucket: string; count: number }[] = [
    { bucket: "win", count: wins },
    { bucket: "podium", count: podiums - wins },
    { bucket: "top5", count: top5 - podiums },
    { bucket: "top10", count: top10 - top5 },
    { bucket: "outsidePoints", count: classified - top10 },
    { bucket: "dnf", count: dnf + dsq },
  ];

  const streaks = computeStreaks(filtered);

  // ── Discipline ────────────────────────────────────────────────
  const penaltySeconds = filtered.reduce((s, r) => s + r.penaltySeconds, 0);
  const stewardSeconds = filtered.reduce((s, r) => s + r.stewardPenalty, 0);
  const gameSeconds = filtered.reduce((s, r) => s + r.gamePenalty, 0);
  const racesWithPenalty = filtered.filter(
    (r) => r.isStart && r.penaltySeconds > 0,
  ).length;
  const cleanRaces = filtered.filter(
    (r) => r.isStart && r.penaltySeconds === 0,
  ).length;

  // ── Splits ────────────────────────────────────────────────────
  const byWeather = (["dry", "wet", "mixed"] as const).map((w) =>
    aggregateSplit(
      w,
      filtered.filter((r) => r.weather === w),
    ),
  );
  const byFormat = (["50%", "25%", "sprint"] as const).map((fmt) =>
    aggregateSplit(
      fmt,
      filtered.filter((r) => r.format === fmt),
    ),
  );
  const byLeague = (["main", "wild"] as const).map((lg) =>
    aggregateSplit(
      lg,
      filtered.filter((r) => r.league === lg),
    ),
  );
  const byRound = (
    [
      ["regular", filtered.filter((r) => !r.isPlayoff)],
      ["playoff", filtered.filter((r) => r.isPlayoff)],
    ] as const
  ).map(([k, list]) => aggregateSplit(k, list as NormalizedRace[]));

  // ── Circuits ──────────────────────────────────────────────────
  const circuitMap = new Map<string, NormalizedRace[]>();
  for (const r of filtered) {
    const track = (r.track ?? "").trim();
    if (!track) continue;
    if (!circuitMap.has(track)) circuitMap.set(track, []);
    circuitMap.get(track)!.push(r);
  }
  const circuits: CircuitRow[] = [...circuitMap.entries()]
    .map(([track, list]) => {
      const s = list.filter((r) => r.isStart).length;
      const fins = list.filter((r) => r.isClassified).map((r) => r.finish!);
      const pts = list.reduce((sum, r) => sum + r.points, 0);
      return {
        track,
        starts: s,
        avgFinish: mean(fins),
        pointsPerStart: s > 0 ? round2(pts / s) : null,
        bestFinish: fins.length ? Math.min(...fins) : null,
        wins: list.filter((r) => r.isClassified && r.finish === 1).length,
        podiums: list.filter((r) => r.isClassified && r.finish! <= 3).length,
        netPositions: list.reduce((sum, r) => sum + (r.netChange ?? 0), 0),
        thin: s > 0 && s < MIN_SAMPLE,
      };
    })
    .sort((a, b) => b.starts - a.starts);

  // ── Records (career, unfiltered) ──────────────────────────────
  const firstRace = careerAll.find((r) => r.isStart) ?? null;
  const firstPoints = careerAll.find((r) => r.points > 0) ?? null;
  const firstPodium =
    careerAll.find((r) => r.isClassified && r.finish! <= 3) ?? null;
  const firstWin = careerAll.find((r) => r.finish === 1) ?? null;

  let recBestFinish: Extreme = null;
  let recBestGrid: Extreme = null;
  let recMostPoints: Extreme = null;
  let recBestRecovery: Extreme = null;
  for (const r of careerAll) {
    if (r.finish !== null && (recBestFinish === null || r.finish < recBestFinish.value)) {
      recBestFinish = { value: r.finish, race: toRaceLine(r) };
    }
    if (r.grid !== null && (recBestGrid === null || r.grid < recBestGrid.value)) {
      recBestGrid = { value: r.grid, race: toRaceLine(r) };
    }
    if (recMostPoints === null || r.points > recMostPoints.value) {
      recMostPoints = { value: r.points, race: toRaceLine(r) };
    }
    const nc = r.netChange ?? 0;
    if (nc > 0 && (recBestRecovery === null || nc > recBestRecovery.value)) {
      recBestRecovery = { value: nc, race: toRaceLine(r) };
    }
  }
  const careerStreaks = computeStreaks(careerAll);

  return {
    driverName: careerAll[0].driverName,
    driverId,
    team,
    seasonsCompeted: new Set(filtered.map((r) => r.seasonKey)).size,

    entries,
    starts,
    classified,
    wins,
    podiums,
    points,
    pointsPerStart: starts > 0 ? round2(points / starts) : null,
    avgFinish,
    finishRate,

    recentForm: {
      window: RECENT_FORM_WINDOW,
      races: windowRaces.map(toRaceLine),
      avgFinish: windowAvg,
      points: windowPoints,
      netPositions: windowRaces.reduce((s, r) => s + (r.netChange ?? 0), 0),
      prevAvgFinish: prevAvg,
      prevPoints,
      deltaAvgFinish:
        windowAvg !== null && prevAvg !== null
          ? round2(windowAvg - prevAvg)
          : null,
      deltaPoints:
        prevPoints !== null ? round2(windowPoints - prevPoints) : null,
    },

    results: {
      wins,
      podiums,
      top5,
      top10,
      pointsFinishes,
      poles,
      fastestLaps,
      dotd,
      winRate: pct(wins, starts),
      podiumRate: pct(podiums, starts),
      top5Rate: pct(top5, starts),
      top10Rate: pct(top10, starts),
      pointsRate: pct(pointsFinishes, starts),
      poleRate: gridPositions.length ? pct(poles, gridPositions.length) : null,
      bestFinish: finishPositions.length ? Math.min(...finishPositions) : null,
      bestGrid: gridPositions.length ? Math.min(...gridPositions) : null,
    },

    racecraft: {
      avgGrid: mean(gridPositions),
      gridSample: gridPositions.length,
      avgFinish,
      finishSample: finishPositions.length,
      medianFinish: median(finishPositions),
      netPositions,
      avgNetPerRace: withNet.length ? round2(netPositions / withNet.length) : null,
      racesGained,
      racesLost,
      bestRecovery,
      worstLoss,
    },

    consistency: {
      finishRate,
      dnf,
      dns,
      dsq,
      dnfRate: pct(dnf, starts),
      stdevFinish: stdev(finishPositions),
      distribution: distributionBuckets,
      streaks,
    },

    discipline: {
      penaltySeconds: round2(penaltySeconds),
      stewardSeconds: round2(stewardSeconds),
      gameSeconds: round2(gameSeconds),
      penaltiesPerStart: starts > 0 ? round2(penaltySeconds / starts) : null,
      cleanRaces,
      cleanRacePct: pct(cleanRaces, starts),
      racesWithPenalty,
      penaltyRate: pct(racesWithPenalty, starts),
    },

    splits: {
      weather: byWeather,
      format: byFormat,
      league: byLeague,
      roundType: byRound,
    },

    circuits,

    history: [...filtered].reverse().map(toRaceLine),

    records: {
      firstRace: firstRace ? toRaceLine(firstRace) : null,
      firstPoints: firstPoints ? toRaceLine(firstPoints) : null,
      firstPodium: firstPodium ? toRaceLine(firstPodium) : null,
      firstWin: firstWin ? toRaceLine(firstWin) : null,
      bestFinish: recBestFinish,
      bestGrid: recBestGrid,
      mostPointsRace: recMostPoints,
      bestRecovery: recBestRecovery,
      longestFinishStreak: careerStreaks.finishBest,
      longestPointsStreak: careerStreaks.pointsBest,
    },
  };
}
