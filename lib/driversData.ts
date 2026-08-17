import type { Reward } from "@/lib/rewardsData";
import type { ComputedDriverRating } from "@/lib/statsComputed";
import type { StandingsRow } from "@/lib/resultsData";
import { matchesSeason } from "@/lib/seasonConfig";

export type DriverRole = "main" | "reserve" | "historic";

export type DriverStats = {
  points?: string;
  wins?: string;
  podiums?: string;
  poles?: string;
  avg_finish?: string;
  dnfs?: string;
  avg_grid?: string;
  avg_points?: string;
};

/** Stats + ratings for a specific competition scope (main / wild). */
export type CompetitionStats = {
  events?: string;
  // Quick stats
  points?: string;
  wins?: string;
  podiums?: string;
  poles?: string;
  avg_finish?: string;
  dnfs?: string;
  avg_grid?: string;
  avg_points?: string;
  // Ratings
  rating_speed?: string;
  rating_consistency?: string;
  rating_performance?: string;
  rating_agility?: string;
  rating_overall?: string;
  // Cross-driver ranks within this competition scope (computed server-side)
  rank_points?: string;
  rank_wins?: string;
  rank_podiums?: string;
  rank_poles?: string;
  rank_avg_finish?: string;
  rank_dnfs?: string;
  rank_avg_grid?: string;
  rank_avg_points?: string;
  rank_rating_speed?: string;
  rank_rating_consistency?: string;
  rank_rating_performance?: string;
  rank_rating_agility?: string;
  rank_rating_overall?: string;
};

export type Driver = {
  driver_id: string;
  name: string;
  /** Optional Hebrew driver name (csv column: name_he). Falls back to name. */
  name_he?: string;
  team_key: string;
  role: DriverRole;
  number?: string;
  photo_url?: string;
  photo_position?: string; // CSS object-position value, e.g. "center", "bottom", "50% 70%"
  about?: string;
  /** Optional Hebrew bio (csv column: about_he). Falls back to about. */
  about_he?: string;
  // All-time stats
  points?: string;
  wins?: string;
  podiums?: string;
  poles?: string;
  avg_finish?: string;
  dnfs?: string;
  avg_grid?: string;
  avg_points?: string;
  // Season stats
  season_points?: string;
  season_wins?: string;
  season_podiums?: string;
  season_poles?: string;
  season_avg_finish?: string;
  season_dnfs?: string;
  season_avg_grid?: string;
  season_avg_points?: string;
  // All-time ratings
  rating_speed?: string;
  rating_consistency?: string;
  rating_performance?: string;
  rating_agility?: string;
  rating_overall?: string;
  // Season ratings
  season_rating_speed?: string;
  season_rating_consistency?: string;
  season_rating_performance?: string;
  season_rating_agility?: string;
  season_rating_overall?: string;
  // All-time stat ranks (among active drivers)
  rank_points?: string;
  rank_wins?: string;
  rank_podiums?: string;
  rank_poles?: string;
  rank_avg_finish?: string;
  rank_dnfs?: string;
  rank_avg_grid?: string;
  rank_avg_points?: string;
  // Season stat ranks
  season_rank_points?: string;
  season_rank_wins?: string;
  season_rank_podiums?: string;
  season_rank_poles?: string;
  season_rank_avg_finish?: string;
  season_rank_dnfs?: string;
  season_rank_avg_grid?: string;
  season_rank_avg_points?: string;
  // All-time rating ranks
  rank_rating_speed?: string;
  rank_rating_consistency?: string;
  rank_rating_performance?: string;
  rank_rating_agility?: string;
  rank_rating_overall?: string;
  // Season rating ranks
  season_rank_rating_speed?: string;
  season_rank_rating_consistency?: string;
  season_rank_rating_performance?: string;
  season_rank_rating_agility?: string;
  season_rank_rating_overall?: string;
  // Race events (total participated)
  events?: string;
  season_events?: string;
  // Season-aware rewards (loaded from rewards dataset)
  rewards?: Reward[];
  // League standings (injected via applyLeagueStandings)
  league_rank_main?: string;
  league_rank_wild?: string;
  // Competition-split stats + ratings (all-time and current season)
  comp_main?: CompetitionStats;
  comp_wild?: CompetitionStats;
  season_comp_main?: CompetitionStats;
  season_comp_wild?: CompetitionStats;
};

/** Driver name in the active locale — Hebrew when available, else English/Latin. */
export function localizedDriverName(
  driver: Pick<Driver, "name" | "name_he">,
  locale: string,
): string {
  return locale === "he" && driver.name_he ? driver.name_he : driver.name;
}

/** Driver bio in the active locale — Hebrew when available, else English. */
export function localizedAbout(
  driver: Pick<Driver, "about" | "about_he">,
  locale: string,
): string | undefined {
  return locale === "he" && driver.about_he ? driver.about_he : driver.about;
}

/* ------------------------------------------------------------------ */
/*  League Standings (separate sheet, joined by driver_id)             */
/* ------------------------------------------------------------------ */

export type LeagueStanding = {
  driver_id: string;
  main_rank?: string;
  wild_rank?: string;
};

/** Treat "-", empty, or missing values as undefined. */
function cleanRank(value: string | undefined): string | undefined {
  if (!value || value.trim() === "" || value.trim() === "-") return undefined;
  return value.trim();
}

export function mapLeagueStandings(raw: Record<string, string>[]): LeagueStanding[] {
  return raw.map((row) => ({
    driver_id: (row.driver_id ?? "").trim(),
    main_rank: cleanRank(row.main_league_rank),
    wild_rank: cleanRank(row.wild_league_rank),
  }));
}

/** Merge league standings into existing drivers (by driver_id). */
export function applyLeagueStandings(
  drivers: Driver[],
  standings: LeagueStanding[],
): Driver[] {
  const standingMap = new Map(standings.map((s) => [s.driver_id, s]));
  return drivers.map((driver) => {
    const standing = standingMap.get(driver.driver_id);
    if (!standing) return driver;
    return {
      ...driver,
      league_rank_main: standing.main_rank,
      league_rank_wild: standing.wild_rank,
    };
  });
}

/**
 * Derive LeagueStanding[] from the computed standings tables instead of the
 * legacy leagueStandings CSV. Filters to the given season and extracts each
 * driver's position as their league rank.
 */
export function leagueStandingsFromTables(
  mainRows: StandingsRow[],
  wildRows: StandingsRow[],
  currentSeasonKey: string,
): LeagueStanding[] {
  const mainMap = new Map<string, string>();
  const wildMap = new Map<string, string>();

  mainRows
    .filter((r) => r.driver_id && matchesSeason(r.season, currentSeasonKey))
    .forEach((r) => mainMap.set(r.driver_id, r.position));

  wildRows
    .filter((r) => r.driver_id && matchesSeason(r.season, currentSeasonKey))
    .forEach((r) => wildMap.set(r.driver_id, r.position));

  const allIds = new Set([...mainMap.keys(), ...wildMap.keys()]);
  return Array.from(allIds).map((driver_id) => ({
    driver_id,
    main_rank: mainMap.get(driver_id),
    wild_rank: wildMap.get(driver_id),
  }));
}

export type Team = {
  team_key: string;
  team_name: string;
  /** Optional Hebrew display name from the sheet (csv column: team_name_he).
   *  When empty, the hardcoded Hebrew map in lib/stats/teamIdentity.ts is used. */
  team_name_he?: string;
  logo_url: string;
};

export type TeamWithDrivers = Team & { drivers: Driver[] };

export function normalizeRole(role: string): DriverRole {
  const r = role.toLowerCase().trim();
  if (r === "reserve") return "reserve";
  if (r === "historic") return "historic";
  return "main";
}

/**
 * Maps raw CSV rows from the csv_drivers tab.
 * Only the identity columns (driver_id → about) are read here.
 * All stats, ratings, ranks, and events are computed server-side
 * via mergeComputedRatings / computeAllScopeRanks / computeCompetitionRanks.
 */
export function mapDrivers(raw: Record<string, string>[]): Driver[] {
  return raw
    // Skip CSV filler rows: trailing blank rows and stray note rows in the sheet
    // have no id and/or no name and are not real drivers.
    .filter((row) => (row.driver_id ?? "").trim() && (row.name ?? "").trim())
    .map((row) => ({
      driver_id: row.driver_id ?? "",
      name: row.name ?? "",
      name_he: (row.name_he ?? "").trim() || undefined,
      team_key: row.team_key ?? "",
      role: normalizeRole(row.role ?? "main"),
      number: row.number || undefined,
      photo_url: row.photo_url || undefined,
      photo_position: row.photo_position || undefined,
      about: row.about || undefined,
      about_he: (row.about_he ?? "").trim() || undefined,
      rewards: [],
    }));
}

export function mapTeams(raw: Record<string, string>[]): Team[] {
  return raw.map((row) => ({
    team_key: row.team_key ?? "",
    team_name: row.team_name ?? "",
    team_name_he: (row.team_name_he ?? "").trim() || undefined,
    logo_url: row.logo_url ?? "",
  }));
}

export function groupDriversByTeam(teams: Team[], drivers: Driver[]): TeamWithDrivers[] {
  return teams.map((team) => ({
    ...team,
    drivers: drivers.filter((driver) => driver.team_key === team.team_key && driver.role === "main"),
  }));
}

export function getReserveDrivers(drivers: Driver[]): Driver[] {
  return drivers.filter((driver) => driver.role === "reserve");
}

export function getHistoricDrivers(drivers: Driver[]): Driver[] {
  return drivers
    .filter((driver) => driver.role === "historic")
    .sort((a, b) => a.name.localeCompare(b.name));
}

/* ------------------------------------------------------------------ */
/*  Team primary colors (F1 livery-inspired)                           */
/* ------------------------------------------------------------------ */

const TEAM_COLORS: Record<string, string> = {
  "psgil-alpine":   "#0093CC",   // Alpine blue / pink accent
  "psgil-aston":    "#006F62",   // Aston Martin British racing green
  "psgil-ferrari":  "#E8002D",   // Ferrari red
  "psgil-racingb":  "#6692FF",   // Racing Bulls blue
  "psgil-haas":     "#B6BABD",   // Haas silver
  "psgil-redbull":  "#3671C6",   // Red Bull blue
  "psgil-mclaren":  "#FF8000",   // McLaren papaya orange
  "psgil-williams": "#64C4FF",   // Williams blue
  "psgil-mercedes": "#27F4D2",   // Mercedes turquoise
  "psgil-sauber":   "#52E252",   // Kick Sauber green (historic)
  "psgil-audi":     "#FF2D00",   // Audi F1 red (matches the logo mark)
  "psgil-cadillac": "#0A1E3C",   // Cadillac dark navy — best-guess, adjust to final livery
};

const FALLBACK_TEAM_COLOR = "#7020B0"; // purple accent

/** Return the primary border color for a given team_key. Falls back to purple. */
export function getTeamColor(teamKey: string): string {
  return TEAM_COLORS[teamKey] ?? FALLBACK_TEAM_COLOR;
}

/* ------------------------------------------------------------------ */
/*  Team logos                                                         */
/* ------------------------------------------------------------------ */

/**
 * Team logos, keyed by team_key. This map is the single source of truth for
 * team logos — the `logo_url` column in the Google Sheet is intentionally NOT
 * consulted. To add or change a logo: drop the file in `public/teams/` and add
 * or update its entry here. Files live in `public/teams/`.
 */
const TEAM_LOGOS: Record<string, string> = {
  "psgil-alpine":   "/teams/alpine.svg",
  "psgil-aston":    "/teams/aston martin.svg",
  "psgil-ferrari":  "/teams/ferrari.svg",
  "psgil-racingb":  "/teams/racing bulls.svg",
  "psgil-haas":     "/teams/haas.svg",
  "psgil-redbull":  "/teams/red bull.svg",
  "psgil-mclaren":  "/teams/mclaren.svg",
  "psgil-williams": "/teams/williams.svg",
  "psgil-mercedes": "/teams/mercedes.svg",
  "psgil-sauber":   "/teams/kick sauber.svg",
  "psgil-audi":     "/teams/audi.svg",
  "psgil-cadillac": "/teams/cadillac.png",
};

const FALLBACK_TEAM_LOGO = "/isl-mark.png";

/**
 * Resolve the logo for a team from the code-side `TEAM_LOGOS` map, falling
 * back to the site mark for unmapped teams.
 */
export function getTeamLogo(teamKey: string): string {
  return TEAM_LOGOS[teamKey] ?? FALLBACK_TEAM_LOGO;
}

/* ------------------------------------------------------------------ */
/*  Merge computed ratings into Driver objects                         */
/* ------------------------------------------------------------------ */

function toStr(v: number | null | undefined): string | undefined {
  if (v == null) return undefined;
  return String(Math.round(v * 10) / 10);
}
function toStrRound(v: number | null | undefined): string | undefined {
  if (v == null) return undefined;
  return String(Math.round(v));
}

function ratingToCompStats(r: ComputedDriverRating): CompetitionStats {
  return {
    events:             String(r.events),
    points:             String(r.total_points),
    wins:               String(r.wins),
    podiums:            String(r.podiums),
    poles:              String(r.poles),
    avg_finish:         toStr(r.avg_finish),
    dnfs:               String(r.dnfs),
    avg_grid:           toStr(r.avg_grid),
    avg_points:         toStr(r.avg_points),
    rating_speed:       toStrRound(r.speed),
    rating_consistency: toStrRound(r.consistency),
    rating_performance: toStrRound(r.performance),
    rating_agility:     toStrRound(r.agility),
    rating_overall:     toStrRound(r.overall),
  };
}

/**
 * Merge computed ratings into the `Driver` array.
 *
 * mode:
 *   "alltime"      – writes to top-level `rating_*` + `events`
 *   "season"       – writes to `season_rating_*` + `season_events`
 *   "main"         – writes to `comp_main` (CompetitionStats)
 *   "wild"         – writes to `comp_wild`
 *   "season_main"  – writes to `season_comp_main`
 *   "season_wild"  – writes to `season_comp_wild`
 */
export function mergeComputedRatings(
  drivers: Driver[],
  ratings: ComputedDriverRating[],
  mode: "alltime" | "season" | "main" | "wild" | "season_main" | "season_wild",
): Driver[] {
  const ratingMap = new Map(ratings.map((r) => [r.driver_id, r]));

  if (mode === "main" || mode === "wild" || mode === "season_main" || mode === "season_wild") {
    const field: keyof Driver =
      mode === "main" ? "comp_main"
      : mode === "wild" ? "comp_wild"
      : mode === "season_main" ? "season_comp_main"
      : "season_comp_wild";
    return drivers.map((d) => {
      const r = ratingMap.get(d.driver_id);
      if (!r || r.events === 0) return d;
      return { ...d, [field]: ratingToCompStats(r) };
    });
  }

  const prefix = mode === "season" ? "season_" : "";
  const eventsKey = mode === "season" ? "season_events" : "events";
  return drivers.map((d) => {
    const r = ratingMap.get(d.driver_id);
    if (!r || r.events === 0) return d;
    // Computed stats are used as the source of truth for "All" competition scope.
    // They override empty/missing CSV values but lose to populated CSV values so that
    // standings-sourced data (which includes bonus/penalty adjustments) takes priority.
    const csvKey = <K extends string>(k: K) => d[`${prefix}${k}` as keyof Driver] as string | undefined;
    const computed = <V>(v: V, csvVal: string | undefined): string =>
      csvVal != null && csvVal !== "" ? csvVal : String(v ?? "");
    return {
      ...d,
      [eventsKey]:                     String(r.events),
      [`${prefix}points`]:             computed(r.total_points, csvKey("points")),
      [`${prefix}wins`]:               computed(r.wins,         csvKey("wins")),
      [`${prefix}podiums`]:            computed(r.podiums,      csvKey("podiums")),
      [`${prefix}poles`]:              computed(r.poles,        csvKey("poles")),
      [`${prefix}avg_finish`]:         r.avg_finish != null ? (csvKey("avg_finish") ?? toStr(r.avg_finish)) : csvKey("avg_finish"),
      [`${prefix}dnfs`]:               computed(r.dnfs,         csvKey("dnfs")),
      [`${prefix}avg_grid`]:           r.avg_grid != null ? (csvKey("avg_grid") ?? toStr(r.avg_grid)) : csvKey("avg_grid"),
      [`${prefix}avg_points`]:         r.avg_points != null ? (csvKey("avg_points") ?? toStr(r.avg_points)) : csvKey("avg_points"),
      [`${prefix}rating_speed`]:       r.speed        != null ? String(Math.round(r.speed))       : d[`${prefix}rating_speed` as keyof Driver],
      [`${prefix}rating_consistency`]: r.consistency  != null ? String(Math.round(r.consistency)) : d[`${prefix}rating_consistency` as keyof Driver],
      [`${prefix}rating_performance`]: r.performance  != null ? String(Math.round(r.performance)) : d[`${prefix}rating_performance` as keyof Driver],
      [`${prefix}rating_agility`]:     r.agility      != null ? String(Math.round(r.agility))     : d[`${prefix}rating_agility` as keyof Driver],
      [`${prefix}rating_overall`]:     r.overall      != null ? String(Math.round(r.overall))     : d[`${prefix}rating_overall` as keyof Driver],
    } as Driver;
  });
}

/* ------------------------------------------------------------------ */
/*  All-scope cross-driver rankings (alltime + season)                 */
/* ------------------------------------------------------------------ */

const ALL_SCOPE_ASCENDING = new Set(["avg_finish", "avg_grid", "dnfs"]);
const ALL_SCOPE_STAT_KEYS = ["points", "wins", "podiums", "poles", "avg_finish", "dnfs", "avg_grid", "avg_points"] as const;
const ALL_SCOPE_RATING_KEYS = ["rating_speed", "rating_consistency", "rating_performance", "rating_agility", "rating_overall"] as const;

/**
 * Computes cross-driver rank fields (rank_* and season_rank_*) for the "All"
 * competition scope entirely from race-results-derived data already merged
 * onto the Driver objects via mergeComputedRatings.
 * Call this after all mergeComputedRatings calls and before passing drivers
 * to the page component.
 */
export function computeAllScopeRanks(drivers: Driver[]): Driver[] {
  const patches = new Map<string, Partial<Driver>>();
  const ensurePatch = (id: string): Partial<Driver> => {
    if (!patches.has(id)) patches.set(id, {});
    return patches.get(id)!;
  };

  // ── All-time ──────────────────────────────────────────────────────
  for (const key of ALL_SCOPE_STAT_KEYS) {
    const ascending = ALL_SCOPE_ASCENDING.has(key);
    const entries: Array<{ id: string; val: number }> = [];
    for (const d of drivers) {
      const val = parseFloat((d[key as keyof Driver] as string | undefined) ?? "");
      if (Number.isFinite(val)) entries.push({ id: d.driver_id, val });
    }
    const rankMap = denseRank(entries, ascending);
    for (const [id, rank] of rankMap) {
      (ensurePatch(id) as Record<string, string>)[`rank_${key}`] = rank;
    }
  }
  for (const key of ALL_SCOPE_RATING_KEYS) {
    const entries: Array<{ id: string; val: number }> = [];
    for (const d of drivers) {
      const val = parseFloat((d[key as keyof Driver] as string | undefined) ?? "");
      if (Number.isFinite(val)) entries.push({ id: d.driver_id, val });
    }
    const rankMap = denseRank(entries, false);
    for (const [id, rank] of rankMap) {
      (ensurePatch(id) as Record<string, string>)[`rank_${key}`] = rank;
    }
  }

  // ── Season ────────────────────────────────────────────────────────
  for (const key of ALL_SCOPE_STAT_KEYS) {
    const ascending = ALL_SCOPE_ASCENDING.has(key);
    const seasonKey = `season_${key}` as keyof Driver;
    const entries: Array<{ id: string; val: number }> = [];
    for (const d of drivers) {
      const val = parseFloat((d[seasonKey] as string | undefined) ?? "");
      if (Number.isFinite(val)) entries.push({ id: d.driver_id, val });
    }
    const rankMap = denseRank(entries, ascending);
    for (const [id, rank] of rankMap) {
      (ensurePatch(id) as Record<string, string>)[`season_rank_${key}`] = rank;
    }
  }
  for (const key of ALL_SCOPE_RATING_KEYS) {
    const seasonKey = `season_${key}` as keyof Driver;
    const entries: Array<{ id: string; val: number }> = [];
    for (const d of drivers) {
      const val = parseFloat((d[seasonKey] as string | undefined) ?? "");
      if (Number.isFinite(val)) entries.push({ id: d.driver_id, val });
    }
    const rankMap = denseRank(entries, false);
    for (const [id, rank] of rankMap) {
      (ensurePatch(id) as Record<string, string>)[`season_rank_${key}`] = rank;
    }
  }

  return drivers.map((d) => {
    const patch = patches.get(d.driver_id);
    return patch ? { ...d, ...patch } : d;
  });
}

/* ------------------------------------------------------------------ */
/*  Competition-scoped cross-driver rankings                           */
/* ------------------------------------------------------------------ */

type CompField = "comp_main" | "comp_wild" | "season_comp_main" | "season_comp_wild";

const COMP_ASCENDING_STATS = new Set(["avg_finish", "avg_grid", "dnfs"]);
const COMP_STAT_KEYS = ["points", "wins", "podiums", "poles", "avg_finish", "dnfs", "avg_grid", "avg_points"] as const;
const COMP_RATING_KEYS = ["rating_speed", "rating_consistency", "rating_performance", "rating_agility", "rating_overall"] as const;

function denseRank(entries: Array<{ id: string; val: number }>, ascending: boolean): Map<string, string> {
  const sorted = [...entries].sort((a, b) => ascending ? a.val - b.val : b.val - a.val);
  const rankMap = new Map<string, string>();
  let rank = 1;
  for (let i = 0; i < sorted.length; i++) {
    if (i > 0 && sorted[i].val !== sorted[i - 1].val) rank = i + 1;
    rankMap.set(sorted[i].id, String(rank));
  }
  return rankMap;
}

/**
 * After all competition-scope stats are merged via mergeComputedRatings,
 * call this to populate rank_* fields within each CompetitionStats object
 * so the driver modal can show relative rankings within Main / Wild.
 */
export function computeCompetitionRanks(drivers: Driver[]): Driver[] {
  const FIELDS: CompField[] = ["comp_main", "comp_wild", "season_comp_main", "season_comp_wild"];

  const patches = new Map<string, Partial<Record<CompField, Partial<CompetitionStats>>>>();
  const ensure = (id: string, field: CompField): Partial<CompetitionStats> => {
    if (!patches.has(id)) patches.set(id, {});
    const p = patches.get(id)!;
    if (!p[field]) p[field] = {};
    return p[field]!;
  };

  for (const field of FIELDS) {
    for (const key of COMP_STAT_KEYS) {
      const ascending = COMP_ASCENDING_STATS.has(key);
      const entries: Array<{ id: string; val: number }> = [];
      for (const d of drivers) {
        const cs = d[field] as CompetitionStats | undefined;
        if (!cs) continue;
        const val = parseFloat((cs as Record<string, string | undefined>)[key] ?? "");
        if (Number.isFinite(val)) entries.push({ id: d.driver_id, val });
      }
      const rankMap = denseRank(entries, ascending);
      for (const [id, rank] of rankMap) {
        (ensure(id, field) as Record<string, string>)[`rank_${key}`] = rank;
      }
    }

    for (const key of COMP_RATING_KEYS) {
      const entries: Array<{ id: string; val: number }> = [];
      for (const d of drivers) {
        const cs = d[field] as CompetitionStats | undefined;
        if (!cs) continue;
        const val = parseFloat((cs as Record<string, string | undefined>)[key] ?? "");
        if (Number.isFinite(val)) entries.push({ id: d.driver_id, val });
      }
      const rankMap = denseRank(entries, false); // ratings: higher = better
      for (const [id, rank] of rankMap) {
        (ensure(id, field) as Record<string, string>)[`rank_${key}`] = rank;
      }
    }
  }

  return drivers.map((d) => {
    const patch = patches.get(d.driver_id);
    if (!patch) return d;
    const updated: Driver = { ...d };
    for (const field of FIELDS) {
      if (patch[field] && d[field]) {
        (updated as Record<string, unknown>)[field] = { ...(d[field] as CompetitionStats), ...patch[field] };
      }
    }
    return updated;
  });
}
