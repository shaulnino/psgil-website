"use client";

import { useMemo, useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from "recharts";
import type { DriverProfile, RaceLine } from "@/lib/stats/driverProfile";
import { localizedRaceName } from "@/lib/scheduleData";
import { SectionCard, Pill, CHART_THEME, SINGLE_COLOR } from "@/components/stats/shared";

type ViewId = "finishByRace" | "cumulativePoints" | "netPerRace" | "distribution";

const VIEWS: ViewId[] = [
  "finishByRace",
  "cumulativePoints",
  "netPerRace",
  "distribution",
];

const axisTick = { fill: CHART_THEME.text, fontSize: 10 };
const axisLine = { stroke: CHART_THEME.border };
const tooltipStyle = {
  background: CHART_THEME.bg,
  border: `1px solid ${CHART_THEME.border}`,
  borderRadius: 2,
  fontSize: 12,
  color: "#1C1712",
  boxShadow: "none",
};

export function GraphSwitcher({ profile }: { profile: DriverProfile }) {
  const t = useTranslations("stats");
  const locale = useLocale();
  const [view, setView] = useState<ViewId>("finishByRace");
  const [showGrid, setShowGrid] = useState(false);

  // Chronological (ascending) — history is stored newest-first.
  const chrono: RaceLine[] = useMemo(
    () => [...profile.history].reverse(),
    [profile.history],
  );

  const finishData = useMemo(
    () =>
      chrono.map((r, i) => ({
        idx: i + 1,
        name: `${localizedRaceName({ race_name: r.raceName, race_name_he: r.raceNameHe }, locale)} · ${r.seasonKey}`,
        finish: r.status === "finished" ? r.finish : null,
        grid: r.gridRaw,
      })),
    [chrono, locale],
  );

  const cumulativeData = useMemo(() => {
    const totals = chrono.reduce<number[]>((acc, r) => {
      const prev = acc.length > 0 ? acc[acc.length - 1] : 0;
      return [...acc, prev + r.points];
    }, []);
    return chrono.map((r, i) => ({
      idx: i + 1,
      name: `${localizedRaceName({ race_name: r.raceName, race_name_he: r.raceNameHe }, locale)} · ${r.seasonKey}`,
      points: totals[i],
    }));
  }, [chrono, locale]);

  const netData = useMemo(
    () =>
      chrono
        .filter((r) => r.netChange !== null)
        .map((r, i) => ({
          idx: i + 1,
          name: `${localizedRaceName({ race_name: r.raceName, race_name_he: r.raceNameHe }, locale)} · ${r.seasonKey}`,
          net: r.netChange ?? 0,
        })),
    [chrono, locale],
  );

  const distributionData = useMemo(
    () =>
      profile.consistency.distribution
        .filter((d) => d.count > 0)
        .map((d) => ({ bucket: t(`driversTab.graph.buckets.${d.bucket}`), count: d.count, key: d.bucket })),
    [profile.consistency.distribution, t],
  );

  const maxFinish = useMemo(() => {
    const vals = finishData.map((d) => d.finish).filter((v): v is number => v !== null);
    const gridVals = finishData.map((d) => d.grid).filter((v): v is number => v !== null);
    return Math.max(20, ...vals, ...gridVals);
  }, [finishData]);

  const hasData = chrono.length > 0;

  return (
    <SectionCard
      id="trends"
      title={t("driversTab.sections.trends")}
      action={
        view === "finishByRace" ? (
          <Pill active={showGrid} onClick={() => setShowGrid((v) => !v)}>
            {t("driversTab.graph.showGrid")}
          </Pill>
        ) : undefined
      }
    >
      <div className="space-y-4 rounded-[2px] border border-[color:var(--isl-hairline)] bg-cream p-4 sm:p-6">
        <div className="flex flex-wrap gap-1.5">
          {VIEWS.map((v) => (
            <Pill key={v} active={view === v} onClick={() => setView(v)}>
              {t(`driversTab.graph.${v}`)}
            </Pill>
          ))}
        </div>

        {!hasData ? (
          <div className="flex h-56 items-center justify-center">
            <p className="text-sm text-meta">{t("driversTab.graph.empty")}</p>
          </div>
        ) : (
          <div className="h-72">
            <ResponsiveContainer width="100%" height={288}>
              {view === "finishByRace" ? (
                <LineChart data={finishData} margin={{ top: 8, right: 12, bottom: 4, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={CHART_THEME.grid} />
                  <XAxis dataKey="idx" tick={axisTick} axisLine={axisLine} tickLine={false} />
                  <YAxis
                    reversed
                    domain={[1, maxFinish]}
                    tick={axisTick}
                    axisLine={axisLine}
                    tickLine={false}
                    width={32}
                    label={{ value: t("driversTab.graph.axisPosition"), angle: -90, position: "insideLeft", fill: CHART_THEME.muted, fontSize: 10 }}
                  />
                  <Tooltip contentStyle={tooltipStyle} labelFormatter={(l) => finishData[Number(l) - 1]?.name ?? l} />
                  {showGrid && (
                    <Line type="monotone" dataKey="grid" name={t("driversTab.history.colGrid")} stroke={CHART_THEME.neutral} strokeWidth={1.5} strokeDasharray="4 3" dot={false} connectNulls />
                  )}
                  <Line type="monotone" dataKey="finish" name={t("driversTab.history.colFinish")} stroke={SINGLE_COLOR} strokeWidth={2.5} dot={{ r: 3, fill: SINGLE_COLOR }} activeDot={{ r: 5 }} connectNulls />
                  {showGrid && <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />}
                </LineChart>
              ) : view === "cumulativePoints" ? (
                <LineChart data={cumulativeData} margin={{ top: 8, right: 12, bottom: 4, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={CHART_THEME.grid} />
                  <XAxis dataKey="idx" tick={axisTick} axisLine={axisLine} tickLine={false} />
                  <YAxis tick={axisTick} axisLine={axisLine} tickLine={false} width={40} />
                  <Tooltip contentStyle={tooltipStyle} labelFormatter={(l) => cumulativeData[Number(l) - 1]?.name ?? l} />
                  <Line type="monotone" dataKey="points" name={t("driversTab.graph.axisPoints")} stroke={SINGLE_COLOR} strokeWidth={2.5} dot={{ r: 2, fill: SINGLE_COLOR }} activeDot={{ r: 5 }} />
                </LineChart>
              ) : view === "netPerRace" ? (
                <BarChart data={netData} margin={{ top: 8, right: 12, bottom: 4, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={CHART_THEME.grid} />
                  <XAxis dataKey="idx" tick={axisTick} axisLine={axisLine} tickLine={false} />
                  <YAxis tick={axisTick} axisLine={axisLine} tickLine={false} width={32} />
                  <Tooltip contentStyle={tooltipStyle} labelFormatter={(l) => netData[Number(l) - 1]?.name ?? l} />
                  <Bar dataKey="net" name={t("metrics.netPositions.label")}>
                    {netData.map((d, i) => (
                      <Cell key={i} fill={d.net >= 0 ? "#3F6B3A" : "#7E2A1E"} />
                    ))}
                  </Bar>
                </BarChart>
              ) : (
                <BarChart data={distributionData} margin={{ top: 8, right: 12, bottom: 4, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={CHART_THEME.grid} />
                  <XAxis dataKey="bucket" tick={axisTick} axisLine={axisLine} tickLine={false} interval={0} angle={-15} textAnchor="end" height={56} />
                  <YAxis tick={axisTick} axisLine={axisLine} tickLine={false} width={32} allowDecimals={false} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Bar dataKey="count" name={t("driversTab.graph.axisCount")} fill={SINGLE_COLOR} />
                </BarChart>
              )}
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </SectionCard>
  );
}
