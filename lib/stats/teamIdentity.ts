/* ------------------------------------------------------------------ */
/*  Canonical team identity                                            */
/*                                                                     */
/*  A team in ISL data is identified by a stable `team_key` (e.g.      */
/*  "psgil-mclaren") that matches the csv_teams tab and drives logo /  */
/*  colour lookups (see lib/driversData.ts). The race-results tab is   */
/*  the historical source of truth for which team a driver raced for   */
/*  in a given event (drivers change teams between seasons, mid-season,*/
/*  or move to/from reserve), via its `team_id` column.                */
/*                                                                     */
/*  This module resolves any team reference — a team_key, a short      */
/*  label, or a free-text sponsor name — onto the canonical team_key,  */
/*  and provides a compact display label. It is intentionally free of  */
/*  React / async deps so both the stats engine and UI can import it.  */
/* ------------------------------------------------------------------ */

/** Compact, UI-friendly team label, keyed by canonical team_key. */
export const TEAM_SHORT_NAMES: Record<string, string> = {
  "psgil-mclaren": "McLaren",
  "psgil-mercedes": "Mercedes",
  "psgil-redbull": "Red Bull",
  "psgil-ferrari": "Ferrari",
  "psgil-williams": "Williams",
  "psgil-racingb": "Racing Bulls",
  "psgil-haas": "Haas",
  "psgil-aston": "Aston Martin",
  "psgil-alpine": "Alpine",
  "psgil-audi": "Audi",
  "psgil-cadillac": "Cadillac",
  "psgil-sauber": "Kick Sauber",
};

/**
 * Hebrew display labels, keyed by canonical team_key. Teams are the fixed F1
 * grid, so these are maintained here rather than in the sheet. Any key missing
 * from this map falls back to the English `TEAM_SHORT_NAMES` label.
 */
export const TEAM_SHORT_NAMES_HE: Record<string, string> = {
  "psgil-mclaren": "מקלארן",
  "psgil-mercedes": "מרצדס",
  "psgil-redbull": "רד בול",
  "psgil-ferrari": "פרארי",
  "psgil-williams": "וויליאמס",
  "psgil-racingb": "רייסינג בולס",
  "psgil-haas": "האס",
  "psgil-aston": "אסטון מרטין",
  "psgil-alpine": "אלפין",
  "psgil-audi": "אאודי",
  "psgil-cadillac": "קדילק",
  "psgil-sauber": "קיק סאובר",
};

/** Every canonical team_key the code knows about. */
export const ALL_TEAM_KEYS: string[] = Object.keys(TEAM_SHORT_NAMES);

/**
 * Distinctive substrings (normalized) that map a free-text team reference to a
 * canonical key. Order-independent because the tokens are mutually exclusive.
 * Used only as a fallback when a result row lacks an explicit `team_id`.
 */
const KEY_TOKENS: Array<[key: string, tokens: string[]]> = [
  ["psgil-mclaren", ["mclaren"]],
  ["psgil-mercedes", ["mercedes"]],
  ["psgil-redbull", ["red bull", "redbull"]],
  ["psgil-racingb", ["racing bull", "racing bulls", "visa cash app"]],
  ["psgil-ferrari", ["ferrari"]],
  ["psgil-williams", ["williams"]],
  ["psgil-haas", ["haas"]],
  ["psgil-aston", ["aston"]],
  ["psgil-alpine", ["alpine"]],
  ["psgil-audi", ["audi"]],
  ["psgil-cadillac", ["cadillac"]],
  ["psgil-sauber", ["sauber"]],
];

/* ------------------------------------------------------------------ */
/*  Sheet-sourced names (optional override of the hardcoded maps)      */
/*                                                                     */
/*  Names are primarily maintained in the csv_teams sheet (team_name + */
/*  team_name_he). A lookup built from that sheet is threaded into the */
/*  resolvers below so a rename/typo fix is a sheet edit, not a code   */
/*  change. The hardcoded TEAM_SHORT_NAMES{,_HE} maps remain the       */
/*  fallback for any key the sheet doesn't cover.                      */
/* ------------------------------------------------------------------ */

export type TeamNameEntry = {
  team_key: string;
  team_name?: string;
  team_name_he?: string;
};

/** Resolve a canonical team_key to its sheet-sourced names (if any). */
export type TeamNameLookup = (teamKey: string) => { en?: string; he?: string } | undefined;

/** Build a {@link TeamNameLookup} from csv_teams rows (or any name-bearing rows). */
export function makeTeamNameLookup(entries: readonly TeamNameEntry[]): TeamNameLookup {
  const m = new Map<string, { en?: string; he?: string }>();
  for (const e of entries) {
    if (!e.team_key) continue;
    m.set(e.team_key, {
      en: (e.team_name ?? "").trim() || undefined,
      he: (e.team_name_he ?? "").trim() || undefined,
    });
  }
  return (key) => m.get(key);
}

/** Lowercase, punctuation-free, single-spaced form of any team reference. */
export function normalizeTeamText(input: string): string {
  return (input ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

/**
 * Resolve any team reference (canonical key, short label, or free-text sponsor
 * name) to the canonical `team_key`. Returns "" when nothing matches.
 */
export function resolveTeamKey(input: string | undefined | null): string {
  const raw = (input ?? "").trim();
  if (!raw) return "";
  // Already a canonical key.
  if (TEAM_SHORT_NAMES[raw]) return raw;
  const norm = normalizeTeamText(raw);
  if (!norm) return "";
  // A key written without the "psgil-" prefix (e.g. "redbull", "racingb").
  const prefixed = `psgil-${norm.replace(/\s+/g, "")}`;
  if (TEAM_SHORT_NAMES[prefixed]) return prefixed;
  for (const [key, tokens] of KEY_TOKENS) {
    if (tokens.some((tok) => norm.includes(tok))) return key;
  }
  return "";
}

/**
 * Compact display label for a team. Prefers the short-name map; falls back to
 * the supplied free-text (e.g. the raw results `team` value) and finally the
 * key itself, so unmapped/new teams still render something readable.
 */
export function getTeamShortName(
  teamKey: string,
  fallbackText?: string,
  lookup?: TeamNameLookup,
): string {
  return (
    lookup?.(teamKey)?.en ||
    TEAM_SHORT_NAMES[teamKey] ||
    (fallbackText ?? "").trim() ||
    teamKey
  );
}

/**
 * Locale-aware compact team label. Resolution order for a given `teamKey`:
 * sheet name (via `lookup`) → hardcoded map → free-text fallback → key. In
 * Hebrew the Hebrew sheet/map names are preferred, falling back to English.
 */
export function localizedTeamName(
  teamKey: string,
  locale: string,
  fallbackText?: string,
  lookup?: TeamNameLookup,
): string {
  if (locale === "he") {
    const sheetHe = lookup?.(teamKey)?.he;
    if (sheetHe) return sheetHe;
    const mapHe = TEAM_SHORT_NAMES_HE[teamKey];
    if (mapHe) return mapHe;
  }
  return getTeamShortName(teamKey, fallbackText, lookup);
}

/**
 * Resolve any team reference (canonical key, short label, or free-text sponsor
 * name) to a locale-aware display name. Pass an explicit `teamKey` when the row
 * has one (e.g. standings `team_key`); otherwise the free-text `raw` value is
 * resolved to a canonical key first. Unknown teams fall back to the raw text.
 */
export function resolveTeamName(
  raw: string | undefined | null,
  locale: string,
  teamKey?: string | null,
  lookup?: TeamNameLookup,
): string {
  const key = (teamKey && teamKey.trim()) || resolveTeamKey(raw);
  const fallback = (raw ?? "").trim();
  if (key) return localizedTeamName(key, locale, fallback, lookup);
  return fallback;
}
