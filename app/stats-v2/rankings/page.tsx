import Link from "next/link";
import { loadStatsV2Bundle } from "@/lib/statsV2/dataLoader";
import { parseFiltersFromParams, filterResultsByFilters } from "@/lib/statsV2/filters";
import { computeDriverMetrics } from "@/lib/statsV2/metrics";
import { RANKING_TEMPLATES, applyRanking } from "@/lib/statsV2/rankings";

export const revalidate = 300;

type SearchParams = Record<string, string | string[] | undefined>;

export default async function RankingsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const filters = parseFiltersFromParams(sp);
  const bundle = await loadStatsV2Bundle();

  const filtered = filterResultsByFilters(bundle.results, bundle.eventMap, filters);
  const metrics = computeDriverMetrics(filtered, bundle.eventMap);

  const tParam = typeof sp.t === "string" ? sp.t : Array.isArray(sp.t) ? sp.t[0] : "pace";
  const active = RANKING_TEMPLATES.find((r) => r.id === tParam) ?? RANKING_TEMPLATES[0];

  const rows = applyRanking(metrics, active, filters.minSample).slice(0, 30);

  function fmt(v: number | null): string {
    if (v === null) return "—";
    if (active.metric === "finish_rate" || active.metric === "pole_to_win" || active.metric === "front_row_to_win" || active.metric === "top3_grid_to_podium") {
      return `${(v * 100).toFixed(1)}%`;
    }
    if (Number.isInteger(v)) return String(v);
    return v.toFixed(2);
  }

  // Preserve query for tab links
  const baseSp = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) {
    if (k === "t") continue;
    if (typeof v === "string") baseSp.set(k, v);
    else if (Array.isArray(v)) v.forEach((x) => baseSp.append(k, x));
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">Rankings Studio</h2>
        <p className="text-sm text-white/60">
          Pre-built leaderboards across the derived-metric pyramid. All respect the global filter.
        </p>
      </div>

      <div className="rounded-lg border border-white/10 bg-white/[0.02] p-3 flex flex-wrap gap-1.5">
        {RANKING_TEMPLATES.map((t) => {
          const params = new URLSearchParams(baseSp);
          params.set("t", t.id);
          const href = `/stats-v2/rankings?${params.toString()}`;
          const isActive = t.id === active.id;
          return (
            <Link
              key={t.id}
              href={href}
              className={`rounded-md px-2.5 py-1 text-xs border transition-colors ${
                isActive
                  ? "border-cyan-400/40 bg-cyan-500/15 text-cyan-100"
                  : "border-white/10 bg-white/[0.03] text-white/80 hover:bg-white/[0.07]"
              }`}
            >
              {t.label}
            </Link>
          );
        })}
      </div>

      <div className="rounded-lg border border-white/10 bg-white/[0.02] p-4">
        <div className="flex items-baseline justify-between gap-3 mb-3">
          <div>
            <h3 className="text-base font-semibold">{active.label}</h3>
            <p className="text-xs text-white/60 mt-0.5">{active.description}</p>
          </div>
          <span className="text-xs text-white/45">
            min {Math.max(active.minEvents ?? 1, filters.minSample)} race{(active.minEvents ?? 1) === 1 ? "" : "s"}
          </span>
        </div>

        {rows.length === 0 ? (
          <p className="text-sm text-white/60">No drivers meet the threshold for this ranking under the current filter.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-white/50 border-b border-white/10">
                  <th className="text-left py-2 px-2 font-medium w-10">#</th>
                  <th className="text-left py-2 px-2 font-medium">Driver</th>
                  <th className="text-left py-2 px-2 font-medium">Team</th>
                  <th className="text-right py-2 px-2 font-medium">{active.label}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const driverHref = `/stats-v2/drivers/${encodeURIComponent(r.driver_id)}${baseSp.toString() ? `?${baseSp.toString()}` : ""}`;
                  return (
                    <tr key={r.driver_id} className="border-b border-white/5 hover:bg-white/[0.03]">
                      <td className="py-2 px-2 tabular-nums text-white/60">{r.rank}</td>
                      <td className="py-2 px-2">
                        <Link href={driverHref} className="text-cyan-300 hover:underline">
                          {r.driver_name}
                        </Link>
                      </td>
                      <td className="py-2 px-2 text-white/70">{r.team || "—"}</td>
                      <td className="py-2 px-2 text-right tabular-nums font-semibold">{fmt(r.value)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
