import Section from "@/components/Section";
import ScheduleList from "@/components/ScheduleList";
import { fetchCsv, parseCsv } from "@/lib/csv";
import { mapRaceEvents, sortRaceEvents } from "@/lib/scheduleData";
import { fetchAllRaceResults } from "@/lib/resultsData";
import { mapDrivers, mapTeams, mapLeagueStandings, applyLeagueStandings } from "@/lib/driversData";

/* ------------------------------------------------------------------ */
/*  CSV sources                                                        */
/* ------------------------------------------------------------------ */
const SCHEDULE_CSV_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vQSNGhBKLMDdmeIOy9wn3ZBS3Kk0-oBmWCMs0ANbg3qDrSsp9PbIXm8qLtTUQKA2HkvoNEpZg9Zf_Ps/pub?gid=2105913561&single=true&output=csv";
const DRIVERS_CSV_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vQSNGhBKLMDdmeIOy9wn3ZBS3Kk0-oBmWCMs0ANbg3qDrSsp9PbIXm8qLtTUQKA2HkvoNEpZg9Zf_Ps/pub?gid=353282807&single=true&output=csv";
const TEAMS_CSV_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vQSNGhBKLMDdmeIOy9wn3ZBS3Kk0-oBmWCMs0ANbg3qDrSsp9PbIXm8qLtTUQKA2HkvoNEpZg9Zf_Ps/pub?gid=1933328661&single=true&output=csv";
const LEAGUE_STANDINGS_CSV_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vQSNGhBKLMDdmeIOy9wn3ZBS3Kk0-oBmWCMs0ANbg3qDrSsp9PbIXm8qLtTUQKA2HkvoNEpZg9Zf_Ps/pub?gid=1982499543&single=true&output=csv";

export default async function SchedulePage() {
  // Fetch schedule + race results + drivers/teams + league standings in parallel
  const [scheduleCsv, raceResultsByEvent, driversCsv, teamsCsv, standingsCsv] =
    await Promise.all([
      fetchCsv(SCHEDULE_CSV_URL).catch(() => ""),
      fetchAllRaceResults(),
      fetchCsv(DRIVERS_CSV_URL).catch(() => ""),
      fetchCsv(TEAMS_CSV_URL).catch(() => ""),
      fetchCsv(LEAGUE_STANDINGS_CSV_URL).catch(() => ""),
    ]);

  const events = scheduleCsv
    ? sortRaceEvents(
        mapRaceEvents(parseCsv<Record<string, string>>(scheduleCsv)),
      )
    : [];

  let allDrivers = driversCsv
    ? mapDrivers(parseCsv<Record<string, string>>(driversCsv))
    : [];

  // Merge league standings into driver data
  if (standingsCsv) {
    const standings = mapLeagueStandings(parseCsv<Record<string, string>>(standingsCsv));
    allDrivers = applyLeagueStandings(allDrivers, standings);
  }

  const allTeams = teamsCsv
    ? mapTeams(parseCsv<Record<string, string>>(teamsCsv))
    : [];

  return (
    <main className="bg-[#0B0B0E] text-white">
      <Section
        title="Schedule & Race Results"
        description="Full race calendar and results for every PSGiL season."
      >
        <ScheduleList
          events={events}
          raceResultsByEvent={raceResultsByEvent}
          allDrivers={allDrivers}
          allTeams={allTeams}
        />
      </Section>
    </main>
  );
}
