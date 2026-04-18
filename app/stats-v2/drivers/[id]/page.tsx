import Link from "next/link";
import DnaRadar from "@/components/statsV2/DnaRadar";
import { loadStatsV2Bundle } from "@/lib/statsV2/dataLoader";
import { parseFiltersFromParams, filterResultsByFilters } from "@/lib/statsV2/filters";
import { computeDriverMetrics, findDriverMetrics } from "@/lib/statsV2/metrics";
import { computeDriverDnaMap, dnaAverage, DNA_AXIS_LABELS, type DnaAxis } from "@/lib/statsV2/dna";
import { computeArchetypes, computeDriverTier, ARCHETYPE_DESCRIPTIONS } from "@/lib/statsV2/identity";
import { buildDriverNarrative } from "@/lib/statsV2/narrative";
import { computeDriverRecordsAtCircuit, computeCircuitStatsList } from "@/lib/statsV2/circuits";

export const revalidate = 300;

type SearchParams = Record<string, string | string[] | undefined>;

export default async function DriverProfile({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<SearchParams>;
}) {
  const { id } = await params;
  const driverId = decodeURIComponent(id);
  const sp = await searchParams;
  const filters = parseFiltersFromParams(sp);
  const bundle = await loadStatsV2Bundle();

  const filtered = filterResultsByFilters(bundle.results, bundle.eventMap, filters);
  const metrics = computeDriverMetrics(filtered, bundle.eventMap);
  const dnaByDriver = computeDriverDnaMap(metrics);

  const m = findDriverMetrics(metrics, driverId);
  if (!m) {
    return (
      <div className="space-y-4">
        <Link href={`/stats-v2/drivers?${new URLSearchParams(serialiseSp(sp)).toString()}`} className="text-sm text-cyan-300 hover:underline">
          ← Back to drivers
        </Link>
        <p className="text-white/70">No data for &quot;{driverId}&quot; in the current filter scope.</p>
      </div>
    );
  }

  const dna = dnaByDriver.get(m.driver_id) ?? {
    one_lap_pace: null, race_pace: null, race_craft: null, consistency: null,
    wet_conditions: null, tyre_management: null, reliability: null, clutch: null,
  };
  const dnaAvg = dnaAverage(dna);
  const tier = computeDriverTier(m, dna);
  const archetypes = computeArchetypes(m, dna);

  // Rank for total points within scope
  const sortedByPoints = [...metrics].sort((a, b) => b.total_points - a.total_points);
  const pointsRank = sortedByPoints.findIndex((x) => x.driver_id === m.driver_id) + 1;
  const narrative = buildDriverNarrative({
    metrics: m,
    dna,
    tier,
    archetypes,
    rankByMetric: { total_points: { rank: pointsRank, outOf: sortedByPoints.length } },
  });

  // Circuit map
  const circuits = computeCircuitStatsList(bundle.results, bundle.events);
  const circuitRecords = circuits
    .map((c) => {
      const recs = computeDriverRecordsAtCircuit(bundle.results, bundle.events, c.track);
      const own = recs.find((r) => r.driver_id === m.driver_id);
      return own ? { circuit: c.track, ...own } : null;
    })
    .filter((x): x is NonNullable<typeof x> => x !== null)
    .sort((a, b) => (a.avg_finish ?? 99) - (b.avg_finish ?? 99));

  // Series for DNA radar — driver + league avg
  const leagueAvgDna: Record<DnaAxis, number | null> = (() => {
    const acc: Record<DnaAxis, { sum: number; n: number }> = {
      one_lap_pace: { sum: 0, n: 0 }, race_pace: { sum: 0, n: 0 },
      race_craft: { sum: 0, n: 0 }, consistency: { sum: 0, n: 0 },
      wet_conditions: { sum: 0, n: 0 }, tyre_management: { sum: 0, n: 0 },
      reliability: { sum: 0, n: 0 }, clutch: { sum: 0, n: 0 },
    };
    for (const d of dnaByDriver.values()) {
      for (const k of Object.keys(acc) as DnaAxis[]) {
        const v = d[k];
        if (v !== null) {
          acc[k].sum += v;
          acc[k].n++;
        }
      }
    }
    const out = {} as Record<DnaAxis, number | null>;
    for (const k of Object.keys(acc) as DnaAxis[]) {
      out[k] = acc[k].n > 0 ? Math.round(acc[k].sum / acc[k].n) : null;
    }
    return out;
  })();

  const qs = new URLSearchParams(serialiseSp(sp)).toString();
  const link = (href: string) => (qs ? `${href}?${qs}` : href);

  return (
    <div className="space-y-8">
      <Link
        href={link("/stats-v2/drivers")}
        className="text-sm text-cyan-300 hover:underline"
      >
        ← Back to drivers
      </Link>

      {/* Identity hero */}
      <div className="grid gap-6 md:grid-cols-[1fr_auto]">
        <div>
          <div className="flex items-baseline gap-3 flex-wrap">
            <h2 className="text-3xl font-bold">{m.driver_name || m.driver_id}</h2>
            <span className="rounded-md bg-white/10 px-2 py-0.5 text-sm text-white/80">{m.team || "—"}</span>
            <span className="rounded-md bg-cyan-500/20 border border-cyan-500/30 px-2 py-0.5 text-sm text-cyan-100">
              {tier}
            </span>
          </div>

          {dnaAvg !== null && (
            <p className="mt-2 text-white/70">
              Composite DNA <span className="font-semibold text-white">{dnaAvg}/100</span>
            </p>
          )}

          {archetypes.length > 0 && (
            <div className="mt-3 flex items-center gap-2 flex-wrap">
              {archetypes.map((a) => (
                <span
                  key={a}
                  title={ARCHETYPE_DESCRIPTIONS[a]}
                  className="rounded-full bg-cyan-500/10 border border-cyan-500/30 px-3 py-1 text-xs text-cyan-200"
                >
                  {a}
                </span>
              ))}
            </div>
          )}

          {/* Narrative cards */}
          <div className="mt-4 grid gap-2">
            {narrative.map((c, i) => (
              <div
                key={i}
                className={`rounded-md border px-3 py-2 text-sm ${
                  c.kind === "headline"
                    ? "border-cyan-500/30 bg-cyan-500/5 text-white"
                    : c.kind === "weakness"
                      ? "border-orange-500/20 bg-orange-500/5 text-white/80"
                      : "border-white/10 bg-white/[0.02] text-white/80"
                }`}
              >
                {c.text}
              </div>
            ))}
          </div>
        </div>

        <div className="md:w-[420px]">
          <DnaRadar
            series={[
              {
                label: m.driver_name || m.driver_id,
                color: "#22d3ee",
                values: dna,
              },
              {
                label: "League avg",
                color: "#a3a3a3",
                values: leagueAvgDna,
              },
            ]}
          />
          <div className="mt-2 flex items-center justify-center gap-4 text-xs text-white/60">
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-cyan-400" />
              {m.driver_name || m.driver_id}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-neutral-400" />
              League avg
            </span>
          </div>
        </div>
      </div>

      {/* Layer 1 record table */}
      <div className="rounded-lg border border-white/10 bg-white/[0.02] p-4">
        <h3 className="text-sm font-semibold mb-3">Record Book</h3>
        <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-4 text-sm">
          <Stat label="Races" value={m.events} />
          <Stat label="Wins" value={m.wins} />
          <Stat label="Podiums" value={m.podiums} />
          <Stat label="Poles" value={m.poles} />
          <Stat label="Top 5" value={m.top5} />
          <Stat label="Top 10" value={m.top10} />
          <Stat label="Fastest Laps" value={m.fastest_laps} />
          <Stat label="DOTD" value={m.dotd} />
          <Stat label="DNFs" value={m.dnfs} />
          <Stat label="Total Points" value={m.total_points.toFixed(0)} />
          <Stat label="Avg. Finish" value={m.avg_finish?.toFixed(2) ?? "—"} />
          <Stat label="Avg. Grid" value={m.avg_grid?.toFixed(2) ?? "—"} />
        </div>
      </div>

      {/* Layer 2 derived metrics */}
      <div className="rounded-lg border border-white/10 bg-white/[0.02] p-4">
        <h3 className="text-sm font-semibold mb-3">Performance Analytics</h3>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4 text-sm">
          <Stat label="Pace Index" value={m.pace_index?.toFixed(0) ?? "—"} sub="0-100" />
          <Stat label="Race Craft" value={m.race_craft_score?.toFixed(0) ?? "—"} sub="0-100" />
          <Stat label="Clutch Score" value={m.clutch_score?.toFixed(0) ?? "—"} sub="0-100" />
          <Stat label="Format Adapt." value={m.format_adaptability?.toFixed(0) ?? "—"} sub="0-100" />
          <Stat label="Wet Δ vs Dry" value={m.wet_delta?.toFixed(2) ?? "—"} sub="positions" />
          <Stat label="Pole→Win" value={m.pole_to_win !== null ? `${(m.pole_to_win * 100).toFixed(0)}%` : "—"} />
          <Stat label="Front-Row→Win" value={m.front_row_to_win !== null ? `${(m.front_row_to_win * 100).toFixed(0)}%` : "—"} />
          <Stat label="PAP" value={m.peer_adjusted_points?.toFixed(0) ?? "—"} sub="vs expected" />
        </div>
      </div>

      {/* DNA breakdown */}
      <div className="rounded-lg border border-white/10 bg-white/[0.02] p-4">
        <h3 className="text-sm font-semibold mb-3">DNA Breakdown</h3>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {(Object.keys(DNA_AXIS_LABELS) as DnaAxis[]).map((axis) => {
            const v = dna[axis];
            return (
              <div key={axis} className="rounded-md bg-white/[0.02] px-3 py-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-white/60">{DNA_AXIS_LABELS[axis]}</span>
                  <span className="text-sm font-semibold tabular-nums">{v ?? "—"}</span>
                </div>
                {v !== null && (
                  <div className="mt-1 h-1.5 rounded-full bg-white/10 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-cyan-400"
                      style={{ width: `${v}%` }}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Circuit map */}
      {circuitRecords.length > 0 && (
        <div className="rounded-lg border border-white/10 bg-white/[0.02] p-4">
          <h3 className="text-sm font-semibold mb-3">Circuit Map</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase tracking-wide text-white/50">
                <tr>
                  <th className="py-1.5 pr-3">Circuit</th>
                  <th className="py-1.5 pr-3 text-right">Races</th>
                  <th className="py-1.5 pr-3 text-right">Wins</th>
                  <th className="py-1.5 pr-3 text-right">Podiums</th>
                  <th className="py-1.5 pr-3 text-right">Best</th>
                  <th className="py-1.5 pr-3 text-right">Avg</th>
                </tr>
              </thead>
              <tbody>
                {circuitRecords.slice(0, 30).map((r) => (
                  <tr key={r.circuit} className="border-t border-white/5">
                    <td className="py-1.5 pr-3">
                      <Link
                        href={link(`/stats-v2/circuits/${encodeURIComponent(r.circuit)}`)}
                        className="text-white hover:text-cyan-300"
                      >
                        {r.circuit}
                      </Link>
                    </td>
                    <td className="py-1.5 pr-3 text-right tabular-nums">{r.races}</td>
                    <td className="py-1.5 pr-3 text-right tabular-nums">{r.wins}</td>
                    <td className="py-1.5 pr-3 text-right tabular-nums">{r.podiums}</td>
                    <td className="py-1.5 pr-3 text-right tabular-nums">{r.best_finish ?? "—"}</td>
                    <td className="py-1.5 pr-3 text-right tabular-nums">{r.avg_finish ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="rounded-lg border border-white/10 bg-white/[0.02] p-4">
        <Link
          href={link(`/stats-v2/h2h?d=${encodeURIComponent(m.driver_id)}`)}
          className="text-sm text-cyan-300 hover:underline"
        >
          Compare {m.driver_name || m.driver_id} head-to-head with another driver →
        </Link>
      </div>
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="rounded-md bg-white/[0.03] px-3 py-2">
      <div className="text-[11px] uppercase tracking-wide text-white/40">{label}</div>
      <div className="mt-0.5 text-base font-semibold tabular-nums">{value}</div>
      {sub && <div className="text-[10px] text-white/35 mt-0.5">{sub}</div>}
    </div>
  );
}

function serialiseSp(sp: SearchParams): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(sp)) {
    if (typeof v === "string") out[k] = v;
    else if (Array.isArray(v) && v.length) out[k] = v.join(",");
  }
  return out;
}
