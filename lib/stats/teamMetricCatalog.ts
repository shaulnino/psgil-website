/* ------------------------------------------------------------------ */
/*  Team metric catalog                                                */
/*                                                                     */
/*  Central, typed definitions for every team-level metric surfaced in */
/*  the Teams tab: its i18n key id and unit. Labels + tooltips live in */
/*  messages/{en,he}/stats.json under `teams.metrics.<id>.{label,      */
/*  tooltip}` — never hardcoded in the UI. Formatting is shared with    */
/*  the other tabs via `formatMetric`.                                 */
/* ------------------------------------------------------------------ */

import type { MetricUnit } from "@/lib/stats/metricCatalog";

export type TeamMetricDef = {
  /** i18n id under stats.teams.metrics.<id> */
  id: string;
  unit: MetricUnit;
  /** Higher value is better (for leaderboard sort hints / highlighting). */
  higherBetter: boolean;
};

export const TEAM_METRIC_CATALOG: Record<string, TeamMetricDef> = {
  // Snapshot / context
  seasons: { id: "seasons", unit: "int", higherBetter: true },
  races: { id: "races", unit: "int", higherBetter: true },
  entries: { id: "entries", unit: "int", higherBetter: true },
  championshipPosition: { id: "championshipPosition", unit: "pos", higherBetter: false },
  bestChampPosition: { id: "bestChampPosition", unit: "pos", higherBetter: false },

  // Performance
  points: { id: "points", unit: "int", higherBetter: true },
  pointsPerRace: { id: "pointsPerRace", unit: "dec", higherBetter: true },
  wins: { id: "wins", unit: "int", higherBetter: true },
  winRate: { id: "winRate", unit: "pct", higherBetter: true },
  podiums: { id: "podiums", unit: "int", higherBetter: true },
  poles: { id: "poles", unit: "int", higherBetter: true },
  poleRate: { id: "poleRate", unit: "pct", higherBetter: true },
  fastestLaps: { id: "fastestLaps", unit: "int", higherBetter: true },
  dotd: { id: "dotd", unit: "int", higherBetter: true },
  avgFinish: { id: "avgFinish", unit: "dec", higherBetter: false },
  bestFinish: { id: "bestFinish", unit: "pos", higherBetter: false },
  doublePodiums: { id: "doublePodiums", unit: "int", higherBetter: true },
  oneTwoFinishes: { id: "oneTwoFinishes", unit: "int", higherBetter: true },

  // Qualifying
  avgGrid: { id: "avgGrid", unit: "dec", higherBetter: false },
  frontRowStarts: { id: "frontRowStarts", unit: "int", higherBetter: true },
  avgNetMovement: { id: "avgNetMovement", unit: "delta", higherBetter: true },

  // Reliability & discipline
  dnf: { id: "dnf", unit: "int", higherBetter: false },
  dnfRate: { id: "dnfRate", unit: "pct", higherBetter: false },
  classificationRate: { id: "classificationRate", unit: "pct", higherBetter: true },
  cleanEntryRate: { id: "cleanEntryRate", unit: "pct", higherBetter: true },
  stewardSecondsPerRace: { id: "stewardSecondsPerRace", unit: "sec", higherBetter: false },
  gameSecondsPerRace: { id: "gameSecondsPerRace", unit: "sec", higherBetter: false },

  // Lineup & contribution
  pointsShare: { id: "pointsShare", unit: "pct", higherBetter: true },
};
