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
  ] = await Promise.all([
    fetchStandings(GLOBAL_CSV_URLS.driversStandingsMain),
    fetchStandings(GLOBAL_CSV_URLS.constructorsStandingsMain),
    fetchStandings(GLOBAL_CSV_URLS.driversStandingsWild),
    fetchStandings(GLOBAL_CSV_URLS.constructorsStandingsWild),
    fetchCsv(GLOBAL_CSV_URLS.drivers).catch(() => ""),
    fetchCsv(GLOBAL_CSV_URLS.teams).catch(() => ""),
    fetchCsv(GLOBAL_CSV_URLS.leagueStandings).catch(() => ""),
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

  return (
    <main className="bg-[#0B0B0E] text-white">
      <section className="py-12 md:py-16">
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
            placeholderSrc={PLACEHOLDER_PHOTO}
          />
        </div>
      </section>
    </main>
  );
}
