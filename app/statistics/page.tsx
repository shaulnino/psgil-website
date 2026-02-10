import TablesPageContent from "@/components/TablesPageContent";
import {
  fetchStandings,
  getLatestSeason,
  CSV_URLS,
} from "@/lib/resultsData";
import { fetchCsv, parseCsv } from "@/lib/csv";
import {
  mapDrivers,
  mapTeams,
  mapLeagueStandings,
  applyLeagueStandings,
} from "@/lib/driversData";

/* ------------------------------------------------------------------ */
/*  CSV sources for drivers & teams (same as /drivers page)            */
/* ------------------------------------------------------------------ */

const DRIVERS_CSV_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vQSNGhBKLMDdmeIOy9wn3ZBS3Kk0-oBmWCMs0ANbg3qDrSsp9PbIXm8qLtTUQKA2HkvoNEpZg9Zf_Ps/pub?gid=353282807&single=true&output=csv";
const TEAMS_CSV_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vQSNGhBKLMDdmeIOy9wn3ZBS3Kk0-oBmWCMs0ANbg3qDrSsp9PbIXm8qLtTUQKA2HkvoNEpZg9Zf_Ps/pub?gid=1933328661&single=true&output=csv";
const LEAGUE_STANDINGS_CSV_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vQSNGhBKLMDdmeIOy9wn3ZBS3Kk0-oBmWCMs0ANbg3qDrSsp9PbIXm8qLtTUQKA2HkvoNEpZg9Zf_Ps/pub?gid=1982499543&single=true&output=csv";

/* ------------------------------------------------------------------ */
/*  Static fallback images (used when CSV rows have no table_image)    */
/* ------------------------------------------------------------------ */

const FALLBACK_IMAGES = {
  driversMain: "/statistics/drivers-main-champ.png",
  constructorsMain: "/statistics/constructors-main-champ.png",
  driversWild: "/statistics/drivers-wild-champ.png",
  constructorsWild: "/statistics/constructors-wild-champ.png",
};

const PLACEHOLDER_PHOTO = "/placeholders/driver.png";

/* ------------------------------------------------------------------ */
/*  Tables page – Server Component                                     */
/* ------------------------------------------------------------------ */

export default async function TablesPage() {
  // Fetch standings + driver/team data in parallel
  const [
    driversMain,
    constructorsMain,
    driversWild,
    constructorsWild,
    driversCsv,
    teamsCsv,
    standingsCsv,
  ] = await Promise.all([
    fetchStandings(CSV_URLS.drivers_standings_main),
    fetchStandings(CSV_URLS.constructors_standings_main),
    fetchStandings(CSV_URLS.drivers_standings_wild),
    fetchStandings(CSV_URLS.constructors_standings_wild),
    fetchCsv(DRIVERS_CSV_URL).catch(() => ""),
    fetchCsv(TEAMS_CSV_URL).catch(() => ""),
    fetchCsv(LEAGUE_STANDINGS_CSV_URL).catch(() => ""),
  ]);

  // Parse drivers & teams
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

  // Determine latest season in data (defaults to S6)
  const defaultSeason = getLatestSeason(
    driversMain,
    constructorsMain,
    driversWild,
    constructorsWild,
  );

  return (
    <main className="bg-[#0B0B0E] text-white">
      <section className="py-12 md:py-16">
        <div className="mx-auto w-full max-w-6xl px-6">
          <TablesPageContent
            defaultSeason={defaultSeason}
            driversMain={driversMain}
            constructorsMain={constructorsMain}
            driversWild={driversWild}
            constructorsWild={constructorsWild}
            fallbackImages={FALLBACK_IMAGES}
            drivers={drivers}
            teams={teams}
            placeholderSrc={PLACEHOLDER_PHOTO}
          />
        </div>
      </section>
    </main>
  );
}
