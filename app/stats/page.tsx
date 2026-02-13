export const dynamic = "force-dynamic";

import Section from "@/components/Section";
import StatsPageContent from "@/components/StatsPageContent";
import { fetchAllStatsData } from "@/lib/statsData";

export default async function StatsPage() {
  const data = await fetchAllStatsData();

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
