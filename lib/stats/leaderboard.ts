/* ------------------------------------------------------------------ */
/*  Rankings leaderboard selector                                      */
/*                                                                     */
/*  Produces one row per driver for the Rankings tab. Every value is   */
/*  taken from computeDriverProfile so a ranked value is provably       */
/*  identical to the same driver's Drivers-tab profile under the same   */
/*  scope + filters (see tests/stats/leaderboard.test.ts).             */
/*                                                                     */
/*  Locked rules (cross-tab statistical contract):                     */
/*   - Denominator for rates/averages = STARTS (entries - DNS).        */
/*   - Classified finish = status "finished" (DNF/DNS/DSQ excluded).   */
/*   - Grid/pole exclude reverse-grid events.                          */
/*   - Records/streaks here follow the active scope+filters.           */
/*   - MIN_SAMPLE gates rate/average metrics.                          */
/* ------------------------------------------------------------------ */

import {
  computeDriverProfile,
  MIN_SAMPLE,
  RECENT_FORM_WINDOW,
} from "@/lib/stats/driverProfile";
import type { NormalizedRace, ProfileFilters } from "@/lib/stats/normalizeRace";

export { MIN_SAMPLE, RECENT_FORM_WINDOW };

/** One driver's aggregate row for the leaderboard. */
export type LeaderboardRow = {
  driverId: string;
  driverName: string;
  team: string | null;
  starts: number;
  entries: number;
  /** metric id -> value (null when unavailable). */
  values: Record<string, number | null>;
};

/**
 * Build the leaderboard from the normalized dataset for the given scope +
 * filters. Drivers with no entries in the scope are omitted.
 */
export function computeLeaderboard(
  allRaces: NormalizedRace[],
  filters: ProfileFilters,
): LeaderboardRow[] {
  const names = new Set<string>();
  for (const r of allRaces) {
    const n = r.driverName.trim();
    if (n) names.add(n);
  }

  const rows: LeaderboardRow[] = [];
  for (const name of names) {
    const p = computeDriverProfile(allRaces, name, filters);
    if (!p || p.entries === 0) continue;

    rows.push({
      driverId: p.driverId,
      driverName: p.driverName,
      team: p.team,
      starts: p.starts,
      entries: p.entries,
      values: {
        // Results & achievements
        wins: p.results.wins,
        podiums: p.results.podiums,
        top5: p.results.top5,
        top10: p.results.top10,
        pointsFinishes: p.results.pointsFinishes,
        poles: p.results.poles,
        fastestLaps: p.results.fastestLaps,
        dotd: p.results.dotd,
        bestFinish: p.results.bestFinish,
        points: p.points,
        // Performance rates
        winRate: p.results.winRate,
        podiumRate: p.results.podiumRate,
        top5Rate: p.results.top5Rate,
        pointsRate: p.results.pointsRate,
        poleRate: p.results.poleRate,
        pointsPerStart: p.pointsPerStart,
        // Qualifying
        avgGrid: p.racecraft.avgGrid,
        bestGrid: p.results.bestGrid,
        // Race performance
        avgFinish: p.avgFinish,
        medianFinish: p.racecraft.medianFinish,
        netPositions: p.racecraft.netPositions,
        avgNetPerRace: p.racecraft.avgNetPerRace,
        bestRecovery: p.racecraft.bestRecovery?.value ?? null,
        // Reliability
        finishRate: p.consistency.finishRate,
        dnfRate: p.consistency.dnfRate,
        finishStreakBest: p.consistency.streaks.finishBest,
        pointsStreakBest: p.consistency.streaks.pointsBest,
        // Recent form (last N starts, within scope)
        recentPoints: p.recentForm.points,
        recentAvgFinish: p.recentForm.avgFinish,
        recentNet: p.recentForm.netPositions,
        // Discipline (positive framing)
        cleanRacePct: p.discipline.cleanRacePct,
      },
    });
  }

  return rows;
}

/* ------------------------------------------------------------------ */
/*  Competition ranking + minimum-sample gating                        */
/* ------------------------------------------------------------------ */

export type RankedEntry = {
  rank: number;
  row: LeaderboardRow;
  value: number;
};

export type RankedLeaderboard = {
  /** Drivers with data and (for gated metrics) a sufficient sample. */
  qualified: RankedEntry[];
  /** Drivers below the minimum sample for a gated metric (unranked). */
  insufficient: { row: LeaderboardRow; value: number }[];
};

/**
 * Rank rows by one metric using standard competition ranking (1, 2, 2, 4).
 * Equal (unrounded) values share a rank; the next rank skips accordingly.
 * A localized display order is applied only within an equal-value group and
 * never changes the rank itself.
 *
 * @param gated  when true, rows with fewer than MIN_SAMPLE starts are moved to
 *               `insufficient` instead of being ranked.
 * @param higherBetter sort direction.
 * @param collator locale-aware collator for the within-tie display order.
 */
export function rankLeaderboard(
  rows: LeaderboardRow[],
  metricId: string,
  higherBetter: boolean,
  gated: boolean,
  collator: Intl.Collator,
): RankedLeaderboard {
  const withValue: { row: LeaderboardRow; value: number }[] = [];
  const insufficient: { row: LeaderboardRow; value: number }[] = [];

  for (const row of rows) {
    const v = row.values[metricId];
    if (v === null || v === undefined || Number.isNaN(v)) continue;
    if (gated && row.starts < MIN_SAMPLE) {
      insufficient.push({ row, value: v });
      continue;
    }
    withValue.push({ row, value: v });
  }

  withValue.sort((a, b) => {
    if (a.value !== b.value) return higherBetter ? b.value - a.value : a.value - b.value;
    return collator.compare(a.row.driverName, b.row.driverName);
  });

  const qualified: RankedEntry[] = [];
  for (let i = 0; i < withValue.length; i++) {
    const cur = withValue[i];
    // Standard competition ranking: share the rank of the first equal value.
    const rank =
      i > 0 && withValue[i - 1].value === cur.value ? qualified[i - 1].rank : i + 1;
    qualified.push({ rank, row: cur.row, value: cur.value });
  }

  insufficient.sort((a, b) => {
    if (a.value !== b.value) return higherBetter ? b.value - a.value : a.value - b.value;
    return collator.compare(a.row.driverName, b.row.driverName);
  });

  return { qualified, insufficient };
}
