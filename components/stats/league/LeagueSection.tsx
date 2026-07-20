"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import type { RaceResultRow } from "@/lib/resultsData";
import type { RaceEvent, RaceFormat } from "@/lib/scheduleData";
import type { SeasonConfig } from "@/lib/seasonConfig";
import {
  normalizeRaces,
  filterRaces,
  hasAdvancedFilter,
  type NormalizedRace,
  type ProfileFilters,
  type LeagueKind,
  type WeatherKind,
} from "@/lib/stats/normalizeRace";
import { computeLeagueProfile } from "@/lib/stats/leagueProfile";
import StatsFilterPills from "@/components/stats/StatsFilterPills";
import { EmptyState, Toggle, Pill, Chip } from "@/components/stats/shared";
import {
  PulseSection,
  CompetitiveSection,
  MovementSection,
  GridHealthSection,
  ReliabilitySection,
  DisciplineSection,
  SplitsSection,
  RecordsSection,
  FactsSection,
} from "@/components/stats/league/sections";
import { LeagueCharts } from "@/components/stats/league/LeagueCharts";

type Props = {
  raceResults?: Record<string, RaceResultRow[]>;
  events?: RaceEvent[];
  seasons?: SeasonConfig[];
};

const WEATHER_ORDER: WeatherKind[] = ["dry", "wet", "mixed"];
/** Only surface the weather split/filter when weather is logged widely enough. */
const WEATHER_COVERAGE_MIN = 0.6;

export default function LeagueSection({
  raceResults = {},
  events = [],
  seasons = [],
}: Props) {
  const t = useTranslations("stats");
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  /* ---------- Normalized dataset (completed races only) ---------- */
  const allRaces = useMemo<NormalizedRace[]>(() => {
    const completed = new Set(
      events
        .filter((e) => (e.status ?? "").trim().toLowerCase() === "completed")
        .map((e) => e.event_id.toLowerCase()),
    );
    return normalizeRaces(Object.values(raceResults).flat(), events).filter((r) =>
      completed.has(r.eventId.toLowerCase()),
    );
  }, [raceResults, events]);

  const seasonOptions = useMemo(() => {
    const set = new Set<string>();
    for (const r of allRaces) if (r.seasonKey) set.add(r.seasonKey);
    return [...set].sort(
      (a, b) => (parseInt(b.replace(/\D/g, ""), 10) || 0) - (parseInt(a.replace(/\D/g, ""), 10) || 0),
    );
  }, [allRaces]);

  /* ---------- State (hydrated from URL via lazy initializers) ---------- */
  const [scope, setScope] = useState<"all-time" | "season">(
    () => (searchParams.get("scope") === "season" ? "season" : "all-time"),
  );
  const [season, setSeason] = useState<string>(() => {
    const sn = searchParams.get("season");
    return sn && seasonOptions.includes(sn) ? sn : seasonOptions[0] ?? "S1";
  });
  const [format, setFormat] = useState<RaceFormat | undefined>(() => {
    const f = searchParams.get("format");
    return f === "50%" || f === "25%" || f === "sprint" ? f : undefined;
  });
  const [competition, setCompetition] = useState<LeagueKind | undefined>(() => {
    const c = searchParams.get("comp");
    return c === "main" || c === "wild" ? c : undefined;
  });
  const [roundType, setRoundType] = useState<"regular" | "playoff" | undefined>(() => {
    const r = searchParams.get("round");
    return r === "regular" || r === "playoff" ? r : undefined;
  });
  const [weather, setWeather] = useState<"dry" | "wet" | "mixed" | undefined>(() => {
    const w = searchParams.get("weather");
    return w === "dry" || w === "wet" || w === "mixed" ? w : undefined;
  });
  const [showAdvanced, setShowAdvanced] = useState<boolean>(
    () =>
      !!(
        searchParams.get("format") ||
        searchParams.get("comp") ||
        searchParams.get("round") ||
        searchParams.get("weather")
      ),
  );

  /* ---------- Availability (scope-only) ---------- */
  const scopeFilters = useMemo<ProfileFilters>(
    () => ({ scope, season: scope === "season" ? season : undefined }),
    [scope, season],
  );
  const scopedRaces = useMemo(
    () => filterRaces(allRaces, scopeFilters),
    [allRaces, scopeFilters],
  );
  const availability = useMemo(() => {
    const formats = new Set<RaceFormat>();
    const weathers = new Set<WeatherKind>();
    let wild = false;
    let hasRegular = false;
    let hasPlayoffs = false;
    let knownWeather = 0;
    const eventIds = new Set<string>();
    for (const r of scopedRaces) {
      formats.add(r.format);
      if (r.weather !== "unknown") weathers.add(r.weather);
      if (r.league === "wild") wild = true;
      if (r.isPlayoff) hasPlayoffs = true;
      else hasRegular = true;
    }
    // Weather coverage measured per event, not per entry.
    const perEventWeather = new Map<string, WeatherKind>();
    for (const r of scopedRaces) {
      eventIds.add(r.eventId);
      perEventWeather.set(r.eventId, r.weather);
    }
    for (const w of perEventWeather.values()) if (w !== "unknown") knownWeather++;
    const order: RaceFormat[] = ["50%", "25%", "sprint"];
    return {
      formats: order.filter((f) => formats.has(f)),
      weathers: WEATHER_ORDER.filter((w) => weathers.has(w)),
      wild,
      hasRegular,
      hasPlayoffs,
      weatherCoverage: eventIds.size ? knownWeather / eventIds.size : 0,
    };
  }, [scopedRaces]);

  const weatherEnabled =
    availability.weathers.length >= 2 &&
    availability.weatherCoverage >= WEATHER_COVERAGE_MIN;

  /* ---------- Effective (availability-clamped) filters ---------- */
  const effFormat =
    format && availability.formats.includes(format) ? format : undefined;
  const effCompetition =
    competition === "wild" && !availability.wild ? undefined : competition;
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
  const effWeather =
    weather && weatherEnabled && availability.weathers.includes(weather)
      ? weather
      : undefined;

  /* ---------- URL sync (write-only) ---------- */
  useEffect(() => {
    const next = new URLSearchParams(searchParams.toString());
    const set = (key: string, val: string | undefined) => {
      if (val) next.set(key, val);
      else next.delete(key);
    };
    set("scope", scope === "season" ? "season" : undefined);
    set("season", scope === "season" ? season : undefined);
    set("format", effFormat);
    set("comp", effCompetition);
    set("round", effRoundType);
    set("weather", effWeather);
    const qs = next.toString();
    if (qs !== searchParams.toString()) {
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    }
  }, [searchParams, scope, season, effFormat, effCompetition, effRoundType, effWeather, pathname, router]);

  /* ---------- Profile ---------- */
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

  const profile = useMemo(
    () => computeLeagueProfile(allRaces, events, seasons, filters),
    [allRaces, events, seasons, filters],
  );

  /* ---------- Active filter chips ---------- */
  const activeChips = useMemo(() => {
    const chips: { key: string; label: string; onRemove: () => void }[] = [];
    if (effFormat)
      chips.push({
        key: "format",
        label: effFormat === "sprint" ? t("filters.sprint") : effFormat === "25%" ? t("filters.format25") : t("filters.format50"),
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
    availability.wild ||
    (availability.hasRegular && availability.hasPlayoffs) ||
    weatherEnabled;

  const contextLabel = useMemo(() => {
    const key = scope === "season" ? "league.context.scopeSeason" : "league.context.scopeAllTime";
    return t(key, {
      season: season.replace(/^S/i, ""),
      races: profile.races,
      seasons: profile.seasons,
    });
  }, [scope, season, profile.races, profile.seasons, t]);

  const hasAnyData = allRaces.length > 0;

  return (
    <div className="space-y-6">
      {/* ── Context bar ── */}
      <div className="space-y-3 rounded-[2px] border border-[color:var(--isl-hairline)] bg-cream p-4">
        <div className="flex flex-wrap items-center gap-3">
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
          <span className="ms-auto text-[11px] font-semibold uppercase tracking-wider text-faint">
            {contextLabel}
          </span>
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
              showWild={availability.wild}
              availableFormats={availability.formats}
              showRegular={availability.hasRegular}
              showPlayoffs={availability.hasPlayoffs}
            />
            {weatherEnabled && (
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

        {activeChips.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 border-t border-[color:var(--isl-hairline)] pt-3">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-faint">
              {t("league.context.filteredNote")}
            </span>
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

      {/* ── Body ── */}
      {!hasAnyData ? (
        <EmptyState message={t("empty.noLeagueStats")} />
      ) : profile.races === 0 ? (
        <EmptyState message={t("league.context.emptyForFilters")} />
      ) : (
        <div className="space-y-8">
          <PulseSection profile={profile} />
          <CompetitiveSection profile={profile} />
          <LeagueCharts profile={profile} />
          <MovementSection profile={profile} />
          <GridHealthSection profile={profile} />
          <ReliabilitySection profile={profile} />
          <DisciplineSection profile={profile} />
          <SplitsSection profile={profile} />
          <RecordsSection profile={profile} />
          <FactsSection profile={profile} />
        </div>
      )}
    </div>
  );
}
