/* ------------------------------------------------------------------ */
/*  Server component: fetches schedule → finds next/live race → renders*/
/*  the client-side countdown widget.                                  */
/* ------------------------------------------------------------------ */

import { fetchCsv, parseCsv } from "@/lib/csv";
import {
  fetchSeasonsConfig,
  resolveCurrentSeason,
  matchesSeason,
  GLOBAL_CSV_URLS,
} from "@/lib/seasonConfig";
import {
  mapRaceEvents,
  toIsraelTimestamp,
  DEFAULT_RACE_DURATION_MS,
} from "@/lib/scheduleData";
import NextRaceWidget, { type NextRaceData } from "./NextRaceWidget";

export default async function NextRaceWidgetServer() {
  try {
    /* 1. Resolve current season */
    const allSeasons = await fetchSeasonsConfig();
    const currentSeason = resolveCurrentSeason(allSeasons);

    /* 2. Fetch & parse schedule */
    const scheduleCsv = await fetchCsv(GLOBAL_CSV_URLS.schedule);
    const allEvents = mapRaceEvents(
      parseCsv<Record<string, string>>(scheduleCsv),
    );

    /* 3. Filter to current season */
    const seasonEvents = allEvents.filter((e) =>
      matchesSeason(e.season, currentSeason.season_key),
    );

    /* 4. Check for a LIVE race first (started but not ended) */
    const now = Date.now();

    for (const e of seasonEvents) {
      const startTs = toIsraelTimestamp(e.date, e.start_time);
      if (startTs === null || startTs > now) continue;
      // Race has started — check if it's still in the live window
      if (e.status.toLowerCase() === "completed") continue;
      const endTs = e.end_time
        ? toIsraelTimestamp(e.date, e.end_time)
        : startTs + DEFAULT_RACE_DURATION_MS;
      if (endTs !== null && now < endTs) {
        // This race is LIVE
        const raceData: NextRaceData = {
          eventId: e.event_id,
          raceName: e.race_name,
          raceNumber: e.race_number,
          season: e.season,
          league: e.league,
          track: e.track,
          countryCode: e.country_code,
          posterImage: e.poster_image,
          date: e.date,
          startTime: e.start_time,
          startTimestamp: startTs,
          endTimestamp: endTs,
          youtubeUrl: e.youtube_url,
          isLive: true,
        };
        return <NextRaceWidget race={raceData} />;
      }
    }

    /* 5. Find next upcoming race (earliest future start time) */
    const upcoming = seasonEvents
      .map((e) => {
        const ts = toIsraelTimestamp(e.date, e.start_time);
        return ts !== null ? { event: e, ts } : null;
      })
      .filter(
        (x): x is { event: (typeof seasonEvents)[number]; ts: number } =>
          x !== null && x.ts > now,
      )
      .sort((a, b) => a.ts - b.ts);

    if (upcoming.length === 0) {
      // No upcoming race — render nothing
      return <NextRaceWidget race={null} />;
    }

    const next = upcoming[0];
    const endTs = next.event.end_time
      ? toIsraelTimestamp(next.event.date, next.event.end_time)
      : next.ts + DEFAULT_RACE_DURATION_MS;

    // The next race is a championship finale if there are no more races in its league
    // on a later date (same-day double-headers are still the finale day)
    const nextLeague = next.event.league.trim().toLowerCase();
    const nextDate = next.event.date.trim();
    const moreLaterInSameLeague = upcoming
      .slice(1)
      .some(
        (u) =>
          u.event.league.trim().toLowerCase() === nextLeague &&
          u.event.date.trim() !== nextDate,
      );
    const isChampionshipFinale = !moreLaterInSameLeague;

    const raceData: NextRaceData = {
      eventId: next.event.event_id,
      raceName: next.event.race_name,
      raceNumber: next.event.race_number,
      season: next.event.season,
      league: next.event.league,
      track: next.event.track,
      countryCode: next.event.country_code,
      posterImage: next.event.poster_image,
      date: next.event.date,
      startTime: next.event.start_time,
      startTimestamp: next.ts,
      endTimestamp: endTs ?? next.ts + DEFAULT_RACE_DURATION_MS,
      youtubeUrl: next.event.youtube_url,
      isLive: false,
      isChampionshipFinale,
    };

    return <NextRaceWidget race={raceData} />;
  } catch {
    // If anything fails, silently render nothing
    return null;
  }
}
