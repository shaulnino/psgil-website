/* ------------------------------------------------------------------ */
/*  Stats V2 — Auto-generated narrative cards                          */
/*                                                                     */
/*  Rule-based templates that turn metrics into sentences. No LLM.     */
/* ------------------------------------------------------------------ */

import type { DriverMetrics } from "./metrics";
import { DNA_AXIS_LABELS, type DriverDna, topAxes } from "./dna";
import type { Archetype, DriverTier } from "./identity";

export type NarrativeCard = {
  /** Short tag for filtering / icon lookup. */
  kind: "headline" | "strength" | "weakness" | "milestone" | "quirk";
  text: string;
  /** Optional metric/value associated with the line, for emphasis. */
  highlight?: string;
};

function ord(n: number): string {
  const r = n % 100;
  if (r >= 11 && r <= 13) return `${n}th`;
  switch (n % 10) {
    case 1: return `${n}st`;
    case 2: return `${n}nd`;
    case 3: return `${n}rd`;
    default: return `${n}th`;
  }
}

/* ------------------------------------------------------------------ */
/*  Driver narrative                                                    */
/* ------------------------------------------------------------------ */

export function buildDriverNarrative(opts: {
  metrics: DriverMetrics;
  dna: DriverDna;
  tier: DriverTier;
  archetypes: Archetype[];
  rankByMetric?: Partial<Record<keyof DriverMetrics, { rank: number; outOf: number }>>;
}): NarrativeCard[] {
  const { metrics: m, dna, tier, archetypes, rankByMetric } = opts;
  const cards: NarrativeCard[] = [];
  const name = m.driver_name || m.driver_id;

  // Headline
  const top = topAxes(dna, 2);
  const topAxisLabel = top[0] ? DNA_AXIS_LABELS[top[0].axis] : null;
  const archLabel = archetypes[0] ?? null;
  if (tier === "Insufficient Sample") {
    cards.push({
      kind: "headline",
      text: `${name} has only ${m.events} race${m.events === 1 ? "" : "s"} in this scope — too few for a reliable identity read.`,
    });
  } else if (topAxisLabel) {
    cards.push({
      kind: "headline",
      text: `${name} is a ${tier.toLowerCase()}-tier driver whose biggest strength is ${topAxisLabel.toLowerCase()}${
        archLabel ? `, with a clear ${archLabel} profile` : ""
      }.`,
      highlight: tier,
    });
  }

  // Strength
  if (top[0] && top[0].score >= 75) {
    cards.push({
      kind: "strength",
      text: `Top-quartile ${DNA_AXIS_LABELS[top[0].axis].toLowerCase()} (${top[0].score}/100 league percentile).`,
      highlight: `${top[0].score}`,
    });
  }

  // Weakness
  const lows = Object.entries(dna)
    .filter((entry): entry is [string, number] => entry[1] !== null && (entry[1] as number) < 30)
    .map(([k, v]) => ({ axis: k, score: v as number }));
  if (lows.length) {
    const worst = lows.sort((a, b) => a.score - b.score)[0];
    const label = DNA_AXIS_LABELS[worst.axis as keyof typeof DNA_AXIS_LABELS];
    cards.push({
      kind: "weakness",
      text: `Weakest area: ${label.toLowerCase()} (${worst.score}/100).`,
    });
  }

  // Milestones
  if (m.wins >= 1) {
    cards.push({
      kind: "milestone",
      text: `${m.wins} career win${m.wins === 1 ? "" : "s"}, ${m.podiums} podium${m.podiums === 1 ? "" : "s"} across ${m.events} race${m.events === 1 ? "" : "s"}.`,
      highlight: `${m.wins}W / ${m.podiums}P`,
    });
  }
  if (m.poles >= 1 && m.pole_to_win !== null) {
    cards.push({
      kind: "milestone",
      text: `${m.poles} pole${m.poles === 1 ? "" : "s"}, converting ${Math.round(m.pole_to_win * 100)}% to wins.`,
    });
  }

  // Quirks
  if (m.wet_delta !== null && Math.abs(m.wet_delta) >= 1.5) {
    if (m.wet_delta > 0) {
      cards.push({
        kind: "quirk",
        text: `Performs ${m.wet_delta.toFixed(1)} positions better in wet/mixed conditions than in the dry.`,
      });
    } else {
      cards.push({
        kind: "quirk",
        text: `Drops ${Math.abs(m.wet_delta).toFixed(1)} positions in wet/mixed vs. dry conditions.`,
      });
    }
  }

  if (rankByMetric?.total_points) {
    const r = rankByMetric.total_points;
    cards.push({
      kind: "quirk",
      text: `${ord(r.rank)} of ${r.outOf} drivers in total points within this scope.`,
    });
  }

  return cards;
}

/* ------------------------------------------------------------------ */
/*  Season narrative                                                    */
/* ------------------------------------------------------------------ */

export function buildSeasonNarrative(opts: {
  seasonKey: string;
  uniqueWinners: number;
  totalRaces: number;
  championName: string | null;
  competitivenessIndex: number | null;
  dominanceShare: number | null; // % of wins by top driver
}): NarrativeCard[] {
  const { seasonKey, uniqueWinners, totalRaces, championName, competitivenessIndex, dominanceShare } = opts;
  const cards: NarrativeCard[] = [];

  if (championName) {
    cards.push({
      kind: "headline",
      text: `${seasonKey}: ${championName} took the title across ${totalRaces} race${totalRaces === 1 ? "" : "s"}.`,
      highlight: championName,
    });
  }

  if (competitivenessIndex !== null) {
    const tag = competitivenessIndex >= 75 ? "highly competitive"
      : competitivenessIndex >= 55 ? "balanced"
      : "dominated";
    cards.push({
      kind: "strength",
      text: `Season was ${tag} — Competitiveness Index ${competitivenessIndex}/100.`,
      highlight: `${competitivenessIndex}`,
    });
  }

  cards.push({
    kind: "milestone",
    text: `${uniqueWinners} different race winner${uniqueWinners === 1 ? "" : "s"} across the season.`,
  });

  if (dominanceShare !== null && dominanceShare >= 0.5) {
    cards.push({
      kind: "quirk",
      text: `Top driver won ${Math.round(dominanceShare * 100)}% of races — high dominance.`,
    });
  }

  return cards;
}
