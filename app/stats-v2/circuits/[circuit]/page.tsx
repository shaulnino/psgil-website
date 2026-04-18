import Link from "next/link";
import { loadStatsV2Bundle } from "@/lib/statsV2/dataLoader";
import { parseFiltersFromParams, filterResultsByFilters, filterEventsByFilters } from "@/lib/statsV2/filters";
import { computeCircuitStatsList, findCircuit, computeDriverRecordsAtCircuit } from "@/lib/statsV2/circuits";

export const revalidate = 300;

type SearchParams = Record<string, string | string[] | undefined>;

export default async function CircuitPage({
  params,
  searchParams,
}: {
  params: Promise<{ circuit: string }>;
  searchParams: Promise<SearchParams>;
}) {
  const { circuit } = await params;
  const trackName = decodeURIComponent(circuit);
  const sp = await searchParams;
  const filters = parseFiltersFromParams(sp);
  const bundle = await loadStatsV2Bundle();

  const events = filterEventsByFilters(bundle.events, filters);
  const results = filterResultsByFilters(bundle.results, bundle.eventMap, filters);

  const list = computeCircuitStatsList(results, events);
  const c = findCircuit(list, trackName);

  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) {
    if (typeof v === "string") qs.set(k, v);
    else if (Array.isArray(v)) v.forEach((x) => qs.append(k, x));
  }
  const qsStr = qs.toString();
  const backHref = qsStr ? `/stats-v2/circuits?${qsStr}` : `/stats-v2/circuits`;

  if (!c) {
    return (
      <div>
        <Link href={backHref} className="text-sm text-cyan-300 hover:underline">
          ← Back to circuits
        </Link>
        <p className="mt-4 text-white/70">No data for circuit {trackName}.</p>
      </div>
    );
  }

  const records = computeDriverRecordsAtCircuit(results, events, c.track);

  return (
    <div className="space-y-6">
      <Link href={backHref} className="text-sm text-cyan-300 hover:underline">
        ← Back to circuits
      </Link>

      <div>
        <h2 className="text-2xl font-bold">{c.track}</h2>
        <p className="text-sm text-white/60">
          {c.event_ids.length} race{c.event_ids.length === 1 ? "" : "s"} · {c.unique_winners} unique winners · {c.driver_ids.length} drivers
        </p>
        {c.tags.length > 0 && (
          <div className="mt-2 flex items-center gap-2 flex-wrap">
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
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KPI label="Avg overtakes / race" value={c.avg_overtakes_per_race ?? "—"} />
        <KPI label="DNF rate" value={`${(c.dnf_rate * 100).toFixed(1)}%`} />
        <KPI label="Pole → Win" value={c.pole_to_win !== null ? `${Math.round(c.pole_to_win * 100)}%` : "—"} />
        <KPI label="Avg |Δ position|" value={c.avg_abs_position_change ?? "—"} />
        <KPI label="Steward penalty / entry" value={c.steward_penalty_rate} />
        <KPI label="Total entries" value={c.entries} />
        <KPI
          label="Specialist"
          value={c.specialist ? `${c.specialist.driver_name} (${c.specialist.avg_finish})` : "—"}
        />
      </div>

      <div className="rounded-lg border border-white/10 bg-white/[0.02] p-4">
        <h3 className="text-sm font-semibold mb-3">All-time records at {c.track}</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-white/50 border-b border-white/10">
                <th className="text-left py-2 px-2 font-medium">Driver</th>
                <th className="text-right py-2 px-2 font-medium">Races</th>
                <th className="text-right py-2 px-2 font-medium">Wins</th>
                <th className="text-right py-2 px-2 font-medium">Podiums</th>
                <th className="text-right py-2 px-2 font-medium">Best</th>
                <th className="text-right py-2 px-2 font-medium">Avg finish</th>
              </tr>
            </thead>
            <tbody>
              {records.map((r) => {
                const href = qsStr
                  ? `/stats-v2/drivers/${encodeURIComponent(r.driver_id)}?${qsStr}`
                  : `/stats-v2/drivers/${encodeURIComponent(r.driver_id)}`;
                return (
                  <tr key={r.driver_id} className="border-b border-white/5 hover:bg-white/[0.03]">
                    <td className="py-2 px-2">
                      <Link href={href} className="text-cyan-300 hover:underline">
                        {r.driver_name || r.driver_id}
                      </Link>
                    </td>
                    <td className="text-right py-2 px-2 tabular-nums">{r.races}</td>
                    <td className="text-right py-2 px-2 tabular-nums">{r.wins}</td>
                    <td className="text-right py-2 px-2 tabular-nums">{r.podiums}</td>
                    <td className="text-right py-2 px-2 tabular-nums">{r.best_finish ?? "—"}</td>
                    <td className="text-right py-2 px-2 tabular-nums">{r.avg_finish ?? "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function KPI({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
      <div className="text-[11px] uppercase tracking-wide text-white/45">{label}</div>
      <div className="mt-0.5 text-base font-semibold truncate">{value}</div>
    </div>
  );
}
