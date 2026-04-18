import Link from "next/link";
import { loadStatsV2Bundle } from "@/lib/statsV2/dataLoader";
import { computeSeasonAnalytics } from "@/lib/statsV2/seasons";
import { buildSeasonNarrative } from "@/lib/statsV2/narrative";

export const revalidate = 300;

type SearchParams = Record<string, string | string[] | undefined>;

export default async function SeasonPage({
  params,
  searchParams,
}: {
  params: Promise<{ season: string }>;
  searchParams: Promise<SearchParams>;
}) {
  const { season } = await params;
  const seasonKey = decodeURIComponent(season);
  const sp = await searchParams;
  const bundle = await loadStatsV2Bundle();

  const all = computeSeasonAnalytics(bundle.results, bundle.events, bundle.seasons);
  const s = all.find((x) => x.season_key.toLowerCase() === seasonKey.toLowerCase());

  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) {
    if (typeof v === "string") qs.set(k, v);
    else if (Array.isArray(v)) v.forEach((x) => qs.append(k, x));
  }

  if (!s) {
    return (
      <div>
        <Link href={`/stats-v2/league?${qs.toString()}`} className="text-sm text-cyan-300 hover:underline">
          ← Back to seasons
        </Link>
        <p className="mt-4 text-white/70">No data for season {seasonKey}.</p>
      </div>
    );
  }

  const cards = buildSeasonNarrative({
    seasonKey: s.season_key,
    uniqueWinners: s.unique_winners,
    totalRaces: s.total_races,
    championName: s.champion?.driver_name ?? null,
    competitivenessIndex: s.competitiveness_index,
    dominanceShare: s.dominance_share,
  });

  // Title race chart bounds
  const lastRound = s.title_race[s.title_race.length - 1];
  const maxPts = Math.max(
    lastRound?.leader_points ?? 0,
    lastRound?.runner_up_points ?? 0,
    1,
  );

  return (
    <div className="space-y-6">
      <Link
        href={`/stats-v2/league?${qs.toString()}`}
        className="text-sm text-cyan-300 hover:underline"
      >
        ← Back to seasons
      </Link>

      <div>
        <h2 className="text-2xl font-bold">{s.season_label}</h2>
        <p className="text-sm text-white/60">
          {s.total_races} races · {s.total_drivers} drivers · {s.unique_winners} unique winners
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KPI label="Competitiveness Index" value={`${s.competitiveness_index}/100`} />
        <KPI label="Dominance Share" value={s.dominance_share !== null ? `${Math.round(s.dominance_share * 100)}%` : "—"} />
        <KPI label="DNF Rate" value={`${(s.dnf_rate * 100).toFixed(1)}%`} />
        <KPI label="Overtakes / Race" value={s.overtake_density !== null ? s.overtake_density.toFixed(1) : "—"} />
        <KPI label="Champion" value={s.champion?.driver_name ?? "—"} />
        <KPI label="Runner-up" value={s.runner_up?.driver_name ?? "—"} />
        <KPI label="Title Margin (pts)" value={s.champion && s.runner_up ? `${s.champion.points - s.runner_up.points}` : "—"} />
        <KPI label="Midfield Compression" value={s.midfield_compression !== null ? s.midfield_compression.toFixed(3) : "—"} />
      </div>

      <div className="rounded-lg border border-white/10 bg-white/[0.02] p-4">
        <h3 className="text-sm font-semibold mb-3">Auto-narrative</h3>
        <div className="grid gap-2">
          {cards.map((c, i) => (
            <div
              key={i}
              className={`rounded-md border px-3 py-2 text-sm ${
                c.kind === "headline"
                  ? "border-cyan-500/30 bg-cyan-500/5 text-white"
                  : "border-white/10 bg-white/[0.02] text-white/80"
              }`}
            >
              {c.text}
            </div>
          ))}
        </div>
      </div>

      {s.title_race.length > 0 && s.champion && s.runner_up && (
        <div className="rounded-lg border border-white/10 bg-white/[0.02] p-4">
          <h3 className="text-sm font-semibold mb-3">Title Race</h3>
          <div className="text-xs text-white/60 mb-2">
            <span className="inline-flex items-center gap-1.5 mr-3">
              <span className="h-2 w-2 rounded-full bg-cyan-400" />
              {s.champion.driver_name}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-orange-400" />
              {s.runner_up.driver_name}
            </span>
          </div>
          <svg viewBox="0 0 600 200" className="w-full h-48">
            <line x1={20} y1={180} x2={580} y2={180} stroke="rgba(255,255,255,0.15)" strokeWidth={1} />
            <line x1={20} y1={20} x2={20} y2={180} stroke="rgba(255,255,255,0.15)" strokeWidth={1} />
            <polyline
              fill="none"
              stroke="#22d3ee"
              strokeWidth={2}
              points={s.title_race
                .map(
                  (p, i) =>
                    `${20 + (i / Math.max(1, s.title_race.length - 1)) * 560},${180 - (p.leader_points / maxPts) * 160}`,
                )
                .join(" ")}
            />
            <polyline
              fill="none"
              stroke="#fb923c"
              strokeWidth={2}
              points={s.title_race
                .map(
                  (p, i) =>
                    `${20 + (i / Math.max(1, s.title_race.length - 1)) * 560},${180 - (p.runner_up_points / maxPts) * 160}`,
                )
                .join(" ")}
            />
          </svg>
        </div>
      )}
    </div>
  );
}

function KPI({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
      <div className="text-[11px] uppercase tracking-wide text-white/45">{label}</div>
      <div className="mt-0.5 text-base font-semibold truncate">{value}</div>
    </div>
  );
}
