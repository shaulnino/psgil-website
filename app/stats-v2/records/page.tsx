import Link from "next/link";
import { loadStatsV2Bundle } from "@/lib/statsV2/dataLoader";
import { parseFiltersFromParams, filterResultsByFilters } from "@/lib/statsV2/filters";
import { computeDriverMetrics, type DriverMetrics } from "@/lib/statsV2/metrics";

export const revalidate = 300;

type SearchParams = Record<string, string | string[] | undefined>;

type Column = {
  key: keyof DriverMetrics;
  label: string;
  format?: (v: unknown) => string;
};

const COLUMNS: Column[] = [
  { key: "events", label: "Races" },
  { key: "wins", label: "Wins" },
  { key: "podiums", label: "Podiums" },
  { key: "poles", label: "Poles" },
  { key: "fastest_laps", label: "FL" },
  { key: "dotd", label: "DOTD" },
  { key: "top5", label: "T5" },
  { key: "top10", label: "T10" },
  { key: "dnfs", label: "DNFs" },
  { key: "total_points", label: "Pts" },
  { key: "laps_led", label: "Laps Led" },
  {
    key: "avg_finish",
    label: "Avg Fin",
    format: (v) => (typeof v === "number" ? v.toFixed(2) : "—"),
  },
  {
    key: "avg_grid",
    label: "Avg Grid",
    format: (v) => (typeof v === "number" ? v.toFixed(2) : "—"),
  },
  {
    key: "finish_rate",
    label: "Finish %",
    format: (v) => (typeof v === "number" ? `${(v * 100).toFixed(1)}%` : "—"),
  },
];

export default async function RecordsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const filters = parseFiltersFromParams(sp);
  const bundle = await loadStatsV2Bundle();

  const filtered = filterResultsByFilters(bundle.results, bundle.eventMap, filters);
  const metrics = computeDriverMetrics(filtered, bundle.eventMap)
    .filter((m) => m.events >= filters.minSample);

  const sortKey = typeof sp.sort === "string" ? sp.sort : "total_points";
  const dir = sp.dir === "asc" ? "asc" : "desc";

  const sorted = [...metrics].sort((a, b) => {
    const av = a[sortKey as keyof DriverMetrics];
    const bv = b[sortKey as keyof DriverMetrics];
    const aN = typeof av === "number" ? av : -Infinity;
    const bN = typeof bv === "number" ? bv : -Infinity;
    return dir === "asc" ? aN - bN : bN - aN;
  });

  const baseSp = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) {
    if (k === "sort" || k === "dir") continue;
    if (typeof v === "string") baseSp.set(k, v);
    else if (Array.isArray(v)) v.forEach((x) => baseSp.append(k, x));
  }

  function sortHref(col: Column): string {
    const params = new URLSearchParams(baseSp);
    params.set("sort", String(col.key));
    if (sortKey === col.key) {
      params.set("dir", dir === "desc" ? "asc" : "desc");
    } else {
      params.set("dir", "desc");
    }
    return `/stats-v2/records?${params.toString()}`;
  }

  function driverHref(id: string): string {
    return baseSp.toString()
      ? `/stats-v2/drivers/${encodeURIComponent(id)}?${baseSp.toString()}`
      : `/stats-v2/drivers/${encodeURIComponent(id)}`;
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">Record Book</h2>
        <p className="text-sm text-white/60">
          Layer 1 raw counting stats. Click any column header to re-sort.
        </p>
      </div>

      <div className="rounded-lg border border-white/10 bg-white/[0.02] p-4 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs text-white/50 border-b border-white/10">
              <th className="text-left py-2 px-2 font-medium sticky left-0 bg-[#0a0a0b]">Driver</th>
              <th className="text-left py-2 px-2 font-medium">Team</th>
              {COLUMNS.map((c) => {
                const isActive = sortKey === c.key;
                return (
                  <th key={String(c.key)} className="text-right py-2 px-2 font-medium">
                    <Link
                      href={sortHref(c)}
                      className={`hover:text-white ${isActive ? "text-cyan-300" : "text-white/50"}`}
                    >
                      {c.label}
                      {isActive && <span className="ml-0.5">{dir === "desc" ? "↓" : "↑"}</span>}
                    </Link>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {sorted.map((m) => (
              <tr key={m.driver_id} className="border-b border-white/5 hover:bg-white/[0.03]">
                <td className="py-1.5 px-2 sticky left-0 bg-[#0a0a0b]">
                  <Link href={driverHref(m.driver_id)} className="text-cyan-300 hover:underline">
                    {m.driver_name || m.driver_id}
                  </Link>
                </td>
                <td className="py-1.5 px-2 text-white/70 truncate max-w-[120px]">{m.team || "—"}</td>
                {COLUMNS.map((c) => {
                  const v = m[c.key];
                  const display = c.format ? c.format(v) : typeof v === "number" ? String(v) : "—";
                  return (
                    <td key={String(c.key)} className="py-1.5 px-2 text-right tabular-nums">
                      {display}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
