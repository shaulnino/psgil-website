import Link from "next/link";
import { loadStatsV2Bundle } from "@/lib/statsV2/dataLoader";
import { parseFiltersFromParams, filterResultsByFilters, filterEventsByFilters } from "@/lib/statsV2/filters";
import { computeDriverMetrics } from "@/lib/statsV2/metrics";
import { computeDriverDnaMap } from "@/lib/statsV2/dna";
import { computeSeasonAnalytics } from "@/lib/statsV2/seasons";

export const revalidate = 300;

type SearchParams = Record<string, string | string[] | undefined>;

export default async function StatsV2Overview({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const filters = parseFiltersFromParams(sp);
  const bundle = await loadStatsV2Bundle();

  const filteredResults = filterResultsByFilters(bundle.results, bundle.eventMap, filters);
  const filteredEvents = filterEventsByFilters(bundle.events, filters);
  const metrics = computeDriverMetrics(filteredResults, bundle.eventMap);
  const dnaByDriver = computeDriverDnaMap(metrics);
  const seasonAnalytics = computeSeasonAnalytics(bundle.results, bundle.events, bundle.seasons);

  const totalRaces = filteredEvents.length;
  const totalDrivers = metrics.length;
  const totalEntries = filteredResults.length;
  const totalOvertakes = metrics.reduce((s, m) => s + m.overtakes_gross, 0);
  const totalDNF = metrics.reduce((s, m) => s + m.dnfs, 0);

  const topByPace = [...metrics]
    .filter((m) => m.pace_index !== null && m.events >= 3)
    .sort((a, b) => (b.pace_index as number) - (a.pace_index as number))
    .slice(0, 5);

  const topByWins = [...metrics]
    .sort((a, b) => b.wins - a.wins)
    .slice(0, 5)
    .filter((m) => m.wins > 0);

  const topRaceCraft = [...metrics]
    .filter((m) => m.race_craft_score !== null && m.events >= 3)
    .sort((a, b) => (b.race_craft_score as number) - (a.race_craft_score as number))
    .slice(0, 5);

  const qsObj = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) {
    if (typeof v === "string") qsObj.set(k, v);
    else if (Array.isArray(v)) v.forEach((x) => qsObj.append(k, x));
  }
  const qs = qsObj.toString();
  const linkWithQS = (href: string) => (qs ? `${href}?${qs}` : href);

  return (
    <div className="space-y-8">
      <SectionHeader
        title="Overview"
        subtitle={
          totalRaces === 0
            ? "No completed races match the current filters."
            : `${totalRaces} race${totalRaces === 1 ? "" : "s"} · ${totalDrivers} driver${totalDrivers === 1 ? "" : "s"} in scope`
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KPICard label="Races" value={totalRaces} />
        <KPICard label="Drivers" value={totalDrivers} />
        <KPICard label="Driver-Race Entries" value={totalEntries} />
        <KPICard label="Overtakes (gross)" value={totalOvertakes} />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <PaneList
          title="Top by Pace Index"
          rows={topByPace.map((m, i) => ({
            rank: i + 1,
            driver_id: m.driver_id,
            label: m.driver_name || m.driver_id,
            value: `${m.pace_index?.toFixed(0)}`,
            sub: m.team,
          }))}
          emptyText="Need more races for this filter."
          linkPrefix={(id) => linkWithQS(`/stats-v2/drivers/${encodeURIComponent(id)}`)}
        />
        <PaneList
          title="Top by Wins"
          rows={topByWins.map((m, i) => ({
            rank: i + 1,
            driver_id: m.driver_id,
            label: m.driver_name || m.driver_id,
            value: `${m.wins}W`,
            sub: `${m.podiums} podiums`,
          }))}
          emptyText="No wins in this scope."
          linkPrefix={(id) => linkWithQS(`/stats-v2/drivers/${encodeURIComponent(id)}`)}
        />
        <PaneList
          title="Top by Race Craft"
          rows={topRaceCraft.map((m, i) => ({
            rank: i + 1,
            driver_id: m.driver_id,
            label: m.driver_name || m.driver_id,
            value: `${m.race_craft_score?.toFixed(0)}`,
            sub: `+${(m.avg_position_change ?? 0).toFixed(1)} avg`,
          }))}
          emptyText="Need more races for this filter."
          linkPrefix={(id) => linkWithQS(`/stats-v2/drivers/${encodeURIComponent(id)}`)}
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <KPICard label="DNF count" value={totalDNF} />
        <KPICard
          label="DNA dimensions tracked"
          value={dnaByDriver.size > 0 ? "8" : "0"}
        />
        <KPICard label="Seasons analysed" value={seasonAnalytics.length} />
      </div>

      <div className="rounded-lg border border-white/10 bg-white/[0.02] p-4">
        <h2 className="text-base font-semibold mb-2">Where to next</h2>
        <ul className="space-y-1 text-sm text-white/70">
          <li>
            <Link href={linkWithQS("/stats-v2/drivers")} className="text-cyan-300 hover:underline">
              Browse drivers →
            </Link>{" "}
            with full DNA, archetypes, and tier classification.
          </li>
          <li>
            <Link href={linkWithQS("/stats-v2/league")} className="text-cyan-300 hover:underline">
              League seasons →
            </Link>{" "}
            with Competitiveness Index and dominance analysis.
          </li>
          <li>
            <Link href={linkWithQS("/stats-v2/circuits")} className="text-cyan-300 hover:underline">
              Circuit pages →
            </Link>{" "}
            with character tags (High-Overtake, Chaos, Pole Decides…).
          </li>
          <li>
            <Link href={linkWithQS("/stats-v2/h2h")} className="text-cyan-300 hover:underline">
              Head-to-head →
            </Link>{" "}
            up to 4 drivers, DNA overlay, shared-race matrix.
          </li>
          <li>
            <Link href={linkWithQS("/stats-v2/rankings")} className="text-cyan-300 hover:underline">
              Rankings studio →
            </Link>{" "}
            pre-built leaderboards plus a custom builder.
          </li>
          <li>
            <Link href={linkWithQS("/stats-v2/records")} className="text-cyan-300 hover:underline">
              Records →
            </Link>{" "}
            classic record book preserved in the new shell.
          </li>
        </ul>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */

function SectionHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div>
      <h2 className="text-xl font-semibold">{title}</h2>
      {subtitle && <p className="text-sm text-white/60 mt-1">{subtitle}</p>}
    </div>
  );
}

function KPICard({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.03] p-4">
      <div className="text-xs uppercase tracking-wide text-white/50">{label}</div>
      <div className="mt-1 text-2xl font-semibold tabular-nums">{value}</div>
    </div>
  );
}

function PaneList({
  title,
  rows,
  emptyText,
  linkPrefix,
}: {
  title: string;
  rows: { rank: number; driver_id: string; label: string; value: string; sub?: string }[];
  emptyText: string;
  linkPrefix: (id: string) => string;
}) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.02] p-4">
      <h3 className="text-sm font-semibold mb-3">{title}</h3>
      {rows.length === 0 ? (
        <p className="text-xs text-white/50">{emptyText}</p>
      ) : (
        <ul className="space-y-1.5">
          {rows.map((r) => (
            <li key={r.driver_id} className="flex items-center justify-between gap-2">
              <Link
                href={linkPrefix(r.driver_id)}
                className="flex items-baseline gap-2 text-sm text-white hover:text-cyan-300"
              >
                <span className="text-white/40 tabular-nums w-4">{r.rank}</span>
                <span className="truncate">{r.label}</span>
                {r.sub && <span className="text-xs text-white/40">{r.sub}</span>}
              </Link>
              <span className="text-sm font-semibold tabular-nums text-white">{r.value}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
