import Section from "@/components/Section";
import DriversGrid from "@/components/DriversGrid";
import { fetchCsv, parseCsv } from "@/lib/csv";
import {
  groupDriversByTeam,
  mapDrivers,
  mapTeams,
  getReserveDrivers,
  getHistoricDrivers,
  applyLeagueStandings,
  mapLeagueStandings,
} from "@/lib/driversData";
import {
  fetchSeasonsConfig,
  resolveCurrentSeason,
  GLOBAL_CSV_URLS,
} from "@/lib/seasonConfig";

const PLACEHOLDER_PHOTO = "/placeholders/driver.png";

const DEMO_TEAM = {
  team_key: "psgil-demo",
  team_name: "PSGiL Demo Team",
  logo_url: "/psgil-logo.png",
};

const DEMO_DRIVER = {
  driver_id: "demo-driver",
  name: "Demo Driver",
  team_key: "psgil-demo",
  role: "main" as const,
  number: "07",
  photo_url: "",
  about:
    "This is a temporary demo profile to preview layout and modal behavior. Replace with live CSV data.",
  // All-time stats
  points: "124",
  wins: "3",
  podiums: "8",
  poles: "2",
  avg_finish: "5.4",
  dnfs: "2",
  avg_grid: "4.8",
  avg_points: "12.4",
  // Season stats
  season_points: "24",
  season_wins: "1",
  season_podiums: "2",
  season_poles: "0",
  season_avg_finish: "6.2",
  season_dnfs: "0",
  season_avg_grid: "5.1",
  season_avg_points: "8.0",
  // All-time ratings
  rating_speed: "78",
  rating_consistency: "82",
  rating_performance: "75",
  rating_agility: "71",
  rating_overall: "77",
  // Season ratings
  season_rating_speed: "80",
  season_rating_consistency: "85",
  season_rating_performance: "79",
  season_rating_agility: "73",
  season_rating_overall: "79",
  // All-time stat ranks
  rank_points: "5",
  rank_wins: "3",
  rank_podiums: "4",
  rank_poles: "6",
  rank_avg_finish: "2",
  rank_dnfs: "8",
  rank_avg_grid: "3",
  rank_avg_points: "4",
  // Season stat ranks
  season_rank_points: "7",
  season_rank_wins: "4",
  season_rank_podiums: "5",
  season_rank_avg_finish: "3",
  season_rank_avg_grid: "4",
  season_rank_avg_points: "6",
  // All-time rating ranks
  rank_rating_speed: "4",
  rank_rating_consistency: "2",
  rank_rating_performance: "5",
  rank_rating_agility: "6",
  rank_rating_overall: "3",
  // Season rating ranks
  season_rank_rating_speed: "3",
  season_rank_rating_consistency: "1",
  season_rank_rating_performance: "4",
  season_rank_rating_agility: "5",
  season_rank_rating_overall: "2",
  // Race events
  events: "42",
  season_events: "6",
  // Achievements
  titles_league_1st: "3",
  titles_league_2nd: "1",
  titles_lower_1st: "1",
  titles_wild_1st: "2",
  titles_wild_3rd: "1",
  // League standings
  league_rank_main: "4",
  league_rank_wild: "2",
};

export default async function DriversPage() {
  // Fetch seasons config for current season label
  const seasonsConfig = await fetchSeasonsConfig();
  const currentSeason = resolveCurrentSeason(seasonsConfig);

  let teams: {
    team_key: string;
    team_name: string;
    logo_url: string;
    drivers: ReturnType<typeof mapDrivers>;
  }[] = [];
  let reserves: ReturnType<typeof mapDrivers> = [];
  let historic: ReturnType<typeof mapDrivers> = [];

  try {
    const csvPromises: [
      Promise<string>,
      Promise<string>,
      Promise<string | null>,
    ] = [
      fetchCsv(GLOBAL_CSV_URLS.drivers),
      fetchCsv(GLOBAL_CSV_URLS.teams),
      fetchCsv(GLOBAL_CSV_URLS.leagueStandings).catch(() => null),
    ];

    const [driversCsv, teamsCsv, standingsCsv] =
      await Promise.all(csvPromises);

    let drivers = mapDrivers(
      parseCsv<Record<string, string>>(driversCsv),
    );

    // Merge league standings when available
    if (standingsCsv) {
      const standings = mapLeagueStandings(
        parseCsv<Record<string, string>>(standingsCsv),
      );
      drivers = applyLeagueStandings(drivers, standings);
    }

    const teamsData = mapTeams(
      parseCsv<Record<string, string>>(teamsCsv),
    );
    teams = groupDriversByTeam(teamsData, drivers);
    reserves = getReserveDrivers(drivers);
    historic = getHistoricDrivers(drivers);
  } catch (error) {
    teams = [];
    reserves = [];
    historic = [];
  }

  if (teams.length === 0) {
    teams = [{ ...DEMO_TEAM, drivers: [DEMO_DRIVER] }];
    reserves = [];
  }

  return (
    <main className="bg-[#0B0B0E] text-white">
      <Section
        title="Drivers"
        description="Official PSGiL roster: teams, drivers, and profiles — updated as the season progresses."
      >
        <DriversGrid
          teams={teams}
          reserves={reserves}
          historicDrivers={historic}
          placeholderSrc={PLACEHOLDER_PHOTO}
          currentSeasonLabel={currentSeason.season_label}
        />
      </Section>
    </main>
  );
}
