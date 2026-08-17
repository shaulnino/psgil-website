/* ------------------------------------------------------------------ */
/*  Team profile selector                                              */
/*                                                                     */
/*  Aggregates the normalized per-race dataset into a constructors     */
/*  ("teams") overview leaderboard + a deep per-team profile, mirroring */
/*  the Drivers / League tabs. Everything historical is derived from   */
/*  the result rows' `teamKey` (resolved from the results `team_id`),   */
/*  never from the drivers tab — so mid-season swaps, between-season    */
/*  moves, and reserve substitutions are all captured as fact.         */
/*                                                                     */
/*  Locked product rules (approved):                                   */
/*   - Stats computed from race results (not the official constructors  */
/*     standings CSVs).                                                 */
/*   - Championship position = standard-competition rank by points in   */
/*     the selected scope.                                              */
/*   - Teammate comparison is per-event between the two cars the team   */
/*     fielded that round, aggregated per driver (robust to a changing  */
/*     partner). A classified finisher beats a non-classified teammate. */
/* ------------------------------------------------------------------ */

import type { RaceEvent, RaceFormat } from "@/lib/scheduleData";
import type { SeasonConfig } from "@/lib/seasonConfig";
import {
  filterRaces,
  type NormalizedRace,
  type ProfileFilters,
  type WeatherKind,
} from "@/lib/stats/normalizeRace";
import { getTeamShortName } from "@/lib/stats/teamIdentity";

/** Minimum races below which a filtered average/rate is flagged as thin. */
export const TEAM_MIN_SAMPLE = 3;

const WEATHER_ORDER: WeatherKind[] = ["dry", "wet", "mixed"];

/* ------------------------------------------------------------------ */
/*  Public types                                                        */
/* ------------------------------------------------------------------ */

/** One row of the teams overview leaderboard. */
export type TeamListItem = {
  teamKey: string;
  name: string;
  seasons: number;
  races: number; // distinct events the team appeared in
  entries: number; // driver-events
  points: number;
  wins: number;
  podiums: number; // podium finishes (driver-events)
  poles: number;
  fastestLaps: number;
  dnfs: number;
  avgFinish: number | null;
  avgGrid: number | null;
  pointsPerRace: number | null;
  oneTwoFinishes: number;
  bestFinish: number | null;
  /** Standard-competition rank by points within the current scope. */
  championshipPosition: number;
};

/** A driver's contribution + intra-team (teammate) record for a team. */
export type TeamDriverLine = {
  driverId: string;
  driverName: string;
  entries: number;
  points: number;
  pointsShare: number | null; // % of the team's points in scope
  wins: number;
  podiums: number;
  poles: number;
  avgFinish: number | null;
  // Per-driver "vs whoever the teammate was that round"
  qualiWins: number;
  qualiLosses: number;
  raceWins: number;
  raceLosses: number;
};

export type TeamCircuitLine = {
  circuitId: string;
  name: string;
  nameHe?: string;
  races: number;
  wins: number;
  podiums: number;
  avgFinish: number | null;
  bestFinish: number | null;
};

export type TeamFormPoint = {
  eventId: string;
  seasonKey: string;
  raceNumber: number;
  label: string;
  labelHe?: string;
  points: number; // team points that event
  cumulative: number; // running total within the season
};

export type TeamProfile = {
  teamKey: string;
  name: string;

  // Context
  seasons: number;
  races: number;
  entries: number;

  snapshot: {
    points: number;
    wins: number;
    podiums: number;
    poles: number;
    fastestLaps: number;
    bestChampPosition: number | null; // best per-season constructors rank in scope
    /** Drivers from the team's most recent event in scope (results-derived). */
    recentDriverIds: string[];
  };

  performance: {
    points: number;
    pointsPerRace: number | null;
    wins: number;
    winRate: number | null; // wins / races
    podiums: number;
    poles: number;
    fastestLaps: number;
    dotd: number;
    avgFinish: number | null;
    avgGrid: number | null;
    doublePodiums: number; // events with >=2 podium finishers from the team
    oneTwoFinishes: number; // events the team locked out P1 & P2
  };

  qualifying: {
    avgGrid: number | null;
    poleRate: number | null; // poles / races
    frontRowStarts: number; // entries starting grid 1-2
    avgNetMovement: number | null; // mean net positions gained/lost
  };

  reliability: {
    dnf: number;
    dnfRate: number | null; // dnf / starts
    classificationRate: number | null; // classified / starts
    cleanEntryRate: number | null; // entries with zero penalty / entries
    stewardSecondsPerRace: number | null;
    gameSecondsPerRace: number | null;
  };

  lineup: TeamDriverLine[];
  perCircuit: TeamCircuitLine[];
  form: TeamFormPoint[];

  /** True when the scope is below the thin-sample threshold. */
  thin: boolean;
};

export type TeamsAvailability = {
  hasWild: boolean;
  formats: RaceFormat[];
  weathers: WeatherKind[];
  hasRegular: boolean;
  hasPlayoffs: boolean;
};

export type TeamsOverview = {
  teams: TeamListItem[];
  races: number;
  availability: TeamsAvailability;
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
/*  Scoping                                                             */
/* ------------------------------------------------------------------ */

/** Completed-event rows only, with scope + advanced filters applied. */
function scopeRaces(
  allRaces: NormalizedRace[],
  events: RaceEvent[],
  filters: ProfileFilters,
): NormalizedRace[] {
  const completedIds = new Set(
    events
      .filter((e) => (e.status ?? "").trim().toLowerCase() === "completed")
      .map((e) => e.event_id.toLowerCase()),
  );
  const completed = allRaces.filter((r) => completedIds.has(r.eventId.toLowerCase()));
  return filterRaces(completed, filters).filter((r) => r.teamKey);
}

function seasonNumOf(seasonKey: string): number {
  return parseInt(seasonKey.replace(/\D/g, ""), 10) || 0;
}

function chronoSort(a: NormalizedRace, b: NormalizedRace): number {
  if (Number.isFinite(a.dateMs) && Number.isFinite(b.dateMs) && a.dateMs !== b.dateMs) {
    return a.dateMs - b.dateMs;
  }
  if (a.seasonNum !== b.seasonNum) return a.seasonNum - b.seasonNum;
  if (a.raceNumber !== b.raceNumber) return a.raceNumber - b.raceNumber;
  return a.eventId.localeCompare(b.eventId);
}

/* ------------------------------------------------------------------ */
/*  Per-team aggregate primitives                                       */
/* ------------------------------------------------------------------ */

type TeamAgg = {
  teamKey: string;
  rows: NormalizedRace[];
  eventIds: Set<string>;
  seasons: Set<string>;
  points: number;
  wins: number; // events won
  podiums: number; // podium finishes (rows)
  poles: number; // events with a pole
  fastestLaps: number;
  dnfs: number;
  starts: number;
  classifiedFinishes: number[];
  grids: number[];
  oneTwoFinishes: number;
  bestFinish: number | null;
};

/** Group scoped rows by teamKey and roll up the headline aggregates. */
function aggregateTeams(rows: NormalizedRace[]): Map<string, TeamAgg> {
  const byTeam = new Map<string, NormalizedRace[]>();
  for (const r of rows) {
    if (!byTeam.has(r.teamKey)) byTeam.set(r.teamKey, []);
    byTeam.get(r.teamKey)!.push(r);
  }

  const out = new Map<string, TeamAgg>();
  for (const [teamKey, teamRows] of byTeam) {
    const byEvent = new Map<string, NormalizedRace[]>();
    for (const r of teamRows) {
      if (!byEvent.has(r.eventId)) byEvent.set(r.eventId, []);
      byEvent.get(r.eventId)!.push(r);
    }

    let wins = 0;
    let poles = 0;
    let oneTwoFinishes = 0;
    for (const evRows of byEvent.values()) {
      if (evRows.some((r) => r.finish === 1)) wins++;
      if (evRows.some((r) => r.pole)) poles++;
      const finishes = new Set(
        evRows
          .filter((r) => r.isClassified && r.finish !== null)
          .map((r) => r.finish as number),
      );
      if (finishes.has(1) && finishes.has(2)) oneTwoFinishes++;
    }

    const classifiedFinishes = teamRows
      .filter((r) => r.isClassified && r.finish !== null)
      .map((r) => r.finish as number);
    const grids = teamRows
      .filter((r) => r.grid !== null)
      .map((r) => r.grid as number);

    out.set(teamKey, {
      teamKey,
      rows: teamRows,
      eventIds: new Set(teamRows.map((r) => r.eventId)),
      seasons: new Set(teamRows.map((r) => r.seasonKey)),
      points: round2(teamRows.reduce((s, r) => s + r.points, 0)),
      wins,
      podiums: teamRows.filter((r) => r.isClassified && r.finish !== null && r.finish <= 3).length,
      poles,
      fastestLaps: teamRows.filter((r) => r.fastestLap).length,
      dnfs: teamRows.filter((r) => r.status === "dnf").length,
      starts: teamRows.filter((r) => r.isStart).length,
      classifiedFinishes,
      grids,
      oneTwoFinishes,
      bestFinish: classifiedFinishes.length ? Math.min(...classifiedFinishes) : null,
    });
  }
  return out;
}

/** Standard-competition rank (1,2,2,4) of each team by points (desc). */
function championshipRanks(aggs: Map<string, TeamAgg>): Map<string, number> {
  const sorted = [...aggs.values()].sort((a, b) => b.points - a.points);
  const ranks = new Map<string, number>();
  let rank = 0;
  let prev = Infinity;
  for (let i = 0; i < sorted.length; i++) {
    if (sorted[i].points !== prev) {
      rank = i + 1;
      prev = sorted[i].points;
    }
    ranks.set(sorted[i].teamKey, rank);
  }
  return ranks;
}

function availabilityOf(rows: NormalizedRace[]): TeamsAvailability {
  const formats = new Set(rows.map((r) => r.format));
  const weathers = new Set(rows.filter((r) => r.weather !== "unknown").map((r) => r.weather));
  const FORMAT_ORDER: RaceFormat[] = ["50%", "25%", "sprint"];
  return {
    hasWild: rows.some((r) => r.league === "wild"),
    formats: FORMAT_ORDER.filter((f) => formats.has(f)),
    weathers: WEATHER_ORDER.filter((w) => weathers.has(w)),
    hasRegular: rows.some((r) => !r.isPlayoff),
    hasPlayoffs: rows.some((r) => r.isPlayoff),
  };
}

/* ------------------------------------------------------------------ */
/*  Public: teams overview (leaderboard)                                */
/* ------------------------------------------------------------------ */

export function computeTeamsOverview(
  allRaces: NormalizedRace[],
  events: RaceEvent[],
  _seasons: SeasonConfig[],
  filters: ProfileFilters,
): TeamsOverview {
  const scoped = scopeRaces(allRaces, events, filters);
  const aggs = aggregateTeams(scoped);
  const ranks = championshipRanks(aggs);

  const teams: TeamListItem[] = [...aggs.values()].map((a) => {
    const races = a.eventIds.size;
    return {
      teamKey: a.teamKey,
      name: getTeamShortName(a.teamKey, a.rows[0]?.team),
      seasons: a.seasons.size,
      races,
      entries: a.rows.length,
      points: a.points,
      wins: a.wins,
      podiums: a.podiums,
      poles: a.poles,
      fastestLaps: a.fastestLaps,
      dnfs: a.dnfs,
      avgFinish: mean(a.classifiedFinishes),
      avgGrid: mean(a.grids),
      pointsPerRace: races > 0 ? round2(a.points / races) : null,
      oneTwoFinishes: a.oneTwoFinishes,
      bestFinish: a.bestFinish,
      championshipPosition: ranks.get(a.teamKey) ?? 0,
    };
  });

  teams.sort(
    (x, y) =>
      x.championshipPosition - y.championshipPosition ||
      y.points - x.points ||
      y.wins - x.wins ||
      x.name.localeCompare(y.name),
  );

  // Availability from the season scope only (advanced filters ignored) so the
  // filter pills reflect what could be toggled, like the other tabs.
  const scopeOnly = scopeRaces(allRaces, events, {
    scope: filters.scope,
    season: filters.season,
  });

  return { teams, races: new Set(scoped.map((r) => r.eventId)).size, availability: availabilityOf(scopeOnly) };
}

/**
 * List every team that has ever appeared (all-time, unfiltered) for the
 * profile selector, ordered by all-time points.
 */
export function listTeamsWithHistory(
  allRaces: NormalizedRace[],
  events: RaceEvent[],
): { teamKey: string; name: string }[] {
  const scoped = scopeRaces(allRaces, events, { scope: "all-time" });
  const aggs = aggregateTeams(scoped);
  return [...aggs.values()]
    .sort((a, b) => b.points - a.points || a.teamKey.localeCompare(b.teamKey))
    .map((a) => ({ teamKey: a.teamKey, name: getTeamShortName(a.teamKey, a.rows[0]?.team) }));
}

/* ------------------------------------------------------------------ */
/*  Best per-season championship position (across scope)                */
/* ------------------------------------------------------------------ */

function bestChampPosition(scoped: NormalizedRace[], teamKey: string): number | null {
  const bySeason = new Map<string, NormalizedRace[]>();
  for (const r of scoped) {
    if (!bySeason.has(r.seasonKey)) bySeason.set(r.seasonKey, []);
    bySeason.get(r.seasonKey)!.push(r);
  }
  let best: number | null = null;
  for (const rows of bySeason.values()) {
    const ranks = championshipRanks(aggregateTeams(rows));
    const pos = ranks.get(teamKey);
    if (pos && pos > 0) best = best === null ? pos : Math.min(best, pos);
  }
  return best;
}

/* ------------------------------------------------------------------ */
/*  Per-driver contribution + teammate duels                            */
/* ------------------------------------------------------------------ */

function buildLineup(teamRows: NormalizedRace[], teamPoints: number): TeamDriverLine[] {
  const byDriver = new Map<string, NormalizedRace[]>();
  for (const r of teamRows) {
    if (!byDriver.has(r.driverId)) byDriver.set(r.driverId, []);
    byDriver.get(r.driverId)!.push(r);
  }

  // Teammate duels: per event with exactly two cars, compare the pair.
  const quali = new Map<string, { w: number; l: number }>();
  const race = new Map<string, { w: number; l: number }>();
  const bump = (m: Map<string, { w: number; l: number }>, id: string, win: boolean) => {
    const cur = m.get(id) ?? { w: 0, l: 0 };
    if (win) cur.w++;
    else cur.l++;
    m.set(id, cur);
  };

  const byEvent = new Map<string, NormalizedRace[]>();
  for (const r of teamRows) {
    if (!byEvent.has(r.eventId)) byEvent.set(r.eventId, []);
    byEvent.get(r.eventId)!.push(r);
  }
  for (const evRows of byEvent.values()) {
    if (evRows.length !== 2) continue; // standard two-car duel only
    const [a, b] = evRows;
    // Qualifying: lower grid wins (both grids must be known / non-reverse).
    if (a.grid !== null && b.grid !== null && a.grid !== b.grid) {
      const aWins = a.grid < b.grid;
      bump(quali, a.driverId, aWins);
      bump(quali, b.driverId, !aWins);
    }
    // Race: classified beats non-classified; else lower finish wins.
    const aC = a.isClassified && a.finish !== null;
    const bC = b.isClassified && b.finish !== null;
    if (aC && bC && a.finish !== b.finish) {
      const aWins = (a.finish as number) < (b.finish as number);
      bump(race, a.driverId, aWins);
      bump(race, b.driverId, !aWins);
    } else if (aC !== bC) {
      bump(race, a.driverId, aC);
      bump(race, b.driverId, bC);
    }
  }

  const lines: TeamDriverLine[] = [...byDriver.entries()].map(([driverId, rows]) => {
    const points = round2(rows.reduce((s, r) => s + r.points, 0));
    const classified = rows.filter((r) => r.isClassified && r.finish !== null).map((r) => r.finish as number);
    const q = quali.get(driverId) ?? { w: 0, l: 0 };
    const rc = race.get(driverId) ?? { w: 0, l: 0 };
    return {
      driverId,
      driverName: rows[0]?.driverName ?? driverId,
      entries: rows.length,
      points,
      pointsShare: teamPoints > 0 ? round2((points / teamPoints) * 100) : null,
      wins: rows.filter((r) => r.finish === 1).length,
      podiums: rows.filter((r) => r.isClassified && r.finish !== null && r.finish <= 3).length,
      poles: rows.filter((r) => r.pole).length,
      avgFinish: mean(classified),
      qualiWins: q.w,
      qualiLosses: q.l,
      raceWins: rc.w,
      raceLosses: rc.l,
    };
  });

  lines.sort((a, b) => b.points - a.points || b.entries - a.entries || a.driverName.localeCompare(b.driverName));
  return lines;
}

/* ------------------------------------------------------------------ */
/*  Per-circuit + form                                                  */
/* ------------------------------------------------------------------ */

function buildPerCircuit(teamRows: NormalizedRace[]): TeamCircuitLine[] {
  const byCircuit = new Map<string, NormalizedRace[]>();
  for (const r of teamRows) {
    const id = (r.track ?? "").trim();
    if (!id) continue;
    if (!byCircuit.has(id)) byCircuit.set(id, []);
    byCircuit.get(id)!.push(r);
  }
  const lines: TeamCircuitLine[] = [...byCircuit.entries()].map(([id, rows]) => {
    const events = new Set(rows.map((r) => r.eventId));
    const classified = rows.filter((r) => r.isClassified && r.finish !== null).map((r) => r.finish as number);
    let wins = 0;
    const byEvent = new Map<string, NormalizedRace[]>();
    for (const r of rows) {
      if (!byEvent.has(r.eventId)) byEvent.set(r.eventId, []);
      byEvent.get(r.eventId)!.push(r);
    }
    for (const evRows of byEvent.values()) if (evRows.some((r) => r.finish === 1)) wins++;
    return {
      circuitId: id,
      name: id,
      nameHe: rows.find((r) => r.trackHe)?.trackHe,
      races: events.size,
      wins,
      podiums: rows.filter((r) => r.isClassified && r.finish !== null && r.finish <= 3).length,
      avgFinish: mean(classified),
      bestFinish: classified.length ? Math.min(...classified) : null,
    };
  });
  lines.sort((a, b) => b.wins - a.wins || b.races - a.races || a.name.localeCompare(b.name));
  return lines;
}

function buildForm(teamRows: NormalizedRace[]): TeamFormPoint[] {
  // Team points per event, chronological, cumulative reset per season.
  const byEvent = new Map<string, NormalizedRace[]>();
  for (const r of teamRows) {
    if (!byEvent.has(r.eventId)) byEvent.set(r.eventId, []);
    byEvent.get(r.eventId)!.push(r);
  }
  const events = [...byEvent.values()]
    .map((rows) => rows)
    .sort((a, b) => chronoSort(a[0], b[0]));

  const cumulativeBySeason = new Map<string, number>();
  const out: TeamFormPoint[] = [];
  for (const rows of events) {
    const head = rows[0];
    const points = round2(rows.reduce((s, r) => s + r.points, 0));
    const cum = (cumulativeBySeason.get(head.seasonKey) ?? 0) + points;
    cumulativeBySeason.set(head.seasonKey, cum);
    out.push({
      eventId: head.eventId,
      seasonKey: head.seasonKey,
      raceNumber: head.raceNumber,
      label: head.raceName,
      labelHe: head.raceNameHe,
      points,
      cumulative: round2(cum),
    });
  }
  return out;
}

/* ------------------------------------------------------------------ */
/*  Public: computeTeamProfile                                          */
/* ------------------------------------------------------------------ */

export function computeTeamProfile(
  allRaces: NormalizedRace[],
  events: RaceEvent[],
  _seasons: SeasonConfig[],
  filters: ProfileFilters,
  teamKey: string,
): TeamProfile | null {
  if (!teamKey) return null;
  const scoped = scopeRaces(allRaces, events, filters);
  const teamRows = scoped.filter((r) => r.teamKey === teamKey);
  if (teamRows.length === 0) return null;

  const eventIds = new Set(teamRows.map((r) => r.eventId));
  const races = eventIds.size;
  const starts = teamRows.filter((r) => r.isStart).length;
  const classifiedRows = teamRows.filter((r) => r.isClassified && r.finish !== null);
  const classifiedFinishes = classifiedRows.map((r) => r.finish as number);
  const grids = teamRows.filter((r) => r.grid !== null).map((r) => r.grid as number);
  const points = round2(teamRows.reduce((s, r) => s + r.points, 0));

  // Per-event rollups for the team.
  const byEvent = new Map<string, NormalizedRace[]>();
  for (const r of teamRows) {
    if (!byEvent.has(r.eventId)) byEvent.set(r.eventId, []);
    byEvent.get(r.eventId)!.push(r);
  }
  let wins = 0;
  let poles = 0;
  let oneTwoFinishes = 0;
  let doublePodiums = 0;
  for (const evRows of byEvent.values()) {
    if (evRows.some((r) => r.finish === 1)) wins++;
    if (evRows.some((r) => r.pole)) poles++;
    const podiumCount = evRows.filter((r) => r.isClassified && r.finish !== null && r.finish <= 3).length;
    if (podiumCount >= 2) doublePodiums++;
    const finishes = new Set(
      evRows.filter((r) => r.isClassified && r.finish !== null).map((r) => r.finish as number),
    );
    if (finishes.has(1) && finishes.has(2)) oneTwoFinishes++;
  }

  const podiums = teamRows.filter((r) => r.isClassified && r.finish !== null && r.finish <= 3).length;
  const fastestLaps = teamRows.filter((r) => r.fastestLap).length;
  const dotd = teamRows.filter((r) => r.dotd).length;
  const dnf = teamRows.filter((r) => r.status === "dnf").length;
  const cleanEntries = teamRows.filter((r) => r.penaltySeconds === 0).length;
  const stewardTotal = teamRows.reduce((s, r) => s + r.stewardPenalty, 0);
  const gameTotal = teamRows.reduce((s, r) => s + r.gamePenalty, 0);
  const netChanges = teamRows.filter((r) => r.netChange !== null).map((r) => r.netChange as number);
  const frontRowStarts = teamRows.filter((r) => r.grid !== null && (r.grid as number) <= 2).length;

  // Most-recent lineup in scope (results-derived).
  const sortedByEvent = [...byEvent.values()].sort((a, b) => chronoSort(b[0], a[0]));
  const recentDriverIds = sortedByEvent.length
    ? [...new Set(sortedByEvent[0].map((r) => r.driverId))]
    : [];

  return {
    teamKey,
    name: getTeamShortName(teamKey, teamRows[0]?.team),

    seasons: new Set(teamRows.map((r) => r.seasonKey)).size,
    races,
    entries: teamRows.length,

    snapshot: {
      points,
      wins,
      podiums,
      poles,
      fastestLaps,
      bestChampPosition: bestChampPosition(scoped, teamKey),
      recentDriverIds,
    },

    performance: {
      points,
      pointsPerRace: races > 0 ? round2(points / races) : null,
      wins,
      winRate: pct(wins, races),
      podiums,
      poles,
      fastestLaps,
      dotd,
      avgFinish: mean(classifiedFinishes),
      avgGrid: mean(grids),
      doublePodiums,
      oneTwoFinishes,
    },

    qualifying: {
      avgGrid: mean(grids),
      poleRate: pct(poles, races),
      frontRowStarts,
      avgNetMovement: mean(netChanges),
    },

    reliability: {
      dnf,
      dnfRate: pct(dnf, starts),
      classificationRate: pct(classifiedRows.length, starts),
      cleanEntryRate: pct(cleanEntries, teamRows.length),
      stewardSecondsPerRace: races > 0 ? round2(stewardTotal / races) : null,
      gameSecondsPerRace: races > 0 ? round2(gameTotal / races) : null,
    },

    lineup: buildLineup(teamRows, points),
    perCircuit: buildPerCircuit(teamRows),
    form: buildForm(teamRows),

    thin: races > 0 && races < TEAM_MIN_SAMPLE,
  };
}
