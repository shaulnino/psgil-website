export const revalidate = 300;

import TablesPageContent from "@/components/TablesPageContent";
import { fetchStandings } from "@/lib/resultsData";
import { fetchCsv, parseCsv } from "@/lib/csv";
import {
  mapDrivers,
  mapTeams,
  applyLeagueStandings,
  leagueStandingsFromTables,
  mergeComputedRatings,
  computeAllScopeRanks,
  computeCompetitionRanks,
} from "@/lib/driversData";
import { attachRewardsToDrivers, fetchRewards } from "@/lib/rewardsData";
import { applyUploadedDriverPhotos } from "@/lib/drivers/photoOverride";
import {
  fetchSeasonsConfig,
  resolveCurrentSeason,
  GLOBAL_CSV_URLS,
} from "@/lib/seasonConfig";
import { fetchAllRaceResults } from "@/lib/resultsData";
import { mapRaceEvents } from "@/lib/scheduleData";
import { computeDriverRatingsAll } from "@/lib/statsComputed";

const PLACEHOLDER_PHOTO = "/placeholders/driver.png";

/* ------------------------------------------------------------------ */
/*  Tables page – Server Component                                     */
/*  ----------------------------------------------------------------  */
/*  Fetches ALL standings (every season) from global CSVs.             */
/*  The client component filters by the selected season.               */
/* ------------------------------------------------------------------ */

export default async function TablesPage() {
  // 1. Fetch seasons config (single source of truth)
  const seasonsConfig = await fetchSeasonsConfig();
  const currentSeason = resolveCurrentSeason(seasonsConfig);

  // 2. Fetch ALL standings + driver/team data in parallel
  const [
    allDriversMain,
    allConstructorsMain,
    allDriversWild,
    allConstructorsWild,
    driversCsv,
    teamsCsv,
    rewards,
    raceResultsByEvent,
    scheduleCsv,
  ] = await Promise.all([
    fetchStandings(GLOBAL_CSV_URLS.driversStandingsMain),
    fetchStandings(GLOBAL_CSV_URLS.constructorsStandingsMain),
    fetchStandings(GLOBAL_CSV_URLS.driversStandingsWild),
    fetchStandings(GLOBAL_CSV_URLS.constructorsStandingsWild),
    fetchCsv(GLOBAL_CSV_URLS.drivers).catch(() => ""),
    fetchCsv(GLOBAL_CSV_URLS.teams).catch(() => ""),
    fetchRewards(GLOBAL_CSV_URLS.rewards),
    fetchAllRaceResults(GLOBAL_CSV_URLS.raceResults),
    fetchCsv(GLOBAL_CSV_URLS.schedule).catch(() => ""),
  ]);

  // 3. Parse drivers & teams
  let drivers = driversCsv
    ? mapDrivers(parseCsv<Record<string, string>>(driversCsv))
    : [];
  // Override CSV photo_url with account-uploaded driver photos (PW-2e) so the
  // shared driver modal opened from standings shows the uploaded photo too.
  drivers = await applyUploadedDriverPhotos(drivers);
  const teams = teamsCsv
    ? mapTeams(parseCsv<Record<string, string>>(teamsCsv))
    : [];

  // Derive league ranks from the already-fetched computed standings tables (current season)
  drivers = applyLeagueStandings(
    drivers,
    leagueStandingsFromTables(allDriversMain, allDriversWild, currentSeason.season_key),
  );
  drivers = attachRewardsToDrivers(drivers, rewards);

  // Merge live-computed ratings into driver objects for driver modals
  try {
    const allResultsFlat = Object.values(raceResultsByEvent).flat();
    const allEvents = scheduleCsv
      ? mapRaceEvents(parseCsv<Record<string, string>>(scheduleCsv))
      : [];
    if (allResultsFlat.length > 0 && allEvents.length > 0) {
      const { allTime, season, allTimeMain, allTimeWild, seasonMain, seasonWild } =
        computeDriverRatingsAll(allResultsFlat, allEvents, currentSeason.season_key);
      drivers = mergeComputedRatings(drivers, allTime,      "alltime");
      drivers = mergeComputedRatings(drivers, season,       "season");
      drivers = mergeComputedRatings(drivers, allTimeMain,  "main");
      drivers = mergeComputedRatings(drivers, allTimeWild,  "wild");
      drivers = mergeComputedRatings(drivers, seasonMain,   "season_main");
      drivers = mergeComputedRatings(drivers, seasonWild,   "season_wild");
    }
    drivers = computeAllScopeRanks(drivers);
    drivers = computeCompetitionRanks(drivers);
  } catch {
    // Non-critical; modals still render with CSV-sourced ratings
  }

  return (
    <main className="text-ink">
      <section className="py-14 md:py-20">
        <div className="mx-auto w-full max-w-6xl px-6">
          <TablesPageContent
            seasonsConfig={seasonsConfig}
            defaultSeasonKey={currentSeason.season_key}
            allStandings={{
              driversMain: allDriversMain,
              constructorsMain: allConstructorsMain,
              driversWild: allDriversWild,
              constructorsWild: allConstructorsWild,
            }}
            drivers={drivers}
            teams={teams}
            rewards={rewards}
            placeholderSrc={PLACEHOLDER_PHOTO}
          />
        </div>
      </section>
    </main>
  );
}
