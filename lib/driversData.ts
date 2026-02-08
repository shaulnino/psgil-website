export type DriverRole = "main" | "reserve";

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

export type Driver = {
  driver_id: string;
  name: string;
  team_key: string;
  role: DriverRole;
  number?: string;
  photo_url?: string;
  about?: string;
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
  // Achievements (counts per placement tier)
  titles_league_1st?: string;
  titles_league_2nd?: string;
  titles_league_3rd?: string;
  titles_lower_1st?: string;
  titles_lower_2nd?: string;
  titles_lower_3rd?: string;
  titles_wild_1st?: string;
  titles_wild_2nd?: string;
  titles_wild_3rd?: string;
  // League standings (injected via applyLeagueStandings)
  league_rank_main?: string;
  league_rank_wild?: string;
};

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

export type Team = {
  team_key: string;
  team_name: string;
  logo_url: string;
};

export type TeamWithDrivers = Team & { drivers: Driver[] };

export function normalizeRole(role: string): DriverRole {
  return role.toLowerCase() === "reserve" ? "reserve" : "main";
}

export function mapDrivers(raw: Record<string, string>[]): Driver[] {
  return raw.map((row) => ({
    driver_id: row.driver_id ?? "",
    name: row.name ?? "",
    team_key: row.team_key ?? "",
    role: normalizeRole(row.role ?? "main"),
    number: row.number || undefined,
    photo_url: row.photo_url || undefined,
    about: row.about || undefined,
    // All-time stats
    points: row.points || undefined,
    wins: row.wins || undefined,
    podiums: row.podiums || undefined,
    poles: row.poles || undefined,
    avg_finish: row.avg_finish || undefined,
    dnfs: row.dnfs || undefined,
    avg_grid: row.avg_grid || undefined,
    avg_points: row.avg_points || undefined,
    // Season stats
    season_points: row.season_points || undefined,
    season_wins: row.season_wins || undefined,
    season_podiums: row.season_podiums || undefined,
    season_poles: row.season_poles || undefined,
    season_avg_finish: row.season_avg_finish || undefined,
    season_dnfs: row.season_dnfs || undefined,
    season_avg_grid: row.season_avg_grid || undefined,
    season_avg_points: row.season_avg_points || undefined,
    // All-time ratings
    rating_speed: row.rating_speed || undefined,
    rating_consistency: row.rating_consistency || undefined,
    rating_performance: row.rating_performance || undefined,
    rating_agility: row.rating_agility || undefined,
    rating_overall: row.rating_overall || undefined,
    // Season ratings
    season_rating_speed: row.season_rating_speed || undefined,
    season_rating_consistency: row.season_rating_consistency || undefined,
    season_rating_performance: row.season_rating_performance || undefined,
    season_rating_agility: row.season_rating_agility || undefined,
    season_rating_overall: row.season_rating_overall || undefined,
    // All-time stat ranks
    rank_points: row.rank_points || undefined,
    rank_wins: row.rank_wins || undefined,
    rank_podiums: row.rank_podiums || undefined,
    rank_poles: row.rank_poles || undefined,
    rank_avg_finish: row.rank_avg_finish || undefined,
    rank_dnfs: row.rank_dnfs || undefined,
    rank_avg_grid: row.rank_avg_grid || undefined,
    rank_avg_points: row.rank_avg_points || undefined,
    // Season stat ranks
    season_rank_points: row.season_rank_points || undefined,
    season_rank_wins: row.season_rank_wins || undefined,
    season_rank_podiums: row.season_rank_podiums || undefined,
    season_rank_poles: row.season_rank_poles || undefined,
    season_rank_avg_finish: row.season_rank_avg_finish || undefined,
    season_rank_dnfs: row.season_rank_dnfs || undefined,
    season_rank_avg_grid: row.season_rank_avg_grid || undefined,
    season_rank_avg_points: row.season_rank_avg_points || undefined,
    // All-time rating ranks
    rank_rating_speed: row.rank_rating_speed || undefined,
    rank_rating_consistency: row.rank_rating_consistency || undefined,
    rank_rating_performance: row.rank_rating_performance || undefined,
    rank_rating_agility: row.rank_rating_agility || undefined,
    rank_rating_overall: row.rank_rating_overall || undefined,
    // Season rating ranks
    season_rank_rating_speed: row.season_rank_rating_speed || undefined,
    season_rank_rating_consistency: row.season_rank_rating_consistency || undefined,
    season_rank_rating_performance: row.season_rank_rating_performance || undefined,
    season_rank_rating_agility: row.season_rank_rating_agility || undefined,
    season_rank_rating_overall: row.season_rank_rating_overall || undefined,
    // Race events
    events: row.events || undefined,
    season_events: row.season_events || undefined,
    // Achievements
    titles_league_1st: row.titles_league_1st || undefined,
    titles_league_2nd: row.titles_league_2nd || undefined,
    titles_league_3rd: row.titles_league_3rd || undefined,
    titles_lower_1st: row.titles_lower_1st || undefined,
    titles_lower_2nd: row.titles_lower_2nd || undefined,
    titles_lower_3rd: row.titles_lower_3rd || undefined,
    titles_wild_1st: row.titles_wild_1st || undefined,
    titles_wild_2nd: row.titles_wild_2nd || undefined,
    titles_wild_3rd: row.titles_wild_3rd || undefined,
  }));
}

export function mapTeams(raw: Record<string, string>[]): Team[] {
  return raw.map((row) => ({
    team_key: row.team_key ?? "",
    team_name: row.team_name ?? "",
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
  "psgil-sauber":   "#52E252",   // Kick Sauber green
};

const FALLBACK_TEAM_COLOR = "#7020B0"; // purple accent

/** Return the primary border color for a given team_key. Falls back to purple. */
export function getTeamColor(teamKey: string): string {
  return TEAM_COLORS[teamKey] ?? FALLBACK_TEAM_COLOR;
}
