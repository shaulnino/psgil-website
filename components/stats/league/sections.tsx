"use client";

import { useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import type {
  LeagueProfile,
  RaceRef,
  RecordItem,
  SeasonSplit,
  WeatherSplit,
} from "@/lib/stats/leagueProfile";
import { LEAGUE_METRIC_CATALOG } from "@/lib/stats/leagueMetricCatalog";
import { formatMetric } from "@/lib/stats/metricCatalog";
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

function useLeagueMetricText() {
  const t = useTranslations("stats");
  const locale = useLocale();
  return {
    label: (id: string) => t(`league.metrics.${id}.label`),
    tip: (id: string) => t(`league.metrics.${id}.tooltip`),
    val: (id: string, value: number | null | undefined) => {
      const def = LEAGUE_METRIC_CATALOG[id];
      return formatMetric(value, def ? def.unit : "int", locale);
    },
    locale,
    t,
  };
}

function refLabel(ref: RaceRef, locale: string): string {
  const name = localizedRaceName(
    { race_name: ref.raceName, race_name_he: ref.raceNameHe },
    locale,
  );
  const track = ref.track
    ? localizedTrack({ track: ref.track, track_he: ref.trackHe }, locale)
    : "";
  const tail = [ref.seasonKey, track].filter(Boolean).join(" · ");
  return tail ? `${name} · ${tail}` : name;
}

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
/*  A. Pulse                                                            */
/* ------------------------------------------------------------------ */

export function PulseSection({ profile }: { profile: LeagueProfile }) {
  const { label, tip, val, t } = useLeagueMetricText();
  return (
    <SectionCard id="league-pulse" title={t("league.sections.pulse")}>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <StatCard label={label("races")} value={val("races", profile.races)} tooltip={tip("races")} />
        <StatCard label={label("seasons")} value={val("seasons", profile.seasons)} tooltip={tip("seasons")} />
        <StatCard label={label("uniqueDrivers")} value={val("uniqueDrivers", profile.uniqueDrivers)} tooltip={tip("uniqueDrivers")} />
        <StatCard label={label("differentWinners")} value={val("differentWinners", profile.differentWinners)} tooltip={tip("differentWinners")} />
        <StatCard label={label("avgStarters")} value={val("avgStarters", profile.avgStarters)} tooltip={tip("avgStarters")} />
        <StatCard label={label("totalPoints")} value={val("totalPoints", profile.totalPoints)} tooltip={tip("totalPoints")} />
      </div>
    </SectionCard>
  );
}

/* ------------------------------------------------------------------ */
/*  B. Competitive balance                                             */
/* ------------------------------------------------------------------ */

export function CompetitiveSection({ profile }: { profile: LeagueProfile }) {
  const { label, tip, val, t } = useLeagueMetricText();
  const c = profile.competitive;
  const topShareSample =
    c.topWinnerName && c.topWinnerWins > 0
      ? `${c.topWinnerName} · ${c.topWinnerWins}`
      : undefined;
  return (
    <SectionCard id="league-competitive" title={t("league.sections.competitive")}>
      <MetricGrid>
        <StatLine label={label("differentWinners")} value={val("differentWinners", c.differentWinners)} tooltip={tip("differentWinners")} />
        <StatLine label={label("differentPodium")} value={val("differentPodium", c.differentPodium)} tooltip={tip("differentPodium")} />
        <StatLine label={label("differentPoles")} value={val("differentPoles", c.differentPoles)} tooltip={tip("differentPoles")} />
        <StatLine label={label("topDriverWinShare")} value={val("topDriverWinShare", c.topDriverWinShare)} sample={topShareSample} tooltip={tip("topDriverWinShare")} />
        <StatLine label={label("leadChanges")} value={val("leadChanges", c.leadChanges)} tooltip={tip("leadChanges")} />
      </MetricGrid>
    </SectionCard>
  );
}

/* ------------------------------------------------------------------ */
/*  C. How races unfold                                                */
/* ------------------------------------------------------------------ */

export function MovementSection({ profile }: { profile: LeagueProfile }) {
  const { label, tip, val, t } = useLeagueMetricText();
  const m = profile.movement;
  const sample = (n: number) => t("league.sample.races", { count: n });
  return (
    <SectionCard id="league-movement" title={t("league.sections.movement")}>
      <MetricGrid>
        <StatLine label={label("avgWinningGrid")} value={val("avgWinningGrid", m.avgWinningGrid)} sample={sample(m.winningGridSample)} tooltip={tip("avgWinningGrid")} />
        <StatLine label={label("poleToWinRate")} value={val("poleToWinRate", m.poleToWinRate)} sample={sample(m.poleSample)} tooltip={tip("poleToWinRate")} />
        <StatLine label={label("winsFromOutsideTop3")} value={val("winsFromOutsideTop3", m.winsFromOutsideTop3)} tooltip={tip("winsFromOutsideTop3")} />
        <StatLine label={label("avgAbsPositionChange")} value={val("avgAbsPositionChange", m.avgAbsPositionChange)} sample={t("league.sample.ofN", { n: m.changeSample })} tooltip={tip("avgAbsPositionChange")} />
      </MetricGrid>
    </SectionCard>
  );
}

/* ------------------------------------------------------------------ */
/*  D. Grid health & participation                                     */
/* ------------------------------------------------------------------ */

function extremeSample(item: RecordItem, locale: string): string | undefined {
  return item ? refLabel(item.ref, locale) : undefined;
}

export function GridHealthSection({ profile }: { profile: LeagueProfile }) {
  const { label, tip, val, locale, t } = useLeagueMetricText();
  const g = profile.gridHealth;
  return (
    <SectionCard id="league-grid" title={t("league.sections.gridHealth")}>
      <MetricGrid>
        <StatLine label={label("avgStarters")} value={val("avgStarters", g.avgStarters)} tooltip={tip("avgStarters")} />
        <StatLine label={label("avgClassified")} value={val("avgClassified", g.avgClassified)} tooltip={tip("avgClassified")} />
        <StatLine label={label("completionRate")} value={val("completionRate", g.completionRate)} tooltip={tip("completionRate")} />
        <StatLine label={label("maxGrid")} value={g.maxGrid ? val("maxGrid", g.maxGrid.value) : "—"} sample={extremeSample(g.maxGrid, locale)} tooltip={tip("maxGrid")} />
        <StatLine label={label("minGrid")} value={g.minGrid ? val("minGrid", g.minGrid.value) : "—"} sample={extremeSample(g.minGrid, locale)} tooltip={tip("minGrid")} />
      </MetricGrid>
    </SectionCard>
  );
}

/* ------------------------------------------------------------------ */
/*  E. Reliability                                                      */
/* ------------------------------------------------------------------ */

export function ReliabilitySection({ profile }: { profile: LeagueProfile }) {
  const { label, tip, val, t } = useLeagueMetricText();
  const r = profile.reliability;
  return (
    <SectionCard id="league-reliability" title={t("league.sections.reliability")}>
      <MetricGrid>
        <StatLine label={label("classificationRate")} value={val("classificationRate", r.classificationRate)} tooltip={tip("classificationRate")} />
        <StatLine label={label("dnfRate")} value={val("dnfRate", r.dnfRate)} tooltip={tip("dnfRate")} />
        <StatLine label={label("dnsRate")} value={val("dnsRate", r.dnsRate)} tooltip={tip("dnsRate")} />
        <StatLine label={label("dsqRate")} value={val("dsqRate", r.dsqRate)} tooltip={tip("dsqRate")} />
        <StatLine label={label("avgClassified")} value={val("avgClassified", r.avgClassified)} tooltip={tip("avgClassified")} />
      </MetricGrid>
    </SectionCard>
  );
}

/* ------------------------------------------------------------------ */
/*  F. Discipline & clean racing                                       */
/* ------------------------------------------------------------------ */

export function DisciplineSection({ profile }: { profile: LeagueProfile }) {
  const { label, tip, val, t } = useLeagueMetricText();
  const d = profile.discipline;
  return (
    <SectionCard id="league-discipline" title={t("league.sections.discipline")}>
      <MetricGrid>
        <StatLine label={label("cleanRaceRate")} value={val("cleanRaceRate", d.cleanRaceRate)} tooltip={tip("cleanRaceRate")} />
        <StatLine label={label("penaltyRate")} value={val("penaltyRate", d.penaltyRate)} sample={t("league.sample.races", { count: d.racesWithPenalty })} tooltip={tip("penaltyRate")} />
        <StatLine label={label("penaltySecondsPerRace")} value={val("penaltySecondsPerRace", d.penaltySecondsPerRace)} tooltip={tip("penaltySecondsPerRace")} />
        {d.stewardSecondsPerRace !== null && d.stewardSecondsPerRace > 0 && (
          <StatLine label={label("stewardSecondsPerRace")} value={val("stewardSecondsPerRace", d.stewardSecondsPerRace)} tooltip={tip("stewardSecondsPerRace")} />
        )}
        {d.gameSecondsPerRace !== null && d.gameSecondsPerRace > 0 && (
          <StatLine label={label("gameSecondsPerRace")} value={val("gameSecondsPerRace", d.gameSecondsPerRace)} tooltip={tip("gameSecondsPerRace")} />
        )}
      </MetricGrid>
    </SectionCard>
  );
}

/* ------------------------------------------------------------------ */
/*  G. Splits                                                           */
/* ------------------------------------------------------------------ */

function SeasonSplitTable({ rows }: { rows: SeasonSplit[] }) {
  const { val, t } = useLeagueMetricText();
  if (rows.length === 0) {
    return <p className="text-sm text-meta">{t("league.splits.noData")}</p>;
  }
  return (
    <div>
      <p className="mb-1.5 text-xs font-semibold text-meta">{t("league.splits.bySeason")}</p>
      <div className="overflow-x-auto rounded-[2px] border border-[color:var(--isl-hairline)]">
        <table className="w-full text-sm">
          <thead className="bg-sink">
            <tr className="border-b border-[color:var(--isl-hairline-strong)] text-[11px] uppercase tracking-wider text-meta">
              <th className="px-3 py-1.5 text-start font-semibold">{t("league.splits.colSeason")}</th>
              <th className="px-3 py-1.5 text-end font-semibold">{t("league.splits.colRaces")}</th>
              <th className="px-3 py-1.5 text-end font-semibold">{t("league.splits.colAvgStarters")}</th>
              <th className="px-3 py-1.5 text-end font-semibold">{t("league.splits.colWinners")}</th>
              <th className="px-3 py-1.5 text-end font-semibold">{t("league.splits.colDnf")}</th>
              <th className="px-3 py-1.5 text-end font-semibold">{t("league.splits.colClean")}</th>
              <th className="px-3 py-1.5 text-end font-semibold">{t("league.splits.colWinGrid")}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.seasonKey} className="border-b border-[color:var(--isl-hairline)] last:border-0">
                <td className="px-3 py-1.5 text-start text-meta">
                  <span className="flex items-center gap-1.5">
                    {t("season.label", { n: row.seasonKey.replace(/^S/i, "") })}
                    {row.thin && (
                      <MetricTooltip text={t("league.sample.thin")}>
                        <span className="text-[10px] text-brass-ink">*</span>
                      </MetricTooltip>
                    )}
                  </span>
                </td>
                <td className="num px-3 py-1.5 text-end font-semibold text-ink">{row.races}</td>
                <td className="num px-3 py-1.5 text-end text-ink-2">{val("avgStarters", row.avgStarters)}</td>
                <td className="num px-3 py-1.5 text-end text-ink-2">{row.differentWinners}</td>
                <td className="num px-3 py-1.5 text-end text-ink-2">{val("dnfRate", row.dnfRate)}</td>
                <td className="num px-3 py-1.5 text-end text-ink-2">{val("cleanRaceRate", row.cleanRaceRate)}</td>
                <td className="num px-3 py-1.5 text-end text-ink-2">{val("avgWinningGrid", row.avgWinningGrid)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function WeatherSplitTable({ rows }: { rows: WeatherSplit[] }) {
  const { val, t } = useLeagueMetricText();
  if (rows.length === 0) return null;
  return (
    <div>
      <p className="mb-1.5 text-xs font-semibold text-meta">{t("league.splits.byWeather")}</p>
      <div className="overflow-x-auto rounded-[2px] border border-[color:var(--isl-hairline)]">
        <table className="w-full text-sm">
          <thead className="bg-sink">
            <tr className="border-b border-[color:var(--isl-hairline-strong)] text-[11px] uppercase tracking-wider text-meta">
              <th className="px-3 py-1.5 text-start font-semibold">{t("league.splits.colWeather")}</th>
              <th className="px-3 py-1.5 text-end font-semibold">{t("league.splits.colRaces")}</th>
              <th className="px-3 py-1.5 text-end font-semibold">{t("league.splits.colDnf")}</th>
              <th className="px-3 py-1.5 text-end font-semibold">{t("league.splits.colWinners")}</th>
              <th className="px-3 py-1.5 text-end font-semibold">{t("league.splits.colPosChange")}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.key} className="border-b border-[color:var(--isl-hairline)] last:border-0">
                <td className="px-3 py-1.5 text-start text-meta">
                  <span className="flex items-center gap-1.5">
                    {t(`weather.${row.key}`)}
                    {row.thin && (
                      <MetricTooltip text={t("league.sample.thin")}>
                        <span className="text-[10px] text-brass-ink">*</span>
                      </MetricTooltip>
                    )}
                  </span>
                </td>
                <td className="num px-3 py-1.5 text-end font-semibold text-ink">{row.races}</td>
                <td className="num px-3 py-1.5 text-end text-ink-2">{val("dnfRate", row.dnfRate)}</td>
                <td className="num px-3 py-1.5 text-end text-ink-2">{row.differentWinners}</td>
                <td className="num px-3 py-1.5 text-end text-ink-2">{val("avgAbsPositionChange", row.avgAbsPositionChange)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function SplitsSection({ profile }: { profile: LeagueProfile }) {
  const { t } = useLeagueMetricText();
  const hasWeather = profile.splits.byWeather.length > 0;
  return (
    <SectionCard id="league-splits" title={t("league.sections.splits")} note={t("league.sample.thinNote", { n: 3 })}>
      <div className={`grid gap-4 ${hasWeather ? "lg:grid-cols-2" : ""}`}>
        <SeasonSplitTable rows={profile.splits.bySeason} />
        <WeatherSplitTable rows={profile.splits.byWeather} />
      </div>
    </SectionCard>
  );
}

/* ------------------------------------------------------------------ */
/*  H. Records & milestones (all-time)                                 */
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

export function RecordsSection({ profile }: { profile: LeagueProfile }) {
  const { locale, t } = useLeagueMetricText();
  const rec = profile.records;
  const none = t("league.records.none");

  return (
    <SectionCard id="league-records" title={t("league.sections.records")} note={t("league.context.recordsNote")}>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        <RecordCard
          label={t("league.records.firstRace")}
          value={rec.firstRace ? rec.firstRace.date || rec.firstRace.seasonKey : none}
          sub={rec.firstRace ? refLabel(rec.firstRace, locale) : undefined}
        />
        <RecordCard
          label={t("league.records.firstWinner")}
          value={rec.firstWinner && rec.firstWinner.name ? rec.firstWinner.name : none}
          sub={rec.firstWinner ? refLabel(rec.firstWinner.ref, locale) : undefined}
        />
        <RecordCard
          label={t("league.records.mostStarters")}
          value={rec.mostStarters ? t("league.records.starters", { n: rec.mostStarters.value }) : none}
          sub={rec.mostStarters ? refLabel(rec.mostStarters.ref, locale) : undefined}
        />
        <RecordCard
          label={t("league.records.mostFinishers")}
          value={rec.mostFinishers ? t("league.records.finishers", { n: rec.mostFinishers.value }) : none}
          sub={rec.mostFinishers ? refLabel(rec.mostFinishers.ref, locale) : undefined}
        />
        <RecordCard
          label={t("league.records.mostDifferentWinnersSeason")}
          value={rec.mostDifferentWinnersSeason ? t("league.records.winnersInSeason", { n: rec.mostDifferentWinnersSeason.value }) : none}
          sub={rec.mostDifferentWinnersSeason ? t("season.label", { n: rec.mostDifferentWinnersSeason.seasonKey.replace(/^S/i, "") }) : undefined}
        />
        <RecordCard
          label={t("league.records.mostPenalizedRace")}
          value={rec.mostPenalizedRace ? t("league.records.penalties", { n: rec.mostPenalizedRace.value }) : none}
          sub={rec.mostPenalizedRace ? refLabel(rec.mostPenalizedRace.ref, locale) : undefined}
        />
      </div>
    </SectionCard>
  );
}

/* ------------------------------------------------------------------ */
/*  I. Operational facts (collapsible)                                 */
/* ------------------------------------------------------------------ */

export function FactsSection({ profile }: { profile: LeagueProfile }) {
  const { label, tip, val, t } = useLeagueMetricText();
  const [open, setOpen] = useState(false);
  const f = profile.facts;
  return (
    <section id="league-facts" className="scroll-mt-24 space-y-3">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 font-isl-body text-[0.75rem] font-semibold uppercase tracking-[0.2em] text-oxblood"
      >
        <span aria-hidden>{open ? "▾" : "▸"}</span>
        {open ? t("league.context.hideFacts") : t("league.context.showFacts")}
      </button>
      {open && (
        <MetricGrid>
          <StatLine label={label("safetyCars")} value={val("safetyCars", f.safetyCars)} tooltip={tip("safetyCars")} />
          <StatLine label={label("reverseGridEvents")} value={val("reverseGridEvents", f.reverseGridEvents)} tooltip={tip("reverseGridEvents")} />
          <StatLine label={label("broadcastedEvents")} value={val("broadcastedEvents", f.broadcastedEvents)} tooltip={tip("broadcastedEvents")} />
        </MetricGrid>
      )}
    </section>
  );
}
