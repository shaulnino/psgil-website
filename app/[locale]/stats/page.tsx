export const revalidate = 300;

import { Suspense } from "react";
import { getTranslations } from "next-intl/server";
import Section from "@/components/Section";
import StatsPageContent from "@/components/StatsPageContent";
import { fetchSeasonsConfig, GLOBAL_CSV_URLS } from "@/lib/seasonConfig";
import { fetchAllRaceResults } from "@/lib/resultsData";
import { fetchCsv, parseCsv } from "@/lib/csv";
import { mapRaceEvents } from "@/lib/scheduleData";
import { fetchRewards } from "@/lib/rewardsData";
import {
  computeDriverStats,
  computeCircuitStats,
  computeLeagueStats,
} from "@/lib/statsComputed";

export default async function StatsPage() {
  const t = await getTranslations("stats");
  const seasons = await fetchSeasonsConfig();

  const [raceResultsByEvent, scheduleCsv, rewards] = await Promise.all([
    fetchAllRaceResults(GLOBAL_CSV_URLS.raceResults),
    fetchCsv(GLOBAL_CSV_URLS.schedule).catch(() => ""),
    fetchRewards(GLOBAL_CSV_URLS.rewards),
  ]);

  const events = scheduleCsv
    ? mapRaceEvents(parseCsv<Record<string, string>>(scheduleCsv))
    : [];

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

  // League and circuits
  const league   = computeLeagueStats(allResults, events, seasons);
  const circuits = computeCircuitStats(allResults, events, seasons);

  const data = {
    driversAllTime,
    driversBySeason,
    league,
    circuits,
  };

  return (
    <main className="bg-bone text-ink">
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
          />
        </Suspense>
      </Section>
    </main>
  );
}
