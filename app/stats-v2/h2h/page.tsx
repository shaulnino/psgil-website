import Link from "next/link";
import { loadStatsV2Bundle } from "@/lib/statsV2/dataLoader";
import { parseFiltersFromParams, filterResultsByFilters, filterEventsByFilters } from "@/lib/statsV2/filters";
import { computeDriverMetrics } from "@/lib/statsV2/metrics";
import { computeDriverDnaMap, type DnaAxis } from "@/lib/statsV2/dna";
import { computeH2HMatrix, buildH2HMetricRows } from "@/lib/statsV2/h2h";
import H2HPicker from "@/components/statsV2/H2HPicker";
import DnaRadar from "@/components/statsV2/DnaRadar";

export const revalidate = 300;

type SearchParams = Record<string, string | string[] | undefined>;

const COLORS = ["#22d3ee", "#fb923c", "#a78bfa", "#34d399"];

const DNA_AXES: DnaAxis[] = [
  "one_lap_pace",
  "race_pace",
  "race_craft",
  "consistency",
  "wet_conditions",
  "tyre_management",
  "reliability",
  "clutch",
];

export default async function H2HPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const filters = parseFiltersFromParams(sp);
  const bundle = await loadStatsV2Bundle();

  const events = filterEventsByFilters(bundle.events, filters);
  const results = filterResultsByFilters(bundle.results, bundle.eventMap, filters);
  const allMetrics = computeDriverMetrics(results, bundle.eventMap);
  const dnaMap = computeDriverDnaMap(allMetrics);

  const driverOpts = [...allMetrics]
    .sort((a, b) => (a.driver_name || a.driver_id).localeCompare(b.driver_name || b.driver_id))
    .map((m) => ({ id: m.driver_id, name: m.driver_name || m.driver_id }));

  const rawSel = sp.d;
  const selected = (Array.isArray(rawSel) ? rawSel : rawSel ? [rawSel] : []).slice(0, 4);
  const selectedMetrics = selected
    .map((id) => allMetrics.find((m) => m.driver_id === id))
    .filter((m): m is NonNullable<typeof m> => !!m);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">Head-to-Head</h2>
        <p className="text-sm text-white/60">
          Compare up to four drivers across shared races, derived metrics, and DNA profiles.
        </p>
      </div>

      <H2HPicker drivers={driverOpts} selected={selected} />

      {selectedMetrics.length < 2 ? (
        <div className="rounded-lg border border-white/10 bg-white/[0.02] p-6 text-center text-sm text-white/60">
          Select at least 2 drivers above to begin a comparison.
        </div>
      ) : (
        <>
          <H2HOverview metrics={selectedMetrics} dnaMap={dnaMap} />
          <H2HMatrixPanel
            results={results}
            events={events}
            driverIds={selectedMetrics.map((m) => m.driver_id)}
          />
          <H2HMetricsPanel metrics={selectedMetrics} />
        </>
      )}
    </div>
  );
}

function H2HOverview({
  metrics,
  dnaMap,
}: {
  metrics: ReturnType<typeof computeDriverMetrics>;
  dnaMap: Map<string, ReturnType<typeof computeDriverDnaMap> extends Map<string, infer V> ? V : never>;
}) {
  const series = metrics.map((m, i) => {
    const dna = dnaMap.get(m.driver_id);
    const values = Object.fromEntries(
      DNA_AXES.map((a) => [a, dna?.[a] ?? 0]),
    ) as Record<DnaAxis, number | null>;
    return { label: m.driver_name || m.driver_id, color: COLORS[i % COLORS.length], values };
  });

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <div className="rounded-lg border border-white/10 bg-white/[0.02] p-4">
        <h3 className="text-sm font-semibold mb-3">DNA overlay</h3>
        <DnaRadar series={series} />
        <div className="mt-3 flex flex-wrap gap-3 justify-center text-xs">
          {series.map((s) => (
            <span key={s.label} className="inline-flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: s.color }} />
              {s.label}
            </span>
          ))}
        </div>
      </div>

      <div className="rounded-lg border border-white/10 bg-white/[0.02] p-4">
        <h3 className="text-sm font-semibold mb-3">Snapshot</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-white/50 border-b border-white/10">
                <th className="text-left py-2 px-2 font-medium">Driver</th>
                <th className="text-right py-2 px-2 font-medium">Races</th>
                <th className="text-right py-2 px-2 font-medium">Wins</th>
                <th className="text-right py-2 px-2 font-medium">Podiums</th>
                <th className="text-right py-2 px-2 font-medium">Pts</th>
              </tr>
            </thead>
            <tbody>
              {metrics.map((m, i) => (
                <tr key={m.driver_id} className="border-b border-white/5">
                  <td className="py-2 px-2">
                    <span className="inline-flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                      {m.driver_name || m.driver_id}
                    </span>
                  </td>
                  <td className="text-right py-2 px-2 tabular-nums">{m.events}</td>
                  <td className="text-right py-2 px-2 tabular-nums">{m.wins}</td>
                  <td className="text-right py-2 px-2 tabular-nums">{m.podiums}</td>
                  <td className="text-right py-2 px-2 tabular-nums">{m.total_points}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function H2HMatrixPanel({
  results,
  events,
  driverIds,
}: {
  results: Awaited<ReturnType<typeof loadStatsV2Bundle>>["results"];
  events: Awaited<ReturnType<typeof loadStatsV2Bundle>>["events"];
  driverIds: string[];
}) {
  const matrix = computeH2HMatrix(results, events, driverIds);
  if (matrix.shared_races === 0) {
    return (
      <div className="rounded-lg border border-white/10 bg-white/[0.02] p-4 text-sm text-white/60">
        These drivers have not shared a race in the current filter scope.
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.02] p-4 space-y-4">
      <div className="flex items-baseline justify-between">
        <h3 className="text-sm font-semibold">Shared races</h3>
        <span className="text-xs text-white/50">{matrix.shared_races} race{matrix.shared_races === 1 ? "" : "s"}</span>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {matrix.shares.map((s, i) => (
          <div key={s.driver_id} className="rounded-md border border-white/10 bg-white/[0.03] p-3">
            <div className="flex items-baseline justify-between">
              <div className="text-sm font-semibold inline-flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                {s.driver_name}
              </div>
              <div className="text-xs text-white/50">{s.outright_wins} outright</div>
            </div>
            <div className="mt-2 grid gap-1 text-xs">
              {Object.entries(s.pairwise).map(([otherId, rec]) => {
                const other = matrix.shares.find((x) => x.driver_id === otherId);
                return (
                  <div key={otherId} className="flex justify-between text-white/70">
                    <span>vs {other?.driver_name ?? otherId}</span>
                    <span className="tabular-nums">
                      <span className="text-emerald-300">{rec.wins}W</span>{" "}
                      <span className="text-rose-300">{rec.losses}L</span>{" "}
                      <span className="text-white/40">{rec.ties}T</span>
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function H2HMetricsPanel({
  metrics,
}: {
  metrics: ReturnType<typeof computeDriverMetrics>;
}) {
  const rows = buildH2HMetricRows(metrics);

  function fmt(v: number | null, format: "raw" | "pct" | "decimal"): string {
    if (v === null) return "—";
    if (format === "pct") return `${(v * 100).toFixed(1)}%`;
    if (format === "decimal") return v.toFixed(2);
    return String(v);
  }

  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.02] p-4">
      <h3 className="text-sm font-semibold mb-3">Metric comparison</h3>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs text-white/50 border-b border-white/10">
              <th className="text-left py-2 px-2 font-medium">Metric</th>
              {metrics.map((m, i) => (
                <th key={m.driver_id} className="text-right py-2 px-2 font-medium">
                  <span className="inline-flex items-center gap-1.5 justify-end">
                    <span className="h-2 w-2 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                    {m.driver_name || m.driver_id}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.metric_key} className="border-b border-white/5 hover:bg-white/[0.02]">
                <td className="py-2 px-2 text-white/80">{r.label}</td>
                {r.values.map((v, i) => (
                  <td
                    key={i}
                    className={`text-right py-2 px-2 tabular-nums ${
                      r.best_indices.includes(i) ? "text-cyan-300 font-semibold" : "text-white/85"
                    }`}
                  >
                    {fmt(v, r.format)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-[11px] text-white/40">
        Cyan values mark the best performer per row. <Link href="/stats-v2/drivers" className="text-cyan-300 hover:underline">Open driver profiles →</Link>
      </p>
    </div>
  );
}
