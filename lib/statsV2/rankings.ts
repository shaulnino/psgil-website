/* ------------------------------------------------------------------ */
/*  Stats V2 — Ranking studio                                          */
/*                                                                     */
/*  Pre-built rankings + a custom builder that lets users compose      */
/*  their own leaderboard from any combination of metrics.             */
/* ------------------------------------------------------------------ */

import type { DriverMetrics } from "./metrics";

export type RankingDirection = "high" | "low";

export type RankingSpec = {
  id: string;
  label: string;
  description: string;
  /** Numeric metric key on DriverMetrics. */
  metric: keyof DriverMetrics;
  direction: RankingDirection;
  /** Minimum events filter override (or use global filter min). */
  minEvents?: number;
};

export const RANKING_TEMPLATES: RankingSpec[] = [
  {
    id: "pace",
    label: "Pace Rankings",
    description: "Highest Pace Index — best average finish, normalised to field strength.",
    metric: "pace_index",
    direction: "high",
    minEvents: 3,
  },
  {
    id: "racecraft",
    label: "Race Craft",
    description: "Best at gaining positions on the racing line, weighted by start position.",
    metric: "race_craft_score",
    direction: "high",
    minEvents: 3,
  },
  {
    id: "wet",
    label: "Wet Specialists",
    description: "Drivers who outperform their dry baseline in wet/mixed conditions.",
    metric: "wet_delta",
    direction: "high",
    minEvents: 5,
  },
  {
    id: "iron",
    label: "Iron Drivers",
    description: "Highest finish rate across many races.",
    metric: "finish_rate",
    direction: "high",
    minEvents: 10,
  },
  {
    id: "clutch",
    label: "Clutch Closers",
    description: "Best position-change performance in the closing stages.",
    metric: "clutch_score",
    direction: "high",
    minEvents: 3,
  },
  {
    id: "conversion",
    label: "Conversion Kings",
    description: "Best at turning poles into wins.",
    metric: "pole_to_win",
    direction: "high",
    minEvents: 1,
  },
  {
    id: "giant",
    label: "Giant Slayers",
    description: "Most positions gained vs. starting grid (raw).",
    metric: "avg_position_change",
    direction: "high",
    minEvents: 3,
  },
  {
    id: "chaos",
    label: "Chaos Magnets",
    description: "Most steward penalty points per race (lower-is-better leaderboard).",
    metric: "steward_penalty_points",
    direction: "high",
    minEvents: 3,
  },
  {
    id: "wins",
    label: "Wins Leaderboard",
    description: "Classic win count.",
    metric: "wins",
    direction: "high",
  },
  {
    id: "podiums",
    label: "Podiums Leaderboard",
    description: "Classic podium count.",
    metric: "podiums",
    direction: "high",
  },
  {
    id: "points",
    label: "Total Points",
    description: "All-time / scope-filtered points.",
    metric: "total_points",
    direction: "high",
  },
  {
    id: "pap",
    label: "Peer-Adjusted Points",
    description: "Points scored vs. expected for grid slots — over/underperformance.",
    metric: "peer_adjusted_points",
    direction: "high",
    minEvents: 3,
  },
];

export type RankingRow = {
  rank: number;
  driver_id: string;
  driver_name: string;
  team: string;
  value: number | null;
};

/* ------------------------------------------------------------------ */

export function applyRanking(
  metrics: DriverMetrics[],
  spec: RankingSpec,
  globalMinSample: number = 1,
): RankingRow[] {
  const minE = Math.max(spec.minEvents ?? 1, globalMinSample);
  const eligible = metrics.filter((m) => m.events >= minE);

  const withVal = eligible
    .map((m) => ({
      driver_id: m.driver_id,
      driver_name: m.driver_name || m.driver_id,
      team: m.team,
      value: m[spec.metric] as number | null,
    }))
    .filter((r) => typeof r.value === "number")
    .sort((a, b) => {
      const av = a.value as number;
      const bv = b.value as number;
      return spec.direction === "high" ? bv - av : av - bv;
    });

  // Dense ranking (ties share rank, next rank skips)
  let lastVal: number | null = null;
  let lastRank = 0;
  let seen = 0;
  return withVal.map((r) => {
    seen++;
    if (lastVal !== r.value) {
      lastRank = seen;
      lastVal = r.value;
    }
    return {
      rank: lastRank,
      driver_id: r.driver_id,
      driver_name: r.driver_name,
      team: r.team,
      value: r.value,
    };
  });
}

/* ------------------------------------------------------------------ */
/*  Custom (weighted) ranking builder                                   */
/* ------------------------------------------------------------------ */

export type CustomRankingComponent = {
  metric: keyof DriverMetrics;
  weight: number; // any positive number, normalised internally
  direction: RankingDirection;
};

/**
 * Compose a custom ranking from N metrics + weights. Each component is
 * percentile-normalised within the eligible population, then weighted-summed.
 */
export function applyCustomRanking(
  metrics: DriverMetrics[],
  components: CustomRankingComponent[],
  globalMinSample: number = 1,
): RankingRow[] {
  if (components.length === 0) return [];
  const eligible = metrics.filter((m) => m.events >= globalMinSample);
  const weightSum = components.reduce((s, c) => s + c.weight, 0);
  if (weightSum === 0) return [];

  // Pre-compute sorted arrays per metric for percentile calculation
  const sortedByMetric = new Map<keyof DriverMetrics, number[]>();
  for (const c of components) {
    const vals = eligible
      .map((m) => m[c.metric])
      .filter((v): v is number => typeof v === "number")
      .sort((a, b) => a - b);
    sortedByMetric.set(c.metric, vals);
  }

  const scored = eligible.map((m) => {
    let composite = 0;
    let included = 0;
    for (const c of components) {
      const v = m[c.metric];
      if (typeof v !== "number") continue;
      const sorted = sortedByMetric.get(c.metric)!;
      if (sorted.length === 0) continue;
      let i = 0;
      while (i < sorted.length && sorted[i] < v) i++;
      const pct = (i / Math.max(1, sorted.length - 1)) * 100;
      const score = c.direction === "high" ? pct : 100 - pct;
      composite += score * (c.weight / weightSum);
      included++;
    }
    return {
      driver_id: m.driver_id,
      driver_name: m.driver_name || m.driver_id,
      team: m.team,
      value: included > 0 ? Math.round(composite * 10) / 10 : null,
    };
  });

  const sorted = scored
    .filter((r) => r.value !== null)
    .sort((a, b) => (b.value as number) - (a.value as number));

  let lastVal: number | null = null;
  let lastRank = 0;
  let seen = 0;
  return sorted.map((r) => {
    seen++;
    if (lastVal !== r.value) {
      lastRank = seen;
      lastVal = r.value;
    }
    return {
      rank: lastRank,
      driver_id: r.driver_id,
      driver_name: r.driver_name,
      team: r.team,
      value: r.value,
    };
  });
}
