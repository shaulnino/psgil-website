import Link from "next/link";
import { loadStatsV2Bundle } from "@/lib/statsV2/dataLoader";
import { parseFiltersFromParams, filterResultsByFilters, filterEventsByFilters } from "@/lib/statsV2/filters";
import { computeCircuitStatsList } from "@/lib/statsV2/circuits";

export const revalidate = 300;

type SearchParams = Record<string, string | string[] | undefined>;

export default async function CircuitsIndex({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const filters = parseFiltersFromParams(sp);
  const bundle = await loadStatsV2Bundle();

  const events = filterEventsByFilters(bundle.events, filters);
  const results = filterResultsByFilters(bundle.results, bundle.eventMap, filters);
  const circuits = computeCircuitStatsList(results, events);

  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) {
    if (typeof v === "string") qs.set(k, v);
    else if (Array.isArray(v)) v.forEach((x) => qs.append(k, x));
  }
  const qsStr = qs.toString();

  const sorted = [...circuits].sort((a, b) => b.entries - a.entries);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">Circuits</h2>
        <p className="text-sm text-white/60">
          {sorted.length} track{sorted.length === 1 ? "" : "s"} · character tags derived from overtake density, DNF rate, and pole-to-win conversion.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {sorted.map((c) => {
          const href = qsStr
            ? `/stats-v2/circuits/${encodeURIComponent(c.track)}?${qsStr}`
            : `/stats-v2/circuits/${encodeURIComponent(c.track)}`;
          return (
            <Link
              key={c.track}
              href={href}
              className="block rounded-lg border border-white/10 bg-white/[0.02] p-4 hover:bg-white/[0.05] transition-colors"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-base font-semibold truncate">{c.track}</div>
                  <div className="text-xs text-white/50">
                    {c.event_ids.length} race{c.event_ids.length === 1 ? "" : "s"} · {c.unique_winners} unique winners
                  </div>
                </div>
              </div>

              {c.tags.length > 0 && (
                <div className="mt-3 flex items-center gap-2 flex-wrap">
                  {c.tags.map((t) => (
                    <span
                      key={t}
                      className="rounded-md bg-cyan-500/10 border border-cyan-500/20 px-2 py-0.5 text-xs text-cyan-200"
                    >
                      {t}
                    </span>
                  ))}
                </div>
              )}

              <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
                <Stat label="Avg overtakes" value={c.avg_overtakes_per_race ?? "—"} />
                <Stat label="DNF rate" value={`${(c.dnf_rate * 100).toFixed(1)}%`} />
                <Stat label="Pole→win" value={c.pole_to_win !== null ? `${Math.round(c.pole_to_win * 100)}%` : "—"} />
              </div>

              {c.specialist && (
                <div className="mt-3 text-xs text-white/70">
                  <span className="text-white/50">Specialist:</span>{" "}
                  <span className="text-white/90">{c.specialist.driver_name}</span>{" "}
                  <span className="text-white/50">(avg {c.specialist.avg_finish}, {c.specialist.races} races)</span>
                </div>
              )}
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
