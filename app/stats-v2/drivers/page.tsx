import Link from "next/link";
import { loadStatsV2Bundle } from "@/lib/statsV2/dataLoader";
import { parseFiltersFromParams, filterResultsByFilters } from "@/lib/statsV2/filters";
import { computeDriverMetrics } from "@/lib/statsV2/metrics";
import { computeDriverDnaMap, dnaAverage } from "@/lib/statsV2/dna";
import { computeArchetypes, computeDriverTier } from "@/lib/statsV2/identity";

export const revalidate = 300;

type SearchParams = Record<string, string | string[] | undefined>;

export default async function DriversIndex({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const filters = parseFiltersFromParams(sp);
  const bundle = await loadStatsV2Bundle();

  const filtered = filterResultsByFilters(bundle.results, bundle.eventMap, filters);
  const metrics = computeDriverMetrics(filtered, bundle.eventMap);
  const dnaByDriver = computeDriverDnaMap(metrics);

  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) {
    if (typeof v === "string") qs.set(k, v);
    else if (Array.isArray(v)) v.forEach((x) => qs.append(k, x));
  }
  const qsStr = qs.toString();

  // Sorted by DNA average desc (with min sample threshold from filters)
  const ranked = metrics
    .filter((m) => m.events >= filters.minSample)
    .map((m) => {
      const dna = dnaByDriver.get(m.driver_id) ?? null;
      const dnaAvg = dna ? dnaAverage(dna) : null;
      const tier = dna ? computeDriverTier(m, dna) : "Insufficient Sample";
      const archetypes = dna ? computeArchetypes(m, dna) : [];
      return { m, dna, dnaAvg, tier, archetypes };
    })
    .sort((a, b) => (b.dnaAvg ?? -1) - (a.dnaAvg ?? -1));

  return (
    <div className="space-y-6">
      <div className="flex items-baseline justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-xl font-semibold">Drivers</h2>
          <p className="text-sm text-white/60">
            {ranked.length} driver{ranked.length === 1 ? "" : "s"} · sorted by composite DNA score
          </p>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {ranked.map(({ m, dnaAvg, tier, archetypes }) => {
          const href = qsStr
            ? `/stats-v2/drivers/${encodeURIComponent(m.driver_id)}?${qsStr}`
            : `/stats-v2/drivers/${encodeURIComponent(m.driver_id)}`;
          return (
            <Link
              key={m.driver_id}
              href={href}
              className="block rounded-lg border border-white/10 bg-white/[0.02] p-4 hover:bg-white/[0.05] transition-colors"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-base font-semibold truncate">
                    {m.driver_name || m.driver_id}
                  </div>
                  <div className="text-xs text-white/50 truncate">{m.team || "—"}</div>
                </div>
                <div className="text-right">
                  <div className="text-xs text-white/40 uppercase tracking-wide">DNA</div>
                  <div className="text-xl font-semibold tabular-nums">
                    {dnaAvg ?? "—"}
                  </div>
                </div>
              </div>

              <div className="mt-3 flex items-center gap-2 flex-wrap">
                <span className="rounded-md bg-white/5 border border-white/10 px-2 py-0.5 text-xs text-white/80">
                  {tier}
                </span>
                {archetypes.slice(0, 3).map((a) => (
                  <span
                    key={a}
                    className="rounded-md bg-cyan-500/10 border border-cyan-500/20 px-2 py-0.5 text-xs text-cyan-200"
                  >
                    {a}
                  </span>
                ))}
              </div>

              <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
                <Stat label="Races" value={m.events} />
                <Stat label="Wins" value={m.wins} />
                <Stat label="Podiums" value={m.podiums} />
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-md bg-white/[0.03] px-2 py-1.5">
      <div className="text-[10px] uppercase tracking-wide text-white/40">{label}</div>
      <div className="text-sm font-semibold tabular-nums">{value}</div>
    </div>
  );
}
