/* ------------------------------------------------------------------ */
/*  Stats V2 — Filter system                                            */
/*                                                                     */
/*  A single filter type drives every page in /stats-v2. Filters are   */
/*  URL-serialised so they survive navigation and are shareable.       */
/* ------------------------------------------------------------------ */

import type { RaceEvent, RaceFormat } from "@/lib/scheduleData";
import type { RaceResultRow } from "@/lib/resultsData";
import { matchesSeason } from "@/lib/seasonConfig";

export type LeagueFilter = "main" | "wild";
export type WeatherFilter = "dry" | "wet" | "mixed";
export type RoundType = "regular" | "playoff";
export type DriverPool = "active" | "historical" | "all";

export type StatsV2Filters = {
  /** Season keys, e.g. ["S5", "S6"]. Empty = all-time. */
  seasons: string[];
  /** Leagues to include. Empty = both. */
  leagues: LeagueFilter[];
  /** Race formats. Empty = all. */
  formats: RaceFormat[];
  /** Weather conditions. Empty = all. */
  weather: WeatherFilter[];
  /** Specific circuits (track names). Empty = all. */
  circuits: string[];
  /** Round type. Empty = all. */
  roundTypes: RoundType[];
  /** Driver pool. Defaults to "all". */
  driverPool: DriverPool;
  /** Minimum race count for inclusion in rankings. Defaults to 1. */
  minSample: number;
};

export const DEFAULT_FILTERS: StatsV2Filters = {
  seasons: [],
  leagues: [],
  formats: [],
  weather: [],
  circuits: [],
  roundTypes: [],
  driverPool: "all",
  minSample: 1,
};

/* ------------------------------------------------------------------ */
/*  URL serialization                                                   */
/* ------------------------------------------------------------------ */

const PARAM_KEYS = {
  seasons: "season",
  leagues: "league",
  formats: "format",
  weather: "weather",
  circuits: "circuit",
  roundTypes: "round",
  driverPool: "pool",
  minSample: "min",
} as const;

/** Parse filters from a URLSearchParams-like object. */
export function parseFiltersFromParams(
  params: URLSearchParams | Record<string, string | string[] | undefined>,
): StatsV2Filters {
  const get = (key: string): string[] => {
    if (params instanceof URLSearchParams) {
      const all = params.getAll(key);
      if (all.length > 0) return all.flatMap((v) => v.split(",")).filter(Boolean);
      const single = params.get(key);
      return single ? single.split(",").filter(Boolean) : [];
    }
    const raw = (params as Record<string, string | string[] | undefined>)[key];
    if (!raw) return [];
    if (Array.isArray(raw)) return raw.flatMap((v) => v.split(",")).filter(Boolean);
    return raw.split(",").filter(Boolean);
  };

  const single = (key: string): string | undefined => {
    const arr = get(key);
    return arr[0];
  };

  return {
    seasons: get(PARAM_KEYS.seasons),
    leagues: get(PARAM_KEYS.leagues).filter(
      (v): v is LeagueFilter => v === "main" || v === "wild",
    ),
    formats: get(PARAM_KEYS.formats).filter(
      (v): v is RaceFormat => v === "50%" || v === "25%" || v === "sprint",
    ),
    weather: get(PARAM_KEYS.weather).filter(
      (v): v is WeatherFilter => v === "dry" || v === "wet" || v === "mixed",
    ),
    circuits: get(PARAM_KEYS.circuits),
    roundTypes: get(PARAM_KEYS.roundTypes).filter(
      (v): v is RoundType => v === "regular" || v === "playoff",
    ),
    driverPool: ((): DriverPool => {
      const v = single(PARAM_KEYS.driverPool);
      return v === "active" || v === "historical" ? v : "all";
    })(),
    minSample: ((): number => {
      const v = single(PARAM_KEYS.minSample);
      const n = v ? parseInt(v, 10) : 1;
      return Number.isFinite(n) && n > 0 ? n : 1;
    })(),
  };
}

/** Serialize filters back to a URLSearchParams string (for links / replaceState). */
export function serializeFilters(filters: StatsV2Filters): string {
  const sp = new URLSearchParams();
  if (filters.seasons.length) sp.set(PARAM_KEYS.seasons, filters.seasons.join(","));
  if (filters.leagues.length) sp.set(PARAM_KEYS.leagues, filters.leagues.join(","));
  if (filters.formats.length) sp.set(PARAM_KEYS.formats, filters.formats.join(","));
  if (filters.weather.length) sp.set(PARAM_KEYS.weather, filters.weather.join(","));
  if (filters.circuits.length) sp.set(PARAM_KEYS.circuits, filters.circuits.join(","));
  if (filters.roundTypes.length) sp.set(PARAM_KEYS.roundTypes, filters.roundTypes.join(","));
  if (filters.driverPool !== "all") sp.set(PARAM_KEYS.driverPool, filters.driverPool);
  if (filters.minSample > 1) sp.set(PARAM_KEYS.minSample, String(filters.minSample));
  return sp.toString();
}

/** Returns true if filters are at default values. */
export function isDefaultFilters(filters: StatsV2Filters): boolean {
  return (
    filters.seasons.length === 0 &&
    filters.leagues.length === 0 &&
    filters.formats.length === 0 &&
    filters.weather.length === 0 &&
    filters.circuits.length === 0 &&
    filters.roundTypes.length === 0 &&
    filters.driverPool === "all" &&
    filters.minSample === 1
  );
}

/* ------------------------------------------------------------------ */
/*  Event / result predicates                                           */
/* ------------------------------------------------------------------ */

/** Map RaceEvent.weather string to a WeatherFilter category. */
export function eventWeather(ev: RaceEvent): WeatherFilter | null {
  const w = (ev.weather ?? "").toLowerCase().trim();
  if (!w) return null;
  if (w.includes("wet") || w.includes("rain")) return "wet";
  if (w.includes("mix") || w.includes("chang")) return "mixed";
  if (w.includes("dry") || w === "clear") return "dry";
  return null;
}

/** True if the event passes the given filters. */
export function eventMatchesFilters(
  ev: RaceEvent,
  filters: StatsV2Filters,
): boolean {
  if (ev.status.toLowerCase() !== "completed") return false;
  if (filters.seasons.length && !filters.seasons.some((s) => matchesSeason(ev.season, s))) return false;
  if (filters.leagues.length) {
    const lg = ev.league.toLowerCase();
    if (!filters.leagues.includes(lg as LeagueFilter)) return false;
  }
  if (filters.formats.length && !filters.formats.includes(ev.race_format)) return false;
  if (filters.weather.length) {
    const w = eventWeather(ev);
    if (!w || !filters.weather.includes(w)) return false;
  }
  if (filters.circuits.length) {
    const track = (ev.track ?? "").trim();
    if (!track || !filters.circuits.includes(track)) return false;
  }
  if (filters.roundTypes.length) {
    const wantPlayoff = filters.roundTypes.includes("playoff");
    const wantRegular = filters.roundTypes.includes("regular");
    if (ev.is_playoff && !wantPlayoff) return false;
    if (!ev.is_playoff && !wantRegular) return false;
  }
  return true;
}

/** Filter race results to those whose event matches the filters. */
export function filterResultsByFilters(
  results: RaceResultRow[],
  eventMap: Map<string, RaceEvent>,
  filters: StatsV2Filters,
): RaceResultRow[] {
  return results.filter((r) => {
    const ev = eventMap.get(r.event_id.toLowerCase());
    if (!ev) return false;
    return eventMatchesFilters(ev, filters);
  });
}

/** Filter events to only those matching the filters. */
export function filterEventsByFilters(
  events: RaceEvent[],
  filters: StatsV2Filters,
): RaceEvent[] {
  return events.filter((ev) => eventMatchesFilters(ev, filters));
}
