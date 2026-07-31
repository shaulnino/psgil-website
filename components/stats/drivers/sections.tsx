"use client";

import { useMemo, useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import type {
  DriverProfile,
  RaceLine,
  SplitRow,
  CircuitRow,
  Extreme,
} from "@/lib/stats/driverProfile";
import { METRIC_CATALOG, formatMetric } from "@/lib/stats/metricCatalog";
import { localizedRaceName, localizedTrack } from "@/lib/scheduleData";
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

function mFmt(id: string, value: number | null | undefined, locale: string): string {
  const def = METRIC_CATALOG[id];
  return formatMetric(value, def ? def.unit : "int", locale);
}

function useMetricText() {
  const t = useTranslations("stats");
  const locale = useLocale();
  return {
    label: (id: string) => t(`metrics.${id}.label`),
    tip: (id: string) => t(`metrics.${id}.tooltip`),
    val: (id: string, value: number | null | undefined) => mFmt(id, value, locale),
    locale,
    t,
  };
}

function raceLabel(line: RaceLine, locale: string): string {
  const name = localizedRaceName(
    { race_name: line.raceName, race_name_he: line.raceNameHe },
    locale,
  );
  return `${name} · ${line.seasonKey}`;
}

function statusLabel(line: RaceLine, t: TFn): string {
  if (line.status === "finished") return line.finish !== null ? `P${line.finish}` : "-";
  return t(`status.${line.status}.label`);
}

/* ------------------------------------------------------------------ */
/*  B. Snapshot                                                         */
/* ------------------------------------------------------------------ */

export function SnapshotSection({
  profile,
  driverRating,
  championshipPos,
}: {
  profile: DriverProfile;
  driverRating: number | null;
  championshipPos: number | null;
}) {
  const { label, tip, val, locale, t } = useMetricText();
  const entriesSub =
    profile.entries !== profile.starts
      ? t("driversTab.sample.count", { count: profile.entries })
      : undefined;

  return (
    <SectionCard id="snapshot" title={t("driversTab.sections.snapshot")}>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <StatCard label={label("starts")} value={val("starts", profile.starts)} sub={entriesSub} tooltip={tip("starts")} />
        <StatCard label={label("wins")} value={val("wins", profile.wins)} sub={`${val("winRate", profile.results.winRate)}`} tooltip={tip("wins")} />
        <StatCard label={label("podiums")} value={val("podiums", profile.podiums)} sub={`${val("podiumRate", profile.results.podiumRate)}`} tooltip={tip("podiums")} />
        <StatCard label={label("points")} value={val("points", profile.points)} sub={`${val("pointsPerStart", profile.pointsPerStart)} / ${label("starts").toLowerCase()}`} tooltip={tip("points")} />
        <StatCard label={label("avgFinish")} value={val("avgFinish", profile.avgFinish)} sub={`${val("finishRate", profile.finishRate)} ${label("finishRate").toLowerCase()}`} tooltip={tip("avgFinish")} />
        <StatCard
          label={label("driverRating")}
          value={formatMetric(driverRating, "int", locale)}
          sub={championshipPos ? `${label("championshipPos")} ${championshipPos}` : undefined}
          tooltip={tip("driverRating")}
        />
      </div>
    </SectionCard>
  );
}

/* ------------------------------------------------------------------ */
/*  C. Recent form                                                      */
/* ------------------------------------------------------------------ */

function trendFor(delta: number | null, lowerBetter: boolean): "up" | "down" | "flat" | undefined {
  if (delta === null || delta === 0) return delta === 0 ? "flat" : undefined;
  const improved = lowerBetter ? delta < 0 : delta > 0;
  return improved ? "up" : "down";
}

export function RecentFormSection({ profile }: { profile: DriverProfile }) {
  const { label, val, locale, t } = useMetricText();
  const rf = profile.recentForm;

  if (rf.races.length === 0) {
    return (
      <SectionCard id="recent-form" title={t("driversTab.sections.recentForm")}>
        <p className="rounded-[2px] border border-[color:var(--isl-hairline)] bg-cream px-4 py-6 text-center text-sm text-meta">
          {t("driversTab.form.empty")}
        </p>
      </SectionCard>
    );
  }

  return (
    <SectionCard id="recent-form" title={t("driversTab.sections.recentForm")}>
      <div className="space-y-4 rounded-[2px] border border-[color:var(--isl-hairline)] bg-cream p-4">
        {/* Compact recent-race cards (oldest -> newest) */}
        <div className="flex flex-wrap gap-2">
          {rf.races.map((r) => {
            const finished = r.status === "finished" && r.finish !== null;
            const podium = finished && r.finish! <= 3;
            return (
              <MetricTooltip key={r.eventId} text={raceLabel(r, locale)}>
                <div
                  className={`flex min-w-[3.25rem] flex-col items-center rounded-[2px] border px-2 py-1.5 ${
                    podium
                      ? "border-oxblood bg-oxblood/5"
                      : "border-[color:var(--isl-hairline)] bg-paper"
                  }`}
                >
                  <span className="num text-base font-extrabold text-ink">
                    {finished ? r.finish : statusLabel(r, t)}
                  </span>
                  <span className="num text-[10px] text-faint">
                    {r.raceNumber ? `${r.seasonKey} · R${r.raceNumber}` : r.seasonKey}
                  </span>
                </div>
              </MetricTooltip>
            );
          })}
        </div>

        {/* Form summary with trend vs previous window */}
        <div className="grid grid-cols-3 gap-3">
          <StatCard
            label={t("driversTab.form.avgFinish")}
            value={val("avgFinish", rf.avgFinish)}
            sub={rf.prevAvgFinish !== null ? t("driversTab.form.vsPrevious", { n: rf.window }) : undefined}
            trend={trendFor(rf.deltaAvgFinish, true)}
          />
          <StatCard
            label={t("driversTab.form.points")}
            value={formatMetric(rf.points, "int", locale)}
            sub={rf.prevPoints !== null ? t("driversTab.form.vsPrevious", { n: rf.window }) : undefined}
            trend={trendFor(rf.deltaPoints, false)}
          />
          <StatCard
            label={label("netPositions")}
            value={formatMetric(rf.netPositions, "delta", locale)}
          />
        </div>
      </div>
    </SectionCard>
  );
}

/* ------------------------------------------------------------------ */
/*  Generic metric grid                                                 */
/* ------------------------------------------------------------------ */

function MetricGrid({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-[2px] border border-[color:var(--isl-hairline)] bg-cream p-4">
      <div className="grid grid-cols-1 gap-x-6 gap-y-0.5 sm:grid-cols-2 lg:grid-cols-3">
        {children}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  D. Results & achievements                                          */
/* ------------------------------------------------------------------ */

export function ResultsSection({ profile }: { profile: DriverProfile }) {
  const { label, tip, val, t } = useMetricText();
  const r = profile.results;
  const sample = (made: number) =>
    t("driversTab.sample.ofStarts", { made, starts: profile.starts });

  return (
    <SectionCard id="results" title={t("driversTab.sections.results")}>
      <MetricGrid>
        <StatLine label={label("wins")} value={val("winRate", r.winRate)} sample={sample(r.wins)} tooltip={tip("winRate")} />
        <StatLine label={label("podiums")} value={val("podiumRate", r.podiumRate)} sample={sample(r.podiums)} tooltip={tip("podiumRate")} />
        <StatLine label={label("top5")} value={val("top5Rate", r.top5Rate)} sample={sample(r.top5)} tooltip={tip("top5Rate")} />
        <StatLine label={label("top10")} value={val("top10Rate", r.top10Rate)} sample={sample(r.top10)} tooltip={tip("top10Rate")} />
        <StatLine label={label("pointsFinishes")} value={val("pointsRate", r.pointsRate)} sample={sample(r.pointsFinishes)} tooltip={tip("pointsRate")} />
        <StatLine label={label("poles")} value={val("poles", r.poles)} sample={r.poleRate !== null ? val("poleRate", r.poleRate) : undefined} tooltip={tip("poles")} />
        <StatLine label={label("fastestLaps")} value={val("fastestLaps", r.fastestLaps)} tooltip={tip("fastestLaps")} />
        <StatLine label={label("dotd")} value={val("dotd", r.dotd)} tooltip={tip("dotd")} />
        <StatLine label={label("bestFinish")} value={val("bestFinish", r.bestFinish)} tooltip={tip("bestFinish")} />
        <StatLine label={label("bestGrid")} value={val("bestGrid", r.bestGrid)} tooltip={tip("bestGrid")} />
      </MetricGrid>
    </SectionCard>
  );
}

/* ------------------------------------------------------------------ */
/*  E. Grid & racecraft                                                */
/* ------------------------------------------------------------------ */

function extremeSub(ex: Extreme, locale: string): string | undefined {
  if (!ex) return undefined;
  return raceLabel(ex.race, locale);
}

export function RacecraftSection({ profile }: { profile: DriverProfile }) {
  const { label, tip, val, locale, t } = useMetricText();
  const rc = profile.racecraft;

  return (
    <SectionCard id="racecraft" title={t("driversTab.sections.racecraft")}>
      <MetricGrid>
        <StatLine label={label("avgGrid")} value={val("avgGrid", rc.avgGrid)} sample={t("driversTab.sample.count", { count: rc.gridSample })} tooltip={tip("avgGrid")} />
        <StatLine label={label("avgFinish")} value={val("avgFinish", rc.avgFinish)} sample={t("driversTab.sample.count", { count: rc.finishSample })} tooltip={tip("avgFinish")} />
        <StatLine label={label("medianFinish")} value={val("medianFinish", rc.medianFinish)} tooltip={tip("medianFinish")} />
        <StatLine label={label("netPositions")} value={val("netPositions", rc.netPositions)} tooltip={tip("netPositions")} />
        <StatLine label={label("avgNetPerRace")} value={val("avgNetPerRace", rc.avgNetPerRace)} tooltip={tip("avgNetPerRace")} />
        <StatLine label={label("racesGained")} value={val("racesGained", rc.racesGained)} tooltip={tip("racesGained")} />
        <StatLine label={label("racesLost")} value={val("racesLost", rc.racesLost)} tooltip={tip("racesLost")} />
        <StatLine
          label={label("bestRecovery")}
          value={rc.bestRecovery ? formatMetric(rc.bestRecovery.value, "delta", locale) : "-"}
          sample={extremeSub(rc.bestRecovery, locale)}
          tooltip={tip("bestRecovery")}
        />
        <StatLine
          label={label("worstLoss")}
          value={rc.worstLoss ? formatMetric(rc.worstLoss.value, "delta", locale) : "-"}
          sample={extremeSub(rc.worstLoss, locale)}
          tooltip={tip("worstLoss")}
        />
      </MetricGrid>
    </SectionCard>
  );
}

/* ------------------------------------------------------------------ */
/*  F. Consistency & reliability                                       */
/* ------------------------------------------------------------------ */

const DIST_COLORS: Record<string, string> = {
  win: "#7E2A1E",
  podium: "#B07A1E",
  top5: "#3F6B3A",
  top10: "#2F5A6E",
  outsidePoints: "#8A7E6A",
  dnf: "#C0392B",
};

export function ConsistencySection({ profile }: { profile: DriverProfile }) {
  const { label, tip, val, t } = useMetricText();
  const c = profile.consistency;
  const total = c.distribution.reduce((s, d) => s + Math.max(0, d.count), 0);
  // Only show the distribution bar when there is an actual spread to
  // visualise. A single non-empty bucket renders as one solid full-width
  // segment, which reads as an empty/pointless box, so hide it in that case.
  const nonEmptyBuckets = c.distribution.filter((d) => d.count > 0).length;
  const showDistribution = total > 0 && nonEmptyBuckets >= 2;

  return (
    <SectionCard id="consistency" title={t("driversTab.sections.consistency")}>
      <div className="space-y-4">
        {showDistribution && (
          <div className="rounded-[2px] border border-[color:var(--isl-hairline)] bg-cream p-4">
            <div className="flex h-4 w-full overflow-hidden rounded-[2px]">
              {c.distribution.map((d) =>
                d.count > 0 ? (
                  <MetricTooltip key={d.bucket} text={`${d.count}`}>
                    <span
                      className="block h-full"
                      style={{
                        width: `${(d.count / total) * 100}%`,
                        backgroundColor: DIST_COLORS[d.bucket] ?? "#8A7E6A",
                      }}
                    />
                  </MetricTooltip>
                ) : null,
              )}
            </div>
          </div>
        )}
        <MetricGrid>
          <StatLine label={label("finishRate")} value={val("finishRate", c.finishRate)} tooltip={tip("finishRate")} />
          <StatLine label={label("dnfRate")} value={val("dnfRate", c.dnfRate)} tooltip={tip("dnfRate")} />
          <StatLine label={label("stdevFinish")} value={val("stdevFinish", c.stdevFinish)} tooltip={tip("stdevFinish")} />
          <StatLine label={t("status.dnf.label")} value={val("dnf", c.dnf)} tooltip={t("status.dnf.tooltip")} />
          <StatLine label={t("status.dns.label")} value={val("dns", c.dns)} tooltip={t("status.dns.tooltip")} />
          <StatLine label={t("status.dsq.label")} value={val("dsq", c.dsq)} tooltip={t("status.dsq.tooltip")} />
          <StatLine label={label("finishStreakBest")} value={val("finishStreakBest", c.streaks.finishBest)} sample={String(c.streaks.finishCurrent)} tooltip={tip("finishStreakBest")} />
          <StatLine label={label("pointsStreakBest")} value={val("pointsStreakBest", c.streaks.pointsBest)} sample={String(c.streaks.pointsCurrent)} tooltip={tip("pointsStreakBest")} />
          <StatLine label={label("podiumStreakBest")} value={val("podiumStreakBest", c.streaks.podiumBest)} sample={String(c.streaks.podiumCurrent)} tooltip={tip("podiumStreakBest")} />
          <StatLine label={label("winStreakBest")} value={val("winStreakBest", c.streaks.winBest)} tooltip={tip("winStreakBest")} />
        </MetricGrid>
      </div>
    </SectionCard>
  );
}

/* ------------------------------------------------------------------ */
/*  G. Discipline                                                       */
/* ------------------------------------------------------------------ */

export function DisciplineSection({ profile }: { profile: DriverProfile }) {
  const { label, tip, val, t } = useMetricText();
  const d = profile.discipline;

  return (
    <SectionCard id="discipline" title={t("driversTab.sections.discipline")}>
      <MetricGrid>
        <StatLine label={label("cleanRaces")} value={val("cleanRaces", d.cleanRaces)} sample={t("driversTab.sample.ofStarts", { made: d.cleanRaces, starts: profile.starts })} tooltip={tip("cleanRaces")} />
        <StatLine label={label("cleanRacePct")} value={val("cleanRacePct", d.cleanRacePct)} tooltip={tip("cleanRacePct")} />
        <StatLine label={label("penaltyRate")} value={val("penaltyRate", d.penaltyRate)} tooltip={tip("penaltyRate")} />
        <StatLine label={label("penaltySeconds")} value={val("penaltySeconds", d.penaltySeconds)} tooltip={tip("penaltySeconds")} />
        {d.stewardSeconds > 0 && (
          <StatLine label={label("stewardSeconds")} value={val("stewardSeconds", d.stewardSeconds)} tooltip={tip("stewardSeconds")} />
        )}
        {d.gameSeconds > 0 && (
          <StatLine label={label("gameSeconds")} value={val("gameSeconds", d.gameSeconds)} tooltip={tip("gameSeconds")} />
        )}
        <StatLine label={label("penaltiesPerStart")} value={val("penaltiesPerStart", d.penaltiesPerStart)} tooltip={tip("penaltiesPerStart")} />
      </MetricGrid>
    </SectionCard>
  );
}

/* ------------------------------------------------------------------ */
/*  H. Splits                                                           */
/* ------------------------------------------------------------------ */

function SplitTable({
  title,
  rows,
  labelFor,
}: {
  title: string;
  rows: SplitRow[];
  labelFor: (key: string) => string;
}) {
  const { val, t } = useMetricText();
  const visible = rows.filter((r) => r.starts > 0);
  if (visible.length === 0) return null;

  return (
    <div>
      <p className="mb-1.5 text-xs font-semibold text-meta">{title}</p>
      <div className="overflow-x-auto rounded-[2px] border border-[color:var(--isl-hairline)]">
        <table className="w-full text-sm">
          <thead className="bg-sink">
            <tr className="border-b border-[color:var(--isl-hairline-strong)] text-[11px] uppercase tracking-wider text-meta">
              <th className="px-3 py-1.5 text-start font-semibold">{t("driversTab.splits.colSegment")}</th>
              <th className="px-3 py-1.5 text-end font-semibold">{t("driversTab.splits.colStarts")}</th>
              <th className="px-3 py-1.5 text-end font-semibold">{t("driversTab.splits.colAvgFinish")}</th>
              <th className="px-3 py-1.5 text-end font-semibold">{t("driversTab.splits.colPps")}</th>
              <th className="px-3 py-1.5 text-end font-semibold">{t("driversTab.splits.colPodiumRate")}</th>
              <th className="px-3 py-1.5 text-end font-semibold">{t("driversTab.splits.colDnfRate")}</th>
              <th className="px-3 py-1.5 text-end font-semibold">{t("driversTab.splits.colNet")}</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((row) => (
              <tr key={row.key} className="border-b border-[color:var(--isl-hairline)] last:border-0">
                <td className="px-3 py-1.5 text-start text-meta">
                  <span className="flex items-center gap-1.5">
                    {labelFor(row.key)}
                    {row.thin && (
                      <MetricTooltip text={t("driversTab.sample.thin")}>
                        <span className="text-[10px] text-brass-ink">*</span>
                      </MetricTooltip>
                    )}
                  </span>
                </td>
                <td className="num px-3 py-1.5 text-end font-semibold text-ink">{row.starts}</td>
                <td className="num px-3 py-1.5 text-end text-ink-2">{val("avgFinish", row.avgFinish)}</td>
                <td className="num px-3 py-1.5 text-end text-ink-2">{val("pointsPerStart", row.pointsPerStart)}</td>
                <td className="num px-3 py-1.5 text-end text-ink-2">{val("podiumRate", row.podiumRate)}</td>
                <td className="num px-3 py-1.5 text-end text-ink-2">{val("dnfRate", row.dnfRate)}</td>
                <td className="num px-3 py-1.5 text-end text-ink-2">{formatMetricDelta(row.netPositions)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function formatMetricDelta(v: number): string {
  return `${v > 0 ? "+" : ""}${v}`;
}

export function SplitsSection({ profile }: { profile: DriverProfile }) {
  const { t } = useMetricText();
  const weatherLabel = (k: string) => t(`weather.${k}`);
  const formatLabel = (k: string) =>
    k === "sprint" ? t("filters.sprint") : k === "25%" ? t("filters.format25") : t("filters.format50");
  const leagueLabel = (k: string) => (k === "wild" ? t("filters.wild") : t("filters.main"));
  const roundLabel = (k: string) => (k === "playoff" ? t("filters.playoffs") : t("filters.regular"));

  return (
    <SectionCard id="splits" title={t("driversTab.sections.splits")} note={t("driversTab.sample.thinNote", { n: 3 })}>
      <div className="grid gap-4 lg:grid-cols-2">
        <SplitTable title={t("driversTab.splits.byWeather")} rows={profile.splits.weather} labelFor={weatherLabel} />
        <SplitTable title={t("driversTab.splits.byFormat")} rows={profile.splits.format} labelFor={formatLabel} />
        <SplitTable title={t("driversTab.splits.byLeague")} rows={profile.splits.league} labelFor={leagueLabel} />
        <SplitTable title={t("driversTab.splits.byRound")} rows={profile.splits.roundType} labelFor={roundLabel} />
      </div>
    </SectionCard>
  );
}

/* ------------------------------------------------------------------ */
/*  I. Circuit performance                                             */
/* ------------------------------------------------------------------ */

type CircuitSortKey = "starts" | "avgFinish" | "pointsPerStart" | "bestFinish" | "wins" | "podiums" | "netPositions";

export function CircuitsSection({ profile }: { profile: DriverProfile }) {
  const { val, t } = useMetricText();
  const [sortKey, setSortKey] = useState<CircuitSortKey>("starts");
  const [asc, setAsc] = useState(false);

  const rows = useMemo(() => {
    const copy = [...profile.circuits];
    copy.sort((a, b) => {
      const va = a[sortKey];
      const vb = b[sortKey];
      const na = va === null ? Number.POSITIVE_INFINITY : va;
      const nb = vb === null ? Number.POSITIVE_INFINITY : vb;
      return asc ? na - nb : nb - na;
    });
    return copy;
  }, [profile.circuits, sortKey, asc]);

  if (rows.length === 0) {
    return (
      <SectionCard id="circuits" title={t("driversTab.sections.circuits")}>
        <p className="rounded-[2px] border border-[color:var(--isl-hairline)] bg-cream px-4 py-6 text-center text-sm text-meta">
          {t("driversTab.circuits.empty")}
        </p>
      </SectionCard>
    );
  }

  const header = (key: CircuitSortKey, labelText: string, align: "start" | "end") => (
    <th
      className={`px-3 py-1.5 text-${align} font-semibold ${sortKey === key ? "text-oxblood" : ""}`}
    >
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
    <SectionCard id="circuits" title={t("driversTab.sections.circuits")} note={t("driversTab.sample.thinNote", { n: 3 })}>
      <div className="overflow-x-auto rounded-[2px] border border-[color:var(--isl-hairline)]">
        <table className="w-full text-sm">
          <thead className="bg-sink">
            <tr className="border-b border-[color:var(--isl-hairline-strong)] text-[11px] uppercase tracking-wider text-meta">
              <th className="px-3 py-1.5 text-start font-semibold">{t("driversTab.circuits.colCircuit")}</th>
              {header("starts", t("driversTab.circuits.colStarts"), "end")}
              {header("avgFinish", t("driversTab.circuits.colAvgFinish"), "end")}
              {header("pointsPerStart", t("driversTab.circuits.colPps"), "end")}
              {header("bestFinish", t("driversTab.circuits.colBest"), "end")}
              {header("wins", t("driversTab.circuits.colWins"), "end")}
              {header("podiums", t("driversTab.circuits.colPodiums"), "end")}
              {header("netPositions", t("driversTab.circuits.colNet"), "end")}
            </tr>
          </thead>
          <tbody>
            {rows.map((c: CircuitRow) => (
              <tr key={c.track} className="border-b border-[color:var(--isl-hairline)] last:border-0">
                <td className="px-3 py-1.5 text-start text-meta">
                  <span className="flex items-center gap-1.5">
                    {c.track}
                    {c.thin && (
                      <MetricTooltip text={t("driversTab.sample.thin")}>
                        <span className="text-[10px] text-brass-ink">*</span>
                      </MetricTooltip>
                    )}
                  </span>
                </td>
                <td className="num px-3 py-1.5 text-end font-semibold text-ink">{c.starts}</td>
                <td className="num px-3 py-1.5 text-end text-ink-2">{val("avgFinish", c.avgFinish)}</td>
                <td className="num px-3 py-1.5 text-end text-ink-2">{val("pointsPerStart", c.pointsPerStart)}</td>
                <td className="num px-3 py-1.5 text-end text-ink-2">{val("bestFinish", c.bestFinish)}</td>
                <td className="num px-3 py-1.5 text-end text-ink-2">{c.wins}</td>
                <td className="num px-3 py-1.5 text-end text-ink-2">{c.podiums}</td>
                <td className="num px-3 py-1.5 text-end text-ink-2">{formatMetricDelta(c.netPositions)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </SectionCard>
  );
}

/* ------------------------------------------------------------------ */
/*  J. Race history                                                     */
/* ------------------------------------------------------------------ */

const DEFAULT_HISTORY_ROWS = 12;

export function RaceHistorySection({ profile }: { profile: DriverProfile }) {
  const locale = useLocale();
  const t = useTranslations("stats");
  const [showAll, setShowAll] = useState(false);
  const rows = showAll ? profile.history : profile.history.slice(0, DEFAULT_HISTORY_ROWS);

  if (profile.history.length === 0) {
    return (
      <SectionCard id="history" title={t("driversTab.sections.history")}>
        <p className="rounded-[2px] border border-[color:var(--isl-hairline)] bg-cream px-4 py-6 text-center text-sm text-meta">
          {t("driversTab.history.empty")}
        </p>
      </SectionCard>
    );
  }

  return (
    <SectionCard id="history" title={t("driversTab.sections.history")}>
      <div className="overflow-x-auto rounded-[2px] border border-[color:var(--isl-hairline)]">
        <table className="w-full text-sm">
          <thead className="bg-sink">
            <tr className="border-b border-[color:var(--isl-hairline-strong)] text-[11px] uppercase tracking-wider text-meta">
              <th className="px-3 py-1.5 text-start font-semibold">{t("driversTab.history.colRace")}</th>
              <th className="px-3 py-1.5 text-start font-semibold">{t("driversTab.history.colWeather")}</th>
              <th className="px-3 py-1.5 text-end font-semibold">{t("driversTab.history.colGrid")}</th>
              <th className="px-3 py-1.5 text-end font-semibold">{t("driversTab.history.colFinish")}</th>
              <th className="px-3 py-1.5 text-end font-semibold">{t("driversTab.history.colNet")}</th>
              <th className="px-3 py-1.5 text-end font-semibold">{t("driversTab.history.colPoints")}</th>
              <th className="px-3 py-1.5 text-end font-semibold">{t("driversTab.history.colStatus")}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.eventId} className="border-b border-[color:var(--isl-hairline)] last:border-0">
                <td className="px-3 py-1.5 text-start">
                  <div className="font-medium text-ink">
                    {localizedRaceName({ race_name: r.raceName, race_name_he: r.raceNameHe }, locale)}
                  </div>
                  <div className="num text-[11px] text-faint">
                    {r.seasonKey}
                    {r.track ? ` · ${localizedTrack({ track: r.track, track_he: r.trackHe }, locale)}` : ""}
                    {r.date ? ` · ${r.date}` : ""}
                  </div>
                </td>
                <td className="px-3 py-1.5 text-start text-ink-2">{t(`weather.${r.weather}`)}</td>
                <td className="num px-3 py-1.5 text-end text-ink-2">
                  {r.reverseGrid ? (
                    <MetricTooltip text={t("driversTab.history.reverseGrid")}>
                      <span>{r.gridRaw ?? "-"}*</span>
                    </MetricTooltip>
                  ) : (
                    r.gridRaw ?? "-"
                  )}
                </td>
                <td className="num px-3 py-1.5 text-end font-semibold text-ink">
                  {r.status === "finished" && r.finish !== null ? r.finish : statusLabel(r, t)}
                </td>
                <td className="num px-3 py-1.5 text-end text-ink-2">
                  {r.netChange !== null ? formatMetricDelta(r.netChange) : "-"}
                </td>
                <td className="num px-3 py-1.5 text-end text-ink-2">{r.points}</td>
                <td className="px-3 py-1.5 text-end">
                  <span className="inline-flex items-center gap-1 text-ink-2">
                    {r.fastestLap && <span title="FL" className="text-[10px] font-bold text-violet-700">FL</span>}
                    {r.pole && <span title="Pole" className="text-[10px] font-bold text-emerald-700">P</span>}
                    {r.dotd && <span title="DOTD" className="text-[10px] font-bold text-brass-ink">★</span>}
                    {r.status !== "finished" && (
                      <span className="text-[11px] font-semibold text-oxblood">{statusLabel(r, t)}</span>
                    )}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {profile.history.length > DEFAULT_HISTORY_ROWS && (
        <div className="flex justify-center">
          <button
            type="button"
            onClick={() => setShowAll((v) => !v)}
            className="rounded-[2px] border border-[color:var(--isl-hairline)] bg-cream px-3 py-1.5 text-xs font-semibold text-meta transition hover:text-ink"
          >
            {showAll ? t("driversTab.history.showLess") : t("driversTab.history.showMore")}
          </button>
        </div>
      )}
    </SectionCard>
  );
}

/* ------------------------------------------------------------------ */
/*  K. Records & milestones                                            */
/* ------------------------------------------------------------------ */

function RecordCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-[2px] border border-[color:var(--isl-hairline)] bg-cream px-4 py-3">
      <div className="text-[10px] font-bold uppercase tracking-wider text-meta">{label}</div>
      <div className="num mt-1 text-lg font-extrabold text-ink">{value}</div>
      {sub && <div className="mt-0.5 truncate text-[11px] text-faint">{sub}</div>}
    </div>
  );
}

export function RecordsSection({ profile }: { profile: DriverProfile }) {
  const { label, val, locale, t } = useMetricText();
  const rec = profile.records;
  const none = t("driversTab.records.none");

  const milestone = (line: RaceLine | null) => (line ? raceLabel(line, locale) : none);

  return (
    <SectionCard id="records" title={t("driversTab.sections.records")} note={t("driversTab.records.careerNote")}>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        <RecordCard label={t("driversTab.records.firstRace")} value={rec.firstRace ? rec.firstRace.date || rec.firstRace.seasonKey : none} sub={rec.firstRace ? raceLabel(rec.firstRace, locale) : undefined} />
        <RecordCard label={t("driversTab.records.firstPoints")} value={milestone(rec.firstPoints)} />
        <RecordCard label={t("driversTab.records.firstPodium")} value={milestone(rec.firstPodium)} />
        <RecordCard label={t("driversTab.records.firstWin")} value={milestone(rec.firstWin)} />
        <RecordCard label={label("bestFinish")} value={rec.bestFinish ? val("bestFinish", rec.bestFinish.value) : none} sub={extremeSub(rec.bestFinish, locale)} />
        <RecordCard label={label("bestGrid")} value={rec.bestGrid ? val("bestGrid", rec.bestGrid.value) : none} sub={extremeSub(rec.bestGrid, locale)} />
        <RecordCard label={t("driversTab.records.mostPointsRace")} value={rec.mostPointsRace ? String(rec.mostPointsRace.value) : none} sub={extremeSub(rec.mostPointsRace, locale)} />
        <RecordCard label={label("bestRecovery")} value={rec.bestRecovery ? formatMetric(rec.bestRecovery.value, "delta", locale) : none} sub={extremeSub(rec.bestRecovery, locale)} />
        <RecordCard label={label("finishStreakBest")} value={val("finishStreakBest", rec.longestFinishStreak)} />
        <RecordCard label={label("pointsStreakBest")} value={val("pointsStreakBest", rec.longestPointsStreak)} />
      </div>
    </SectionCard>
  );
}
