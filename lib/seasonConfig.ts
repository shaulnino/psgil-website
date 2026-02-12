/* ------------------------------------------------------------------ */
/*  Seasons Config – single source of truth for all season metadata    */
/*  ----------------------------------------------------------------  */
/*  The website derives EVERYTHING season-related from this CSV:       */
/*    • list of seasons for dropdowns                                  */
/*    • which season is "current"                                      */
/*    • feature flags (wild / constructors / playoffs)                 */
/*    • fallback images & notes                                        */
/*                                                                     */
/*  ALL season data lives in shared CSVs (standings, schedule, race    */
/*  results) with a "season" column.  The code filters by season_key.  */
/*                                                                     */
/*  Adding a new season requires ONLY a new row in the Google Sheet.   */
/* ------------------------------------------------------------------ */

import { fetchCsv, parseCsv } from "@/lib/csv";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export type SeasonConfig = {
  season_key: string; // "S1", "S2", …, "S7"
  season_label: string; // "Season 1", "Season 6" (shown in UI)
  start_date: string; // YYYY-MM-DD
  end_date: string; // YYYY-MM-DD
  is_current: boolean;
  has_wild: boolean;
  has_constructors: boolean;
  has_playoffs: boolean;
  playoffs_mode: "none" | "upper_lower";
  fallback_image_drivers_main: string;
  fallback_image_drivers_wild: string;
  fallback_image_constructors_main: string;
  fallback_image_constructors_wild: string;
  notes: string;
};

/* ------------------------------------------------------------------ */
/*  CSV Source URLs                                                    */
/*  ----------------------------------------------------------------  */
/*  The Google Sheets base URL is loaded from the SHEETS_BASE_URL      */
/*  environment variable to avoid triggering secrets scanning.         */
/*  Set it in Netlify to:                                              */
/*    https://docs.google.com/spreadsheets/d/e/<PACX-ID>/pub          */
/* ------------------------------------------------------------------ */

const SHEETS_BASE = process.env.SHEETS_BASE_URL ?? "";

function sheetUrl(gid: string): string {
  return `${SHEETS_BASE}?gid=${gid}&single=true&output=csv`;
}

export const SEASONS_CONFIG_CSV_URL = sheetUrl("819205893");

/* ------------------------------------------------------------------ */
/*  Global CSV URLs                                                    */
/*  ----------------------------------------------------------------  */
/*  Each CSV contains ALL seasons.  Pages filter by season_key.        */
/* ------------------------------------------------------------------ */

export const GLOBAL_CSV_URLS = {
  /* Driver roster & team data */
  drivers: sheetUrl("353282807"),
  teams: sheetUrl("1933328661"),
  leagueStandings: sheetUrl("1982499543"),

  /* Championship standings (all seasons, filtered by "season" column) */
  driversStandingsMain: sheetUrl("174729634"),
  driversStandingsWild: sheetUrl("1010201825"),
  constructorsStandingsMain: sheetUrl("1965693345"),
  constructorsStandingsWild: sheetUrl("769074374"),

  /* Schedule & race results (all seasons, filtered by "season" column) */
  schedule: sheetUrl("2105913561"),
  raceResults: sheetUrl("1960669750"),
};

/* ------------------------------------------------------------------ */
/*  Internal helpers                                                   */
/* ------------------------------------------------------------------ */

function toBool(value: string | undefined): boolean {
  return (value ?? "").trim().toUpperCase() === "TRUE";
}

function s(value: string | undefined): string {
  return (value ?? "").trim();
}

/* ------------------------------------------------------------------ */
/*  Season-matching helper                                             */
/*  ----------------------------------------------------------------  */
/*  CSV data uses different season formats:                            */
/*    • standings:  "S1", "S2", "S6"  (with S prefix)                  */
/*    • schedule:   "6"               (just the number)                */
/*  season_key in config is always "S6".                               */
/*  This helper matches all variants.                                  */
/* ------------------------------------------------------------------ */

/**
 * Check whether a season value from CSV data matches a season_key.
 *   matchesSeason("S6", "S6")  → true
 *   matchesSeason("6",  "S6")  → true
 *   matchesSeason("S6", "S1")  → false
 */
export function matchesSeason(
  dataValue: string,
  seasonKey: string,
): boolean {
  const d = (dataValue ?? "").trim();
  const k = (seasonKey ?? "").trim();
  if (!d || !k) return false;
  if (d === k) return true;
  // Strip leading "S"/"s" and compare numbers
  const dNum = d.replace(/^S/i, "");
  const kNum = k.replace(/^S/i, "");
  return dNum === kNum;
}

/* ------------------------------------------------------------------ */
/*  Mapper                                                             */
/* ------------------------------------------------------------------ */

export function mapSeasonsConfig(
  raw: Record<string, string>[],
): SeasonConfig[] {
  return raw
    .map((row) => ({
      season_key: s(row.season_key),
      season_label: s(row.season_label),
      start_date: s(row.start_date),
      end_date: s(row.end_date),
      is_current: toBool(row.is_current),
      has_wild: toBool(row.has_wild),
      has_constructors: toBool(row.has_constructors),
      has_playoffs: toBool(row.has_playoffs),
      playoffs_mode:
        s(row.playoffs_mode).toLowerCase() === "upper_lower"
          ? ("upper_lower" as const)
          : ("none" as const),
      fallback_image_drivers_main: s(row.fallback_image_drivers_main),
      fallback_image_drivers_wild: s(row.fallback_image_drivers_wild),
      fallback_image_constructors_main: s(
        row.fallback_image_constructors_main,
      ),
      fallback_image_constructors_wild: s(
        row.fallback_image_constructors_wild,
      ),
      notes: s(row.notes),
    }))
    .filter((c) => !!c.season_key); // skip empty rows
}

/* ------------------------------------------------------------------ */
/*  Sorting                                                            */
/* ------------------------------------------------------------------ */

/** Sort seasons newest-first (by start_date desc, then key number desc). */
export function sortSeasonsDesc(configs: SeasonConfig[]): SeasonConfig[] {
  return [...configs].sort((a, b) => {
    if (a.start_date && b.start_date) {
      const cmp = b.start_date.localeCompare(a.start_date);
      if (cmp !== 0) return cmp;
    }
    const numA = parseInt(a.season_key.replace(/\D/g, ""), 10) || 0;
    const numB = parseInt(b.season_key.replace(/\D/g, ""), 10) || 0;
    return numB - numA;
  });
}

/* ------------------------------------------------------------------ */
/*  Resolution helpers                                                 */
/* ------------------------------------------------------------------ */

/**
 * Resolve the current season:
 *  1. If any config has is_current = TRUE → that season.
 *  2. Otherwise → season with the latest start_date / highest number.
 */
export function resolveCurrentSeason(configs: SeasonConfig[]): SeasonConfig {
  const explicit = configs.find((c) => c.is_current);
  if (explicit) return explicit;
  const sorted = sortSeasonsDesc(configs);
  return sorted[0] ?? createFallbackSeason();
}

/** Find a season config by its key (e.g. "S6"). */
export function getSeasonByKey(
  configs: SeasonConfig[],
  key: string,
): SeasonConfig | undefined {
  return configs.find((c) => c.season_key === key);
}

/** Build the list for season dropdown (newest first). */
export function getSeasonsForDropdown(
  configs: SeasonConfig[],
): { key: string; label: string }[] {
  return sortSeasonsDesc(configs).map((c) => ({
    key: c.season_key,
    label:
      c.season_label || `Season ${c.season_key.replace(/\D/g, "")}`,
  }));
}

/**
 * Replace template tokens in a string with resolved values.
 *   {currentSeason}  → current season label
 *   {seasonCount}    → total number of seasons
 */
export function resolveTemplate(
  text: string,
  currentSeasonLabel: string,
  seasonCount: number,
): string {
  return text
    .replace(/\{currentSeason\}/g, currentSeasonLabel)
    .replace(/\{seasonCount\}/g, String(seasonCount));
}

/* ------------------------------------------------------------------ */
/*  Fetcher                                                            */
/* ------------------------------------------------------------------ */

/**
 * Fetch and parse the seasons config CSV.
 * Falls back to a single hardcoded Season 6 entry when the CSV is
 * unavailable (keeps the site running before the config tab exists).
 */
export async function fetchSeasonsConfig(): Promise<SeasonConfig[]> {
  try {
    const csv = await fetchCsv(SEASONS_CONFIG_CSV_URL);
    const raw = parseCsv<Record<string, string>>(csv);
    const configs = mapSeasonsConfig(raw);
    if (configs.length > 0) return configs;
  } catch {
    // Config CSV not available – use fallback
  }
  return [createFallbackSeason()];
}

/* ------------------------------------------------------------------ */
/*  Fallback (ensures the site works before the CSV tab is created)    */
/* ------------------------------------------------------------------ */

function createFallbackSeason(): SeasonConfig {
  return {
    season_key: "S6",
    season_label: "Season 6",
    start_date: "2025-01-01",
    end_date: "2025-12-31",
    is_current: true,
    has_wild: true,
    has_constructors: true,
    has_playoffs: false,
    playoffs_mode: "none",
    fallback_image_drivers_main: "/statistics/drivers-main-champ.png",
    fallback_image_drivers_wild: "/statistics/drivers-wild-champ.png",
    fallback_image_constructors_main:
      "/statistics/constructors-main-champ.png",
    fallback_image_constructors_wild:
      "/statistics/constructors-wild-champ.png",
    notes: "",
  };
}
