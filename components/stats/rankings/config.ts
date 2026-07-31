/* ------------------------------------------------------------------ */
/*  Rankings metric configuration                                      */
/*                                                                     */
/*  Declares which metrics appear in each Rankings category, their     */
/*  sort direction, unit, whether they are sample-gated, and where     */
/*  their label/tooltip live in the i18n catalog. Catalog-backed ids   */
/*  reuse `metrics.<id>`; virtual ids (recent form, ratings splits)    */
/*  use `rankingsTab.metrics.<id>`.                                    */
/* ------------------------------------------------------------------ */

import { METRIC_CATALOG, type MetricUnit } from "@/lib/stats/metricCatalog";

export type RankingMetric = {
  id: string;
  /** true -> requires MIN_SAMPLE starts to be ranked. */
  gated: boolean;
};

export type RankingCategory = {
  id: string;
  metrics: RankingMetric[];
};

/** Categories shown in the Rankings selector, in display order. */
export const RANKING_CATEGORIES: RankingCategory[] = [
  {
    id: "results",
    metrics: [
      { id: "points", gated: false },
      { id: "wins", gated: false },
      { id: "podiums", gated: false },
      { id: "top5", gated: false },
      { id: "top10", gated: false },
      { id: "pointsFinishes", gated: false },
      { id: "poles", gated: false },
      { id: "fastestLaps", gated: false },
      { id: "dotd", gated: false },
      { id: "bestFinish", gated: false },
    ],
  },
  {
    id: "rates",
    metrics: [
      { id: "winRate", gated: true },
      { id: "podiumRate", gated: true },
      { id: "top5Rate", gated: true },
      { id: "pointsRate", gated: true },
      { id: "poleRate", gated: true },
      { id: "pointsPerStart", gated: true },
    ],
  },
  {
    id: "qualifying",
    metrics: [
      { id: "avgGrid", gated: true },
      { id: "bestGrid", gated: false },
      { id: "poles", gated: false },
    ],
  },
  {
    id: "race",
    metrics: [
      { id: "avgFinish", gated: true },
      { id: "medianFinish", gated: true },
      { id: "netPositions", gated: false },
      { id: "avgNetPerRace", gated: true },
      { id: "bestRecovery", gated: false },
    ],
  },
  {
    id: "reliability",
    metrics: [
      { id: "finishRate", gated: true },
      { id: "dnfRate", gated: true },
      { id: "finishStreakBest", gated: false },
      { id: "pointsStreakBest", gated: false },
    ],
  },
  {
    id: "recent",
    metrics: [
      { id: "recentPoints", gated: false },
      { id: "recentAvgFinish", gated: false },
      { id: "recentNet", gated: false },
    ],
  },
  {
    id: "discipline",
    metrics: [
      { id: "cleanRacePct", gated: true },
      { id: "dnfRate", gated: true },
    ],
  },
  {
    id: "ratings",
    metrics: [
      { id: "driverRating", gated: false },
      { id: "speed", gated: false },
      { id: "consistency", gated: false },
      { id: "performance", gated: false },
      { id: "agility", gated: false },
    ],
  },
];

/** Virtual metrics not present in METRIC_CATALOG. */
const VIRTUAL_META: Record<
  string,
  { unit: MetricUnit; higherBetter: boolean; virtual: true }
> = {
  recentPoints: { unit: "int", higherBetter: true, virtual: true },
  recentAvgFinish: { unit: "dec", higherBetter: false, virtual: true },
  recentNet: { unit: "delta", higherBetter: true, virtual: true },
  speed: { unit: "int", higherBetter: true, virtual: true },
  consistency: { unit: "int", higherBetter: true, virtual: true },
  performance: { unit: "int", higherBetter: true, virtual: true },
  agility: { unit: "int", higherBetter: true, virtual: true },
};

/** Rating metric ids resolve to Engine A dataset columns (scope-only). */
export const RATING_ENGINE_A_KEY: Record<string, string> = {
  driverRating: "Driver Rating",
  speed: "Speed",
  consistency: "Consistency",
  performance: "Performance",
  agility: "Agility",
};

export const RATING_METRIC_IDS = new Set(Object.keys(RATING_ENGINE_A_KEY));

export type MetricMeta = {
  id: string;
  unit: MetricUnit;
  higherBetter: boolean;
  /** i18n label/tooltip path prefix. */
  labelKey: string;
  gated: boolean;
  isRating: boolean;
};

/** Resolve display + sort metadata for a metric id. */
export function metricMeta(id: string, gated: boolean): MetricMeta {
  const cat = METRIC_CATALOG[id];
  if (cat) {
    return {
      id,
      unit: cat.unit,
      higherBetter: cat.higherBetter,
      labelKey: `metrics.${id}`,
      gated,
      isRating: RATING_METRIC_IDS.has(id),
    };
  }
  const v = VIRTUAL_META[id];
  return {
    id,
    unit: v?.unit ?? "int",
    higherBetter: v?.higherBetter ?? true,
    labelKey: `rankingsTab.metrics.${id}`,
    gated,
    isRating: RATING_METRIC_IDS.has(id),
  };
}
