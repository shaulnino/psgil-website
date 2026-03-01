export const dynamic = "force-dynamic";

import Section from "@/components/Section";
import StatsPageContent from "@/components/StatsPageContent";
import { fetchAllStatsData } from "@/lib/statsData";
import { fetchSeasonsConfig, GLOBAL_CSV_URLS } from "@/lib/seasonConfig";
import { fetchAllRaceResults } from "@/lib/resultsData";
import { fetchCsv, parseCsv } from "@/lib/csv";
import { mapRaceEvents } from "@/lib/scheduleData";

export default async function StatsPage() {
  const seasons = await fetchSeasonsConfig();

  const [data, raceResultsByEvent, scheduleCsv] = await Promise.all([
    fetchAllStatsData(seasons),
    fetchAllRaceResults(GLOBAL_CSV_URLS.raceResults),
    fetchCsv(GLOBAL_CSV_URLS.schedule).catch(() => ""),
  ]);

  const events = scheduleCsv
    ? mapRaceEvents(parseCsv<Record<string, string>>(scheduleCsv))
    : [];

  return (
    <main className="bg-[#0B0B0E] text-white">
      <Section
        title="Stats"
        description="Deep stats for every driver, season, and circuit in PSGiL history."
        pageHeader
      >
        <StatsPageContent
          data={data}
          raceResults={raceResultsByEvent}
          events={events}
        />
      </Section>
    </main>
  );
}
