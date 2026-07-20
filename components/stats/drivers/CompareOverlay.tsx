"use client";

import { useMemo } from "react";
import { useTranslations, useLocale } from "next-intl";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from "recharts";
import type { DriverProfile } from "@/lib/stats/driverProfile";
import { METRIC_CATALOG, formatMetric } from "@/lib/stats/metricCatalog";
import {
  SectionCard,
  CHART_THEME,
  SINGLE_COLOR,
  COMPARE_COLOR,
} from "@/components/stats/shared";

type StripMetric = {
  id: string;
  a: number | null;
  b: number | null;
};

function cumulative(profile: DriverProfile): number[] {
  const chrono = [...profile.history].reverse();
  const out: number[] = [];
  let acc = 0;
  for (const r of chrono) {
    acc += r.points;
    out.push(acc);
  }
  return out;
}

export function CompareOverlay({
  profileA,
  profileB,
  ratingA,
  ratingB,
  nameA,
  nameB,
  onOpenHeadToHead,
}: {
  profileA: DriverProfile;
  profileB: DriverProfile;
  ratingA: number | null;
  ratingB: number | null;
  /** Localized display names (fall back to the profile's English name). */
  nameA?: string;
  nameB?: string;
  onOpenHeadToHead?: () => void;
}) {
  const t = useTranslations("stats");
  const locale = useLocale();
  const labelA = nameA ?? profileA.driverName;
  const labelB = nameB ?? profileB.driverName;

  const strip: StripMetric[] = useMemo(
    () => [
      { id: "points", a: profileA.points, b: profileB.points },
      { id: "wins", a: profileA.wins, b: profileB.wins },
      { id: "podiums", a: profileA.podiums, b: profileB.podiums },
      { id: "avgFinish", a: profileA.avgFinish, b: profileB.avgFinish },
      { id: "pointsPerStart", a: profileA.pointsPerStart, b: profileB.pointsPerStart },
      { id: "winRate", a: profileA.results.winRate, b: profileB.results.winRate },
      { id: "driverRating", a: ratingA, b: ratingB },
    ],
    [profileA, profileB, ratingA, ratingB],
  );

  const chartData = useMemo(() => {
    const ca = cumulative(profileA);
    const cb = cumulative(profileB);
    const len = Math.max(ca.length, cb.length);
    const rows: { idx: number; a: number | null; b: number | null }[] = [];
    for (let i = 0; i < len; i++) {
      rows.push({
        idx: i + 1,
        a: i < ca.length ? ca[i] : null,
        b: i < cb.length ? cb[i] : null,
      });
    }
    return rows;
  }, [profileA, profileB]);

  const leader = (m: StripMetric): "a" | "b" | null => {
    if (m.a === null || m.b === null || m.a === m.b) return null;
    const higherBetter = METRIC_CATALOG[m.id]?.higherBetter ?? true;
    if (higherBetter) return m.a > m.b ? "a" : "b";
    return m.a < m.b ? "a" : "b";
  };

  return (
    <SectionCard
      id="compare"
      title={t("driversTab.compareOverlay.title")}
      action={
        onOpenHeadToHead ? (
          <button
            type="button"
            onClick={onOpenHeadToHead}
            className="text-sm font-semibold text-oxblood transition hover:text-oxblood-deep"
          >
            {t("driversTab.compareOverlay.fullComparison")}
          </button>
        ) : undefined
      }
    >
      {/* Metric strip */}
      <div className="overflow-hidden rounded-[2px] border border-[color:var(--isl-hairline)] bg-cream">
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 border-b border-[color:var(--isl-hairline-strong)] bg-sink px-4 py-2">
          <span className="text-sm font-bold" style={{ color: SINGLE_COLOR }}>{labelA}</span>
          <span className="text-[11px] font-semibold uppercase tracking-wider text-faint">{t("h2h.vs")}</span>
          <span className="text-end text-sm font-bold" style={{ color: COMPARE_COLOR }}>{labelB}</span>
        </div>
        {strip.map((m) => {
          const def = METRIC_CATALOG[m.id];
          const win = leader(m);
          return (
            <div key={m.id} className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 border-b border-[color:var(--isl-hairline)] px-4 py-1.5 last:border-0">
              <span className={`num text-sm font-semibold ${win === "a" ? "text-oxblood" : "text-faint"}`}>
                {formatMetric(m.a, def ? def.unit : "int", locale)}
              </span>
              <span className="whitespace-nowrap text-center text-[11px] font-medium text-meta">
                {t(`metrics.${m.id}.label`)}
              </span>
              <span className={`num text-end text-sm font-semibold ${win === "b" ? "text-oxblood" : "text-faint"}`}>
                {formatMetric(m.b, def ? def.unit : "int", locale)}
              </span>
            </div>
          );
        })}
      </div>

      {/* Shared cumulative-points chart */}
      <div className="mt-4 h-72 rounded-[2px] border border-[color:var(--isl-hairline)] bg-cream p-4">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 8, right: 12, bottom: 4, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={CHART_THEME.grid} />
            <XAxis dataKey="idx" tick={{ fill: CHART_THEME.text, fontSize: 10 }} axisLine={{ stroke: CHART_THEME.border }} tickLine={false} />
            <YAxis tick={{ fill: CHART_THEME.text, fontSize: 10 }} axisLine={{ stroke: CHART_THEME.border }} tickLine={false} width={40} />
            <Tooltip contentStyle={{ background: CHART_THEME.bg, border: `1px solid ${CHART_THEME.border}`, borderRadius: 2, fontSize: 12, color: "#1C1712", boxShadow: "none" }} />
            <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
            <Line type="monotone" dataKey="a" name={labelA} stroke={SINGLE_COLOR} strokeWidth={2.5} dot={false} connectNulls />
            <Line type="monotone" dataKey="b" name={labelB} stroke={COMPARE_COLOR} strokeWidth={2.5} dot={false} connectNulls />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </SectionCard>
  );
}
