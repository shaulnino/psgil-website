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
} from "recharts";
import type { TeamProfile } from "@/lib/stats/teamProfile";
import { localizedRaceName } from "@/lib/scheduleData";
import { SectionCard, Pill, CHART_THEME, SINGLE_COLOR } from "@/components/stats/shared";

type ViewId = "cumulative" | "perRound";
const VIEWS: ViewId[] = ["cumulative", "perRound"];

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

export function TeamsCharts({ profile }: { profile: TeamProfile }) {
  const t = useTranslations("stats");
  const locale = useLocale();
  const [view, setView] = useState<ViewId>("cumulative");

  const data = useMemo(
    () =>
      profile.form.map((f, i) => ({
        idx: i + 1,
        name: `${localizedRaceName({ race_name: f.label, race_name_he: f.labelHe }, locale)} · ${f.seasonKey}`,
        points: f.points,
        cumulative: f.cumulative,
      })),
    [profile.form, locale],
  );

  const hasData = data.length > 0;

  return (
    <SectionCard id="team-form" title={t("teamsTab.sections.form")}>
      <div className="space-y-4 rounded-[2px] border border-[color:var(--isl-hairline)] bg-cream p-4 sm:p-6">
        <div className="flex flex-wrap gap-1.5">
          {VIEWS.map((v) => (
            <Pill key={v} active={view === v} onClick={() => setView(v)}>
              {t(`teamsTab.charts.${v}`)}
            </Pill>
          ))}
        </div>

        {!hasData ? (
          <div className="flex h-56 items-center justify-center">
            <p className="text-sm text-meta">{t("teamsTab.charts.empty")}</p>
          </div>
        ) : (
          <div className="h-72">
            <ResponsiveContainer width="100%" height={288}>
              {view === "cumulative" ? (
                <LineChart data={data} margin={{ top: 8, right: 12, bottom: 4, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={CHART_THEME.grid} />
                  <XAxis dataKey="idx" tick={axisTick} axisLine={axisLine} tickLine={false} />
                  <YAxis tick={axisTick} axisLine={axisLine} tickLine={false} width={36} allowDecimals={false} />
                  <Tooltip contentStyle={tooltipStyle} labelFormatter={(l) => data[Number(l) - 1]?.name ?? l} />
                  <Line
                    type="monotone"
                    dataKey="cumulative"
                    name={t("teamsTab.charts.seriesCumulative")}
                    stroke={SINGLE_COLOR}
                    strokeWidth={2.5}
                    dot={{ r: 2, fill: SINGLE_COLOR }}
                    activeDot={{ r: 5 }}
                  />
                </LineChart>
              ) : (
                <BarChart data={data} margin={{ top: 8, right: 12, bottom: 4, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={CHART_THEME.grid} />
                  <XAxis dataKey="idx" tick={axisTick} axisLine={axisLine} tickLine={false} />
                  <YAxis tick={axisTick} axisLine={axisLine} tickLine={false} width={36} allowDecimals={false} />
                  <Tooltip contentStyle={tooltipStyle} labelFormatter={(l) => data[Number(l) - 1]?.name ?? l} />
                  <Bar dataKey="points" name={t("teamsTab.charts.seriesPoints")} fill={SINGLE_COLOR} />
                </BarChart>
              )}
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </SectionCard>
  );
}
