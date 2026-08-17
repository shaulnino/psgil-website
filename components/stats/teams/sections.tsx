"use client";

import { useLocale, useTranslations } from "next-intl";
import { formatMetric } from "@/lib/stats/metricCatalog";
import { TEAM_METRIC_CATALOG } from "@/lib/stats/teamMetricCatalog";
import type { TeamProfile } from "@/lib/stats/teamProfile";
import { getTeamColor, getTeamLogo } from "@/lib/driversData";
import { localizedTeamName, type TeamNameLookup } from "@/lib/stats/teamIdentity";
import {
  SectionCard,
  StatCard,
  StatLine,
} from "@/components/stats/shared";

/* ------------------------------------------------------------------ */
/*  Local helpers                                                       */
/* ------------------------------------------------------------------ */

function useTeamText() {
  const t = useTranslations("stats");
  const locale = useLocale();
  return {
    t,
    locale,
    label: (id: string) => t(`teamsTab.metrics.${id}.label`),
    tip: (id: string) => t(`teamsTab.metrics.${id}.tooltip`),
    val: (id: string, value: number | null | undefined) =>
      formatMetric(value, TEAM_METRIC_CATALOG[id]?.unit ?? "int", locale),
  };
}

function useDisplayName(driverNamesHe?: Record<string, string>) {
  const locale = useLocale();
  return (id: string, name: string) =>
    locale === "he" ? driverNamesHe?.[id] || name : name;
}

/** White-boxed team logo (marks are dark/monochrome — see /drivers). */
export function TeamLogo({ teamKey, name, size = 40 }: { teamKey: string; name: string; size?: number }) {
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center rounded-[2px] border border-[color:var(--isl-hairline)] bg-white p-1"
      style={{ width: size, height: size }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={getTeamLogo(teamKey)} alt={name} className="h-full w-full object-contain" loading="lazy" />
    </span>
  );
}

/* ------------------------------------------------------------------ */
/*  1. Snapshot                                                        */
/* ------------------------------------------------------------------ */

export function TeamSnapshotSection({
  profile,
  currentRoster,
  driverNamesHe,
  teamNames,
}: {
  profile: TeamProfile;
  currentRoster?: { driverId: string; name: string }[];
  driverNamesHe?: Record<string, string>;
  teamNames?: TeamNameLookup;
}) {
  const { t, locale, label, tip, val } = useTeamText();
  const displayName = useDisplayName(driverNamesHe);
  const s = profile.snapshot;
  const color = getTeamColor(profile.teamKey);
  const teamName = localizedTeamName(profile.teamKey, locale, profile.name, teamNames);

  // Prefer the current roster from the drivers tab; fall back to the most
  // recent results-derived lineup so brand-new/legacy teams still show one.
  const roster =
    currentRoster && currentRoster.length > 0
      ? currentRoster
      : s.recentDriverIds.map((id) => ({
          driverId: id,
          name: profile.lineup.find((l) => l.driverId === id)?.driverName ?? id,
        }));

  return (
    <SectionCard id="team-snapshot" title={t("teamsTab.sections.snapshot")}>
      <div
        className="mb-3 flex items-center gap-3 rounded-[2px] border-s-4 border border-[color:var(--isl-hairline)] bg-cream px-4 py-3"
        style={{ borderInlineStartColor: color }}
      >
        <TeamLogo teamKey={profile.teamKey} name={teamName} size={48} />
        <div className="min-w-0">
          <div className="truncate text-base font-extrabold text-ink">{teamName}</div>
          {roster.length > 0 && (
            <div className="mt-1 flex flex-wrap gap-1.5">
              {roster.map((d) => (
                <span
                  key={d.driverId}
                  className="rounded-[2px] border border-[color:var(--isl-hairline)] bg-paper px-1.5 py-0.5 text-[11px] font-semibold text-meta"
                >
                  {displayName(d.driverId, d.name)}
                </span>
              ))}
            </div>
          )}
        </div>
        <div className="ms-auto text-end">
          <div className="text-[10px] font-bold uppercase tracking-wider text-meta">
            {t("teamsTab.sample.races", { count: profile.races })}
          </div>
          {s.bestChampPosition !== null && (
            <div className="num text-[11px] text-faint">
              {t("teamsTab.snapshot.bestChamp", { pos: s.bestChampPosition })}
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <StatCard label={label("points")} value={val("points", s.points)} tooltip={tip("points")} />
        <StatCard label={label("wins")} value={val("wins", s.wins)} tooltip={tip("wins")} />
        <StatCard label={label("podiums")} value={val("podiums", s.podiums)} tooltip={tip("podiums")} />
        <StatCard label={label("poles")} value={val("poles", s.poles)} tooltip={tip("poles")} />
        <StatCard label={label("fastestLaps")} value={val("fastestLaps", s.fastestLaps)} tooltip={tip("fastestLaps")} />
        <StatCard label={label("bestChampPosition")} value={val("bestChampPosition", s.bestChampPosition)} tooltip={tip("bestChampPosition")} />
      </div>
    </SectionCard>
  );
}

/* ------------------------------------------------------------------ */
/*  2. Performance                                                     */
/* ------------------------------------------------------------------ */

export function TeamPerformanceSection({ profile }: { profile: TeamProfile }) {
  const { t, label, tip, val } = useTeamText();
  const p = profile.performance;
  return (
    <SectionCard id="team-performance" title={t("teamsTab.sections.performance")}>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        <StatCard label={label("pointsPerRace")} value={val("pointsPerRace", p.pointsPerRace)} tooltip={tip("pointsPerRace")} />
        <StatCard label={label("winRate")} value={val("winRate", p.winRate)} tooltip={tip("winRate")} />
        <StatCard label={label("avgFinish")} value={val("avgFinish", p.avgFinish)} tooltip={tip("avgFinish")} />
        <StatCard label={label("avgGrid")} value={val("avgGrid", p.avgGrid)} tooltip={tip("avgGrid")} />
        <StatCard label={label("oneTwoFinishes")} value={val("oneTwoFinishes", p.oneTwoFinishes)} tooltip={tip("oneTwoFinishes")} />
        <StatCard label={label("doublePodiums")} value={val("doublePodiums", p.doublePodiums)} tooltip={tip("doublePodiums")} />
        <StatCard label={label("frontRowStarts")} value={val("frontRowStarts", profile.qualifying.frontRowStarts)} tooltip={tip("frontRowStarts")} />
        <StatCard label={label("dotd")} value={val("dotd", p.dotd)} tooltip={tip("dotd")} />
      </div>
    </SectionCard>
  );
}

/* ------------------------------------------------------------------ */
/*  3. Reliability & discipline                                        */
/* ------------------------------------------------------------------ */

export function TeamReliabilitySection({ profile }: { profile: TeamProfile }) {
  const { t, label, tip, val } = useTeamText();
  const r = profile.reliability;
  const q = profile.qualifying;
  return (
    <SectionCard id="team-reliability" title={t("teamsTab.sections.reliability")}>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-[2px] border border-[color:var(--isl-hairline)] bg-cream p-2">
          <StatLine label={label("classificationRate")} value={val("classificationRate", r.classificationRate)} tooltip={tip("classificationRate")} />
          <StatLine label={label("dnfRate")} value={val("dnfRate", r.dnfRate)} tooltip={tip("dnfRate")} />
          <StatLine label={label("dnf")} value={val("dnf", r.dnf)} tooltip={tip("dnf")} />
        </div>
        <div className="rounded-[2px] border border-[color:var(--isl-hairline)] bg-cream p-2">
          <StatLine label={label("cleanEntryRate")} value={val("cleanEntryRate", r.cleanEntryRate)} tooltip={tip("cleanEntryRate")} />
          <StatLine label={label("stewardSecondsPerRace")} value={val("stewardSecondsPerRace", r.stewardSecondsPerRace)} tooltip={tip("stewardSecondsPerRace")} />
          <StatLine label={label("gameSecondsPerRace")} value={val("gameSecondsPerRace", r.gameSecondsPerRace)} tooltip={tip("gameSecondsPerRace")} />
          <StatLine label={label("avgNetMovement")} value={val("avgNetMovement", q.avgNetMovement)} tooltip={tip("avgNetMovement")} />
        </div>
      </div>
    </SectionCard>
  );
}

/* ------------------------------------------------------------------ */
/*  4. Lineup & contribution (+ per-driver teammate record)            */
/* ------------------------------------------------------------------ */

export function TeamLineupSection({
  profile,
  driverNamesHe,
  onSelectDriver,
}: {
  profile: TeamProfile;
  driverNamesHe?: Record<string, string>;
  onSelectDriver?: (driverName: string) => void;
}) {
  const { t, locale } = useTeamText();
  const displayName = useDisplayName(driverNamesHe);

  return (
    <SectionCard id="team-lineup" title={t("teamsTab.sections.lineup")} note={t("teamsTab.lineup.note")}>
      <div className="overflow-x-auto rounded-[2px] border border-[color:var(--isl-hairline)]">
        <table className="w-full min-w-[640px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-[color:var(--isl-hairline)] bg-cream text-start text-[10px] font-bold uppercase tracking-wider text-meta">
              <th className="px-3 py-2 text-start">{t("teamsTab.lineup.driver")}</th>
              <th className="px-3 py-2 text-end">{t("teamsTab.lineup.entries")}</th>
              <th className="px-3 py-2 text-end">{t("teamsTab.metrics.points.label")}</th>
              <th className="px-3 py-2 text-end">{t("teamsTab.lineup.share")}</th>
              <th className="px-3 py-2 text-end">{t("teamsTab.metrics.wins.label")}</th>
              <th className="px-3 py-2 text-end">{t("teamsTab.metrics.podiums.label")}</th>
              <th className="px-3 py-2 text-end">{t("teamsTab.lineup.qualiH2H")}</th>
              <th className="px-3 py-2 text-end">{t("teamsTab.lineup.raceH2H")}</th>
            </tr>
          </thead>
          <tbody>
            {profile.lineup.map((l) => {
              const name = displayName(l.driverId, l.driverName);
              return (
                <tr key={l.driverId} className="border-b border-[color:var(--isl-hairline)] last:border-0">
                  <td className="px-3 py-2 font-semibold text-ink">
                    {onSelectDriver ? (
                      <button
                        type="button"
                        onClick={() => onSelectDriver(l.driverName)}
                        className="text-start underline-offset-2 hover:text-oxblood hover:underline"
                      >
                        {name}
                      </button>
                    ) : (
                      name
                    )}
                  </td>
                  <td className="num px-3 py-2 text-end text-meta">{l.entries}</td>
                  <td className="num px-3 py-2 text-end font-semibold text-ink">
                    {formatMetric(l.points, "int", locale)}
                  </td>
                  <td className="num px-3 py-2 text-end text-meta">{formatMetric(l.pointsShare, "pct", locale)}</td>
                  <td className="num px-3 py-2 text-end text-meta">{l.wins}</td>
                  <td className="num px-3 py-2 text-end text-meta">{l.podiums}</td>
                  <td className="num px-3 py-2 text-end text-meta">{l.qualiWins}&ndash;{l.qualiLosses}</td>
                  <td className="num px-3 py-2 text-end text-meta">{l.raceWins}&ndash;{l.raceLosses}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </SectionCard>
  );
}

/* ------------------------------------------------------------------ */
/*  5. Per-circuit                                                     */
/* ------------------------------------------------------------------ */

export function TeamCircuitsSection({ profile }: { profile: TeamProfile }) {
  const { t, locale } = useTeamText();
  if (profile.perCircuit.length === 0) return null;
  return (
    <SectionCard id="team-circuits" title={t("teamsTab.sections.circuits")}>
      <div className="overflow-x-auto rounded-[2px] border border-[color:var(--isl-hairline)]">
        <table className="w-full min-w-[520px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-[color:var(--isl-hairline)] bg-cream text-[10px] font-bold uppercase tracking-wider text-meta">
              <th className="px-3 py-2 text-start">{t("teamsTab.circuits.circuit")}</th>
              <th className="px-3 py-2 text-end">{t("teamsTab.metrics.races.label")}</th>
              <th className="px-3 py-2 text-end">{t("teamsTab.metrics.wins.label")}</th>
              <th className="px-3 py-2 text-end">{t("teamsTab.metrics.podiums.label")}</th>
              <th className="px-3 py-2 text-end">{t("teamsTab.metrics.avgFinish.label")}</th>
              <th className="px-3 py-2 text-end">{t("teamsTab.metrics.bestFinish.label")}</th>
            </tr>
          </thead>
          <tbody>
            {profile.perCircuit.map((c) => (
              <tr key={c.circuitId} className="border-b border-[color:var(--isl-hairline)] last:border-0">
                <td className="px-3 py-2 font-semibold text-ink">
                  {locale === "he" && c.nameHe ? c.nameHe : c.name}
                </td>
                <td className="num px-3 py-2 text-end text-meta">{c.races}</td>
                <td className="num px-3 py-2 text-end text-meta">{c.wins}</td>
                <td className="num px-3 py-2 text-end text-meta">{c.podiums}</td>
                <td className="num px-3 py-2 text-end text-meta">{formatMetric(c.avgFinish, "dec", locale)}</td>
                <td className="num px-3 py-2 text-end text-meta">{formatMetric(c.bestFinish, "pos", locale)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </SectionCard>
  );
}
