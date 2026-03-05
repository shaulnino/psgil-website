export const dynamic = "force-dynamic";

import Section from "@/components/Section";
import StatsPageContent from "@/components/StatsPageContent";
import { fetchAllStatsData } from "@/lib/statsData";
import { fetchSeasonsConfig, GLOBAL_CSV_URLS } from "@/lib/seasonConfig";
import { fetchAllRaceResults, fetchStandings } from "@/lib/resultsData";
import { fetchCsv, parseCsv } from "@/lib/csv";
import { mapRaceEvents } from "@/lib/scheduleData";
import { mapDrivers, mapTeams } from "@/lib/driversData";
import {
  augmentStatsRowsWithRewards,
  buildConstructorsChampionCountsFromRewards,
  fetchRewards,
} from "@/lib/rewardsData";

export default async function StatsPage() {
  const seasons = await fetchSeasonsConfig();

  const [
    data,
    raceResultsByEvent,
    scheduleCsv,
    driversCsv,
    teamsCsv,
    rewards,
    driversStandingsMain,
  ] = await Promise.all([
    fetchAllStatsData(seasons),
    fetchAllRaceResults(GLOBAL_CSV_URLS.raceResults),
    fetchCsv(GLOBAL_CSV_URLS.schedule).catch(() => ""),
    fetchCsv(GLOBAL_CSV_URLS.drivers).catch(() => ""),
    fetchCsv(GLOBAL_CSV_URLS.teams).catch(() => ""),
    fetchRewards(GLOBAL_CSV_URLS.rewards),
    fetchStandings(GLOBAL_CSV_URLS.driversStandingsMain),
  ]);

  const events = scheduleCsv
    ? mapRaceEvents(parseCsv<Record<string, string>>(scheduleCsv))
    : [];

  const drivers = driversCsv
    ? mapDrivers(parseCsv<Record<string, string>>(driversCsv))
    : [];
  const nameToDriverId = new Map(
    drivers.map((driver) => [driver.name.trim().toLowerCase(), driver.driver_id]),
  );
  const teams = teamsCsv
    ? mapTeams(parseCsv<Record<string, string>>(teamsCsv))
    : [];
  const teamNameByKey = new Map(
    teams.map((team) => [team.team_key, team.team_name]),
  );
  const constructorsCounts = buildConstructorsChampionCountsFromRewards(
    rewards,
    driversStandingsMain,
    teamNameByKey,
  );
  const constructorsChampionCountResolver = (
    driverId: string,
    seasonId?: number,
  ): number | undefined => {
    if (seasonId && constructorsCounts.bySeasonByDriver.has(seasonId)) {
      return constructorsCounts.bySeasonByDriver.get(seasonId)?.get(driverId) ?? 0;
    }
    return constructorsCounts.allTimeByDriver.get(driverId) ?? 0;
  };

  const enrichedData = {
    ...data,
    driversAllTime: {
      ...data.driversAllTime,
      rows: augmentStatsRowsWithRewards(
        data.driversAllTime.rows,
        rewards,
        nameToDriverId,
        undefined,
        constructorsChampionCountResolver,
      ),
    },
    driversBySeason: Object.fromEntries(
      Object.entries(data.driversBySeason).map(([seasonKey, value]) => {
        const seasonId = Number.parseInt(seasonKey.replace(/^S/i, ""), 10);
        return [
          seasonKey,
          {
            ...value,
            rows: augmentStatsRowsWithRewards(
              value.rows,
              rewards,
              nameToDriverId,
              Number.isFinite(seasonId) ? seasonId : undefined,
              constructorsChampionCountResolver,
            ),
          },
        ];
      }),
    ),
  };

  return (
    <main className="bg-[#0B0B0E] text-white">
      <Section
        title="Stats"
        description="Deep stats for every driver, season, and circuit in PSGiL history."
        pageHeader
      >
        <StatsPageContent
          data={enrichedData}
          raceResults={raceResultsByEvent}
          events={events}
        />
      </Section>
    </main>
  );
}
