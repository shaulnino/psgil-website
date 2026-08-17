"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import type { RaceResultRow } from "@/lib/resultsData";
import type { RaceEvent, RaceFormat } from "@/lib/scheduleData";
import type { SeasonConfig } from "@/lib/seasonConfig";
import {
  normalizeRaces,
  hasAdvancedFilter,
  type NormalizedRace,
  type ProfileFilters,
  type LeagueKind,
  type WeatherKind,
} from "@/lib/stats/normalizeRace";
import {
  computeTeamProfile,
  computeTeamsOverview,
  listTeamsWithHistory,
} from "@/lib/stats/teamProfile";
import { formatMetric } from "@/lib/stats/metricCatalog";
import { localizedTeamName, type TeamNameLookup } from "@/lib/stats/teamIdentity";
import StatsFilterPills from "@/components/stats/StatsFilterPills";
import { EmptyState, SearchableSelect, Toggle, Pill, Chip } from "@/components/stats/shared";
import { TeamLogo } from "@/components/stats/teams/sections";
import {
  TeamSnapshotSection,
  TeamPerformanceSection,
  TeamReliabilitySection,
  TeamLineupSection,
  TeamCircuitsSection,
} from "@/components/stats/teams/sections";
import { TeamsCharts } from "@/components/stats/teams/TeamsCharts";

type Props = {
  raceResults?: Record<string, RaceResultRow[]>;
  events?: RaceEvent[];
  seasons?: SeasonConfig[];
  driverNamesHe?: Record<string, string>;
  /** Current team roster from the drivers tab, keyed by team_key. */
  currentRoster?: Record<string, { driverId: string; name: string }[]>;
  /** Sheet-sourced team names (team_key → {en, he}); code map is the fallback. */
  teamNames?: TeamNameLookup;
  onSelectDriver?: (driverName: string) => void;
};

const WEATHER_ORDER: WeatherKind[] = ["dry", "wet", "mixed"];

export default function TeamsSection({
  raceResults = {},
  events = [],
  seasons = [],
  driverNamesHe,
  currentRoster,
  teamNames,
  onSelectDriver,
}: Props) {
  const t = useTranslations("stats");
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  /* ---------- Normalized dataset (built once) ---------- */
  const allRaces = useMemo<NormalizedRace[]>(
    () => normalizeRaces(Object.values(raceResults).flat(), events),
    [raceResults, events],
  );

  const teamList = useMemo(() => listTeamsWithHistory(allRaces, events), [allRaces, events]);
  const teamKeys = useMemo(() => teamList.map((tm) => tm.teamKey), [teamList]);
  const nameByKey = useMemo(() => {
    const m = new Map<string, string>();
    for (const tm of teamList) m.set(tm.teamKey, tm.name);
    return m;
  }, [teamList]);
  const nameFor = useCallback(
    (key: string) => localizedTeamName(key, locale, nameByKey.get(key), teamNames),
    [nameByKey, locale, teamNames],
  );

  const seasonOptions = useMemo(() => {
    const set = new Set<string>();
    for (const r of allRaces) if (r.seasonKey) set.add(r.seasonKey);
    return [...set].sort(
      (a, b) => (parseInt(b.replace(/\D/g, ""), 10) || 0) - (parseInt(a.replace(/\D/g, ""), 10) || 0),
    );
  }, [allRaces]);

  /* ---------- State (hydrated once from the URL) ---------- */
  const [teamKey, setTeamKey] = useState<string>(() => {
    const c = searchParams.get("teamid");
    return c && teamKeys.includes(c) ? c : teamKeys[0] ?? "";
  });
  const [scope, setScope] = useState<"all-time" | "season">(
    () => (searchParams.get("tscope") === "season" ? "season" : "all-time"),
  );
  const [season, setSeason] = useState<string>(() => {
    const sn = searchParams.get("tseason");
    return sn && seasonOptions.includes(sn) ? sn : seasonOptions[0] ?? "S1";
  });
  const [format, setFormat] = useState<RaceFormat | undefined>(() => {
    const f = searchParams.get("tformat");
    return f === "50%" || f === "25%" || f === "sprint" ? f : undefined;
  });
  const [competition, setCompetition] = useState<LeagueKind | undefined>(() => {
    const c = searchParams.get("tcomp");
    return c === "main" || c === "wild" ? c : undefined;
  });
  const [roundType, setRoundType] = useState<"regular" | "playoff" | undefined>(() => {
    const r = searchParams.get("tround");
    return r === "regular" || r === "playoff" ? r : undefined;
  });
  const [weather, setWeather] = useState<"dry" | "wet" | "mixed" | undefined>(() => {
    const w = searchParams.get("tweather");
    return w === "dry" || w === "wet" || w === "mixed" ? w : undefined;
  });
  const [showAdvanced, setShowAdvanced] = useState<boolean>(
    () =>
      !!(
        searchParams.get("tformat") ||
        searchParams.get("tcomp") ||
        searchParams.get("tround") ||
        searchParams.get("tweather")
      ),
  );

  const effTeamKey = teamKeys.includes(teamKey) ? teamKey : teamKeys[0] ?? "";

  /* ---------- Availability (season scope, ignoring advanced filters) ---------- */
  const scopeFilters = useMemo<ProfileFilters>(
    () => ({ scope, season: scope === "season" ? season : undefined }),
    [scope, season],
  );
  const baseOverview = useMemo(
    () => computeTeamsOverview(allRaces, events, seasons, scopeFilters),
    [allRaces, events, seasons, scopeFilters],
  );
  const availability = baseOverview.availability;

  const effFormat = format && availability.formats.includes(format) ? format : undefined;
  const effCompetition = competition === "wild" && !availability.hasWild ? undefined : competition;
  const effRoundType =
    roundType === "playoff"
      ? availability.hasPlayoffs
        ? "playoff"
        : undefined
      : roundType === "regular"
        ? availability.hasRegular
          ? "regular"
          : undefined
        : roundType;
  const effWeather = weather && availability.weathers.includes(weather) ? weather : undefined;

  /* ---------- URL sync (write-only) ---------- */
  useEffect(() => {
    const next = new URLSearchParams(searchParams.toString());
    const set = (key: string, val: string | undefined) => {
      if (val) next.set(key, val);
      else next.delete(key);
    };
    set("teamid", effTeamKey || undefined);
    set("tscope", scope === "season" ? "season" : undefined);
    set("tseason", scope === "season" ? season : undefined);
    set("tformat", effFormat);
    set("tcomp", effCompetition);
    set("tround", effRoundType);
    set("tweather", effWeather);
    const qs = next.toString();
    if (qs !== searchParams.toString()) {
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    }
  }, [searchParams, effTeamKey, scope, season, effFormat, effCompetition, effRoundType, effWeather, pathname, router]);

  /* ---------- Overview + profile ---------- */
  const filters = useMemo<ProfileFilters>(
    () => ({
      scope,
      season: scope === "season" ? season : undefined,
      format: effFormat,
      competition: effCompetition,
      roundType: effRoundType,
      weather: effWeather,
    }),
    [scope, season, effFormat, effCompetition, effRoundType, effWeather],
  );

  const overview = useMemo(
    () => computeTeamsOverview(allRaces, events, seasons, filters),
    [allRaces, events, seasons, filters],
  );
  const profile = useMemo(
    () => (effTeamKey ? computeTeamProfile(allRaces, events, seasons, filters, effTeamKey) : null),
    [allRaces, events, seasons, filters, effTeamKey],
  );

  /* ---------- Active filter chips ---------- */
  const activeChips = useMemo(() => {
    const chips: { key: string; label: string; onRemove: () => void }[] = [];
    if (effFormat)
      chips.push({
        key: "format",
        label:
          effFormat === "sprint"
            ? t("filters.sprint")
            : effFormat === "25%"
              ? t("filters.format25")
              : t("filters.format50"),
        onRemove: () => setFormat(undefined),
      });
    if (effCompetition)
      chips.push({
        key: "comp",
        label: effCompetition === "wild" ? t("filters.wild") : t("filters.main"),
        onRemove: () => setCompetition(undefined),
      });
    if (effRoundType)
      chips.push({
        key: "round",
        label: effRoundType === "playoff" ? t("filters.playoffs") : t("filters.regular"),
        onRemove: () => setRoundType(undefined),
      });
    if (effWeather)
      chips.push({ key: "weather", label: t(`weather.${effWeather}`), onRemove: () => setWeather(undefined) });
    return chips;
  }, [effFormat, effCompetition, effRoundType, effWeather, t]);

  const anyAdvanced = hasAdvancedFilter(filters);
  const resetAll = useCallback(() => {
    setFormat(undefined);
    setCompetition(undefined);
    setRoundType(undefined);
    setWeather(undefined);
  }, []);

  const showFilterGroups =
    availability.formats.length >= 2 ||
    availability.hasWild ||
    (availability.hasRegular && availability.hasPlayoffs);

  const contextLabel = useMemo(() => {
    const parts: string[] = [];
    parts.push(
      scope === "season"
        ? t("driversTab.context.contextSeason", { season: season.replace(/^S/i, "") })
        : t("driversTab.context.contextAllTime"),
    );
    if (effCompetition)
      parts.push(
        effCompetition === "wild"
          ? t("driversTab.context.contextWild")
          : t("driversTab.context.contextMain"),
      );
    return parts.join(" · ");
  }, [scope, season, effCompetition, t]);

  /* ---------- Empty: no teams with history yet ---------- */
  if (teamList.length === 0) {
    return <EmptyState message={t("teamsTab.empty.noTeams")} />;
  }

  return (
    <div className="space-y-6">
      {/* ── Context bar ── */}
      <div className="space-y-3 rounded-[2px] border border-[color:var(--isl-hairline)] bg-cream p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="min-w-[16rem] flex-1">
            <SearchableSelect
              options={teamKeys}
              value={effTeamKey}
              onChange={setTeamKey}
              placeholder={t("teamsTab.selectTeam")}
              labelFor={nameFor}
            />
          </div>
          <Toggle
            options={["all-time", "season"]}
            value={scope}
            onChange={(v) => setScope(v as "all-time" | "season")}
            labelFor={(v) => (v === "season" ? t("toggle.season") : t("toggle.allTime"))}
          />
          {scope === "season" && (
            <select
              value={season}
              onChange={(e) => setSeason(e.target.value)}
              className="num rounded-[2px] border border-[color:var(--isl-hairline-strong)] bg-paper px-3 py-2 text-sm text-ink outline-none"
            >
              {seasonOptions.map((k) => (
                <option key={k} value={k} className="bg-paper">
                  {t("season.label", { n: k.replace(/^S/i, "") })}
                </option>
              ))}
            </select>
          )}
          {showFilterGroups && (
            <button
              type="button"
              onClick={() => setShowAdvanced((v) => !v)}
              className="rounded-[2px] border border-[color:var(--isl-hairline)] px-3 py-2 text-sm font-semibold text-meta transition hover:text-ink"
            >
              {showAdvanced ? t("driversTab.context.hideFilters") : t("driversTab.context.advancedFilters")}
            </button>
          )}
        </div>

        {showAdvanced && showFilterGroups && (
          <div className="space-y-3 border-t border-[color:var(--isl-hairline)] pt-3">
            <StatsFilterPills
              formatFilter={effFormat}
              competitionFilter={effCompetition}
              roundTypeFilter={effRoundType}
              onFormat={(v) => setFormat(v)}
              onCompetition={(v) => setCompetition(v)}
              onRoundType={(v) => setRoundType(v)}
              onClearAll={resetAll}
              showWild={availability.hasWild}
              availableFormats={availability.formats}
              showRegular={availability.hasRegular}
              showPlayoffs={availability.hasPlayoffs}
            />
            {availability.weathers.length >= 2 && (
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-isl-body text-[10px] font-semibold uppercase tracking-[0.2em] text-oxblood">
                  {t("driversTab.context.weather")}
                </span>
                <Pill active={effWeather === undefined} onClick={() => setWeather(undefined)}>
                  {t("filters.all")}
                </Pill>
                {availability.weathers.map((w) => (
                  <Pill key={w} active={effWeather === w} onClick={() => setWeather(w as "dry" | "wet" | "mixed")}>
                    {t(`weather.${w}`)}
                  </Pill>
                ))}
              </div>
            )}
          </div>
        )}

        {(activeChips.length > 0 || anyAdvanced) && (
          <div className="flex flex-wrap items-center gap-2 border-t border-[color:var(--isl-hairline)] pt-3">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-faint">{contextLabel}</span>
            {activeChips.map((c) => (
              <Chip key={c.key} onRemove={c.onRemove}>
                {c.label}
              </Chip>
            ))}
            {anyAdvanced && (
              <button
                type="button"
                onClick={resetAll}
                className="ms-auto rounded-[2px] px-2 py-1 text-xs font-semibold text-meta underline-offset-2 hover:text-oxblood hover:underline"
              >
                {t("driversTab.context.reset")}
              </button>
            )}
          </div>
        )}
      </div>

      {/* ── Constructors leaderboard ── */}
      {overview.teams.length === 0 ? (
        <EmptyState message={t("teamsTab.empty.forFilters")} />
      ) : (
        <div className="overflow-x-auto rounded-[2px] border border-[color:var(--isl-hairline)]">
          <table className="w-full min-w-[640px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-[color:var(--isl-hairline)] bg-cream text-[10px] font-bold uppercase tracking-wider text-meta">
                <th className="px-3 py-2 text-start">{t("teamsTab.overview.pos")}</th>
                <th className="px-3 py-2 text-start">{t("teamsTab.overview.team")}</th>
                <th className="px-3 py-2 text-end">{t("teamsTab.metrics.points.label")}</th>
                <th className="px-3 py-2 text-end">{t("teamsTab.metrics.wins.label")}</th>
                <th className="px-3 py-2 text-end">{t("teamsTab.metrics.podiums.label")}</th>
                <th className="px-3 py-2 text-end">{t("teamsTab.metrics.poles.label")}</th>
                <th className="px-3 py-2 text-end">{t("teamsTab.metrics.avgFinish.label")}</th>
                <th className="px-3 py-2 text-end">{t("teamsTab.metrics.pointsPerRace.label")}</th>
              </tr>
            </thead>
            <tbody>
              {overview.teams.map((tm) => {
                const selected = tm.teamKey === effTeamKey;
                const tmName = localizedTeamName(tm.teamKey, locale, tm.name, teamNames);
                return (
                  <tr
                    key={tm.teamKey}
                    onClick={() => setTeamKey(tm.teamKey)}
                    className={`cursor-pointer border-b border-[color:var(--isl-hairline)] transition last:border-0 hover:bg-sink ${
                      selected ? "bg-sink" : ""
                    }`}
                  >
                    <td className="num px-3 py-2 font-bold text-ink">{tm.championshipPosition}</td>
                    <td className="px-3 py-2">
                      <span className="flex items-center gap-2">
                        <TeamLogo teamKey={tm.teamKey} name={tmName} size={28} />
                        <span className="font-semibold text-ink">{tmName}</span>
                      </span>
                    </td>
                    <td className="num px-3 py-2 text-end font-semibold text-ink">
                      {formatMetric(tm.points, "int", locale)}
                    </td>
                    <td className="num px-3 py-2 text-end text-meta">{tm.wins}</td>
                    <td className="num px-3 py-2 text-end text-meta">{tm.podiums}</td>
                    <td className="num px-3 py-2 text-end text-meta">{tm.poles}</td>
                    <td className="num px-3 py-2 text-end text-meta">{formatMetric(tm.avgFinish, "dec", locale)}</td>
                    <td className="num px-3 py-2 text-end text-meta">{formatMetric(tm.pointsPerRace, "dec", locale)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Profile ── */}
      {!profile ? (
        overview.teams.length > 0 && <EmptyState message={t("teamsTab.empty.forFilters")} />
      ) : (
        <div className="space-y-8">
          <TeamSnapshotSection
            profile={profile}
            currentRoster={currentRoster?.[profile.teamKey]}
            driverNamesHe={driverNamesHe}
            teamNames={teamNames}
          />
          <TeamPerformanceSection profile={profile} />
          <TeamsCharts profile={profile} />
          <TeamLineupSection profile={profile} driverNamesHe={driverNamesHe} onSelectDriver={onSelectDriver} />
          <TeamReliabilitySection profile={profile} />
          <TeamCircuitsSection profile={profile} />
        </div>
      )}
    </div>
  );
}
