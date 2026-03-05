export const dynamic = "force-dynamic";

import TablesPageContent from "@/components/TablesPageContent";
import { fetchStandings } from "@/lib/resultsData";
import { fetchCsv, parseCsv } from "@/lib/csv";
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
    standingsCsv,
    rewards,
  ] = await Promise.all([
    fetchStandings(GLOBAL_CSV_URLS.driversStandingsMain),
    fetchStandings(GLOBAL_CSV_URLS.constructorsStandingsMain),
    fetchStandings(GLOBAL_CSV_URLS.driversStandingsWild),
    fetchStandings(GLOBAL_CSV_URLS.constructorsStandingsWild),
    fetchCsv(GLOBAL_CSV_URLS.drivers).catch(() => ""),
    fetchCsv(GLOBAL_CSV_URLS.teams).catch(() => ""),
    fetchCsv(GLOBAL_CSV_URLS.leagueStandings).catch(() => ""),
    fetchRewards(GLOBAL_CSV_URLS.rewards),
  ]);

  // 3. Parse drivers & teams
  let drivers = driversCsv
    ? mapDrivers(parseCsv<Record<string, string>>(driversCsv))
    : [];
  const teams = teamsCsv
    ? mapTeams(parseCsv<Record<string, string>>(teamsCsv))
    : [];

  // Merge league standings if available
  if (standingsCsv) {
    const standings = mapLeagueStandings(
      parseCsv<Record<string, string>>(standingsCsv),
    );
    drivers = applyLeagueStandings(drivers, standings);
  }
  drivers = attachRewardsToDrivers(drivers, rewards);

  return (
    <main className="bg-[#0B0B0E] text-white">
      <section className="relative py-14 md:py-20">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-[280px] overflow-hidden">
          <div className="absolute left-1/2 top-0 h-[280px] w-[600px] -translate-x-1/2 rounded-full bg-[#7020B0]/[0.07] blur-[100px]" />
        </div>
        <div className="relative mx-auto w-full max-w-6xl px-6">
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
