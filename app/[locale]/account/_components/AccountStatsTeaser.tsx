import { getTranslations } from "next-intl/server";
import { ArrowRight } from "lucide-react";
import LoadingLink from "@/components/LoadingLink";
import { StatCard } from "@/components/stats/shared";
import { formatMetric, type MetricUnit } from "@/lib/stats/metricCatalog";

/**
 * Compact, all-time driver-statistics teaser for the account page (PW).
 *
 * A read-only preview — NOT a second Drivers-Statistics page. Every value is
 * pre-computed server-side with the exact same engine the Drivers tab uses
 * (`computeDriverProfile` + `computeDriverStats`), so nothing is re-derived
 * here. Tile labels/tooltips are reused from the `stats.metrics.*` namespace
 * (already bilingual); only the heading + CTA come from `account`.
 *
 * The CTA opens the user's own driver profile in the full Statistics module.
 */
export type AccountStatsTeaserProps = {
  locale: string;
  /** English results-CSV name used for the Drivers-tab `?driver=` param. */
  urlName: string;
  /** Localized display name (Hebrew when available). */
  displayName: string;
  teamName: string | null;
  starts: number;
  wins: number;
  podiums: number;
  poles: number;
  points: number;
  bestFinish: number | null;
  avgFinish: number | null;
  driverRating: number | null;
  championshipPos: number | null;
};

const card =
  "rounded-[2px] border border-[color:var(--isl-hairline)] bg-cream p-5 md:p-6";
const ctaClass =
  "inline-flex shrink-0 items-center gap-1.5 rounded-[2px] border border-oxblood px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.06em] text-oxblood transition-colors hover:bg-oxblood/10";

export default async function AccountStatsTeaser({
  locale,
  urlName,
  displayName,
  teamName,
  starts,
  wins,
  podiums,
  poles,
  points,
  bestFinish,
  avgFinish,
  driverRating,
  championshipPos,
}: AccountStatsTeaserProps) {
  const t = await getTranslations("account.account");
  const tStats = await getTranslations("stats");

  const tiles: { id: string; unit: MetricUnit; value: number | null }[] = [
    { id: "starts", unit: "int", value: starts },
    { id: "wins", unit: "int", value: wins },
    { id: "podiums", unit: "int", value: podiums },
    { id: "poles", unit: "int", value: poles },
    { id: "points", unit: "int", value: points },
    { id: "bestFinish", unit: "pos", value: bestFinish },
    { id: "avgFinish", unit: "dec", value: avgFinish },
    { id: "driverRating", unit: "int", value: driverRating },
  ];

  const ratingSub =
    championshipPos != null
      ? `${tStats("metrics.championshipPos.label")} ${formatMetric(championshipPos, "pos", locale)}`
      : undefined;

  const ctaHref = `/stats?tab=Drivers&driver=${encodeURIComponent(urlName)}`;

  return (
    <div className={card}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-isl-body text-[0.7rem] font-semibold uppercase tracking-[0.2em] text-oxblood">
            {t("statsHeading")}
            <span className="text-meta"> · {tStats("toggle.allTime")}</span>
          </p>
          <p className="mt-1 truncate text-sm text-meta">
            <bdi className="font-semibold text-ink">{displayName}</bdi>
            {teamName && (
              <span className="text-meta">
                {" · "}
                <bdi>{teamName}</bdi>
              </span>
            )}
          </p>
        </div>
        <LoadingLink href={ctaHref} className={ctaClass}>
          {t("statsCta")}
          <ArrowRight className="h-3.5 w-3.5 shrink-0 rtl:rotate-180" aria-hidden />
        </LoadingLink>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {tiles.map((tile) => (
          <StatCard
            key={tile.id}
            label={tStats(`metrics.${tile.id}.label`)}
            value={formatMetric(tile.value, tile.unit, locale)}
            sub={tile.id === "driverRating" ? ratingSub : undefined}
            tooltip={tStats(`metrics.${tile.id}.tooltip`)}
          />
        ))}
      </div>
    </div>
  );
}
