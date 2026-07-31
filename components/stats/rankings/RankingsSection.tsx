"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import type { RaceResultRow } from "@/lib/resultsData";
import type { RaceEvent, RaceFormat } from "@/lib/scheduleData";
import type { SeasonConfig } from "@/lib/seasonConfig";
import type { DriverStatRow } from "@/lib/statsData";
import {
  normalizeRaces,
  hasAdvancedFilter,
  type NormalizedRace,
  type ProfileFilters,
  type LeagueKind,
  type WeatherKind,
} from "@/lib/stats/normalizeRace";
import {
  computeLeaderboard,
  rankLeaderboard,
  MIN_SAMPLE,
  type LeaderboardRow,
} from "@/lib/stats/leaderboard";
import { formatMetric } from "@/lib/stats/metricCatalog";
import {
  RANKING_CATEGORIES,
  RATING_ENGINE_A_KEY,
  metricMeta,
} from "@/components/stats/rankings/config";
import StatsFilterPills from "@/components/stats/StatsFilterPills";
import { EmptyState, SearchableSelect, Toggle, Pill, Chip } from "@/components/stats/shared";

type Props = {
  /** Engine A datasets — used only for the scope-based Ratings category. */
  allTime: { rows: DriverStatRow[]; headers: string[] };
  bySeason: Record<string, { rows: DriverStatRow[]; headers: string[] }>;
  raceResults?: Record<string, RaceResultRow[]>;
  events?: RaceEvent[];
  seasons?: SeasonConfig[];
  driverNamesHe?: Record<string, string>;
  onSelectDriver?: (driverName: string) => void;
};

const WEATHER_ORDER: WeatherKind[] = ["dry", "wet", "mixed"];
const TEAM_COLS = ["team", "constructor", "team_name", "constructors"];
const TOP_N_DEFAULT = 25;

export default function RankingsSection({
  allTime,
  bySeason,
  raceResults = {},
  events = [],
  driverNamesHe,
  onSelectDriver,
}: Props) {
  const t = useTranslations("stats");
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const collator = useMemo(
    () => new Intl.Collator(locale, { sensitivity: "base" }),
    [locale],
  );

  const allRaces = useMemo<NormalizedRace[]>(
    () => normalizeRaces(Object.values(raceResults).flat(), events),
    [raceResults, events],
  );

  const seasonOptions = useMemo(() => {
    const set = new Set<string>();
    for (const r of allRaces) if (r.seasonKey) set.add(r.seasonKey);
    return [...set].sort(
      (a, b) =>
        (parseInt(b.replace(/\D/g, ""), 10) || 0) - (parseInt(a.replace(/\D/g, ""), 10) || 0),
    );
  }, [allRaces]);

  /* ---------- State (hydrated from the URL) ---------- */
  const [scope, setScope] = useState<"all-time" | "season">(
    () => (searchParams.get("rscope") === "season" ? "season" : "all-time"),
  );
  const [season, setSeason] = useState<string>(() => {
    const s = searchParams.get("rseason");
    return s && seasonOptions.includes(s) ? s : seasonOptions[0] ?? "S1";
  });
  const [categoryId, setCategoryId] = useState<string>(() => {
    const c = searchParams.get("rcat");
    return RANKING_CATEGORIES.some((cat) => cat.id === c) ? c! : "results";
  });
  const [metricId, setMetricId] = useState<string>(() => {
    const m = searchParams.get("rmetric");
    return m || "points";
  });
  const [sortOverride, setSortOverride] = useState<boolean | null>(null); // true=asc
  const [showAll, setShowAll] = useState(false);
  const [hideInsufficient, setHideInsufficient] = useState(false);

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
    () => searchParams.get("circuit") ?? undefined,
  );
  const [team, setTeam] = useState<string | undefined>(
    () => searchParams.get("team") ?? undefined,
  );
  const [showAdvanced, setShowAdvanced] = useState<boolean>(
    () =>
      !!(
        searchParams.get("format") ||
        searchParams.get("comp") ||
        searchParams.get("round") ||
        searchParams.get("weather") ||
        searchParams.get("circuit") ||
        searchParams.get("team")
      ),
  );

  /* ---------- Selected metric metadata ---------- */
  const category =
    RANKING_CATEGORIES.find((c) => c.id === categoryId) ?? RANKING_CATEGORIES[0];
  const metricInCategory = category.metrics.find((m) => m.id === metricId);
  const effMetric = metricInCategory ?? category.metrics[0];
  const meta = metricMeta(effMetric.id, effMetric.gated);
  const isRating = meta.isRating;

  /* ---------- Scope-filtered set (for availability + team/circuit lists) --- */
  const scopedRaces = useMemo(
    () =>
      allRaces.filter(
        (r) => scope === "all-time" || r.seasonKey.toUpperCase() === season.toUpperCase(),
      ),
    [allRaces, scope, season],
  );

  const availability = useMemo(() => {
    const formats = new Set<RaceFormat>();
    const weathers = new Set<WeatherKind>();
    const teams = new Set<string>();
    const circuits = new Set<string>();
    let wild = false;
    let hasRegular = false;
    let hasPlayoffs = false;
    for (const r of scopedRaces) {
      formats.add(r.format);
      if (r.weather !== "unknown") weathers.add(r.weather);
      if (r.team) teams.add(r.team.trim());
      if (r.track) circuits.add(r.track.trim());
      if (r.league === "wild") wild = true;
      if (r.isPlayoff) hasPlayoffs = true;
      else hasRegular = true;
    }
    const order: RaceFormat[] = ["50%", "25%", "sprint"];
    return {
      formats: order.filter((f) => formats.has(f)),
      weathers: WEATHER_ORDER.filter((w) => weathers.has(w)),
      teams: [...teams].sort((a, b) => collator.compare(a, b)),
      circuits: [...circuits].sort((a, b) => collator.compare(a, b)),
      wild,
      hasRegular,
      hasPlayoffs,
    };
  }, [scopedRaces, collator]);

  // Clamp filters to what the scope supports (no setState-in-effect).
  const effFormat = format && availability.formats.includes(format) ? format : undefined;
  const effCompetition = competition === "wild" && !availability.wild ? undefined : competition;
  const effRoundType =
    roundType === "playoff"
      ? availability.hasPlayoffs ? "playoff" : undefined
      : roundType === "regular"
        ? availability.hasRegular ? "regular" : undefined
        : roundType;
  const effWeather = weather && availability.weathers.includes(weather) ? weather : undefined;
  const effCircuit = circuit && availability.circuits.includes(circuit) ? circuit : undefined;
  const effTeam = team && availability.teams.includes(team) ? team : undefined;

  // Ratings ignore advanced filters (they are scope-only pool ratings).
  const filters = useMemo<ProfileFilters>(
    () => ({
      scope,
      season: scope === "season" ? season : undefined,
      format: isRating ? undefined : effFormat,
      competition: isRating ? undefined : effCompetition,
      roundType: isRating ? undefined : effRoundType,
      weather: isRating ? undefined : effWeather,
      circuit: isRating ? undefined : effCircuit,
      team: isRating ? undefined : effTeam,
    }),
    [scope, season, isRating, effFormat, effCompetition, effRoundType, effWeather, effCircuit, effTeam],
  );

  /* ---------- URL sync (write-only) ---------- */
  useEffect(() => {
    const next = new URLSearchParams(searchParams.toString());
    const set = (k: string, v: string | undefined) => {
      if (v) next.set(k, v);
      else next.delete(k);
    };
    set("rscope", scope === "season" ? "season" : undefined);
    set("rseason", scope === "season" ? season : undefined);
    set("rcat", categoryId === "results" ? undefined : categoryId);
    set("rmetric", effMetric.id === "points" ? undefined : effMetric.id);
    set("format", isRating ? undefined : effFormat);
    set("comp", isRating ? undefined : effCompetition);
    set("round", isRating ? undefined : effRoundType);
    set("weather", isRating ? undefined : effWeather);
    set("circuit", isRating ? undefined : effCircuit);
    set("team", isRating ? undefined : effTeam);
    const qs = next.toString();
    if (qs !== searchParams.toString()) {
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    }
  }, [
    searchParams, scope, season, categoryId, effMetric.id, isRating,
    effFormat, effCompetition, effRoundType, effWeather, effCircuit, effTeam,
    pathname, router,
  ]);

  /* ---------- Rows ---------- */
  const leaderboard = useMemo(
    () => computeLeaderboard(allRaces, filters),
    [allRaces, filters],
  );

  const teamColOf = useCallback((headers: string[]): string | null => {
    for (const h of headers) if (TEAM_COLS.includes(h.toLowerCase().trim())) return h;
    return null;
  }, []);

  // Ratings pull from the scope-based Engine A dataset instead of the leaderboard.
  const ratingRows = useMemo<LeaderboardRow[]>(() => {
    if (!isRating) return [];
    const ds = scope === "season" ? bySeason[season] ?? { rows: [], headers: [] } : allTime;
    const teamCol = teamColOf(ds.headers);
    const engineKey = RATING_ENGINE_A_KEY[effMetric.id];
    const out: LeaderboardRow[] = [];
    for (const r of ds.rows) {
      const v = r.metrics[engineKey];
      if (v === undefined) continue;
      out.push({
        driverId: r.driver_id ?? r.driver_name,
        driverName: r.driver_name,
        team: teamCol ? (r.raw[teamCol] ?? "").trim() || null : null,
        starts: r.metrics["Events Participation"] ?? 0,
        entries: r.metrics["Events Participation"] ?? 0,
        values: { [effMetric.id]: v },
      });
    }
    return out;
  }, [isRating, scope, season, bySeason, allTime, teamColOf, effMetric.id]);

  const rows = isRating ? ratingRows : leaderboard;

  const isAsc = sortOverride !== null ? sortOverride : !meta.higherBetter;
  const ranked = useMemo(
    () => rankLeaderboard(rows, effMetric.id, !isAsc, meta.gated, collator),
    [rows, effMetric.id, isAsc, meta.gated, collator],
  );

  const scale = useMemo(() => {
    const vals = ranked.qualified.map((e) => e.value).filter((n) => Number.isFinite(n));
    if (vals.length === 0) return { min: 0, max: 1 };
    return { min: Math.min(...vals), max: Math.max(...vals) };
  }, [ranked]);

  const nameFor = useCallback(
    (row: LeaderboardRow) => {
      if (locale === "he" && driverNamesHe && driverNamesHe[row.driverId]) {
        return driverNamesHe[row.driverId];
      }
      return row.driverName;
    },
    [locale, driverNamesHe],
  );

  const barWidth = useCallback(
    (value: number) => {
      if (scale.max === scale.min) return 50;
      const frac = meta.higherBetter
        ? (value - scale.min) / (scale.max - scale.min)
        : (scale.max - value) / (scale.max - scale.min);
      return Math.min(100, Math.max(4, frac * 100));
    },
    [scale, meta.higherBetter],
  );

  const metricLabel = t(`${meta.labelKey}.label`);
  const metricTooltip = t(`${meta.labelKey}.tooltip`);

  const resetFilters = useCallback(() => {
    setFormat(undefined);
    setCompetition(undefined);
    setRoundType(undefined);
    setWeather(undefined);
    setCircuit(undefined);
    setTeam(undefined);
  }, []);

  const anyAdvanced = hasAdvancedFilter({ ...filters, scope, season: undefined });

  const activeChips = useMemo(() => {
    if (isRating) return [];
    const chips: { key: string; label: string; onRemove: () => void }[] = [];
    if (effFormat)
      chips.push({
        key: "format",
        label: effFormat === "sprint" ? t("filters.sprint") : effFormat === "25%" ? t("filters.format25") : t("filters.format50"),
        onRemove: () => setFormat(undefined),
      });
    if (effCompetition)
      chips.push({ key: "comp", label: effCompetition === "wild" ? t("filters.wild") : t("filters.main"), onRemove: () => setCompetition(undefined) });
    if (effRoundType)
      chips.push({ key: "round", label: effRoundType === "playoff" ? t("filters.playoffs") : t("filters.regular"), onRemove: () => setRoundType(undefined) });
    if (effWeather)
      chips.push({ key: "weather", label: t(`weather.${effWeather}`), onRemove: () => setWeather(undefined) });
    if (effCircuit)
      chips.push({ key: "circuit", label: effCircuit, onRemove: () => setCircuit(undefined) });
    if (effTeam)
      chips.push({ key: "team", label: effTeam, onRemove: () => setTeam(undefined) });
    return chips;
  }, [isRating, effFormat, effCompetition, effRoundType, effWeather, effCircuit, effTeam, t]);

  const showFilterGroups =
    availability.formats.length >= 2 ||
    availability.wild ||
    (availability.hasRegular && availability.hasPlayoffs);

  if (allRaces.length === 0) {
    return <EmptyState message={t("empty.noDriverStats")} />;
  }

  const visibleQualified = showAll
    ? ranked.qualified
    : ranked.qualified.slice(0, TOP_N_DEFAULT);
  const hiddenCount = ranked.qualified.length - visibleQualified.length;

  return (
    <div className="space-y-6">
      {/* ── Controls ── */}
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
          {!isRating && showFilterGroups && (
            <button
              type="button"
              onClick={() => setShowAdvanced((v) => !v)}
              className="rounded-[2px] border border-[color:var(--isl-hairline)] px-3 py-2 text-sm font-semibold text-meta transition hover:text-ink"
            >
              {showAdvanced ? t("driversTab.context.hideFilters") : t("driversTab.context.advancedFilters")}
            </button>
          )}
        </div>

        {/* Category + metric */}
        <div className="flex flex-wrap items-end gap-3 border-t border-[color:var(--isl-hairline)] pt-3">
          <div className="w-full max-w-[14rem]">
            <label className="mb-1 block font-isl-body text-[0.7rem] font-semibold uppercase tracking-[0.2em] text-oxblood">
              {t("rankingsTab.category")}
            </label>
            <SearchableSelect
              options={RANKING_CATEGORIES.map((c) => c.id)}
              value={categoryId}
              onChange={(v) => {
                setCategoryId(v);
                const cat = RANKING_CATEGORIES.find((c) => c.id === v);
                if (cat) setMetricId(cat.metrics[0].id);
                setSortOverride(null);
                setShowAll(false);
              }}
              placeholder={t("rankingsTab.category")}
              labelFor={(v) => t(`rankingsTab.categories.${v}`)}
            />
          </div>
          <div className="w-full max-w-[16rem]">
            <label className="mb-1 block font-isl-body text-[0.7rem] font-semibold uppercase tracking-[0.2em] text-oxblood">
              {t("rankings.stat")}
            </label>
            <SearchableSelect
              options={category.metrics.map((m) => m.id)}
              value={effMetric.id}
              onChange={(v) => {
                setMetricId(v);
                setSortOverride(null);
                setShowAll(false);
              }}
              placeholder={t("select.selectMetric")}
              labelFor={(id) => t(`${metricMeta(id, false).labelKey}.label`)}
            />
          </div>
          <button
            type="button"
            onClick={() => setSortOverride(!isAsc)}
            className="flex items-center gap-1.5 rounded-[2px] border border-[color:var(--isl-hairline)] bg-paper px-3 py-2 text-sm font-semibold text-meta transition hover:border-oxblood hover:text-ink"
          >
            {isAsc ? t("rankings.lowestFirst") : t("rankings.highestFirst")}
          </button>
        </div>

        {isRating && (
          <p className="text-xs text-faint">{t("rankingsTab.ratingsNote")}</p>
        )}

        {!isRating && showAdvanced && showFilterGroups && (
          <div className="space-y-3 border-t border-[color:var(--isl-hairline)] pt-3">
            <StatsFilterPills
              formatFilter={effFormat}
              competitionFilter={effCompetition}
              roundTypeFilter={effRoundType}
              onFormat={setFormat}
              onCompetition={setCompetition}
              onRoundType={setRoundType}
              onClearAll={resetFilters}
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
                <Pill active={!effWeather} onClick={() => setWeather(undefined)}>
                  {t("filters.all")}
                </Pill>
                {availability.weathers.map((w) => (
                  <Pill key={w} active={effWeather === w} onClick={() => setWeather(w as "dry" | "wet" | "mixed")}>
                    {t(`weather.${w}`)}
                  </Pill>
                ))}
              </div>
            )}
            <div className="flex flex-wrap gap-3">
              {availability.circuits.length >= 2 && (
                <div className="w-52">
                  <SearchableSelect
                    options={["", ...availability.circuits]}
                    value={effCircuit ?? ""}
                    onChange={(v) => setCircuit(v || undefined)}
                    placeholder={t("select.selectCircuit")}
                    labelFor={(v) => (v ? v : t("filters.all"))}
                  />
                </div>
              )}
              {availability.teams.length >= 2 && (
                <div className="w-52">
                  <SearchableSelect
                    options={["", ...availability.teams]}
                    value={effTeam ?? ""}
                    onChange={(v) => setTeam(v || undefined)}
                    placeholder={t("rankingsTab.allTeams")}
                    labelFor={(v) => (v ? v : t("rankingsTab.allTeams"))}
                  />
                </div>
              )}
            </div>
          </div>
        )}

        {activeChips.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 border-t border-[color:var(--isl-hairline)] pt-3">
            {activeChips.map((c) => (
              <Chip key={c.key} onRemove={c.onRemove}>
                {c.label}
              </Chip>
            ))}
            {anyAdvanced && (
              <button
                type="button"
                onClick={resetFilters}
                className="ms-auto rounded-[2px] px-2 py-1 text-xs font-semibold text-meta underline-offset-2 hover:text-oxblood hover:underline"
              >
                {t("driversTab.context.reset")}
              </button>
            )}
          </div>
        )}
      </div>

      {/* Metric description */}
      <p className="-mt-2 text-sm text-meta">{metricTooltip}</p>

      {ranked.qualified.length === 0 && ranked.insufficient.length === 0 ? (
        <EmptyState message={t("empty.noDriversForMetric")} />
      ) : (
        <>
          {/* Everyone is below the sample minimum — explain instead of hiding. */}
          {ranked.qualified.length === 0 && ranked.insufficient.length > 0 && (
            <p className="rounded-[2px] border border-dashed border-[color:var(--isl-hairline)] bg-cream px-4 py-3 text-sm text-meta">
              {t("rankingsTab.allBelowMin", { n: MIN_SAMPLE })}
            </p>
          )}

          {/* Top 3 */}
          {ranked.qualified.length >= 3 && (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              {ranked.qualified.slice(0, 3).map((e, idx) => {
                const ring = idx === 0 ? "border-brass" : idx === 1 ? "border-[color:var(--isl-silver-ink)]" : "border-[color:var(--isl-bronze-ink)]";
                const col = idx === 0 ? "text-brass-ink" : idx === 1 ? "text-silver-ink" : "text-bronze-ink";
                return (
                  <div key={e.row.driverId} className={`rounded-[2px] border bg-cream p-4 ${ring}`}>
                    <div className="text-[10px] font-bold uppercase tracking-wider text-meta">
                      #{e.rank} {idx === 0 ? t("rankings.leader") : idx === 1 ? t("rankings.second") : t("rankings.third")}
                    </div>
                    <div className="mt-1 text-lg font-bold text-ink">
                      {onSelectDriver ? (
                        <button type="button" onClick={() => onSelectDriver(e.row.driverName)} className="text-start hover:text-oxblood">
                          {nameFor(e.row)}
                        </button>
                      ) : (
                        nameFor(e.row)
                      )}
                    </div>
                    <div className={`num mt-2 text-2xl font-extrabold ${col}`}>
                      {formatMetric(e.value, meta.unit, locale)}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Table */}
          {ranked.qualified.length > 0 && (
          <div className="overflow-x-auto rounded-[2px] border border-[color:var(--isl-hairline)]">
            <table className="w-full text-sm">
              <thead className="bg-sink">
                <tr className="border-b border-[color:var(--isl-hairline-strong)]">
                  <th className="w-16 px-4 py-3 text-center text-sm font-semibold uppercase tracking-wider text-meta">#</th>
                  <th className="px-4 py-3 text-start text-sm font-semibold uppercase tracking-wider text-meta">{t("table.driver")}</th>
                  <th className="px-4 py-3 text-start text-sm font-semibold uppercase tracking-wider text-meta">{t("table.team")}</th>
                  {!isRating && (
                    <th className="px-4 py-3 text-end text-[10px] font-bold uppercase tracking-wider text-faint">{t("rankingsTab.starts")}</th>
                  )}
                  <th className="w-36 px-2 py-3 text-start text-[10px] font-bold uppercase tracking-wider text-meta">{t("table.vsField")}</th>
                  <th className="px-4 py-3 text-end text-sm font-semibold uppercase tracking-wider text-oxblood">{metricLabel}</th>
                </tr>
              </thead>
              <tbody>
                {visibleQualified.map((e) => {
                  const isTop = e.rank <= 3;
                  const rankCol = e.rank === 1 ? "text-brass-ink" : e.rank === 2 ? "text-silver-ink" : e.rank === 3 ? "text-bronze-ink" : "text-meta";
                  return (
                    <tr key={e.row.driverId} className={`border-b border-[color:var(--isl-hairline)] transition hover:bg-sink/50 ${isTop ? "bg-cream" : ""}`}>
                      <td className="px-4 py-2.5 text-center">
                        <span className={`num inline-flex h-7 w-7 items-center justify-center rounded-full text-sm font-bold ${rankCol}`}>{e.rank}</span>
                      </td>
                      <td className="px-4 py-2.5">
                        {onSelectDriver ? (
                          <button type="button" onClick={() => onSelectDriver(e.row.driverName)} className="font-semibold text-ink transition hover:text-oxblood">
                            {nameFor(e.row)}
                          </button>
                        ) : (
                          <span className="font-semibold text-ink">{nameFor(e.row)}</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-meta">{e.row.team ?? "—"}</td>
                      {!isRating && (
                        <td className="num px-4 py-2.5 text-end text-[11px] text-faint">{e.row.starts}</td>
                      )}
                      <td className="px-3 py-2.5">
                        <div className="h-2 overflow-hidden rounded-[2px] bg-sink">
                          <div className="h-full rounded-[2px] bg-oxblood" style={{ width: `${barWidth(e.value)}%` }} />
                        </div>
                      </td>
                      <td className="num px-4 py-2.5 text-end font-bold text-ink">{formatMetric(e.value, meta.unit, locale)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          )}

          {hiddenCount > 0 && (
            <div className="text-center">
              <button
                type="button"
                onClick={() => setShowAll(true)}
                className="rounded-[2px] border border-[color:var(--isl-hairline)] bg-cream px-4 py-2 text-sm font-semibold text-meta transition hover:border-oxblood hover:text-ink"
              >
                {t("rankingsTab.showAll", { count: hiddenCount })}
              </button>
            </div>
          )}

          {/* Insufficient sample */}
          {meta.gated && ranked.insufficient.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-wider text-faint">
                  {t("rankingsTab.insufficientHeading", { n: MIN_SAMPLE })}
                </p>
                <button
                  type="button"
                  onClick={() => setHideInsufficient((v) => !v)}
                  className="text-xs font-semibold text-meta underline-offset-2 hover:text-oxblood hover:underline"
                >
                  {hideInsufficient ? t("rankingsTab.showLowSample") : t("rankingsTab.hideLowSample")}
                </button>
              </div>
              {!hideInsufficient && (
                <div className="overflow-x-auto rounded-[2px] border border-dashed border-[color:var(--isl-hairline)]">
                  <table className="w-full text-sm opacity-70">
                    <tbody>
                      {ranked.insufficient.map((e) => (
                        <tr key={e.row.driverId} className="border-b border-[color:var(--isl-hairline)]">
                          <td className="px-4 py-2 text-meta">
                            {onSelectDriver ? (
                              <button type="button" onClick={() => onSelectDriver(e.row.driverName)} className="font-medium hover:text-oxblood">
                                {nameFor(e.row)}
                              </button>
                            ) : (
                              nameFor(e.row)
                            )}
                          </td>
                          <td className="num px-4 py-2 text-end text-[11px] text-faint">
                            {t("rankingsTab.startsCount", { count: e.row.starts })}
                          </td>
                          <td className="num px-4 py-2 text-end font-semibold text-ink">{formatMetric(e.value, meta.unit, locale)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Footnote */}
          {ranked.qualified.length > 0 && (
          <p className="text-sm text-faint">
            {t("rankings.rankedCount", { count: ranked.qualified.length })}
            {scope === "season"
              ? t("rankings.scopeSeason", { season: season.replace(/^S/i, "") })
              : t("rankings.scopeAllTime")}
            {meta.gated ? ` · ${t("rankingsTab.minSampleNote", { n: MIN_SAMPLE })}` : ""}
          </p>
          )}
        </>
      )}
    </div>
  );
}
