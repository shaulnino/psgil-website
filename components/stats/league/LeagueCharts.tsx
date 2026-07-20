"use client";

import { useMemo, useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from "recharts";
import type { LeagueProfile } from "@/lib/stats/leagueProfile";
import { localizedRaceName } from "@/lib/scheduleData";
import { SectionCard, Pill, CHART_THEME, SINGLE_COLOR, COMPARE_COLOR } from "@/components/stats/shared";

type ViewId = "gridFinishers" | "diversityBySeason" | "dnfBySeason";

const VIEWS: ViewId[] = ["gridFinishers", "diversityBySeason", "dnfBySeason"];

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

export function LeagueCharts({ profile }: { profile: LeagueProfile }) {
  const t = useTranslations("stats");
  const locale = useLocale();
  const [view, setView] = useState<ViewId>("gridFinishers");

  const gridData = useMemo(
    () =>
      profile.events.map((e, i) => ({
        idx: i + 1,
        name: `${localizedRaceName({ race_name: e.ref.raceName, race_name_he: e.ref.raceNameHe }, locale)} · ${e.seasonKey}`,
        starters: e.starters,
        finishers: e.classified,
      })),
    [profile.events, locale],
  );

  const diversityData = useMemo(
    () =>
      profile.splits.bySeason.map((s) => ({
        season: s.seasonKey.replace(/^S/i, "S"),
        winners: s.differentWinners,
        races: s.races,
      })),
    [profile.splits.bySeason],
  );

  const dnfData = useMemo(
    () =>
      profile.splits.bySeason.map((s) => ({
        season: s.seasonKey.replace(/^S/i, "S"),
        dnf: s.dnfRate ?? 0,
      })),
    [profile.splits.bySeason],
  );

  const hasEvents = gridData.length > 0;
  const hasSeasons = diversityData.length > 0;
  const hasData = view === "gridFinishers" ? hasEvents : hasSeasons;

  return (
    <SectionCard id="league-trends" title={t("league.sections.trends")}>
      <div className="space-y-4 rounded-[2px] border border-[color:var(--isl-hairline)] bg-cream p-4 sm:p-6">
        <div className="flex flex-wrap gap-1.5">
          {VIEWS.map((v) => (
            <Pill key={v} active={view === v} onClick={() => setView(v)}>
              {t(`league.charts.${v}`)}
            </Pill>
          ))}
        </div>

        {!hasData ? (
          <div className="flex h-56 items-center justify-center">
            <p className="text-sm text-meta">{t("league.charts.empty")}</p>
          </div>
        ) : (
          <div className="h-72">
            <ResponsiveContainer width="100%" height={288}>
              {view === "gridFinishers" ? (
                <LineChart data={gridData} margin={{ top: 8, right: 12, bottom: 4, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={CHART_THEME.grid} />
                  <XAxis dataKey="idx" tick={axisTick} axisLine={axisLine} tickLine={false} />
                  <YAxis tick={axisTick} axisLine={axisLine} tickLine={false} width={32} allowDecimals={false} label={{ value: t("league.charts.axisCount"), angle: -90, position: "insideLeft", fill: CHART_THEME.muted, fontSize: 10 }} />
                  <Tooltip contentStyle={tooltipStyle} labelFormatter={(l) => gridData[Number(l) - 1]?.name ?? l} />
                  <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
                  <Line type="monotone" dataKey="starters" name={t("league.charts.seriesStarters")} stroke={SINGLE_COLOR} strokeWidth={2.5} dot={{ r: 2, fill: SINGLE_COLOR }} activeDot={{ r: 5 }} />
                  <Line type="monotone" dataKey="finishers" name={t("league.charts.seriesFinishers")} stroke={COMPARE_COLOR} strokeWidth={2} dot={false} />
                </LineChart>
              ) : view === "diversityBySeason" ? (
                <BarChart data={diversityData} margin={{ top: 8, right: 12, bottom: 4, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={CHART_THEME.grid} />
                  <XAxis dataKey="season" tick={axisTick} axisLine={axisLine} tickLine={false} />
                  <YAxis tick={axisTick} axisLine={axisLine} tickLine={false} width={32} allowDecimals={false} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Bar dataKey="winners" name={t("league.charts.seriesWinners")} fill={SINGLE_COLOR} />
                </BarChart>
              ) : (
                <BarChart data={dnfData} margin={{ top: 8, right: 12, bottom: 4, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={CHART_THEME.grid} />
                  <XAxis dataKey="season" tick={axisTick} axisLine={axisLine} tickLine={false} />
                  <YAxis tick={axisTick} axisLine={axisLine} tickLine={false} width={40} unit="%" />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Bar dataKey="dnf" name={t("league.charts.seriesDnf")} fill={CHART_THEME.highlight} />
                </BarChart>
              )}
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </SectionCard>
  );
}
