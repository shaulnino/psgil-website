/* ------------------------------------------------------------------ */
/*  League profile selector                                            */
/*                                                                     */
/*  Aggregates the normalized per-race dataset into league-wide story  */
/*  sections for the redesigned League tab. Transparent formulas only. */
/*                                                                     */
/*  Locked product rules (approved):                                   */
/*   - Single continuous ISL history (S1..Sn); era note left to UI.    */
/*   - "Starter" excludes DNS; rates use starts unless noted.          */
/*   - Clean race = zero time penalties (steward + game = 0) on every  */
/*     row of the event.                                               */
/*   - Sprint + main combined (filterable); playoffs included          */
/*     (filterable).                                                   */
/*   - Championship lead changes are POINTS-BASED (sum of race points  */
/*     per round); dropped-score / playoff rules are not in the data.  */
/*   - Records & milestones are all-time (unfiltered).                 */
/* ------------------------------------------------------------------ */

import type { RaceEvent } from "@/lib/scheduleData";
import type { SeasonConfig } from "@/lib/seasonConfig";
import {
  filterRaces,
  type NormalizedRace,
  type ProfileFilters,
  type WeatherKind,
} from "@/lib/stats/normalizeRace";

/** Minimum races below which a filtered average/rate is flagged as thin. */
export const LEAGUE_MIN_SAMPLE = 3;

/** Lightweight reference to a race, for records + tooltips + links. */
export type RaceRef = {
  eventId: string;
  seasonKey: string;
  raceNumber: number;
  raceName: string;
  raceNameHe?: string;
  track?: string;
  trackHe?: string;
  date: string;
};

/** One event rolled up from its per-driver rows. */
export type EventAgg = {
  ref: RaceRef;
  seasonKey: string;
  seasonNum: number;
  dateMs: number;
  league: "main" | "wild";
  format: string;
  isPlayoff: boolean;
  reverseGrid: boolean;
  weather: WeatherKind;

  entries: number;
  starters: number;
  classified: number;
  dnf: number;
  dns: number;
  dsq: number;

  winnerId: string | null;
  winnerName: string | null;
  winnerGrid: number | null; // actual start (gridRaw) of the winner
  poleId: string | null; // grid 1 on a non-reverse-grid event
  podiumIds: string[];

  penalizedRows: number;
  penaltySeconds: number;
  hasPenalty: boolean;
};

export type SeasonSplit = {
  seasonKey: string;
  races: number;
  avgStarters: number | null;
  differentWinners: number;
  dnfRate: number | null;
  cleanRaceRate: number | null;
  avgWinningGrid: number | null;
  thin: boolean;
};

export type WeatherSplit = {
  key: WeatherKind;
  races: number;
  dnfRate: number | null;
  differentWinners: number;
  avgAbsPositionChange: number | null;
  thin: boolean;
};

export type RecordItem = { value: number; ref: RaceRef } | null;

export type LeagueProfile = {
  // ── Context ──────────────────────────────────────────────────
  races: number;
  entries: number;
  starts: number;
  classified: number;

  // ── Pulse ────────────────────────────────────────────────────
  seasons: number;
  uniqueDrivers: number;
  uniqueTeams: number;
  totalPoints: number;
  differentWinners: number;
  avgStarters: number | null;

  // ── Competitive balance ──────────────────────────────────────
  competitive: {
    differentWinners: number;
    differentPodium: number;
    differentPoles: number;
    topDriverWinShare: number | null; // % of races won by the most successful driver
    topWinnerName: string | null;
    topWinnerWins: number;
    leadChanges: number; // points-based, summed across seasons in scope
  };

  // ── How races unfold ─────────────────────────────────────────
  movement: {
    avgWinningGrid: number | null;
    winningGridSample: number;
    poleToWinRate: number | null;
    poleSample: number; // races with a valid (non-reverse) pole
    winsFromOutsideTop3: number;
    avgAbsPositionChange: number | null;
    changeSample: number;
  };

  // ── Grid health & participation ──────────────────────────────
  gridHealth: {
    avgStarters: number | null;
    maxGrid: RecordItem;
    minGrid: RecordItem;
    completionRate: number | null; // classified / starts
    avgClassified: number | null;
  };

  // ── Reliability & discipline ─────────────────────────────────
  reliability: {
    classificationRate: number | null;
    dnfRate: number | null;
    dnsRate: number | null;
    dsqRate: number | null;
    avgClassified: number | null;
  };
  discipline: {
    penaltyRate: number | null; // % of races with >= 1 penalty
    cleanRaceRate: number | null;
    penaltySecondsPerRace: number | null;
    racesWithPenalty: number;
  };

  // ── Splits ───────────────────────────────────────────────────
  splits: {
    bySeason: SeasonSplit[];
    byWeather: WeatherSplit[];
  };

  // ── Trends (per-event, chronological) ────────────────────────
  events: EventAgg[];

  // ── Records & milestones (all-time, unfiltered) ──────────────
  records: {
    firstRace: RaceRef | null;
    firstWinner: { name: string; ref: RaceRef } | null;
    mostStarters: RecordItem;
    mostFinishers: RecordItem;
    mostDifferentWinnersSeason: { value: number; seasonKey: string } | null;
    mostPenalizedRace: RecordItem;
  };

  // ── Availability (for filter visibility) ─────────────────────
  availability: {
    hasWild: boolean;
    formats: string[];
    weathers: WeatherKind[];
    hasRegular: boolean;
    hasPlayoffs: boolean;
    weatherCoverage: number; // fraction of races with known weather
  };

  // ── Facts (operational, demoted) ─────────────────────────────
  facts: {
    safetyCars: number;
    reverseGridEvents: number;
    broadcastedEvents: number;
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

function pct(numerator: number, denominator: number): number | null {
  if (denominator <= 0) return null;
  return round2((numerator / denominator) * 100);
}

/* ------------------------------------------------------------------ */
/*  Event roll-up                                                       */
/* ------------------------------------------------------------------ */

function toRef(r: NormalizedRace): RaceRef {
  return {
    eventId: r.eventId,
    seasonKey: r.seasonKey,
    raceNumber: r.raceNumber,
    raceName: r.raceName,
    raceNameHe: r.raceNameHe,
    track: r.track,
    trackHe: r.trackHe,
    date: r.date,
  };
}

/** Group per-driver rows into per-event aggregates (chronological). */
export function aggregateEvents(races: NormalizedRace[]): EventAgg[] {
  const byEvent = new Map<string, NormalizedRace[]>();
  for (const r of races) {
    if (!byEvent.has(r.eventId)) byEvent.set(r.eventId, []);
    byEvent.get(r.eventId)!.push(r);
  }

  const aggs: EventAgg[] = [];
  for (const rows of byEvent.values()) {
    const first = rows[0];
    const starters = rows.filter((r) => r.isStart).length;
    const classified = rows.filter((r) => r.isClassified).length;
    const dnf = rows.filter((r) => r.status === "dnf").length;
    const dns = rows.filter((r) => r.status === "dns").length;
    const dsq = rows.filter((r) => r.status === "dsq").length;

    const winner = rows.find((r) => r.finish === 1) ?? null;
    const poleRow = rows.find((r) => r.pole) ?? null;
    const podiumIds = rows
      .filter((r) => r.isClassified && r.finish !== null && r.finish <= 3)
      .map((r) => r.driverId);

    const penalizedRows = rows.filter((r) => r.penaltySeconds > 0).length;
    const penaltySeconds = rows.reduce((s, r) => s + r.penaltySeconds, 0);

    aggs.push({
      ref: toRef(first),
      seasonKey: first.seasonKey,
      seasonNum: first.seasonNum,
      dateMs: first.dateMs,
      league: first.league,
      format: first.format,
      isPlayoff: first.isPlayoff,
      reverseGrid: first.reverseGrid,
      weather: first.weather,

      entries: rows.length,
      starters,
      classified,
      dnf,
      dns,
      dsq,

      winnerId: winner ? winner.driverId : null,
      winnerName: winner ? winner.driverName : null,
      winnerGrid: winner ? winner.gridRaw : null,
      poleId: poleRow ? poleRow.driverId : null,
      podiumIds,

      penalizedRows,
      penaltySeconds: round2(penaltySeconds),
      hasPenalty: penalizedRows > 0,
    });
  }

  aggs.sort((a, b) => {
    if (Number.isFinite(a.dateMs) && Number.isFinite(b.dateMs) && a.dateMs !== b.dateMs) {
      return a.dateMs - b.dateMs;
    }
    if (a.seasonNum !== b.seasonNum) return a.seasonNum - b.seasonNum;
    return a.ref.raceNumber - b.ref.raceNumber;
  });
  return aggs;
}

/* ------------------------------------------------------------------ */
/*  Championship lead changes (points-based)                           */
/* ------------------------------------------------------------------ */

/**
 * Count how many times the points leader changed across a single season,
 * summing race points per round in chronological order. This is a
 * transparent points-based signal — it does not model dropped-score or
 * playoff rules (not present in the data).
 */
function leadChangesForSeason(seasonRaces: NormalizedRace[]): number {
  const events = aggregateEvents(seasonRaces).sort((a, b) => a.dateMs - b.dateMs);
  const eventIds = events.map((e) => e.ref.eventId);
  const pointsByEvent = new Map<string, NormalizedRace[]>();
  for (const r of seasonRaces) {
    if (!pointsByEvent.has(r.eventId)) pointsByEvent.set(r.eventId, []);
    pointsByEvent.get(r.eventId)!.push(r);
  }

  const cumulative = new Map<string, number>();
  let prevLeader: string | null = null;
  let changes = 0;
  for (const eid of eventIds) {
    for (const r of pointsByEvent.get(eid) ?? []) {
      cumulative.set(r.driverId, (cumulative.get(r.driverId) ?? 0) + r.points);
    }
    let leader: string | null = null;
    let best = -Infinity;
    for (const [id, pts] of cumulative) {
      if (pts > best) {
        best = pts;
        leader = id;
      }
    }
    if (leader && prevLeader && leader !== prevLeader) changes++;
    if (leader) prevLeader = leader;
  }
  return changes;
}

/* ------------------------------------------------------------------ */
/*  Public: computeLeagueProfile                                        */
/* ------------------------------------------------------------------ */

const WEATHER_ORDER: WeatherKind[] = ["dry", "wet", "mixed"];

export function computeLeagueProfile(
  allRaces: NormalizedRace[],
  events: RaceEvent[],
  _seasons: SeasonConfig[],
  filters: ProfileFilters,
): LeagueProfile {
  // Only completed events participate (scheduled/future have no results,
  // but guard explicitly so a partially-entered future race is excluded).
  const completedIds = new Set(
    events
      .filter((e) => (e.status ?? "").trim().toLowerCase() === "completed")
      .map((e) => e.event_id.toLowerCase()),
  );
  const eventById = new Map(events.map((e) => [e.event_id.toLowerCase(), e]));
  const completed = allRaces.filter((r) => completedIds.has(r.eventId.toLowerCase()));

  const filtered = filterRaces(completed, filters);
  const evAggs = aggregateEvents(filtered);

  // ── Denominators ──────────────────────────────────────────────
  const races = evAggs.length;
  const entries = filtered.length;
  const starts = filtered.filter((r) => r.isStart).length;
  const classifiedRows = filtered.filter((r) => r.isClassified);
  const classified = classifiedRows.length;

  // ── Pulse ─────────────────────────────────────────────────────
  const seasonSet = new Set(evAggs.map((e) => e.seasonKey));
  const uniqueDrivers = new Set(
    filtered.filter((r) => r.isStart).map((r) => r.driverId),
  ).size;
  const uniqueTeams = new Set(
    filtered.map((r) => r.team).filter(Boolean),
  ).size;
  const totalPoints = round2(filtered.reduce((s, r) => s + r.points, 0));

  // ── Winners / podium / poles ──────────────────────────────────
  const winsByDriver = new Map<string, number>();
  const winnerNames = new Map<string, string>();
  for (const e of evAggs) {
    if (e.winnerId) {
      winsByDriver.set(e.winnerId, (winsByDriver.get(e.winnerId) ?? 0) + 1);
      if (e.winnerName) winnerNames.set(e.winnerId, e.winnerName);
    }
  }
  const differentWinners = winsByDriver.size;
  let topWinnerId: string | null = null;
  let topWinnerWins = 0;
  for (const [id, w] of winsByDriver) {
    if (w > topWinnerWins) {
      topWinnerWins = w;
      topWinnerId = id;
    }
  }
  const differentPodium = new Set(evAggs.flatMap((e) => e.podiumIds)).size;
  const differentPoles = new Set(
    evAggs.map((e) => e.poleId).filter((x): x is string => !!x),
  ).size;

  // ── Lead changes (sum across seasons in scope) ────────────────
  const bySeasonRaces = new Map<string, NormalizedRace[]>();
  for (const r of filtered) {
    if (!bySeasonRaces.has(r.seasonKey)) bySeasonRaces.set(r.seasonKey, []);
    bySeasonRaces.get(r.seasonKey)!.push(r);
  }
  let leadChanges = 0;
  for (const list of bySeasonRaces.values()) {
    leadChanges += leadChangesForSeason(list);
  }

  // ── Movement ──────────────────────────────────────────────────
  const winningGrids = evAggs
    .map((e) => e.winnerGrid)
    .filter((g): g is number => g !== null);
  const poleEvents = evAggs.filter((e) => !e.reverseGrid && e.poleId);
  const poleToWin = poleEvents.filter((e) => e.poleId === e.winnerId).length;
  const winsOutsideTop3 = evAggs.filter(
    (e) => e.winnerGrid !== null && e.winnerGrid > 3,
  ).length;
  const changeVals = filtered
    .filter((r) => r.netChange !== null)
    .map((r) => Math.abs(r.netChange!));

  // ── Grid health ───────────────────────────────────────────────
  const starterCounts = evAggs.map((e) => e.starters);
  const avgStarters = mean(starterCounts);
  let maxGrid: RecordItem = null;
  let minGrid: RecordItem = null;
  for (const e of evAggs) {
    if (maxGrid === null || e.starters > maxGrid.value) maxGrid = { value: e.starters, ref: e.ref };
    if (minGrid === null || e.starters < minGrid.value) minGrid = { value: e.starters, ref: e.ref };
  }
  const avgClassified = mean(evAggs.map((e) => e.classified));

  // ── Reliability ───────────────────────────────────────────────
  const dnf = filtered.filter((r) => r.status === "dnf").length;
  const dns = filtered.filter((r) => r.status === "dns").length;
  const dsq = filtered.filter((r) => r.status === "dsq").length;

  // ── Discipline ────────────────────────────────────────────────
  const racesWithPenalty = evAggs.filter((e) => e.hasPenalty).length;
  const penaltySecondsTotal = evAggs.reduce((s, e) => s + e.penaltySeconds, 0);

  // ── Splits ────────────────────────────────────────────────────
  const bySeason: SeasonSplit[] = [...bySeasonRaces.entries()]
    .map(([sk, list]) => {
      const evs = aggregateEvents(list);
      const wins = new Set(
        evs.map((e) => e.winnerId).filter((x): x is string => !!x),
      );
      const rowStarts = list.filter((r) => r.isStart).length;
      const rowDnf = list.filter((r) => r.status === "dnf").length;
      const wg = evs.map((e) => e.winnerGrid).filter((g): g is number => g !== null);
      const clean = evs.filter((e) => !e.hasPenalty).length;
      return {
        seasonKey: sk,
        races: evs.length,
        avgStarters: mean(evs.map((e) => e.starters)),
        differentWinners: wins.size,
        dnfRate: pct(rowDnf, rowStarts),
        cleanRaceRate: pct(clean, evs.length),
        avgWinningGrid: mean(wg),
        thin: evs.length > 0 && evs.length < LEAGUE_MIN_SAMPLE,
      };
    })
    .sort(
      (a, b) =>
        (parseInt(a.seasonKey.replace(/\D/g, ""), 10) || 0) -
        (parseInt(b.seasonKey.replace(/\D/g, ""), 10) || 0),
    );

  const byWeather: WeatherSplit[] = WEATHER_ORDER.map((w) => {
    const list = filtered.filter((r) => r.weather === w);
    const evs = aggregateEvents(list);
    const wins = new Set(evs.map((e) => e.winnerId).filter((x): x is string => !!x));
    const rowStarts = list.filter((r) => r.isStart).length;
    const rowDnf = list.filter((r) => r.status === "dnf").length;
    const changes = list
      .filter((r) => r.netChange !== null)
      .map((r) => Math.abs(r.netChange!));
    return {
      key: w,
      races: evs.length,
      dnfRate: pct(rowDnf, rowStarts),
      differentWinners: wins.size,
      avgAbsPositionChange: mean(changes),
      thin: evs.length > 0 && evs.length < LEAGUE_MIN_SAMPLE,
    };
  }).filter((s) => s.races > 0);

  // ── Availability ──────────────────────────────────────────────
  const scopeForAvail = filterRaces(completed, {
    scope: filters.scope,
    season: filters.season,
  });
  const availAggs = aggregateEvents(scopeForAvail);
  const formatsSet = new Set(availAggs.map((e) => e.format));
  const weathersSet = new Set(
    availAggs.filter((e) => e.weather !== "unknown").map((e) => e.weather),
  );
  const knownWeatherRaces = availAggs.filter((e) => e.weather !== "unknown").length;

  // ── Records (all-time, unfiltered) ────────────────────────────
  const allAggs = aggregateEvents(completed);
  const firstEvent = allAggs.length ? allAggs[0] : null;
  const firstWinnerEvent = allAggs.find((e) => e.winnerId) ?? null;
  let mostStarters: RecordItem = null;
  let mostFinishers: RecordItem = null;
  let mostPenalized: RecordItem = null;
  const winnersPerSeason = new Map<string, Set<string>>();
  for (const e of allAggs) {
    if (mostStarters === null || e.starters > mostStarters.value) mostStarters = { value: e.starters, ref: e.ref };
    if (mostFinishers === null || e.classified > mostFinishers.value) mostFinishers = { value: e.classified, ref: e.ref };
    if (mostPenalized === null || e.penalizedRows > mostPenalized.value) mostPenalized = { value: e.penalizedRows, ref: e.ref };
    if (e.winnerId) {
      if (!winnersPerSeason.has(e.seasonKey)) winnersPerSeason.set(e.seasonKey, new Set());
      winnersPerSeason.get(e.seasonKey)!.add(e.winnerId);
    }
  }
  let mostDifferentWinnersSeason: { value: number; seasonKey: string } | null = null;
  for (const [sk, set] of winnersPerSeason) {
    if (mostDifferentWinnersSeason === null || set.size > mostDifferentWinnersSeason.value) {
      mostDifferentWinnersSeason = { value: set.size, seasonKey: sk };
    }
  }

  // ── Facts ─────────────────────────────────────────────────────
  let safetyCars = 0;
  let reverseGridEvents = 0;
  let broadcastedEvents = 0;
  for (const e of evAggs) {
    const src = eventById.get(e.ref.eventId.toLowerCase());
    if (src) {
      safetyCars += src.safety_cars ?? 0;
      if ((src.youtube_url ?? "").trim()) broadcastedEvents++;
    }
    if (e.reverseGrid) reverseGridEvents++;
  }

  return {
    races,
    entries,
    starts,
    classified,

    seasons: seasonSet.size,
    uniqueDrivers,
    uniqueTeams,
    totalPoints,
    differentWinners,
    avgStarters,

    competitive: {
      differentWinners,
      differentPodium,
      differentPoles,
      topDriverWinShare: pct(topWinnerWins, races),
      topWinnerName: topWinnerId ? winnerNames.get(topWinnerId) ?? null : null,
      topWinnerWins,
      leadChanges,
    },

    movement: {
      avgWinningGrid: mean(winningGrids),
      winningGridSample: winningGrids.length,
      poleToWinRate: pct(poleToWin, poleEvents.length),
      poleSample: poleEvents.length,
      winsFromOutsideTop3: winsOutsideTop3,
      avgAbsPositionChange: mean(changeVals),
      changeSample: changeVals.length,
    },

    gridHealth: {
      avgStarters,
      maxGrid,
      minGrid,
      completionRate: pct(classified, starts),
      avgClassified,
    },

    reliability: {
      classificationRate: pct(classified, starts),
      dnfRate: pct(dnf, starts),
      dnsRate: pct(dns, entries),
      dsqRate: pct(dsq, starts),
      avgClassified,
    },
    discipline: {
      penaltyRate: pct(racesWithPenalty, races),
      cleanRaceRate: pct(races - racesWithPenalty, races),
      penaltySecondsPerRace: races > 0 ? round2(penaltySecondsTotal / races) : null,
      racesWithPenalty,
    },

    splits: { bySeason, byWeather },

    events: evAggs,

    records: {
      firstRace: firstEvent ? firstEvent.ref : null,
      firstWinner: firstWinnerEvent
        ? { name: firstWinnerEvent.winnerName ?? "", ref: firstWinnerEvent.ref }
        : null,
      mostStarters,
      mostFinishers,
      mostDifferentWinnersSeason,
      mostPenalizedRace: mostPenalized,
    },

    availability: {
      hasWild: availAggs.some((e) => e.league === "wild"),
      formats: ["50%", "25%", "sprint"].filter((f) => formatsSet.has(f)),
      weathers: WEATHER_ORDER.filter((w) => weathersSet.has(w)),
      hasRegular: availAggs.some((e) => !e.isPlayoff),
      hasPlayoffs: availAggs.some((e) => e.isPlayoff),
      weatherCoverage: availAggs.length ? round2(knownWeatherRaces / availAggs.length) : 0,
    },

    facts: {
      safetyCars,
      reverseGridEvents,
      broadcastedEvents,
    },
  };
}
