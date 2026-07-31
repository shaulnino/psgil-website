/* ------------------------------------------------------------------ */
/*  Driver quick-stats from the shared /stats engine                   */
/*                                                                     */
/*  The driver modal (on /drivers) must show the SAME numbers as the   */
/*  /stats Drivers tab. Both now derive their snapshot stats from a     */
/*  single engine: computeDriverProfile (starts-based denominators,     */
/*  transparent DNS/DNF handling). This module recomputes the eight     */
/*  quick-stat fields (+ events) the modal reads and overwrites the     */
/*  statsComputed-sourced values on each Driver, per scope.             */
/*                                                                     */
/*  Ratings (speed/consistency/performance/agility/overall) still come  */
/*  from computeDriverStats and are merged separately — that is already */
/*  what the /stats tab uses, so ratings stay consistent between the    */
/*  two surfaces. Only the raw quick-stats are unified here.            */
/*                                                                     */
/*  Server-only: pulls in the full stats engine, so it must never be    */
/*  imported into a client component (unlike lib/driversData.ts).       */
/* ------------------------------------------------------------------ */

import type { Driver, CompetitionStats } from "@/lib/driversData";
import {
  computeDriverProfile,
  type DriverProfile,
} from "@/lib/stats/driverProfile";
import type { NormalizedRace, ProfileFilters } from "@/lib/stats/normalizeRace";

/** The nine quick-stat fields the modal renders, as display strings. */
type StatStrings = {
  events?: string;
  points?: string;
  wins?: string;
  podiums?: string;
  poles?: string;
  avg_finish?: string;
  dnfs?: string;
  avg_grid?: string;
  avg_points?: string;
};

const STAT_KEYS: (keyof StatStrings)[] = [
  "events",
  "points",
  "wins",
  "podiums",
  "poles",
  "avg_finish",
  "dnfs",
  "avg_grid",
  "avg_points",
];

/** Numeric → string, preserving full precision; undefined for null/NaN. */
function numStr(v: number | null | undefined): string | undefined {
  return v == null || Number.isNaN(v) ? undefined : String(v);
}

/**
 * Map a computed profile to the modal's quick-stat fields. Mirrors exactly
 * what the /stats SnapshotSection surfaces:
 *   points / wins / podiums / poles → profile counts
 *   avg_finish  → profile.avgFinish (classified finishes only)
 *   avg_grid    → profile.racecraft.avgGrid (excl. reverse grid)
 *   avg_points  → profile.pointsPerStart (points ÷ starts)
 *   dnfs        → profile.consistency.dnf
 *   events      → profile.entries (weekend entries, incl. DNS)
 */
function profileToStats(p: DriverProfile): StatStrings {
  return {
    events: String(p.entries),
    points: String(p.points),
    wins: String(p.wins),
    podiums: String(p.podiums),
    poles: String(p.results.poles),
    avg_finish: numStr(p.avgFinish),
    dnfs: String(p.consistency.dnf),
    avg_grid: numStr(p.racecraft.avgGrid),
    avg_points: numStr(p.pointsPerStart),
  };
}

/** Write the quick-stat fields onto a Driver under a scope prefix (""/"season_"). */
function applyFlat(target: Record<string, unknown>, prefix: string, s: StatStrings): void {
  for (const k of STAT_KEYS) {
    target[`${prefix}${k}`] = s[k];
  }
}

type CompField =
  | "comp_main"
  | "comp_wild"
  | "season_comp_main"
  | "season_comp_wild";

/**
 * Overwrite the quick-stat fields inside a competition-scope object while
 * preserving any ratings/ranks already merged there by mergeComputedRatings.
 */
function applyComp(
  target: Record<string, unknown>,
  field: CompField,
  p: DriverProfile | null,
): void {
  if (!p || p.entries === 0) return;
  const existing = (target[field] as CompetitionStats | undefined) ?? {};
  target[field] = { ...existing, ...profileToStats(p) };
}

/**
 * Recompute every Driver's quick stats (+ events) from computeDriverProfile so
 * the modal matches the /stats Drivers tab. Call AFTER mergeComputedRatings
 * (which supplies ratings) and BEFORE computeAllScopeRanks / computeCompetitionRanks
 * (so ranks reflect the unified values).
 */
export function mergeDriverProfileStats(
  drivers: Driver[],
  normalized: NormalizedRace[],
  currentSeasonKey: string,
): Driver[] {
  // Resolve each roster driver to the exact name used in race results, so the
  // name-keyed computeDriverProfile matches regardless of roster spelling.
  const nameById = new Map<string, string>();
  for (const r of normalized) {
    if (!nameById.has(r.driverId)) nameById.set(r.driverId, r.driverName);
  }

  const profile = (name: string, filters: ProfileFilters): DriverProfile | null =>
    computeDriverProfile(normalized, name, filters);

  return drivers.map((d) => {
    const raceName = nameById.get(d.driver_id);
    if (!raceName) return d; // no race data — keep whatever was merged (or empty)

    const allTime = profile(raceName, { scope: "all-time" });
    if (!allTime || allTime.entries === 0) return d;

    const next: Record<string, unknown> = { ...d };

    applyFlat(next, "", profileToStats(allTime));

    const season = profile(raceName, { scope: "season", season: currentSeasonKey });
    if (season && season.entries > 0) {
      applyFlat(next, "season_", profileToStats(season));
    }

    applyComp(next, "comp_main", profile(raceName, { scope: "all-time", competition: "main" }));
    applyComp(next, "comp_wild", profile(raceName, { scope: "all-time", competition: "wild" }));
    applyComp(next, "season_comp_main", profile(raceName, {
      scope: "season",
      season: currentSeasonKey,
      competition: "main",
    }));
    applyComp(next, "season_comp_wild", profile(raceName, {
      scope: "season",
      season: currentSeasonKey,
      competition: "wild",
    }));

    return next as Driver;
  });
}
