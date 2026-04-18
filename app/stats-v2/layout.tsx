import { Suspense } from "react";
import FilterBar from "@/components/statsV2/FilterBar";
import NavTabs from "@/components/statsV2/NavTabs";
import { loadStatsV2Bundle } from "@/lib/statsV2/dataLoader";

export const revalidate = 300;

export default async function StatsV2Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  const bundle = await loadStatsV2Bundle();
  const seasonOptions = bundle.seasons
    .map((s) => s.season_key)
    .filter((s) => bundle.events.some((e) => e.season.replace(/^S/i, "") === s.replace(/^S/i, "")))
    .sort();
  const circuitOptions = bundle.circuits;

  return (
    <main className="min-h-screen bg-[#0B0B0E] text-white">
      <header className="border-b border-white/10">
        <div className="mx-auto max-w-7xl px-4 py-6">
          <div className="flex items-baseline justify-between gap-4 flex-wrap">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
                PSGiL Statistics
                <span className="ml-2 align-middle rounded-md bg-cyan-500/20 px-2 py-0.5 text-xs font-medium text-cyan-200">
                  v2 preview
                </span>
              </h1>
              <p className="mt-1 text-sm text-white/60 max-w-2xl">
                League intelligence platform — drivers, seasons, circuits, head-to-head, rankings.
              </p>
            </div>
          </div>
        </div>
      </header>

      <Suspense fallback={null}>
        <FilterBar seasonOptions={seasonOptions} circuitOptions={circuitOptions} />
      </Suspense>
      <Suspense fallback={null}>
        <NavTabs />
      </Suspense>

      <div className="mx-auto max-w-7xl px-4 py-6">{children}</div>
    </main>
  );
}
