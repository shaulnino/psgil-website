/* ------------------------------------------------------------------ */
/*  Circuit metric catalog                                             */
/*                                                                     */
/*  Central, typed definitions for every metric surfaced in the        */
/*  redesigned Circuits tab. Mirrors lib/stats/metricCatalog.ts:        */
/*  each entry carries its i18n id, unit and higher-is-better flag.     */
/*  Labels/tooltips live in messages/{en,he}/stats.json under           */
/*  `circuitsTab.metrics.<id>.{label,tooltip}` — never hardcoded.       */
/* ------------------------------------------------------------------ */

import type { MetricDef } from "@/lib/stats/metricCatalog";

export const CIRCUIT_METRIC_CATALOG: Record<string, MetricDef> = {
  // ── Snapshot ────────────────────────────────────────────────
  islRaces: { id: "islRaces", unit: "int", higherBetter: true },
  seasonsFeatured: { id: "seasonsFeatured", unit: "int", higherBetter: true },
  uniqueWinners: { id: "uniqueWinners", unit: "int", higherBetter: true },
  uniquePoleSitters: { id: "uniquePoleSitters", unit: "int", higherBetter: true },
  avgFieldSize: { id: "avgFieldSize", unit: "dec", higherBetter: true },
  classificationRate: { id: "classificationRate", unit: "pct", higherBetter: true },
  dnfRate: { id: "dnfRate", unit: "pct", higherBetter: false },

  // ── Qualifying vs race ──────────────────────────────────────
  poleToWinRate: { id: "poleToWinRate", unit: "pct", higherBetter: true },
  frontRowToWinRate: { id: "frontRowToWinRate", unit: "pct", higherBetter: true },
  frontRowToPodiumRate: { id: "frontRowToPodiumRate", unit: "pct", higherBetter: true },
  avgWinningGrid: { id: "avgWinningGrid", unit: "dec", higherBetter: false },
  avgPodiumGrid: { id: "avgPodiumGrid", unit: "dec", higherBetter: false },

  // ── Race characteristics / movement ─────────────────────────
  avgAbsMovement: { id: "avgAbsMovement", unit: "dec", higherBetter: true },
  avgNetMovement: { id: "avgNetMovement", unit: "delta", higherBetter: true },
  pctImproved: { id: "pctImproved", unit: "pct", higherBetter: true },
  bestRecovery: { id: "bestRecovery", unit: "delta", higherBetter: true },
  worstLoss: { id: "worstLoss", unit: "delta", higherBetter: true },

  // ── Conditions & discipline ─────────────────────────────────
  wetRate: { id: "wetRate", unit: "pct", higherBetter: true },
  safetyCarRate: { id: "safetyCarRate", unit: "pct", higherBetter: true },
  cleanRaceRate: { id: "cleanRaceRate", unit: "pct", higherBetter: true },
  penaltiesPerRace: { id: "penaltiesPerRace", unit: "dec", higherBetter: false },

  // ── Specialists table columns ───────────────────────────────
  starts: { id: "starts", unit: "int", higherBetter: true },
  wins: { id: "wins", unit: "int", higherBetter: true },
  podiums: { id: "podiums", unit: "int", higherBetter: true },
  poles: { id: "poles", unit: "int", higherBetter: true },
  podiumRate: { id: "podiumRate", unit: "pct", higherBetter: true },
  pointsPerStart: { id: "pointsPerStart", unit: "dec", higherBetter: true },
  avgFinish: { id: "avgFinish", unit: "dec", higherBetter: false },
  bestFinish: { id: "bestFinish", unit: "pos", higherBetter: false },
  netPositions: { id: "netPositions", unit: "delta", higherBetter: true },
};
