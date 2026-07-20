/* ------------------------------------------------------------------ */
/*  Metric catalog                                                     */
/*                                                                     */
/*  Central, typed definitions for every metric surfaced in the        */
/*  redesigned Drivers tab: its i18n key id, unit, and whether higher  */
/*  is better (for compare leader highlighting). Formatting is         */
/*  locale-aware. Labels/tooltips live in messages/{en,he}/stats.json  */
/*  under `metrics.<id>.{label,tooltip}` — never hardcoded in the UI.   */
/* ------------------------------------------------------------------ */

export type MetricUnit =
  | "int" // whole number (counts)
  | "dec" // 1-2 decimal places
  | "pct" // percentage
  | "sec" // seconds (penalties)
  | "pos" // finishing/grid position (whole)
  | "delta"; // signed position change (+/-)

export type MetricDef = {
  /** i18n id under stats.metrics.<id> */
  id: string;
  unit: MetricUnit;
  /** Higher value is better (used for compare leader highlight). */
  higherBetter: boolean;
};

/**
 * Metrics referenced by the redesigned Drivers tab. Keys are stable ids
 * used both for React keys and for i18n (`metrics.<id>.label`).
 */
export const METRIC_CATALOG: Record<string, MetricDef> = {
  // Snapshot
  starts: { id: "starts", unit: "int", higherBetter: true },
  entries: { id: "entries", unit: "int", higherBetter: true },
  classified: { id: "classified", unit: "int", higherBetter: true },
  wins: { id: "wins", unit: "int", higherBetter: true },
  podiums: { id: "podiums", unit: "int", higherBetter: true },
  points: { id: "points", unit: "int", higherBetter: true },
  pointsPerStart: { id: "pointsPerStart", unit: "dec", higherBetter: true },
  avgFinish: { id: "avgFinish", unit: "dec", higherBetter: false },
  finishRate: { id: "finishRate", unit: "pct", higherBetter: true },
  driverRating: { id: "driverRating", unit: "int", higherBetter: true },
  championshipPos: { id: "championshipPos", unit: "pos", higherBetter: false },

  // Results & achievements
  top5: { id: "top5", unit: "int", higherBetter: true },
  top10: { id: "top10", unit: "int", higherBetter: true },
  pointsFinishes: { id: "pointsFinishes", unit: "int", higherBetter: true },
  poles: { id: "poles", unit: "int", higherBetter: true },
  fastestLaps: { id: "fastestLaps", unit: "int", higherBetter: true },
  dotd: { id: "dotd", unit: "int", higherBetter: true },
  winRate: { id: "winRate", unit: "pct", higherBetter: true },
  podiumRate: { id: "podiumRate", unit: "pct", higherBetter: true },
  top5Rate: { id: "top5Rate", unit: "pct", higherBetter: true },
  top10Rate: { id: "top10Rate", unit: "pct", higherBetter: true },
  pointsRate: { id: "pointsRate", unit: "pct", higherBetter: true },
  poleRate: { id: "poleRate", unit: "pct", higherBetter: true },
  bestFinish: { id: "bestFinish", unit: "pos", higherBetter: false },
  bestGrid: { id: "bestGrid", unit: "pos", higherBetter: false },

  // Grid & racecraft
  avgGrid: { id: "avgGrid", unit: "dec", higherBetter: false },
  medianFinish: { id: "medianFinish", unit: "dec", higherBetter: false },
  netPositions: { id: "netPositions", unit: "delta", higherBetter: true },
  avgNetPerRace: { id: "avgNetPerRace", unit: "dec", higherBetter: true },
  racesGained: { id: "racesGained", unit: "int", higherBetter: true },
  racesLost: { id: "racesLost", unit: "int", higherBetter: false },
  bestRecovery: { id: "bestRecovery", unit: "delta", higherBetter: true },
  worstLoss: { id: "worstLoss", unit: "delta", higherBetter: true },

  // Consistency & reliability
  dnf: { id: "dnf", unit: "int", higherBetter: false },
  dns: { id: "dns", unit: "int", higherBetter: false },
  dsq: { id: "dsq", unit: "int", higherBetter: false },
  dnfRate: { id: "dnfRate", unit: "pct", higherBetter: false },
  stdevFinish: { id: "stdevFinish", unit: "dec", higherBetter: false },
  finishStreakBest: { id: "finishStreakBest", unit: "int", higherBetter: true },
  pointsStreakBest: { id: "pointsStreakBest", unit: "int", higherBetter: true },
  podiumStreakBest: { id: "podiumStreakBest", unit: "int", higherBetter: true },
  winStreakBest: { id: "winStreakBest", unit: "int", higherBetter: true },

  // Discipline
  penaltySeconds: { id: "penaltySeconds", unit: "sec", higherBetter: false },
  penaltiesPerStart: { id: "penaltiesPerStart", unit: "dec", higherBetter: false },
  cleanRaces: { id: "cleanRaces", unit: "int", higherBetter: true },
  cleanRacePct: { id: "cleanRacePct", unit: "pct", higherBetter: true },
  penaltyRate: { id: "penaltyRate", unit: "pct", higherBetter: false },
};

/* ------------------------------------------------------------------ */
/*  Locale-aware formatting                                             */
/* ------------------------------------------------------------------ */

/**
 * Format a metric value for display. Returns a neutral placeholder when the
 * value is unavailable (null/undefined) so the UI never shows a misleading 0.
 */
export function formatMetric(
  value: number | null | undefined,
  unit: MetricUnit,
  locale: string,
  placeholder = "—",
): string {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return placeholder;
  }
  const nf = (opts: Intl.NumberFormatOptions) =>
    new Intl.NumberFormat(locale, opts).format(value);

  switch (unit) {
    case "int":
      return nf({ maximumFractionDigits: 0 });
    case "pos":
      return nf({ maximumFractionDigits: 0 });
    case "dec":
      return nf({ minimumFractionDigits: 0, maximumFractionDigits: 2 });
    case "pct":
      return `${nf({ minimumFractionDigits: 0, maximumFractionDigits: 1 })}%`;
    case "sec": {
      const s = new Intl.NumberFormat(locale, {
        minimumFractionDigits: 0,
        maximumFractionDigits: 1,
      }).format(value);
      return `${s}s`;
    }
    case "delta": {
      const sign = value > 0 ? "+" : "";
      return `${sign}${nf({ maximumFractionDigits: 0 })}`;
    }
    default:
      return String(value);
  }
}
