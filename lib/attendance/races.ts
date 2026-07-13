/**
 * Upcoming-races resolver for attendance (PW-3).
 *
 * Single place that decides *which* race-days a driver can RSVP to: the
 * not-yet-started race-day groups of the current season. Shared by the driver
 * surface (/account), the admin roster, and the server action's cutoff check —
 * so "you can RSVP until the race starts" is enforced in exactly one spot.
 */
import { fetchCsv, parseCsv } from "@/lib/csv";
import {
  getUpcomingRaceGroups,
  groupTimestamp,
  mapRaceEvents,
  raceGroupAnchorId,
} from "@/lib/scheduleData";
import {
  GLOBAL_CSV_URLS,
  fetchSeasonsConfig,
  matchesSeason,
  resolveCurrentSeason,
} from "@/lib/seasonConfig";

/** A serializable summary of an upcoming race-day a driver can RSVP to. */
export type UpcomingRace = {
  /** Anchor event_id of the race-day group (the RSVP key). */
  raceId: string;
  season: string;
  league: string;
  /** DD.MM.YYYY as stored in the schedule CSV. */
  date: string;
  /** Start time (HH:MM Israel local), if known. */
  startTime?: string;
  /** UTC ms of the race-day start (for cutoff / ordering). */
  startTs: number;
  /** English GP name. */
  name: string;
  /** Hebrew GP name (falls back to English if absent). */
  nameHe: string;
  /** Number of races that night (2 = double-header). */
  raceCount: number;
};

export async function fetchUpcomingRaces(): Promise<UpcomingRace[]> {
  const [scheduleCsv, seasonsConfig] = await Promise.all([
    fetchCsv(GLOBAL_CSV_URLS.schedule).catch(() => ""),
    fetchSeasonsConfig(),
  ]);
  if (!scheduleCsv) return [];

  const currentSeasonKey = resolveCurrentSeason(seasonsConfig).season_key;
  const events = mapRaceEvents(parseCsv<Record<string, string>>(scheduleCsv));

  return getUpcomingRaceGroups(events)
    .filter((g) => matchesSeason(g.season, currentSeasonKey))
    .map((g) => {
      const first = g.events[0];
      return {
        raceId: raceGroupAnchorId(g),
        season: g.season,
        league: g.league,
        date: g.date,
        startTime: first?.start_time,
        startTs: groupTimestamp(g),
        name: first?.race_name ?? "",
        nameHe: (first?.race_name_he || first?.race_name) ?? "",
        raceCount: g.events.length,
      } satisfies UpcomingRace;
    });
}
