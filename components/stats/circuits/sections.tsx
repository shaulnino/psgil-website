"use client";

import { useMemo, useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import {
  ResponsiveContainer,
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  ZAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import { Link } from "@/i18n/navigation";
import { localizedRaceName } from "@/lib/scheduleData";
import {
  CIRCUIT_METRIC_CATALOG,
} from "@/lib/stats/circuitMetricCatalog";
import { formatMetric } from "@/lib/stats/metricCatalog";
import type {
  CircuitProfile,
  CircuitEventRow,
  CircuitRaceRef,
  CircuitExtreme,
} from "@/lib/stats/circuitProfile";
import type { CircuitIdentity } from "@/lib/stats/circuitIdentity";
import {
  SectionCard,
  StatCard,
  StatLine,
  MetricTooltip,
} from "@/components/stats/shared";

/* ------------------------------------------------------------------ */
/*  Local helpers                                                       */
/* ------------------------------------------------------------------ */

type TFn = ReturnType<typeof useTranslations>;

function useCircuitText() {
  const t = useTranslations("stats");
  const locale = useLocale();
  return {
    t,
    locale,
    label: (id: string) => t(`circuitsTab.metrics.${id}.label`),
    tip: (id: string) => t(`circuitsTab.metrics.${id}.tooltip`),
    val: (id: string, value: number | null | undefined) =>
      formatMetric(value, CIRCUIT_METRIC_CATALOG[id]?.unit ?? "int", locale),
  };
}

function raceRefLabel(ref: CircuitRaceRef, locale: string): string {
  const name = localizedRaceName(
    { race_name: ref.raceName, race_name_he: ref.raceNameHe },
    locale,
  );
  return `${name} · ${ref.seasonKey}`;
}

function fmtDelta(v: number): string {
  return `${v > 0 ? "+" : ""}${v}`;
}

function MiniFlag({ code }: { code?: string }) {
  const trimmed = (code ?? "").trim().toLowerCase();
  if (!trimmed) return null;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`https://flagcdn.com/w40/${trimmed}.png`}
      alt=""
      aria-hidden
      className="h-4 w-6 shrink-0 rounded-[1px] object-cover"
      loading="lazy"
    />
  );
}

function useDisplayName(driverNamesHe?: Record<string, string>) {
  const locale = useLocale();
  return (id: string, name: string) =>
    locale === "he" ? driverNamesHe?.[id] || name : name;
}

/* ------------------------------------------------------------------ */
/*  1. Snapshot                                                         */
/* ------------------------------------------------------------------ */

export function CircuitSnapshotSection({
  profile,
  identity,
}: {
  profile: CircuitProfile;
  identity?: CircuitIdentity;
}) {
  const { t, locale, label, tip, val } = useCircuitText();
  const s = profile.snapshot;

  const gp = identity
    ? locale === "he" && identity.grandPrixHe
      ? identity.grandPrixHe
      : identity.grandPrix
    : profile.grandPrix;

  const recent = profile.mostRecentRace;
  const recentLabel = recent
    ? `${localizedRaceName({ race_name: recent.raceName, race_name_he: recent.raceNameHe }, locale)} · ${recent.seasonKey}`
    : t("circuitsTab.records.none");

  return (
    <SectionCard
      id="circuit-snapshot"
      title={t("circuitsTab.sections.snapshot")}
    >
      {/* Identity header */}
      <div className="mb-3 flex items-center gap-3 rounded-[2px] border border-[color:var(--isl-hairline)] bg-cream px-4 py-3">
        <MiniFlag code={identity?.countryCode} />
        <div className="min-w-0">
          <div className="truncate text-base font-extrabold text-ink">
            {identity ? (locale === "he" && identity.nameHe ? identity.nameHe : identity.name) : profile.name}
          </div>
          {gp && <div className="truncate text-[11px] text-faint">{gp}</div>}
        </div>
        <div className="ms-auto text-end">
          <div className="text-[10px] font-bold uppercase tracking-wider text-meta">
            {t("circuitsTab.sample.races", { count: profile.islRaces })}
          </div>
          {profile.mostRecentRace && (
            <div className="num text-[11px] text-faint">{recentLabel}</div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <StatCard label={label("islRaces")} value={val("islRaces", s.islRaces)} tooltip={tip("islRaces")} />
        <StatCard label={label("uniqueWinners")} value={val("uniqueWinners", s.uniqueWinners)} tooltip={tip("uniqueWinners")} />
        <StatCard label={label("poleToWinRate")} value={val("poleToWinRate", s.poleToWinRate)} sub={profile.qualifying.poleToWinSample ? t("circuitsTab.sample.races", { count: profile.qualifying.poleToWinSample }) : undefined} tooltip={tip("poleToWinRate")} />
        <StatCard label={label("avgWinningGrid")} value={val("avgWinningGrid", s.avgWinningGrid)} sub={profile.qualifying.avgWinningGridSample ? t("circuitsTab.sample.races", { count: profile.qualifying.avgWinningGridSample }) : undefined} tooltip={tip("avgWinningGrid")} />
        <StatCard label={label("classificationRate")} value={val("classificationRate", s.classificationRate)} sub={`${val("dnfRate", s.dnfRate)} ${label("dnfRate").toLowerCase()}`} tooltip={tip("classificationRate")} />
        <StatCard label={label("avgFieldSize")} value={val("avgFieldSize", s.avgFieldSize)} tooltip={tip("avgFieldSize")} />
      </div>
    </SectionCard>
  );
}

/* ------------------------------------------------------------------ */
/*  2. History (per-event table)                                        */
/* ------------------------------------------------------------------ */

function weatherText(t: TFn, w: CircuitEventRow["weather"]): string {
  return t(`weather.${w}`);
}

export function CircuitHistorySection({ profile }: { profile: CircuitProfile }) {
  const { t, locale } = useCircuitText();

  if (profile.history.length === 0) {
    return (
      <SectionCard id="circuit-history" title={t("circuitsTab.sections.history")}>
        <p className="rounded-[2px] border border-[color:var(--isl-hairline)] bg-cream px-4 py-6 text-center text-sm text-meta">
          {t("circuitsTab.empty.forFilters")}
        </p>
      </SectionCard>
    );
  }

  return (
    <SectionCard id="circuit-history" title={t("circuitsTab.sections.history")}>
      <div className="overflow-x-auto rounded-[2px] border border-[color:var(--isl-hairline)]">
        <table className="w-full text-sm">
          <thead className="bg-sink">
            <tr className="border-b border-[color:var(--isl-hairline-strong)] text-[11px] uppercase tracking-wider text-meta">
              <th className="px-3 py-1.5 text-start font-semibold">{t("circuitsTab.history.colRace")}</th>
              <th className="px-3 py-1.5 text-start font-semibold">{t("circuitsTab.history.colWeather")}</th>
              <th className="px-3 py-1.5 text-start font-semibold">{t("circuitsTab.history.colPole")}</th>
              <th className="px-3 py-1.5 text-start font-semibold">{t("circuitsTab.history.colWinner")}</th>
              <th className="px-3 py-1.5 text-end font-semibold">{t("circuitsTab.history.colWinnerGrid")}</th>
              <th className="px-3 py-1.5 text-end font-semibold">{t("circuitsTab.history.colStarters")}</th>
              <th className="px-3 py-1.5 text-end font-semibold">{t("circuitsTab.history.colDnf")}</th>
              <th className="px-3 py-1.5 text-end font-semibold">{t("circuitsTab.history.colLink")}</th>
            </tr>
          </thead>
          <tbody>
            {profile.history.map((e) => (
              <tr key={e.eventId} className="border-b border-[color:var(--isl-hairline)] last:border-0">
                <td className="px-3 py-1.5 text-start">
                  <div className="font-medium text-ink">
                    {localizedRaceName({ race_name: e.raceName, race_name_he: e.raceNameHe }, locale)}
                  </div>
                  <div className="num text-[11px] text-faint">
                    {e.seasonKey}
                    {e.date ? ` · ${e.date}` : ""}
                  </div>
                </td>
                <td className="px-3 py-1.5 text-start text-ink-2">{weatherText(t, e.weather)}</td>
                <td className="px-3 py-1.5 text-start text-ink-2">{e.poleName ?? "-"}</td>
                <td className="px-3 py-1.5 text-start font-semibold text-ink">{e.winnerName ?? "-"}</td>
                <td className="num px-3 py-1.5 text-end text-ink-2">{e.winnerGrid ?? "-"}</td>
                <td className="num px-3 py-1.5 text-end text-ink-2">{e.starters}</td>
                <td className="num px-3 py-1.5 text-end text-ink-2">{e.dnf}</td>
                <td className="px-3 py-1.5 text-end">
                  <Link
                    href={`/schedule/${e.eventId}`}
                    className="text-[11px] font-semibold text-oxblood underline-offset-2 hover:underline"
                  >
                    {t("circuitsTab.history.view")}
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </SectionCard>
  );
}

/* ------------------------------------------------------------------ */
/*  3. Qualifying vs race                                               */
/* ------------------------------------------------------------------ */

const CHART_THEME = {
  text: "#3A322A",
  muted: "#6E6455",
  border: "rgba(28,23,18,0.14)",
  grid: "rgba(28,23,18,0.10)",
  highlight: "#7E2A1E",
};
const axisTick = { fill: CHART_THEME.text, fontSize: 10 };
const axisLine = { stroke: CHART_THEME.border };
const tooltipStyle = {
  background: "#FBF8F0",
  border: `1px solid ${CHART_THEME.border}`,
  borderRadius: 2,
  fontSize: 12,
  color: "#1C1712",
  boxShadow: "none",
};

export function CircuitQualifyingSection({ profile }: { profile: CircuitProfile }) {
  const { t, label, tip, val } = useCircuitText();
  const q = profile.qualifying;

  const scatterData = useMemo(
    () =>
      q.gridVsFinish
        .filter((p) => p.finish !== null)
        .map((p) => ({ grid: p.grid, finish: p.finish as number, name: p.driverName })),
    [q.gridVsFinish],
  );
  const notShown = q.gridVsFinish.length - scatterData.length;

  const maxGrid = useMemo(
    () => Math.max(10, ...q.gridVsFinish.map((p) => p.grid), ...scatterData.map((p) => p.finish)),
    [q.gridVsFinish, scatterData],
  );

  const maxDistCount = Math.max(1, ...q.winnerGridDistribution.map((d) => d.count));

  return (
    <SectionCard id="circuit-qualifying" title={t("circuitsTab.sections.qualifying")}>
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-[2px] border border-[color:var(--isl-hairline)] bg-cream p-4">
          <div className="grid grid-cols-1 gap-x-6 gap-y-0.5">
            <StatLine label={label("poleToWinRate")} value={val("poleToWinRate", q.poleToWinRate)} sample={t("circuitsTab.sample.races", { count: q.poleToWinSample })} tooltip={tip("poleToWinRate")} />
            <StatLine label={label("frontRowToWinRate")} value={val("frontRowToWinRate", q.frontRowToWinRate)} tooltip={tip("frontRowToWinRate")} />
            <StatLine label={label("frontRowToPodiumRate")} value={val("frontRowToPodiumRate", q.frontRowToPodiumRate)} tooltip={tip("frontRowToPodiumRate")} />
            <StatLine label={label("avgWinningGrid")} value={val("avgWinningGrid", q.avgWinningGrid)} sample={t("circuitsTab.sample.races", { count: q.avgWinningGridSample })} tooltip={tip("avgWinningGrid")} />
            <StatLine label={label("avgPodiumGrid")} value={val("avgPodiumGrid", q.avgPodiumGrid)} tooltip={tip("avgPodiumGrid")} />
          </div>

          {/* Winner starting-grid distribution (CSS bars, RTL-safe) */}
          {q.winnerGridDistribution.length > 0 && (
            <div className="mt-4 space-y-1.5">
              <p className="text-xs font-semibold text-meta">{t("circuitsTab.qualifying.winnerGridDist")}</p>
              {q.winnerGridDistribution.map((d) => (
                <div key={d.grid} className="flex items-center gap-2">
                  <span className="num w-14 shrink-0 text-[11px] text-faint">
                    {t("circuitsTab.qualifying.gridN", { n: d.grid })}
                  </span>
                  <span className="h-3 flex-1 overflow-hidden rounded-[1px] bg-sink">
                    <span
                      className="block h-full bg-oxblood"
                      style={{ width: `${(d.count / maxDistCount) * 100}%` }}
                    />
                  </span>
                  <span className="num w-6 shrink-0 text-end text-[11px] font-semibold text-ink">{d.count}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Grid vs finish scatter */}
        <div className="rounded-[2px] border border-[color:var(--isl-hairline)] bg-cream p-4">
          <p className="mb-2 text-xs font-semibold text-meta">{t("circuitsTab.qualifying.gridVsFinish")}</p>
          {scatterData.length === 0 ? (
            <div className="flex h-56 items-center justify-center">
              <p className="text-sm text-meta">{t("circuitsTab.empty.noChartData")}</p>
            </div>
          ) : (
            <div className="h-64">
              <ResponsiveContainer width="100%" height={256}>
                <ScatterChart margin={{ top: 8, right: 12, bottom: 24, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={CHART_THEME.grid} />
                  <XAxis
                    type="number"
                    dataKey="grid"
                    name={t("circuitsTab.qualifying.axisGrid")}
                    domain={[1, maxGrid]}
                    tick={axisTick}
                    axisLine={axisLine}
                    tickLine={false}
                    label={{ value: t("circuitsTab.qualifying.axisGrid"), position: "insideBottom", offset: -12, fill: CHART_THEME.muted, fontSize: 10 }}
                  />
                  <YAxis
                    type="number"
                    dataKey="finish"
                    name={t("circuitsTab.qualifying.axisFinish")}
                    reversed
                    domain={[1, maxGrid]}
                    tick={axisTick}
                    axisLine={axisLine}
                    tickLine={false}
                    width={32}
                    label={{ value: t("circuitsTab.qualifying.axisFinish"), angle: -90, position: "insideLeft", fill: CHART_THEME.muted, fontSize: 10 }}
                  />
                  <ZAxis range={[50, 50]} />
                  <Tooltip contentStyle={tooltipStyle} cursor={{ strokeDasharray: "3 3" }} />
                  <Scatter data={scatterData} fill={CHART_THEME.highlight} />
                </ScatterChart>
              </ResponsiveContainer>
            </div>
          )}
          {notShown > 0 && (
            <p className="mt-1 text-[11px] text-faint">
              {t("circuitsTab.qualifying.notClassified", { count: notShown })}
            </p>
          )}
        </div>
      </div>
    </SectionCard>
  );
}

/* ------------------------------------------------------------------ */
/*  4. Specialists (rate-based)                                         */
/* ------------------------------------------------------------------ */

type SpecialistSortKey =
  | "starts"
  | "wins"
  | "podiums"
  | "poles"
  | "podiumRate"
  | "pointsPerStart"
  | "avgFinish"
  | "bestFinish"
  | "netPositions";

export function CircuitSpecialistsSection({
  profile,
  driverNamesHe,
  onSelectDriver,
}: {
  profile: CircuitProfile;
  driverNamesHe?: Record<string, string>;
  onSelectDriver?: (driverName: string) => void;
}) {
  const { t, val } = useCircuitText();
  const displayName = useDisplayName(driverNamesHe);
  const [sortKey, setSortKey] = useState<SpecialistSortKey>("wins");
  const [asc, setAsc] = useState(false);

  const rows = useMemo(() => {
    const copy = [...profile.specialists];
    copy.sort((a, b) => {
      const va = a[sortKey];
      const vb = b[sortKey];
      // avgFinish / bestFinish: lower is better; null sorts last.
      const lowerBetter = sortKey === "avgFinish" || sortKey === "bestFinish";
      const na = va === null ? (lowerBetter ? Number.POSITIVE_INFINITY : Number.NEGATIVE_INFINITY) : va;
      const nb = vb === null ? (lowerBetter ? Number.POSITIVE_INFINITY : Number.NEGATIVE_INFINITY) : vb;
      return asc ? na - nb : nb - na;
    });
    return copy;
  }, [profile.specialists, sortKey, asc]);

  if (rows.length === 0) {
    return (
      <SectionCard id="circuit-specialists" title={t("circuitsTab.sections.specialists")}>
        <p className="rounded-[2px] border border-[color:var(--isl-hairline)] bg-cream px-4 py-6 text-center text-sm text-meta">
          {t("circuitsTab.empty.forFilters")}
        </p>
      </SectionCard>
    );
  }

  const header = (key: SpecialistSortKey, labelText: string) => (
    <th className={`px-3 py-1.5 text-end font-semibold ${sortKey === key ? "text-oxblood" : ""}`}>
      <button
        type="button"
        onClick={() => {
          if (sortKey === key) setAsc((v) => !v);
          else {
            setSortKey(key);
            setAsc(false);
          }
        }}
        className="inline-flex items-center gap-1 hover:text-ink"
      >
        {labelText}
        {sortKey === key && <span aria-hidden>{asc ? "↑" : "↓"}</span>}
      </button>
    </th>
  );

  return (
    <SectionCard
      id="circuit-specialists"
      title={t("circuitsTab.sections.specialists")}
      note={t("driversTab.sample.thinNote", { n: 3 })}
    >
      <div className="overflow-x-auto rounded-[2px] border border-[color:var(--isl-hairline)]">
        <table className="w-full text-sm">
          <thead className="bg-sink">
            <tr className="border-b border-[color:var(--isl-hairline-strong)] text-[11px] uppercase tracking-wider text-meta">
              <th className="px-3 py-1.5 text-start font-semibold">{t("circuitsTab.specialists.colDriver")}</th>
              {header("starts", t("circuitsTab.metrics.starts.label"))}
              {header("wins", t("circuitsTab.metrics.wins.label"))}
              {header("podiums", t("circuitsTab.metrics.podiums.label"))}
              {header("poles", t("circuitsTab.metrics.poles.label"))}
              {header("podiumRate", t("circuitsTab.metrics.podiumRate.label"))}
              {header("pointsPerStart", t("circuitsTab.metrics.pointsPerStart.label"))}
              {header("avgFinish", t("circuitsTab.metrics.avgFinish.label"))}
              {header("netPositions", t("circuitsTab.metrics.netPositions.label"))}
            </tr>
          </thead>
          <tbody>
            {rows.map((d) => (
              <tr key={d.driverId || d.driverName} className="border-b border-[color:var(--isl-hairline)] last:border-0">
                <td className="px-3 py-1.5 text-start text-meta">
                  <span className="flex items-center gap-1.5">
                    {onSelectDriver ? (
                      <button
                        type="button"
                        onClick={() => onSelectDriver(d.driverName)}
                        className="font-medium text-ink underline-offset-2 hover:text-oxblood hover:underline"
                      >
                        {displayName(d.driverId, d.driverName)}
                      </button>
                    ) : (
                      <span className="font-medium text-ink">{displayName(d.driverId, d.driverName)}</span>
                    )}
                    {d.thin && (
                      <MetricTooltip text={t("driversTab.sample.thin")}>
                        <span className="text-[10px] text-brass-ink">*</span>
                      </MetricTooltip>
                    )}
                  </span>
                </td>
                <td className="num px-3 py-1.5 text-end font-semibold text-ink">{d.starts}</td>
                <td className="num px-3 py-1.5 text-end text-ink-2">{d.wins}</td>
                <td className="num px-3 py-1.5 text-end text-ink-2">{d.podiums}</td>
                <td className="num px-3 py-1.5 text-end text-ink-2">{d.poles}</td>
                <td className="num px-3 py-1.5 text-end text-ink-2">{val("podiumRate", d.podiumRate)}</td>
                <td className="num px-3 py-1.5 text-end text-ink-2">{val("pointsPerStart", d.pointsPerStart)}</td>
                <td className="num px-3 py-1.5 text-end text-ink-2">{val("avgFinish", d.avgFinish)}</td>
                <td className="num px-3 py-1.5 text-end text-ink-2">{fmtDelta(d.netPositions)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </SectionCard>
  );
}

/* ------------------------------------------------------------------ */
/*  5. Race characteristics (movement + reliability)                    */
/* ------------------------------------------------------------------ */

function extremeSub(ex: CircuitExtreme, locale: string): string | undefined {
  if (!ex) return undefined;
  const who = ex.holder ? `${ex.holder} · ` : "";
  return `${who}${raceRefLabel(ex.race, locale)}`;
}

export function CircuitCharacteristicsSection({ profile }: { profile: CircuitProfile }) {
  const { t, locale, label, tip, val } = useCircuitText();
  const c = profile.characteristics;

  return (
    <SectionCard id="circuit-characteristics" title={t("circuitsTab.sections.characteristics")}>
      <div className="rounded-[2px] border border-[color:var(--isl-hairline)] bg-cream p-4">
        <div className="grid grid-cols-1 gap-x-6 gap-y-0.5 sm:grid-cols-2 lg:grid-cols-3">
          <StatLine label={label("avgAbsMovement")} value={val("avgAbsMovement", c.avgAbsMovement)} sample={t("driversTab.sample.count", { count: c.movementSample })} tooltip={tip("avgAbsMovement")} />
          <StatLine label={label("avgNetMovement")} value={val("avgNetMovement", c.avgNetMovement)} tooltip={tip("avgNetMovement")} />
          <StatLine label={label("pctImproved")} value={val("pctImproved", c.pctImproved)} tooltip={tip("pctImproved")} />
          <StatLine label={label("classificationRate")} value={val("classificationRate", c.classificationRate)} tooltip={tip("classificationRate")} />
          <StatLine label={label("dnfRate")} value={val("dnfRate", c.dnfRate)} tooltip={tip("dnfRate")} />
          <StatLine
            label={label("bestRecovery")}
            value={c.bestRecovery ? formatMetric(c.bestRecovery.value, "delta", locale) : "-"}
            sample={extremeSub(c.bestRecovery, locale)}
            tooltip={tip("bestRecovery")}
          />
          <StatLine
            label={label("worstLoss")}
            value={c.worstLoss ? formatMetric(c.worstLoss.value, "delta", locale) : "-"}
            sample={extremeSub(c.worstLoss, locale)}
            tooltip={tip("worstLoss")}
          />
        </div>
      </div>
    </SectionCard>
  );
}

/* ------------------------------------------------------------------ */
/*  6. Conditions & discipline                                          */
/* ------------------------------------------------------------------ */

export function CircuitConditionsSection({ profile }: { profile: CircuitProfile }) {
  const { t, label, tip, val } = useCircuitText();
  const cond = profile.conditions;
  const weatherRows = cond.weatherSplits.filter((w) => w.races > 0);
  const showWeather = cond.weatherCoverage >= 0.5 && weatherRows.length >= 1;

  return (
    <SectionCard
      id="circuit-conditions"
      title={t("circuitsTab.sections.conditions")}
      note={
        cond.weatherCoverage < 0.5
          ? t("circuitsTab.conditions.lowCoverage")
          : undefined
      }
    >
      <div className="space-y-4">
        {showWeather && (
          <div className="overflow-x-auto rounded-[2px] border border-[color:var(--isl-hairline)]">
            <table className="w-full text-sm">
              <thead className="bg-sink">
                <tr className="border-b border-[color:var(--isl-hairline-strong)] text-[11px] uppercase tracking-wider text-meta">
                  <th className="px-3 py-1.5 text-start font-semibold">{t("circuitsTab.conditions.colWeather")}</th>
                  <th className="px-3 py-1.5 text-end font-semibold">{t("circuitsTab.conditions.colRaces")}</th>
                  <th className="px-3 py-1.5 text-end font-semibold">{t("circuitsTab.metrics.dnfRate.label")}</th>
                  <th className="px-3 py-1.5 text-end font-semibold">{t("circuitsTab.metrics.avgWinningGrid.label")}</th>
                </tr>
              </thead>
              <tbody>
                {weatherRows.map((w) => (
                  <tr key={w.key} className="border-b border-[color:var(--isl-hairline)] last:border-0">
                    <td className="px-3 py-1.5 text-start text-meta">
                      <span className="flex items-center gap-1.5">
                        {t(`weather.${w.key}`)}
                        {w.thin && (
                          <MetricTooltip text={t("driversTab.sample.thin")}>
                            <span className="text-[10px] text-brass-ink">*</span>
                          </MetricTooltip>
                        )}
                      </span>
                    </td>
                    <td className="num px-3 py-1.5 text-end font-semibold text-ink">{w.races}</td>
                    <td className="num px-3 py-1.5 text-end text-ink-2">{val("dnfRate", w.dnfRate)}</td>
                    <td className="num px-3 py-1.5 text-end text-ink-2">{val("avgWinningGrid", w.avgWinningGrid)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="rounded-[2px] border border-[color:var(--isl-hairline)] bg-cream p-4">
          <div className="grid grid-cols-1 gap-x-6 gap-y-0.5 sm:grid-cols-2 lg:grid-cols-3">
            <StatLine label={label("wetRate")} value={val("wetRate", cond.wetRate)} tooltip={tip("wetRate")} />
            <StatLine label={label("cleanRaceRate")} value={val("cleanRaceRate", cond.cleanRaceRate)} tooltip={tip("cleanRaceRate")} />
            <StatLine label={label("penaltiesPerRace")} value={val("penaltiesPerRace", cond.penaltiesPerRace)} tooltip={tip("penaltiesPerRace")} />
            {cond.safetyCarRate !== null && (
              <StatLine label={label("safetyCarRate")} value={val("safetyCarRate", cond.safetyCarRate)} tooltip={tip("safetyCarRate")} />
            )}
          </div>
        </div>
      </div>
    </SectionCard>
  );
}

/* ------------------------------------------------------------------ */
/*  7. Records (all-time for the circuit)                               */
/* ------------------------------------------------------------------ */

function RecordCard({
  label,
  value,
  sub,
  onClick,
}: {
  label: string;
  value: string;
  sub?: string;
  onClick?: () => void;
}) {
  return (
    <div className="rounded-[2px] border border-[color:var(--isl-hairline)] bg-cream px-4 py-3">
      <div className="text-[10px] font-bold uppercase tracking-wider text-meta">{label}</div>
      <div className="num mt-1 text-lg font-extrabold text-ink">
        {onClick ? (
          <button
            type="button"
            onClick={onClick}
            className="underline-offset-2 hover:text-oxblood hover:underline"
          >
            {value}
          </button>
        ) : (
          value
        )}
      </div>
      {sub && <div className="mt-0.5 truncate text-[11px] text-faint">{sub}</div>}
    </div>
  );
}

export function CircuitRecordsSection({
  profile,
  driverNamesHe,
  onSelectDriver,
}: {
  profile: CircuitProfile;
  driverNamesHe?: Record<string, string>;
  onSelectDriver?: (driverName: string) => void;
}) {
  const { t, locale, label, val } = useCircuitText();
  const displayName = useDisplayName(driverNamesHe);
  const rec = profile.records;
  const none = t("circuitsTab.records.none");

  return (
    <SectionCard
      id="circuit-records"
      title={t("circuitsTab.sections.records")}
      note={t("circuitsTab.records.allTimeNote")}
    >
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        <RecordCard
          label={t("circuitsTab.records.firstWinner")}
          value={rec.firstWinner ? displayName(rec.firstWinner.race.eventId, rec.firstWinner.holder) : none}
          sub={rec.firstWinner ? raceRefLabel(rec.firstWinner.race, locale) : undefined}
        />
        <RecordCard
          label={t("circuitsTab.records.mostWins")}
          value={rec.mostWins ? `${displayName(rec.mostWins.driverId, rec.mostWins.holder)}` : none}
          sub={rec.mostWins ? val("wins", rec.mostWins.value) : undefined}
          onClick={rec.mostWins && onSelectDriver ? () => onSelectDriver(rec.mostWins!.holder) : undefined}
        />
        <RecordCard
          label={t("circuitsTab.records.mostPoles")}
          value={rec.mostPoles ? `${displayName(rec.mostPoles.driverId, rec.mostPoles.holder)}` : none}
          sub={rec.mostPoles ? val("poles", rec.mostPoles.value) : undefined}
          onClick={rec.mostPoles && onSelectDriver ? () => onSelectDriver(rec.mostPoles!.holder) : undefined}
        />
        <RecordCard
          label={t("circuitsTab.records.mostPodiums")}
          value={rec.mostPodiums ? `${displayName(rec.mostPodiums.driverId, rec.mostPodiums.holder)}` : none}
          sub={rec.mostPodiums ? val("podiums", rec.mostPodiums.value) : undefined}
          onClick={rec.mostPodiums && onSelectDriver ? () => onSelectDriver(rec.mostPodiums!.holder) : undefined}
        />
        <RecordCard
          label={label("bestRecovery")}
          value={rec.bestRecovery ? formatMetric(rec.bestRecovery.value, "delta", locale) : none}
          sub={extremeSub(rec.bestRecovery, locale)}
        />
        <RecordCard
          label={t("circuitsTab.records.biggestGrid")}
          value={rec.biggestGrid ? String(rec.biggestGrid.value) : none}
          sub={rec.biggestGrid ? raceRefLabel(rec.biggestGrid.race, locale) : undefined}
        />
      </div>
    </SectionCard>
  );
}
