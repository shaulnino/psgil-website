import Link from "next/link";
import { loadStatsV2Bundle } from "@/lib/statsV2/dataLoader";
import { computeSeasonAnalytics } from "@/lib/statsV2/seasons";
import { buildSeasonNarrative } from "@/lib/statsV2/narrative";

export const revalidate = 300;

type SearchParams = Record<string, string | string[] | undefined>;

export default async function LeaguePage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const bundle = await loadStatsV2Bundle();
  const analytics = computeSeasonAnalytics(bundle.results, bundle.events, bundle.seasons);

  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) {
    if (typeof v === "string") qs.set(k, v);
    else if (Array.isArray(v)) v.forEach((x) => qs.append(k, x));
  }
  const qsStr = qs.toString();

  const sorted = [...analytics].sort((a, b) => {
    const sa = parseInt(a.season_key.replace(/^S/i, ""), 10) || 0;
    const sb = parseInt(b.season_key.replace(/^S/i, ""), 10) || 0;
    return sb - sa;
  });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">League — Seasons</h2>
        <p className="text-sm text-white/60">
          Composite Competitiveness Index combines points distribution (Gini), unique-winner share, and dominance.
        </p>
        <p className="text-xs text-white/40 mt-1">
          Note: League pages currently summarise across both leagues for season-wide context. Use the league filter to drill into Main / Wild on driver-centric pages.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {sorted.map((s) => {
          const cards = buildSeasonNarrative({
            seasonKey: s.season_key,
            uniqueWinners: s.unique_winners,
            totalRaces: s.total_races,
            championName: s.champion?.driver_name ?? null,
            competitivenessIndex: s.competitiveness_index,
            dominanceShare: s.dominance_share,
          });
          const seasonHref = qsStr
            ? `/stats-v2/league/${encodeURIComponent(s.season_key)}?${qsStr}`
            : `/stats-v2/league/${encodeURIComponent(s.season_key)}`;

          return (
            <Link
              key={s.season_key}
              href={seasonHref}
              className="block rounded-lg border border-white/10 bg-white/[0.02] p-4 hover:bg-white/[0.05] transition-colors"
            >
              <div className="flex items-baseline justify-between gap-3">
                <div>
                  <div className="text-lg font-semibold">{s.season_label}</div>
                  <div className="text-xs text-white/50">{s.total_races} races · {s.total_drivers} drivers</div>
                </div>
                <div className="text-right">
                  <div className="text-xs text-white/40 uppercase tracking-wide">Comp. Index</div>
                  <div className="text-xl font-semibold tabular-nums">{s.competitiveness_index}</div>
                </div>
              </div>

              <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                <Mini label="Champion" value={s.champion?.driver_name ?? "—"} />
                <Mini label="Runner-up" value={s.runner_up?.driver_name ?? "—"} />
                <Mini label="Unique winners" value={String(s.unique_winners)} />
                <Mini label="Dominance" value={s.dominance_share !== null ? `${Math.round(s.dominance_share * 100)}%` : "—"} />
                <Mini label="DNF rate" value={`${(s.dnf_rate * 100).toFixed(1)}%`} />
                <Mini label="Avg overtakes" value={s.overtake_density !== null ? s.overtake_density.toFixed(1) : "—"} />
              </div>

              <div className="mt-3 grid gap-1.5">
                {cards.slice(0, 2).map((c, i) => (
                  <div key={i} className="text-xs text-white/70">{c.text}</div>
                ))}
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wide text-white/40">{label}</div>
      <div className="text-sm text-white/85 truncate">{value}</div>
    </div>
  );
}
