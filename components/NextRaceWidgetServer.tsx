/* ------------------------------------------------------------------ */
/*  Server component: fetches schedule → finds next race → renders     */
/*  the client-side countdown widget.                                  */
/* ------------------------------------------------------------------ */

import { fetchCsv, parseCsv } from "@/lib/csv";
import {
  fetchSeasonsConfig,
  resolveCurrentSeason,
  matchesSeason,
  GLOBAL_CSV_URLS,
} from "@/lib/seasonConfig";
import { mapRaceEvents, toIsraelTimestamp } from "@/lib/scheduleData";
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

    /* 4. Find next upcoming race (earliest future start time) */
    const now = Date.now();

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
      youtubeUrl: next.event.youtube_url,
    };

    return <NextRaceWidget race={raceData} />;
  } catch {
    // If anything fails, silently render nothing
    return null;
  }
}
