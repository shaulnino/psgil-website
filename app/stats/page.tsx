export const dynamic = "force-dynamic";

import Section from "@/components/Section";
import StatsPageContent from "@/components/StatsPageContent";
import { fetchAllStatsData } from "@/lib/statsData";
import { fetchSeasonsConfig } from "@/lib/seasonConfig";

export default async function StatsPage() {
  const seasons = await fetchSeasonsConfig();
  const data = await fetchAllStatsData(seasons);

  return (
    <main className="bg-[#0B0B0E] text-white">
      <Section
        title="Stats"
        description="Deep stats for every driver, season, and circuit in PSGiL history."
      >
        <StatsPageContent data={data} />
      </Section>
    </main>
  );
}
