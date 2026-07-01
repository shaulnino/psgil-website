export const revalidate = 300;

import Section from "@/components/Section";
import ScheduleList from "@/components/ScheduleList";
import { fetchCsv, parseCsv } from "@/lib/csv";
import { mapRaceEvents, sortRaceEvents } from "@/lib/scheduleData";
import { fetchAllRaceResults } from "@/lib/resultsData";
import {
  mapDrivers,
  mapTeams,
  mapLeagueStandings,
  applyLeagueStandings,
  mergeComputedRatings,
  computeAllScopeRanks,
  computeCompetitionRanks,
} from "@/lib/driversData";
import { attachRewardsToDrivers, fetchRewards } from "@/lib/rewardsData";
import {
  fetchSeasonsConfig,
  resolveCurrentSeason,
  GLOBAL_CSV_URLS,
} from "@/lib/seasonConfig";
import { computeDriverRatingsAll } from "@/lib/statsComputed";

/* ------------------------------------------------------------------ */
/*  Schedule page – Server Component                                   */
/*  ----------------------------------------------------------------  */
/*  Fetches ALL schedule events & race results (every season) from     */
/*  source CSV files. The client component filters by selected season.  */
/* ------------------------------------------------------------------ */

export default async function SchedulePage() {
  // 1. Fetch seasons config
  const seasonsConfig = await fetchSeasonsConfig();
  const currentSeason = resolveCurrentSeason(seasonsConfig);

  // 2. Fetch ALL schedule + race results + drivers/teams in parallel
  const [scheduleCsv, raceResultsByEvent, driversCsv, teamsCsv, standingsCsv, rewards] =
    await Promise.all([
      fetchCsv(GLOBAL_CSV_URLS.schedule).catch(() => ""),
      fetchAllRaceResults(GLOBAL_CSV_URLS.raceResults),
      fetchCsv(GLOBAL_CSV_URLS.drivers).catch(() => ""),
      fetchCsv(GLOBAL_CSV_URLS.teams).catch(() => ""),
      fetchCsv(GLOBAL_CSV_URLS.leagueStandings).catch(() => ""),
      fetchRewards(GLOBAL_CSV_URLS.rewards),
    ]);

  // 3. Parse ALL events (every season)
  const allEvents = scheduleCsv
    ? sortRaceEvents(
        mapRaceEvents(parseCsv<Record<string, string>>(scheduleCsv)),
      )
    : [];

  // 4. Parse drivers & teams
  let allDrivers = driversCsv
    ? mapDrivers(parseCsv<Record<string, string>>(driversCsv))
    : [];

  if (standingsCsv) {
    const standings = mapLeagueStandings(
      parseCsv<Record<string, string>>(standingsCsv),
    );
    allDrivers = applyLeagueStandings(allDrivers, standings);
  }
  allDrivers = attachRewardsToDrivers(allDrivers, rewards);

  // Merge live-computed ratings into driver objects for driver modals
  try {
    const allResultsFlat = Object.values(raceResultsByEvent).flat();
    if (allResultsFlat.length > 0 && allEvents.length > 0) {
      const { allTime, season, allTimeMain, allTimeWild, seasonMain, seasonWild } =
        computeDriverRatingsAll(allResultsFlat, allEvents, currentSeason.season_key);
      allDrivers = mergeComputedRatings(allDrivers, allTime,     "alltime");
      allDrivers = mergeComputedRatings(allDrivers, season,      "season");
      allDrivers = mergeComputedRatings(allDrivers, allTimeMain, "main");
      allDrivers = mergeComputedRatings(allDrivers, allTimeWild, "wild");
      allDrivers = mergeComputedRatings(allDrivers, seasonMain,  "season_main");
      allDrivers = mergeComputedRatings(allDrivers, seasonWild,  "season_wild");
      allDrivers = computeAllScopeRanks(allDrivers);
      allDrivers = computeCompetitionRanks(allDrivers);
    }
  } catch {
    // Non-critical; modals still render without computed ratings
  }

  const allTeams = teamsCsv
    ? mapTeams(parseCsv<Record<string, string>>(teamsCsv))
    : [];

  return (
    <main className="bg-bone text-ink-2">
      <Section
        title="Schedule & Race Results"
        description="Full race calendar and results for every ISL season."
        pageHeader
      >
        <ScheduleList
          seasonsConfig={seasonsConfig}
          defaultSeasonKey={currentSeason.season_key}
          allEvents={allEvents}
          allRaceResults={raceResultsByEvent}
          allDrivers={allDrivers}
          allTeams={allTeams}
        />
      </Section>
    </main>
  );
}
