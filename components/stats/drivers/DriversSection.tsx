"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import type { DriverStatRow } from "@/lib/statsData";
import type { RaceResultRow } from "@/lib/resultsData";
import type { RaceEvent, RaceFormat } from "@/lib/scheduleData";
import type { SeasonConfig } from "@/lib/seasonConfig";
import type { Reward } from "@/lib/rewardsData";
import { computeDriverStats, type StatsFilters } from "@/lib/statsComputed";
import {
  normalizeRaces,
  filterRaces,
  hasAdvancedFilter,
  type NormalizedRace,
  type ProfileFilters,
  type LeagueKind,
  type WeatherKind,
} from "@/lib/stats/normalizeRace";
import { computeDriverProfile } from "@/lib/stats/driverProfile";
import StatsFilterPills from "@/components/stats/StatsFilterPills";
import {
  EmptyState,
  SearchableSelect,
  Toggle,
  Pill,
  Chip,
} from "@/components/stats/shared";
import {
  SnapshotSection,
  RecentFormSection,
  ResultsSection,
  RacecraftSection,
  ConsistencySection,
  DisciplineSection,
  SplitsSection,
  CircuitsSection,
  RaceHistorySection,
  RecordsSection,
} from "@/components/stats/drivers/sections";
import { GraphSwitcher } from "@/components/stats/drivers/GraphSwitcher";
import { CompareOverlay } from "@/components/stats/drivers/CompareOverlay";

type Props = {
  allTime: { rows: DriverStatRow[]; headers: string[] };
  bySeason: Record<string, { rows: DriverStatRow[]; headers: string[] }>;
  raceResults?: Record<string, RaceResultRow[]>;
  events?: RaceEvent[];
  initialDriver?: string;
  seasons?: SeasonConfig[];
  rewards?: Reward[];
  /** Hebrew driver display names keyed by driver_id (label-only). */
  driverNamesHe?: Record<string, string>;
  /** Jump to the Head-to-Head tab, optionally pre-selecting both drivers. */
  onOpenHeadToHead?: (driverA?: string, driverB?: string) => void;
};

const WEATHER_ORDER: WeatherKind[] = ["dry", "wet", "mixed"];

export default function DriversSection({
  allTime,
  bySeason,
  raceResults = {},
  events = [],
  initialDriver,
  seasons,
  rewards,
  driverNamesHe,
  onOpenHeadToHead,
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

  const driverNames = useMemo(() => {
    const set = new Set<string>();
    for (const r of allRaces) if (r.driverName) set.add(r.driverName);
    return [...set].sort((a, b) => a.localeCompare(b));
  }, [allRaces]);

  // Map English driver name -> driver_id (both from the same results source),
  // so the selector can show a localized (Hebrew) label while the value stays
  // the English name used for matching + URL state.
  const idByName = useMemo(() => {
    const map = new Map<string, string>();
    for (const r of allRaces) {
      if (r.driverName && r.driverId) map.set(r.driverName.toLowerCase(), r.driverId);
    }
    return map;
  }, [allRaces]);

  const displayName = useCallback(
    (name: string) => {
      if (locale !== "he" || !name) return name;
      const id = idByName.get(name.toLowerCase());
      return (id && driverNamesHe?.[id]) || name;
    },
    [locale, idByName, driverNamesHe],
  );

  const seasonOptions = useMemo(() => {
    const set = new Set<string>();
    for (const r of allRaces) if (r.seasonKey) set.add(r.seasonKey);
    return [...set].sort(
      (a, b) => (parseInt(b.replace(/\D/g, ""), 10) || 0) - (parseInt(a.replace(/\D/g, ""), 10) || 0),
    );
  }, [allRaces]);

  /* ---------- State ---------- */
  const defaultDriver = useMemo(
    () => initialDriver ?? allTime.rows[0]?.driver_name ?? driverNames[0] ?? "",
    [initialDriver, allTime.rows, driverNames],
  );

  // Hydrate once from the URL via lazy initializers (searchParams is read at
  // render time, consistent with how the parent derives `initialDriver`). This
  // avoids a setState-in-effect hydration pass; the effect below is write-only.
  const [driver, setDriver] = useState<string>(
    () => searchParams.get("driver") || defaultDriver,
  );
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
  const [circuit, setCircuit] = useState<string | undefined>(
    () => searchParams.get("circuit") || undefined,
  );
  const [showAdvanced, setShowAdvanced] = useState<boolean>(
    () =>
      !!(
        searchParams.get("format") ||
        searchParams.get("comp") ||
        searchParams.get("round") ||
        searchParams.get("weather") ||
        searchParams.get("circuit")
      ),
  );
  const [compareActive, setCompareActive] = useState<boolean>(
    () => !!searchParams.get("cmp"),
  );
  const [compareDriver, setCompareDriver] = useState<string>(
    () => searchParams.get("cmp") || "",
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
    const circuits = new Set<string>();
    let wild = false;
    let hasRegular = false;
    let hasPlayoffs = false;
    for (const r of scopedRaces) {
      formats.add(r.format);
      if (r.weather !== "unknown") weathers.add(r.weather);
      if (r.track) circuits.add(r.track);
      if (r.league === "wild") wild = true;
      if (r.isPlayoff) hasPlayoffs = true;
      else hasRegular = true;
    }
    const order: RaceFormat[] = ["50%", "25%", "sprint"];
    return {
      formats: order.filter((f) => formats.has(f)),
      weathers: WEATHER_ORDER.filter((w) => weathers.has(w)),
      circuits: [...circuits].sort((a, b) => a.localeCompare(b)),
      wild,
      hasRegular,
      hasPlayoffs,
    };
  }, [scopedRaces]);

  // Effective (availability-clamped) advanced filters. Selections that no longer
  // have options in the current scope are ignored for computation/URL/display
  // without clearing the underlying state, so they re-apply if scope changes
  // back. This replaces a setState-in-effect cleanup pass.
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
    weather && availability.weathers.includes(weather) ? weather : undefined;
  const effCircuit =
    circuit && availability.circuits.includes(circuit) ? circuit : undefined;

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
    set("circuit", effCircuit);
    set("cmp", compareActive && compareDriver ? compareDriver : undefined);
    if (driver) next.set("driver", driver);
    const qs = next.toString();
    if (qs !== searchParams.toString()) {
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    }
  }, [
    searchParams,
    scope,
    season,
    effFormat,
    effCompetition,
    effRoundType,
    effWeather,
    effCircuit,
    compareActive,
    compareDriver,
    driver,
    pathname,
    router,
  ]);

  /* ---------- Profiles ---------- */
  const filters = useMemo<ProfileFilters>(
    () => ({
      scope,
      season: scope === "season" ? season : undefined,
      format: effFormat,
      competition: effCompetition,
      roundType: effRoundType,
      weather: effWeather,
      circuit: effCircuit,
    }),
    [scope, season, effFormat, effCompetition, effRoundType, effWeather, effCircuit],
  );

  const profile = useMemo(
    () => (driver ? computeDriverProfile(allRaces, driver, filters) : null),
    [allRaces, driver, filters],
  );
  const compareProfile = useMemo(
    () =>
      compareActive && compareDriver && compareDriver !== driver
        ? computeDriverProfile(allRaces, compareDriver, filters)
        : null,
    [compareActive, compareDriver, driver, allRaces, filters],
  );

  /* ---------- Rating dataset (pool-relative, StatsFilters subset) ---------- */
  const statsFilters = useMemo<StatsFilters>(() => {
    const f: StatsFilters = {};
    if (scope === "season") f.season = season;
    if (effFormat) f.format = effFormat;
    if (effCompetition) f.competition = effCompetition;
    if (effRoundType) f.roundType = effRoundType;
    return f;
  }, [scope, season, effFormat, effCompetition, effRoundType]);

  const ratingDataset = useMemo(() => {
    const needsCompute =
      !!statsFilters.format || !!statsFilters.competition || !!statsFilters.roundType;
    if (!needsCompute) {
      return scope === "season" ? bySeason[season] ?? { rows: [], headers: [] } : allTime;
    }
    const flat = Object.values(raceResults).flat();
    if (!flat.length || !events.length) {
      return scope === "season" ? bySeason[season] ?? { rows: [], headers: [] } : allTime;
    }
    return computeDriverStats(flat, events, rewards ?? [], seasons ?? [], statsFilters);
  }, [statsFilters, scope, season, bySeason, allTime, raceResults, events, rewards, seasons]);

  const ratingFor = useCallback(
    (name: string): { rating: number | null; pos: number | null } => {
      const idx = ratingDataset.rows.findIndex((r) => r.driver_name === name);
      if (idx < 0) return { rating: null, pos: null };
      const row = ratingDataset.rows[idx];
      const rating = row.metrics["Driver Rating"];
      return {
        rating: Number.isFinite(rating) ? rating : null,
        pos: idx + 1,
      };
    },
    [ratingDataset],
  );

  const driverRatingInfo = useMemo(() => ratingFor(driver), [ratingFor, driver]);
  const compareRatingInfo = useMemo(
    () => (compareDriver ? ratingFor(compareDriver) : { rating: null, pos: null }),
    [ratingFor, compareDriver],
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
    if (effCircuit)
      chips.push({ key: "circuit", label: effCircuit, onRemove: () => setCircuit(undefined) });
    return chips;
  }, [effFormat, effCompetition, effRoundType, effWeather, effCircuit, t]);

  const anyAdvanced = hasAdvancedFilter(filters);
  const resetAll = useCallback(() => {
    setFormat(undefined);
    setCompetition(undefined);
    setRoundType(undefined);
    setWeather(undefined);
    setCircuit(undefined);
  }, []);

  const showFilterGroups =
    availability.formats.length >= 2 ||
    availability.wild ||
    (availability.hasRegular && availability.hasPlayoffs);

  /* ---------- Context label ---------- */
  const contextLabel = useMemo(() => {
    const parts: string[] = [];
    parts.push(
      scope === "season"
        ? t("driversTab.context.contextSeason", { season: season.replace(/^S/i, "") })
        : t("driversTab.context.contextAllTime"),
    );
    if (effCompetition) parts.push(effCompetition === "wild" ? t("driversTab.context.contextWild") : t("driversTab.context.contextMain"));
    return parts.join(" · ");
  }, [scope, season, effCompetition, t]);

  const allCircuitsLabel = t("driversTab.context.allCircuits");

  return (
    <div className="space-y-6">
      {/* ── Context bar ── */}
      <div className="space-y-3 rounded-[2px] border border-[color:var(--isl-hairline)] bg-cream p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="min-w-[16rem] flex-1">
            <SearchableSelect
              options={driverNames}
              value={driver}
              onChange={setDriver}
              placeholder={t("select.selectDriver")}
              labelFor={displayName}
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
          <button
            type="button"
            onClick={() => {
              setCompareActive((v) => !v);
              if (!compareActive && !compareDriver) {
                const alt = driverNames.find((n) => n !== driver);
                if (alt) setCompareDriver(alt);
              }
            }}
            className={`rounded-[2px] px-3 py-2 text-sm font-semibold transition ${
              compareActive ? "bg-ink text-bone" : "border border-[color:var(--isl-hairline)] text-meta hover:text-ink"
            }`}
          >
            {compareActive ? t("driversTab.context.compareClose") : t("driversTab.context.compare")}
          </button>
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

        {compareActive && (
          <div className="min-w-[16rem] sm:max-w-sm">
            <SearchableSelect
              options={driverNames.filter((n) => n !== driver)}
              value={compareDriver}
              onChange={setCompareDriver}
              placeholder={t("driversTab.compareOverlay.add")}
              labelFor={displayName}
            />
          </div>
        )}

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
            {availability.circuits.length >= 2 && (
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-isl-body text-[10px] font-semibold uppercase tracking-[0.2em] text-oxblood">
                  {t("driversTab.context.circuit")}
                </span>
                <div className="min-w-[14rem]">
                  <SearchableSelect
                    options={[allCircuitsLabel, ...availability.circuits]}
                    value={effCircuit ?? allCircuitsLabel}
                    onChange={(v) => setCircuit(v === allCircuitsLabel ? undefined : v)}
                    placeholder={allCircuitsLabel}
                  />
                </div>
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

      {/* ── Body ── */}
      {!driver ? (
        <EmptyState message={t("driversTab.context.selectPrompt")} />
      ) : !profile ? (
        <EmptyState message={t("driversTab.context.emptyForFilters")} />
      ) : compareActive && compareProfile ? (
        <CompareOverlay
          profileA={profile}
          profileB={compareProfile}
          nameA={displayName(profile.driverName)}
          nameB={displayName(compareProfile.driverName)}
          ratingA={driverRatingInfo.rating}
          ratingB={compareRatingInfo.rating}
          onOpenHeadToHead={
            onOpenHeadToHead
              ? () => onOpenHeadToHead(driver, compareDriver)
              : undefined
          }
        />
      ) : (
        <div className="space-y-8">
          <SnapshotSection
            profile={profile}
            driverRating={driverRatingInfo.rating}
            championshipPos={driverRatingInfo.pos}
          />
          <RecentFormSection profile={profile} />
          <GraphSwitcher profile={profile} />
          <ResultsSection profile={profile} />
          <RacecraftSection profile={profile} />
          <ConsistencySection profile={profile} />
          <DisciplineSection profile={profile} />
          <SplitsSection profile={profile} />
          <CircuitsSection profile={profile} />
          <RaceHistorySection profile={profile} />
          <RecordsSection profile={profile} />
        </div>
      )}
    </div>
  );
}
