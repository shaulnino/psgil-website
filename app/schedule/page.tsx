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
} from "@/lib/driversData";
import { attachRewardsToDrivers, fetchRewards } from "@/lib/rewardsData";
import {
  fetchSeasonsConfig,
  resolveCurrentSeason,
  GLOBAL_CSV_URLS,
} from "@/lib/seasonConfig";

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

  const allTeams = teamsCsv
    ? mapTeams(parseCsv<Record<string, string>>(teamsCsv))
    : [];

  return (
    <main className="bg-[#0B0B0E] text-white">
      <Section
        title="Schedule & Race Results"
        description="Full race calendar and results for every PSGiL season."
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
