/* ------------------------------------------------------------------ */
/*  Stats UI layer — types, tooltips, metric detection & categorisation */
/*  ----------------------------------------------------------------  */
/*  Driver / league / circuit stat *values* are computed in             */
/*  lib/statsComputed.ts from race results + schedule + rewards.      */
/*  This module only holds shared types and presentation helpers.       */
/* ------------------------------------------------------------------ */

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
  /** Driver ID from the race results feed (when set by statsComputed). */
  driver_id?: string;
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
  tooltip: string;    // hover description
};

/* ------------------------------------------------------------------ */
/*  Tooltip descriptions                                               */
/*  Key = lowercased + trimmed column header (or cleaned label).       */
/*  If a column doesn't match, a sensible auto-generated tip is used. */
/* ------------------------------------------------------------------ */

const METRIC_TOOLTIPS: Record<string, string> = {
  // ── Driver: Participation ──────────────────────────────────────
  "events participation":                    "Total events (races + sprints) the driver entered",
  "races participation":                     "Number of 50% races the driver entered",
  "sprints participation":                   "Number of sprint races the driver entered",
  "25% races participation":                 "Number of 25% races the driver entered",
  "dry events participation":                "Events entered that were held in dry conditions",
  "rainy events participation":              "Events entered that were held in wet conditions",
  "changing weather events participation":   "Events entered with dynamic weather changes during the race",
  "event participation %":                   "Percentage of all available events the driver entered",

  // ── Driver: Race Results ───────────────────────────────────────
  "event top 10 finishes":                   "Number of events finishing in the top 10",
  "event top 10 finishes %":                 "Percentage of entered events finishing in the top 10",
  "event top 5 finishes":                    "Number of events finishing in the top 5",
  "event top 5 finishes %":                  "Percentage of entered events finishing in the top 5",
  "event podiums":                           "Total podium finishes (top 3) across all events",
  "podiums":                                 "Total podium finishes (top 3) across all events",
  "event top 3 finishes %":                  "Percentage of entered events finishing on the podium",
  "top 3 finishes %":                        "Percentage of entered events finishing on the podium",
  "event 3rd place":                         "Number of times finished 3rd",
  "3rd place":                               "Number of times finished 3rd",
  "event 2nd place":                         "Number of times finished 2nd",
  "2nd place":                               "Number of times finished 2nd",
  "event wins":                              "Total event victories (races + sprints)",
  "wins":                                    "Total event victories",
  "race wins":                               "Victories in 50% races only",
  "sprint wins":                             "Victories in sprint races only",
  "race 25% wins":                           "Victories in 25% races",
  "event winning %":                         "Percentage of entered events won",
  "winning %":                               "Percentage of entered events won",

  // ── Driver: Points ─────────────────────────────────────────────
  "total points":                            "Total championship points accumulated",
  "points per events":                       "Average points earned per event entered",
  "points in dry":                           "Total points scored in dry conditions",
  "points in rain":                          "Total points scored in wet conditions",
  "points in changing weather":              "Total points scored in changing weather conditions",
  "avg. points per event*":                  "Average points per event (may exclude outliers)",
  "avg. points per event":                   "Average points per event entered",

  // ── Driver: Positions & Grid ───────────────────────────────────
  "position changes*":                       "Total grid positions gained or lost across all races",
  "position changes":                        "Total grid positions gained or lost across all races",
  "avg. position changes per race":          "Average positions gained/lost per race",
  "avg. grid position*":                     "Average qualifying/grid position",
  "avg. grid position":                      "Average qualifying/grid position",
  "best final position":                     "Best finishing position ever achieved",
  "best grid position":                      "Best qualifying/grid position ever achieved",
  "lowest final position":                   "Worst finishing position recorded",
  "lowest grid position":                    "Worst qualifying/grid position recorded",
  "avg. final position":                     "Average finishing position across all events",
  "avg. final positions - dry*":             "Average finishing position in dry conditions",
  "avg. final positions - dry":              "Average finishing position in dry conditions",
  "avg. final positions - rain*":            "Average finishing position in wet conditions",
  "avg. final positions - rain":             "Average finishing position in wet conditions",
  "avg. final positions - changing weather":  "Average finishing position in changing weather",
  "pole positions":                          "Number of times started from pole position (P1 on the grid)",

  // ── Driver: Records & Awards ───────────────────────────────────
  "fastest laps":                            "Number of fastest laps set during races",
  "driver of the day":                       "Times voted Driver of the Day",
  "championships":                           "Championship titles won",
  "champion titles":                         "Number of season champion awards won.",
  "main champion titles":                    "Number of Main League championship titles won.",
  "main 2nd titles":                         "Number of Main League runner-up season finishes.",
  "main 3rd titles":                         "Number of Main League third-place season finishes.",
  "lower champion titles":                   "Number of Lower League championship titles won.",
  "lower 2nd titles":                        "Number of Lower League runner-up season finishes.",
  "lower 3rd titles":                        "Number of Lower League third-place season finishes.",
  "wild champion titles":                    "Number of Wild League championship titles won.",
  "wild 2nd titles":                         "Number of Wild League runner-up season finishes.",
  "wild 3rd titles":                         "Number of Wild League third-place season finishes.",
  "reward podiums":                          "Number of awards for runner-up and third place combined.",
  "best of the rest":                        "Finished 4th overall in a season championship.",
  "cleanest driver":                         "Lowest combined penalty total in a season.",
  "driver of the season":                    "Most Driver of the Day awards in a season.",
  "grid climber":                            "Most positions gained across a season.",
  "mr. consistent":                          "Finished the most races in a season.",
  "most improved":                           "Community vote: Most Improved Driver.",
  "most valuable":                           "Community vote: Most Valuable Driver.",
  "constructors champion":                   "Constructors title count associated with this driver.",
  "dnf":                                     "Did Not Finish — retired from the race",
  "dns":                                     "Did Not Start — entered but didn't take the start",
  "dsq":                                     "Disqualified from the event",

  // ── Driver: Ratings ────────────────────────────────────────────
  "speed":                                   "Raw pace rating based on qualifying and race performance",
  "consistency":                             "How consistently the driver finishes near their average",
  "performance":                             "Overall performance rating combining multiple factors",
  "agility":                                 "Ability to gain positions and adapt during races",
  "driver rating":                           "Composite overall driver skill rating",

  // ── Circuit stats ──────────────────────────────────────────────
  "event held":                              "Total events hosted at this circuit",
  "races held":                              "Number of 50% races held at this circuit",
  "sprints held":                            "Number of sprint races held at this circuit",
  "spots occupied":                          "Total driver entries across all events at this circuit",
  "participation %":                         "Average fill rate of available spots",
  "dry events":                              "Number of events held in dry conditions",
  "de spots occupied":                       "Driver entries in dry events",
  "de participation %":                      "Fill rate for dry events",
  "rainy events":                            "Number of events held in wet conditions",
  "re spots occupied":                       "Driver entries in rainy events",
  "re participation %":                      "Fill rate for rainy events",
  "changing weather events":                 "Events with dynamic weather changes",
  "cwe spots occupied":                      "Driver entries in changing weather events",
  "cwe participation %":                     "Fill rate for changing weather events",

  // ── League stats ───────────────────────────────────────────────
  "amount of races 50%":                     "Number of 50% distance races held",
  "amount of sprints":                       "Number of sprint races held",
  "amount of races 25%":                     "Number of 25% distance races held",
  "playoff events":                          "Number of playoff-format events",
  "total events":                            "Total events held across all formats",
  "# spots in event":                        "Number of available driver slots per event",
  "max spots":                               "Maximum number of driver slots available",
  "avg. participation":                      "Average number of drivers per event",
  "broadcasted events":                      "Events that were live-streamed",
  "events on f123":                          "Events held using F1 23 game",
  "events on f124":                          "Events held using F1 24 game",
  "events on f125":                          "Events held using F1 25 game",
  "safety cars":                             "Total safety car deployments",
  "# safety cars per event":                 "Average safety cars per event",
  "# drivers participating*":               "Unique drivers who participated",
};

/**
 * Look up a tooltip for a metric key/label.
 * Falls back to a generated description if no explicit entry exists.
 */
export function getMetricTooltip(key: string, label: string): string {
  const lk = key.toLowerCase().trim();
  const ll = label.toLowerCase().trim();
  // Try exact key match, then label match
  if (METRIC_TOOLTIPS[lk]) return METRIC_TOOLTIPS[lk];
  if (METRIC_TOOLTIPS[ll]) return METRIC_TOOLTIPS[ll];
  // Try without trailing asterisk
  const stripped = lk.replace(/\*$/, "").trim();
  if (METRIC_TOOLTIPS[stripped]) return METRIC_TOOLTIPS[stripped];
  // Try stripping "event " prefix
  const noPrefix = lk.replace(/^event\s+/, "").trim();
  if (METRIC_TOOLTIPS[noPrefix]) return METRIC_TOOLTIPS[noPrefix];
  // Season columns (Season 1, Season 2, etc.)
  if (/^season\s+\d+$/i.test(key)) return `Number of events at this circuit in ${key}`;
  // Fallback: humanise the key
  return key;
}

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
  // Only treat as percentage if "%" appears at the END of the header
  // (e.g. "Event Participation %", "Top 10 Finishes %").
  // Headers like "25% Races Participation" have "%" in the middle
  // and are absolute counts, not percentages.
  return /\b%\s*$/.test(header.trim());
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
  return Array.from(allKeys).map((key) => {
    const label = cleanLabel(key);
    return {
      key,
      label,
      isPercentage: isPercentageCol(key),
      isRating: RATING_COLS.has(key.toLowerCase().trim()),
      tooltip: getMetricTooltip(key, label),
    };
  });
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
  return Array.from(allKeys).map((key) => {
    const label = cleanLabel(key);
    return {
      key,
      label,
      isPercentage: isPercentageCol(key),
      isRating: false,
      tooltip: getMetricTooltip(key, label),
    };
  });
}

/* ------------------------------------------------------------------ */
/*  Curated "highlight" metrics (top cards row)                        */
/* ------------------------------------------------------------------ */

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
  ["ratings",       "Driver Ratings",         /^(speed|consistency|performance|agility|driver rating)$/i],
  ["participation", "Participation",           /particip|events?\s+(on|held)|races?\s+particip|sprints?\s+particip|25%\s+races/i],
  ["results",       "Race Results",            /wins?|podiums?|top\s+\d|place|finishes|finishing|winning/i],
  ["points",        "Points",                  /points/i],
  ["grid",          "Grid & Qualifying",       /wins?\s+from\s+pole|front\s+row|pole\s+to\s+win|best\s+grid\s+for/i],
  ["positions",     "Positions & Grid",        /position|grid|position changes/i],
  ["streaks",       "Streaks & Records",       /streak|best\s+single\s+race|best\s+finish\s+from|p4\s+finish|seasons?\s+competed/i],
  ["performance",   "Performance Splits",      /over-performance|finish\s+rate|positions?\s+gained|avg\.?\s+points?\s+\(|regular\s+season|playoffs?\)/i],
  ["records",       "Records & Awards",        /fastest|pole|driver of the day|driver of the season|championships?|main champion titles|main 2nd titles|main 3rd titles|lower champion titles|lower 2nd titles|lower 3rd titles|wild champion titles|wild 2nd titles|wild 3rd titles|champion titles|reward podiums|best of the rest|cleanest|grid climber|mr\.?\s*consistent|most improved|most valuable|dnf|dns|dsq/i],
  ["weather",       "Weather",                 /dry|rain|changing weather|wet/i],
  ["racecraft",     "Racecraft & Strategy",    /overtakes?|laps\s+led|pit\s+stops?|steward\s+penalt|game\s+penalt/i],
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
