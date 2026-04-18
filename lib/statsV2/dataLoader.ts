/* ------------------------------------------------------------------ */
/*  Stats V2 — Server-side data loader                                 */
/*                                                                     */
/*  Centralised fetch for the four CSV sources every v2 page needs.    */
/*  Cached at the route-segment level via Next.js ISR (revalidate 300).*/
/* ------------------------------------------------------------------ */

import { fetchCsv, parseCsv } from "@/lib/csv";
import { fetchAllRaceResults, type RaceResultRow } from "@/lib/resultsData";
import { mapRaceEvents, type RaceEvent } from "@/lib/scheduleData";
import {
  fetchSeasonsConfig,
  GLOBAL_CSV_URLS,
  type SeasonConfig,
} from "@/lib/seasonConfig";
import { fetchRewards, type Reward } from "@/lib/rewardsData";

export type StatsV2Bundle = {
  /** Flat list of all race results across all events. */
  results: RaceResultRow[];
  /** All events from the schedule CSV. */
  events: RaceEvent[];
  /** Map keyed by lower-cased event_id for fast lookup. */
  eventMap: Map<string, RaceEvent>;
  /** All seasons from csv_seasons_config. */
  seasons: SeasonConfig[];
  /** Reward / award rows from the rewards CSV. */
  rewards: Reward[];
  /** Distinct circuit (track) names sorted alphabetically. */
  circuits: string[];
};

/**
 * Load every dataset the stats-v2 module needs in one call.
 * Safe to call from any server component — Next.js will dedupe.
 */
export async function loadStatsV2Bundle(): Promise<StatsV2Bundle> {
  const [seasons, raceResultsByEvent, scheduleCsv, rewards] = await Promise.all([
    fetchSeasonsConfig(),
    fetchAllRaceResults(GLOBAL_CSV_URLS.raceResults),
    fetchCsv(GLOBAL_CSV_URLS.schedule).catch(() => ""),
    fetchRewards(GLOBAL_CSV_URLS.rewards),
  ]);

  const events = scheduleCsv
    ? mapRaceEvents(parseCsv<Record<string, string>>(scheduleCsv))
    : [];

  const eventMap = new Map<string, RaceEvent>();
  for (const e of events) eventMap.set(e.event_id.toLowerCase(), e);

  const results = Object.values(raceResultsByEvent).flat();

  const circuitSet = new Set<string>();
  for (const e of events) {
    const t = (e.track ?? "").trim();
    if (t) circuitSet.add(t);
  }
  const circuits = [...circuitSet].sort((a, b) => a.localeCompare(b));

  return { results, events, eventMap, seasons, rewards, circuits };
}
