/* ------------------------------------------------------------------ */
/*  League metric catalog                                              */
/*                                                                     */
/*  Central, typed definitions for every league-level metric surfaced */
/*  in the redesigned League tab: its i18n key id and unit. Labels and */
/*  tooltips live in messages/{en,he}/stats.json under                 */
/*  `league.metrics.<id>.{label,tooltip}` — never hardcoded in the UI. */
/*  Formatting is shared with the Drivers tab via `formatMetric`.      */
/* ------------------------------------------------------------------ */

import type { MetricUnit } from "@/lib/stats/metricCatalog";

export type LeagueMetricDef = {
  /** i18n id under stats.league.metrics.<id> */
  id: string;
  unit: MetricUnit;
};

/**
 * Every league metric id. Keys are stable ids used for React keys and i18n.
 */
export const LEAGUE_METRIC_CATALOG: Record<string, LeagueMetricDef> = {
  // Pulse / snapshot
  seasons: { id: "seasons", unit: "int" },
  races: { id: "races", unit: "int" },
  uniqueDrivers: { id: "uniqueDrivers", unit: "int" },
  uniqueTeams: { id: "uniqueTeams", unit: "int" },
  totalPoints: { id: "totalPoints", unit: "int" },
  differentWinners: { id: "differentWinners", unit: "int" },
  avgStarters: { id: "avgStarters", unit: "dec" },

  // Competitive balance
  differentPodium: { id: "differentPodium", unit: "int" },
  differentPoles: { id: "differentPoles", unit: "int" },
  topDriverWinShare: { id: "topDriverWinShare", unit: "pct" },
  leadChanges: { id: "leadChanges", unit: "int" },

  // How races unfold
  avgWinningGrid: { id: "avgWinningGrid", unit: "dec" },
  poleToWinRate: { id: "poleToWinRate", unit: "pct" },
  winsFromOutsideTop3: { id: "winsFromOutsideTop3", unit: "int" },
  avgAbsPositionChange: { id: "avgAbsPositionChange", unit: "dec" },

  // Grid health & participation
  maxGrid: { id: "maxGrid", unit: "int" },
  minGrid: { id: "minGrid", unit: "int" },
  completionRate: { id: "completionRate", unit: "pct" },
  avgClassified: { id: "avgClassified", unit: "dec" },

  // Reliability & discipline
  classificationRate: { id: "classificationRate", unit: "pct" },
  dnfRate: { id: "dnfRate", unit: "pct" },
  dnsRate: { id: "dnsRate", unit: "pct" },
  dsqRate: { id: "dsqRate", unit: "pct" },
  penaltyRate: { id: "penaltyRate", unit: "pct" },
  cleanRaceRate: { id: "cleanRaceRate", unit: "pct" },
  penaltySecondsPerRace: { id: "penaltySecondsPerRace", unit: "sec" },
  stewardSecondsPerRace: { id: "stewardSecondsPerRace", unit: "sec" },
  gameSecondsPerRace: { id: "gameSecondsPerRace", unit: "sec" },

  // Facts (operational, demoted)
  safetyCars: { id: "safetyCars", unit: "int" },
  reverseGridEvents: { id: "reverseGridEvents", unit: "int" },
  broadcastedEvents: { id: "broadcastedEvents", unit: "int" },
};
