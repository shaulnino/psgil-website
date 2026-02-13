/* ------------------------------------------------------------------ */
/*  Stats data layer                                                   */
/*  ----------------------------------------------------------------  */
/*  Fetches and types data from the "PSGiL Historical Stats" tabs:     */
/*    • Drivers Statistics All-Time                                    */
/*    • S1–S6 Driver Stats                                             */
/*    • League Statistics                                              */
/*    • Circuits Statistics                                            */
/*                                                                     */
/*  Uses the same sheet-URL construction pattern as seasonConfig.ts    */
/*  to avoid Netlify bundler truncation.                               */
/* ------------------------------------------------------------------ */

import { fetchCsv, parseCsv } from "@/lib/csv";

/* ------------------------------------------------------------------ */
/*  URL construction (same pattern as seasonConfig.ts)                 */
/* ------------------------------------------------------------------ */

const SHEET_ID = [
  "2PACX-1vQSNGhBKLMDdmeIOy9wn3ZBS3Kk0",
  "-oBmWCMs0ANbg3qDrSsp9PbIXm8qLtTUQKA",
  "2HkvoNEpZg9Zf_Ps",
].join("");

function sheetUrl(gid: string): string {
  return `https://docs.google.com/spreadsheets/d/e/${SHEET_ID}/pub?gid=${gid}&single=true&output=csv`;
}

/* ------------------------------------------------------------------ */
/*  Tab gids                                                           */
/* ------------------------------------------------------------------ */

const STATS_GID = {
  driversAllTime: "1700425494",
  driversS6: "1613919890",
  driversS5: "959151792",
  driversS4: "1381179695",
  driversS3: "2036731585",
  driversS2: "1743525015",
  driversS1: "1460630212",
  league: "2021794230",
  circuits: "1199694775",
} as const;

export const STATS_CSV_URLS = {
  driversAllTime: sheetUrl(STATS_GID.driversAllTime),
  driversS6: sheetUrl(STATS_GID.driversS6),
  driversS5: sheetUrl(STATS_GID.driversS5),
  driversS4: sheetUrl(STATS_GID.driversS4),
  driversS3: sheetUrl(STATS_GID.driversS3),
  driversS2: sheetUrl(STATS_GID.driversS2),
  driversS1: sheetUrl(STATS_GID.driversS1),
  league: sheetUrl(STATS_GID.league),
  circuits: sheetUrl(STATS_GID.circuits),
};

/** Available season keys for per-season driver stats */
export const DRIVER_SEASON_KEYS = ["S6", "S5", "S4", "S3", "S2", "S1"] as const;
export type DriverSeasonKey = (typeof DRIVER_SEASON_KEYS)[number];

const SEASON_URL_MAP: Record<DriverSeasonKey, string> = {
  S6: STATS_CSV_URLS.driversS6,
  S5: STATS_CSV_URLS.driversS5,
  S4: STATS_CSV_URLS.driversS4,
  S3: STATS_CSV_URLS.driversS3,
  S2: STATS_CSV_URLS.driversS2,
  S1: STATS_CSV_URLS.driversS1,
};

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

/**
 * A single driver stat row — columns vary by tab so we keep them
 * as a generic record with some guaranteed fields.
 */
export type DriverStatRow = {
  /** Driver name (normalised from "Drivers*" or "Drivers") */
  driver_name: string;
  /** All original columns as string key-value pairs */
  raw: Record<string, string>;
  /** Numeric columns extracted: key → number (NaN excluded) */
  metrics: Record<string, number>;
};

/** A metric descriptor auto-detected from CSV columns */
export type MetricInfo = {
  key: string;        // original column header
  label: string;      // cleaned display label
  isPercentage: boolean;
  isRating: boolean;  // Speed, Consistency, Performance, Agility, Driver Rating
};

/** League stat row (transposed from pivot CSV) */
export type LeagueStatRow = {
  metric: string;
  total: string;
  seasons: Record<string, string>; // "Season 1" → value, "Season 2" → value, …
};

/** Circuit stat row */
export type CircuitStatRow = {
  circuit: string;
  raw: Record<string, string>;
  metrics: Record<string, number>;
};

/* ------------------------------------------------------------------ */
/*  Parsing helpers                                                    */
/* ------------------------------------------------------------------ */

/** Columns that are always the driver name dimension */
const DRIVER_NAME_COLS = ["drivers*", "drivers", "driver", "driver_name", "name"];

/** Columns that are always the circuit dimension */
const CIRCUIT_NAME_COLS = ["circuit", "track", "circuit_name"];

/** Columns that should not be treated as numeric metrics */
const SKIP_COLS = new Set([
  ...DRIVER_NAME_COLS,
  ...CIRCUIT_NAME_COLS,
  "first appearence*",
  "first appearence",
  "first appearance",
  "winners",
  "-",
]);

/** Rating columns (special category) */
const RATING_COLS = new Set([
  "speed", "consistency", "performance", "agility", "driver rating",
]);

function parseNumeric(val: string): number | null {
  if (!val || val === "-" || val === "N/A" || val === "") return null;
  // Remove % and parse
  const cleaned = val.replace(/%/g, "").replace(/,/g, "").trim();
  const n = Number(cleaned);
  return isNaN(n) ? null : n;
}

function isPercentageCol(header: string): boolean {
  return header.includes("%");
}

function cleanLabel(header: string): string {
  return header
    .replace(/\*$/g, "")     // remove trailing asterisks
    .replace(/^Event\s+/i, "") // remove "Event " prefix for compactness
    .trim();
}

/**
 * Extract metrics from a row given the header list.
 */
function extractMetrics(
  row: Record<string, string>,
  headers: string[],
): { metrics: Record<string, number>; raw: Record<string, string> } {
  const metrics: Record<string, number> = {};
  const raw: Record<string, string> = {};

  for (const h of headers) {
    const val = (row[h] ?? "").trim();
    raw[h] = val;
    const lh = h.toLowerCase().trim();
    if (SKIP_COLS.has(lh)) continue;
    const n = parseNumeric(val);
    if (n !== null) {
      metrics[h] = n;
    }
  }
  return { metrics, raw };
}

/**
 * Detect which column is the driver name.
 */
function findDriverNameCol(headers: string[]): string {
  for (const h of headers) {
    if (DRIVER_NAME_COLS.includes(h.toLowerCase().trim())) return h;
  }
  return headers[0]; // fallback
}

/**
 * Detect which column is the circuit name.
 */
function findCircuitNameCol(headers: string[]): string {
  for (const h of headers) {
    if (CIRCUIT_NAME_COLS.includes(h.toLowerCase().trim())) return h;
  }
  return headers[0];
}

/**
 * Build metric descriptors from a set of driver stat rows.
 */
export function detectMetrics(rows: DriverStatRow[]): MetricInfo[] {
  if (rows.length === 0) return [];
  // Collect all metric keys across all rows
  const allKeys = new Set<string>();
  for (const r of rows) {
    for (const k of Object.keys(r.metrics)) allKeys.add(k);
  }
  return Array.from(allKeys).map((key) => ({
    key,
    label: cleanLabel(key),
    isPercentage: isPercentageCol(key),
    isRating: RATING_COLS.has(key.toLowerCase().trim()),
  }));
}

/**
 * Build metric descriptors from circuit rows.
 */
export function detectCircuitMetrics(rows: CircuitStatRow[]): MetricInfo[] {
  if (rows.length === 0) return [];
  const allKeys = new Set<string>();
  for (const r of rows) {
    for (const k of Object.keys(r.metrics)) allKeys.add(k);
  }
  return Array.from(allKeys).map((key) => ({
    key,
    label: cleanLabel(key),
    isPercentage: isPercentageCol(key),
    isRating: false,
  }));
}

/* ------------------------------------------------------------------ */
/*  Curated "highlight" metrics (top cards row)                        */
/* ------------------------------------------------------------------ */

/** Metrics for the top "quick stats" cards (best 8 at a glance) */
export const DRIVER_HIGHLIGHT_METRICS = [
  "Events Participation",
  "Event Wins",
  "Event Podiums",
  "Total Points",
  "Pole Positions",
  "Fastest Laps",
  "Championships",
  "Driver Rating",
];

/** Default bar chart metrics for drivers */
export const DRIVER_CHART_METRICS = [
  "Total Points",
  "Event Wins",
  "Event Podiums",
  "Pole Positions",
  "Fastest Laps",
  "Avg. Final Position",
];

/** Rating metrics for radar chart */
export const DRIVER_RATING_METRICS = [
  "Speed",
  "Consistency",
  "Performance",
  "Agility",
  "Driver Rating",
];

/* ------------------------------------------------------------------ */
/*  Auto-categorization                                                */
/* ------------------------------------------------------------------ */

export type MetricCategory = {
  id: string;
  label: string;
  metrics: MetricInfo[];
};

/**
 * Category rules: each rule is [category-id, display-label, keyword-patterns].
 * A metric is placed in the first category whose pattern matches.
 * Order matters — more specific patterns first.
 */
const CATEGORY_RULES: [string, string, RegExp][] = [
  ["ratings",       "Driver Ratings",     /^(speed|consistency|performance|agility|driver rating)$/i],
  ["participation", "Participation",      /particip|events?\s+(on|held)|races?\s+particip|sprints?\s+particip|25%\s+races/i],
  ["results",       "Race Results",       /wins?|podiums?|top\s+\d|place|finishes|finishing|winning/i],
  ["points",        "Points",             /points/i],
  ["positions",     "Positions & Grid",   /position|grid|position changes/i],
  ["records",       "Records & Awards",   /fastest|pole|driver of the day|championships?|dnf|dns|dsq/i],
  ["weather",       "Weather",            /dry|rain|changing weather|wet/i],
];

/**
 * Auto-categorise a flat list of MetricInfo into labelled groups.
 * Preserves the original column order within each group.
 * Any metric that doesn't match a rule goes to "Other".
 */
export function categoriseMetrics(metrics: MetricInfo[]): MetricCategory[] {
  const buckets = new Map<string, { label: string; items: MetricInfo[] }>();
  // Initialize buckets in display order
  for (const [id, label] of CATEGORY_RULES) {
    buckets.set(id, { label, items: [] });
  }
  buckets.set("other", { label: "Other", items: [] });

  for (const m of metrics) {
    let placed = false;
    for (const [id, , pattern] of CATEGORY_RULES) {
      if (pattern.test(m.key) || pattern.test(m.label)) {
        buckets.get(id)!.items.push(m);
        placed = true;
        break;
      }
    }
    if (!placed) {
      buckets.get("other")!.items.push(m);
    }
  }

  // Return only non-empty categories
  const result: MetricCategory[] = [];
  for (const [id, { label, items }] of buckets) {
    if (items.length > 0) {
      result.push({ id, label, metrics: items });
    }
  }
  return result;
}

/* ------------------------------------------------------------------ */
/*  Fetchers                                                           */
/* ------------------------------------------------------------------ */

/**
 * Fetch and parse driver stats from any tab (all-time or season).
 */
export async function fetchDriverStats(url: string): Promise<{
  rows: DriverStatRow[];
  headers: string[];
}> {
  const csv = await fetchCsv(url);
  const raw = parseCsv<Record<string, string>>(csv);
  if (raw.length === 0) return { rows: [], headers: [] };

  const headers = Object.keys(raw[0]);
  const nameCol = findDriverNameCol(headers);

  if (process.env.NODE_ENV === "development") {
    console.log(`[stats] Driver stats: ${raw.length} rows, headers:`, headers);
  }

  const rows: DriverStatRow[] = raw
    .filter((r) => (r[nameCol] ?? "").trim())
    .map((r) => {
      const { metrics, raw: rawVals } = extractMetrics(r, headers);
      return {
        driver_name: (r[nameCol] ?? "").trim(),
        raw: rawVals,
        metrics,
      };
    });

  return { rows, headers };
}

/**
 * Fetch driver stats for a specific season.
 */
export async function fetchSeasonDriverStats(
  seasonKey: DriverSeasonKey,
): Promise<{ rows: DriverStatRow[]; headers: string[] }> {
  const url = SEASON_URL_MAP[seasonKey];
  if (!url) return { rows: [], headers: [] };
  return fetchDriverStats(url);
}

/**
 * Fetch all-time driver stats.
 */
export async function fetchAllTimeDriverStats(): Promise<{
  rows: DriverStatRow[];
  headers: string[];
}> {
  return fetchDriverStats(STATS_CSV_URLS.driversAllTime);
}

/**
 * Fetch league statistics (pivot table: metrics as rows, seasons as columns).
 */
export async function fetchLeagueStats(): Promise<LeagueStatRow[]> {
  const csv = await fetchCsv(STATS_CSV_URLS.league);
  const raw = parseCsv<Record<string, string>>(csv);
  if (raw.length === 0) return [];

  const headers = Object.keys(raw[0]);
  // First column is the metric name (header "-")
  const metricCol = headers[0]; // "-"
  const totalCol = headers.find((h) => h.toLowerCase() === "total") || headers[1];
  const seasonCols = headers.filter(
    (h) => h !== metricCol && h.toLowerCase() !== "total",
  );

  if (process.env.NODE_ENV === "development") {
    console.log(`[stats] League: ${raw.length} rows, seasonCols:`, seasonCols);
  }

  return raw
    .filter((r) => (r[metricCol] ?? "").trim())
    .map((r) => {
      const seasons: Record<string, string> = {};
      for (const sc of seasonCols) {
        seasons[sc] = (r[sc] ?? "").trim();
      }
      return {
        metric: (r[metricCol] ?? "").trim(),
        total: (r[totalCol] ?? "").trim(),
        seasons,
      };
    });
}

/**
 * Fetch circuit statistics.
 */
export async function fetchCircuitStats(): Promise<{
  rows: CircuitStatRow[];
  headers: string[];
}> {
  const csv = await fetchCsv(STATS_CSV_URLS.circuits);
  const raw = parseCsv<Record<string, string>>(csv);
  if (raw.length === 0) return { rows: [], headers: [] };

  const headers = Object.keys(raw[0]);
  const circuitCol = findCircuitNameCol(headers);

  if (process.env.NODE_ENV === "development") {
    console.log(`[stats] Circuits: ${raw.length} rows, headers:`, headers);
  }

  const rows: CircuitStatRow[] = raw
    .filter((r) => (r[circuitCol] ?? "").trim())
    .map((r) => {
      const { metrics, raw: rawVals } = extractMetrics(r, headers);
      return {
        circuit: (r[circuitCol] ?? "").trim(),
        raw: rawVals,
        metrics,
      };
    });

  return { rows, headers };
}

/**
 * Fetch ALL stats data in parallel (for server component).
 */
export async function fetchAllStatsData() {
  const [
    driversAllTime,
    driversS6,
    driversS5,
    driversS4,
    driversS3,
    driversS2,
    driversS1,
    league,
    circuits,
  ] = await Promise.all([
    fetchAllTimeDriverStats().catch(() => ({ rows: [], headers: [] as string[] })),
    fetchSeasonDriverStats("S6").catch(() => ({ rows: [], headers: [] as string[] })),
    fetchSeasonDriverStats("S5").catch(() => ({ rows: [], headers: [] as string[] })),
    fetchSeasonDriverStats("S4").catch(() => ({ rows: [], headers: [] as string[] })),
    fetchSeasonDriverStats("S3").catch(() => ({ rows: [], headers: [] as string[] })),
    fetchSeasonDriverStats("S2").catch(() => ({ rows: [], headers: [] as string[] })),
    fetchSeasonDriverStats("S1").catch(() => ({ rows: [], headers: [] as string[] })),
    fetchLeagueStats().catch(() => [] as LeagueStatRow[]),
    fetchCircuitStats().catch(() => ({ rows: [], headers: [] as string[] })),
  ]);

  const driversBySeason: Record<string, { rows: DriverStatRow[]; headers: string[] }> = {
    S6: driversS6,
    S5: driversS5,
    S4: driversS4,
    S3: driversS3,
    S2: driversS2,
    S1: driversS1,
  };

  return {
    driversAllTime,
    driversBySeason,
    league,
    circuits,
  };
}
