export const revalidate = 300;

import { Suspense } from "react";
import { getTranslations } from "next-intl/server";
import Section from "@/components/Section";
import StatsPageContent from "@/components/StatsPageContent";
import { fetchSeasonsConfig, GLOBAL_CSV_URLS } from "@/lib/seasonConfig";
import { fetchAllRaceResults } from "@/lib/resultsData";
import { fetchCsv, parseCsv } from "@/lib/csv";
import { mapRaceEvents } from "@/lib/scheduleData";
import { mapDrivers, mapTeams } from "@/lib/driversData";
import type { TeamNameEntry } from "@/lib/stats/teamIdentity";
import { fetchRewards } from "@/lib/rewardsData";
import {
  computeDriverStats,
  computeLeagueStats,
} from "@/lib/statsComputed";

export default async function StatsPage() {
  const t = await getTranslations("stats");
  const seasons = await fetchSeasonsConfig();

  const [raceResultsByEvent, scheduleCsv, driversCsv, teamsCsv, rewards] = await Promise.all([
    fetchAllRaceResults(GLOBAL_CSV_URLS.raceResults),
    fetchCsv(GLOBAL_CSV_URLS.schedule).catch(() => ""),
    fetchCsv(GLOBAL_CSV_URLS.drivers).catch(() => ""),
    fetchCsv(GLOBAL_CSV_URLS.teams).catch(() => ""),
    fetchRewards(GLOBAL_CSV_URLS.rewards),
  ]);

  const events = scheduleCsv
    ? mapRaceEvents(parseCsv<Record<string, string>>(scheduleCsv))
    : [];

  // Hebrew display names keyed by driver_id (English `driver_name` from the
  // results CSV stays the internal value; only the label is localized).
  const drivers = driversCsv ? mapDrivers(parseCsv(driversCsv)) : [];
  const driverNamesHe: Record<string, string> = {};
  for (const d of drivers) {
    if (d.name_he) driverNamesHe[d.driver_id] = d.name_he;
  }

  // Current team roster (drivers tab) for the Teams tab snapshot chip. Keyed by
  // team_key; historical team stats are derived from results, not this map.
  const currentRoster: Record<string, { driverId: string; name: string }[]> = {};
  for (const d of drivers) {
    if (d.role !== "main" || !d.team_key) continue;
    (currentRoster[d.team_key] ??= []).push({ driverId: d.driver_id, name: d.name });
  }

  // Sheet-sourced team display names (team_name / team_name_he) for locale-aware
  // labels in the Teams + Rankings tabs; code map is the fallback.
  const teams = teamsCsv ? mapTeams(parseCsv(teamsCsv)) : [];
  const teamNameEntries: TeamNameEntry[] = teams.map((tm) => ({
    team_key: tm.team_key,
    team_name: tm.team_name,
    team_name_he: tm.team_name_he,
  }));

  const allResults = Object.values(raceResultsByEvent).flat();

  // All-time driver stats
  const driversAllTime = computeDriverStats(allResults, events, rewards, seasons);

  // Per-season driver stats — one call per season that has at least one result
  const seasonsWithData = seasons.filter((s) =>
    allResults.some((r) => {
      const ev = events.find((e) => e.event_id.toLowerCase() === r.event_id.toLowerCase());
      return ev && ev.season.replace(/^S/i, "") === s.season_key.replace(/^S/i, "");
    }),
  );

  const driversBySeason = Object.fromEntries(
    seasonsWithData.map((s) => [
      s.season_key,
      computeDriverStats(allResults, events, rewards, seasons, { season: s.season_key }),
    ]),
  );

  // League (Circuits tab now computes its own profile client-side from
  // normalized race data — see components/stats/circuits/CircuitsSection).
  const league = computeLeagueStats(allResults, events, seasons);

  const data = {
    driversAllTime,
    driversBySeason,
    league,
  };

  return (
    <main className="text-ink">
      <Section
        title={t("page.title")}
        description={t("page.description")}
        pageHeader
      >
        <Suspense>
          <StatsPageContent
            data={data}
            raceResults={raceResultsByEvent}
            events={events}
            seasons={seasons}
            rewards={rewards}
            driverNamesHe={driverNamesHe}
            currentRoster={currentRoster}
            teamNameEntries={teamNameEntries}
          />
        </Suspense>
      </Section>
    </main>
  );
}
