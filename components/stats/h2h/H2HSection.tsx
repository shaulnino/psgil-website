"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import {
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
  LineChart,
  Line,
  CartesianGrid,
} from "recharts";
import type { RaceResultRow } from "@/lib/resultsData";
import type { RaceEvent, RaceFormat } from "@/lib/scheduleData";
import { localizedRaceName, localizedTrack } from "@/lib/scheduleData";
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
  computeH2HProfile,
  listH2HDrivers,
  type H2HProfile,
  type H2HRaceLine,
} from "@/lib/stats/h2hProfile";
import { METRIC_CATALOG, formatMetric } from "@/lib/stats/metricCatalog";
import StatsFilterPills from "@/components/stats/StatsFilterPills";
import { EmptyState, SearchableSelect, Toggle, Pill, Chip, CHART_THEME, SINGLE_COLOR, COMPARE_COLOR } from "@/components/stats/shared";
import RaceResultsTable from "@/components/RaceResultsTable";

type Props = {
  raceResults?: Record<string, RaceResultRow[]>;
  events?: RaceEvent[];
  seasons?: SeasonConfig[];
  driverNamesHe?: Record<string, string>;
  initialDriverA?: string;
  initialDriverB?: string;
};

const WEATHER_ORDER: WeatherKind[] = ["dry", "wet", "mixed"];

/** Comparison cards, in display order. All ids exist in METRIC_CATALOG. */
const H2H_CARDS = [
  "h2hWins",
  "gridWins",
  "wins",
  "podiums",
  "points",
  "pointsPerStart",
  "avgFinish",
  "avgGrid",
  "bestFinish",
  "poles",
  "fastestLaps",
  "dotd",
  "netPositions",
  "finishRate",
  "dnf",
] as const;

const CHART_METRICS = ["finish", "grid", "points", "net", "cumPoints", "cumWins", "cumPodiums"] as const;
type ChartMetric = (typeof CHART_METRICS)[number];

export default function H2HSection({
  raceResults = {},
  events = [],
  driverNamesHe,
  initialDriverA,
  initialDriverB,
}: Props) {
  const t = useTranslations("stats");
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const allRaces = useMemo<NormalizedRace[]>(
    () => normalizeRaces(Object.values(raceResults).flat(), events),
    [raceResults, events],
  );
  const drivers = useMemo(() => listH2HDrivers(allRaces), [allRaces]);
  const driverIds = useMemo(() => drivers.map((d) => d.id), [drivers]);
  const nameById = useMemo(() => {
    const m = new Map<string, string>();
    for (const d of drivers) m.set(d.id, d.name);
    return m;
  }, [drivers]);

  const eventById = useMemo(() => {
    const m = new Map<string, RaceEvent>();
    for (const e of events) m.set(e.event_id, e);
    return m;
  }, [events]);

  const localName = useCallback(
    (id: string) => {
      if (locale === "he" && driverNamesHe && driverNamesHe[id]) return driverNamesHe[id];
      return nameById.get(id) ?? id;
    },
    [locale, driverNamesHe, nameById],
  );

  const seasonOptions = useMemo(() => {
    const set = new Set<string>();
    for (const r of allRaces) if (r.seasonKey) set.add(r.seasonKey);
    return [...set].sort(
      (a, b) => (parseInt(b.replace(/\D/g, ""), 10) || 0) - (parseInt(a.replace(/\D/g, ""), 10) || 0),
    );
  }, [allRaces]);

  /* ---------- State ---------- */
  const [driverA, setDriverA] = useState<string>(
    () => searchParams.get("da") ?? initialDriverA ?? "",
  );
  const [driverB, setDriverB] = useState<string>(
    () => searchParams.get("db") ?? initialDriverB ?? "",
  );
  const [scope, setScope] = useState<"all-time" | "season">(
    () => (searchParams.get("hscope") === "season" ? "season" : "all-time"),
  );
  const [season, setSeason] = useState<string>(() => {
    const s = searchParams.get("hseason");
    return s && seasonOptions.includes(s) ? s : seasonOptions[0] ?? "S1";
  });
  const [format, setFormat] = useState<RaceFormat | undefined>(() => {
    const f = searchParams.get("hformat");
    return f === "50%" || f === "25%" || f === "sprint" ? f : undefined;
  });
  const [competition, setCompetition] = useState<LeagueKind | undefined>(() => {
    const c = searchParams.get("hcomp");
    return c === "main" || c === "wild" ? c : undefined;
  });
  const [roundType, setRoundType] = useState<"regular" | "playoff" | undefined>(() => {
    const r = searchParams.get("hround");
    return r === "regular" || r === "playoff" ? r : undefined;
  });
  const [weather, setWeather] = useState<"dry" | "wet" | "mixed" | undefined>(() => {
    const w = searchParams.get("hweather");
    return w === "dry" || w === "wet" || w === "mixed" ? w : undefined;
  });
  const [circuit, setCircuit] = useState<string | undefined>(
    () => searchParams.get("hcircuit") ?? undefined,
  );
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [chartMetrics, setChartMetrics] = useState<ChartMetric[]>(["finish"]);
  const [resultsEventId, setResultsEventId] = useState<string | null>(null);

  // Sync incoming pre-selected pair (from the Drivers-tab handoff).
  useEffect(() => {
    if (initialDriverA) setDriverA(initialDriverA);
    if (initialDriverB) setDriverB(initialDriverB);
  }, [initialDriverA, initialDriverB]);

  useEffect(() => {
    if (!resultsEventId) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setResultsEventId(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [resultsEventId]);

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
    const circuits = new Set<string>();
    let wild = false;
    let hasRegular = false;
    let hasPlayoffs = false;
    for (const r of scopedRaces) {
      formats.add(r.format);
      if (r.weather !== "unknown") weathers.add(r.weather);
      if (r.track) circuits.add(r.track.trim());
      if (r.league === "wild") wild = true;
      if (r.isPlayoff) hasPlayoffs = true;
      else hasRegular = true;
    }
    const order: RaceFormat[] = ["50%", "25%", "sprint"];
    return {
      formats: order.filter((f) => formats.has(f)),
      weathers: WEATHER_ORDER.filter((w) => weathers.has(w)),
      circuits: [...circuits].sort(),
      wild,
      hasRegular,
      hasPlayoffs,
    };
  }, [scopedRaces]);

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

  /* ---------- URL sync ---------- */
  useEffect(() => {
    const next = new URLSearchParams(searchParams.toString());
    const set = (k: string, v: string | undefined) => {
      if (v) next.set(k, v);
      else next.delete(k);
    };
    set("da", driverA || undefined);
    set("db", driverB || undefined);
    set("hscope", scope === "season" ? "season" : undefined);
    set("hseason", scope === "season" ? season : undefined);
    set("hformat", effFormat);
    set("hcomp", effCompetition);
    set("hround", effRoundType);
    set("hweather", effWeather);
    set("hcircuit", effCircuit);
    const qs = next.toString();
    if (qs !== searchParams.toString()) {
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    }
  }, [searchParams, driverA, driverB, scope, season, effFormat, effCompetition, effRoundType, effWeather, effCircuit, pathname, router]);

  const profile = useMemo<H2HProfile | null>(
    () => computeH2HProfile(allRaces, driverA, driverB, filters),
    [allRaces, driverA, driverB, filters],
  );

  const optionsA = useMemo(() => driverIds.filter((id) => id !== driverB), [driverIds, driverB]);
  const optionsB = useMemo(() => driverIds.filter((id) => id !== driverA), [driverIds, driverA]);

  const showFilterGroups =
    availability.formats.length >= 2 || availability.wild || (availability.hasRegular && availability.hasPlayoffs);

  const resetFilters = useCallback(() => {
    setFormat(undefined);
    setCompetition(undefined);
    setRoundType(undefined);
    setWeather(undefined);
    setCircuit(undefined);
  }, []);
  const anyAdvanced = hasAdvancedFilter({ ...filters, scope, season: undefined });

  const activeChips = useMemo(() => {
    const chips: { key: string; label: string; onRemove: () => void }[] = [];
    if (scope === "season") chips.push({ key: "season", label: t("season.label", { n: season.replace(/^S/i, "") }), onRemove: () => setScope("all-time") });
    if (effFormat) chips.push({ key: "format", label: effFormat === "sprint" ? t("filters.sprint") : effFormat === "25%" ? t("filters.format25") : t("filters.format50"), onRemove: () => setFormat(undefined) });
    if (effCompetition) chips.push({ key: "comp", label: effCompetition === "wild" ? t("filters.wild") : t("filters.main"), onRemove: () => setCompetition(undefined) });
    if (effRoundType) chips.push({ key: "round", label: effRoundType === "playoff" ? t("filters.playoffs") : t("filters.regular"), onRemove: () => setRoundType(undefined) });
    if (effWeather) chips.push({ key: "weather", label: t(`weather.${effWeather}`), onRemove: () => setWeather(undefined) });
    if (effCircuit) chips.push({ key: "circuit", label: effCircuit, onRemove: () => setCircuit(undefined) });
    return chips;
  }, [scope, season, effFormat, effCompetition, effRoundType, effWeather, effCircuit, t]);

  return (
    <div className="space-y-6">
      {/* Explainer */}
      <div className="mx-auto max-w-2xl rounded-[2px] border border-[color:var(--isl-hairline)] bg-cream px-5 py-4 text-center text-sm leading-relaxed text-meta">
        <span className="font-semibold text-ink-2">{t("h2h.explainerTitle")}</span>{" "}
        {t.rich("h2h.explainerBody", { em: (chunks) => <em>{chunks}</em> })}
      </div>

      {/* Driver selectors */}
      <div className="flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
        <div className="w-full max-w-xs">
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wider" style={{ color: SINGLE_COLOR }}>{t("h2h.driverA")}</label>
          <SearchableSelect options={optionsA} value={driverA} onChange={setDriverA} placeholder={t("h2h.selectDriverA")} labelFor={localName} />
        </div>
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[color:var(--isl-hairline)] bg-cream text-sm font-bold text-meta">
          {t("h2h.vs")}
        </div>
        <div className="w-full max-w-xs">
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wider" style={{ color: COMPARE_COLOR }}>{t("h2h.driverB")}</label>
          <SearchableSelect options={optionsB} value={driverB} onChange={setDriverB} placeholder={t("h2h.selectDriverB")} labelFor={localName} />
        </div>
      </div>

      {/* Swap + filters toggle */}
      <div className="flex flex-wrap items-center justify-center gap-3">
        {driverA && driverB && (
          <button
            onClick={() => { const tmp = driverA; setDriverA(driverB); setDriverB(tmp); }}
            className="flex items-center gap-1.5 rounded-[2px] border border-[color:var(--isl-hairline)] bg-cream px-3 py-1.5 text-xs font-medium text-meta transition hover:border-[color:var(--isl-hairline-strong)] hover:text-ink"
          >
            {t("h2h.swap")}
          </button>
        )}
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
              <option key={k} value={k} className="bg-paper">{t("season.label", { n: k.replace(/^S/i, "") })}</option>
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
        <div className="mx-auto max-w-3xl space-y-3 rounded-[2px] border border-[color:var(--isl-hairline)] bg-cream p-4">
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
              <span className="font-isl-body text-[10px] font-semibold uppercase tracking-[0.2em] text-oxblood">{t("driversTab.context.weather")}</span>
              <Pill active={!effWeather} onClick={() => setWeather(undefined)}>{t("filters.all")}</Pill>
              {availability.weathers.map((w) => (
                <Pill key={w} active={effWeather === w} onClick={() => setWeather(w as "dry" | "wet" | "mixed")}>{t(`weather.${w}`)}</Pill>
              ))}
            </div>
          )}
          {availability.circuits.length >= 2 && (
            <div className="w-56">
              <SearchableSelect
                options={["", ...availability.circuits]}
                value={effCircuit ?? ""}
                onChange={(v) => setCircuit(v || undefined)}
                placeholder={t("select.selectCircuit")}
                labelFor={(v) => (v ? v : t("filters.all"))}
              />
            </div>
          )}
        </div>
      )}

      {activeChips.length > 0 && (
        <div className="flex flex-wrap items-center justify-center gap-2">
          {activeChips.map((c) => (
            <Chip key={c.key} onRemove={c.onRemove}>{c.label}</Chip>
          ))}
          {anyAdvanced && (
            <button type="button" onClick={resetFilters} className="rounded-[2px] px-2 py-1 text-xs font-semibold text-meta underline-offset-2 hover:text-oxblood hover:underline">
              {t("driversTab.context.reset")}
            </button>
          )}
        </div>
      )}

      {/* States */}
      {(!driverA || !driverB) && <EmptyState message={t("h2h.selectTwoDrivers")} />}
      {driverA && driverB && driverA === driverB && <EmptyState message={t("h2h.selectDifferentDrivers")} />}
      {profile && profile.sharedEvents === 0 && (
        <EmptyState message={t("h2h.noSharedRaces", { driverA: localName(driverA), driverB: localName(driverB) })} />
      )}

      {profile && profile.sharedEvents > 0 && (
        <div className="space-y-8">
          {/* Sample summary */}
          <div className="text-center text-sm text-meta">
            <span className="num font-semibold text-ink-2">{profile.sharedStarts}</span>{" "}
            {t("h2h.sharedStartsWord", { count: profile.sharedStarts })}
            {profile.excludedDns > 0 && (
              <span className="text-faint"> · {t("h2h.dnsExcludedCount", { count: profile.excludedDns })}</span>
            )}
          </div>

          {/* Win bar */}
          <div className="mx-auto max-w-lg">
            <WinBar winsA={profile.winsA} winsB={profile.winsB} ties={profile.ties} labels={{ wins: (n) => t("h2h.winsCount", { count: n }), ties: (n) => t("h2h.tiesCount", { count: n }) }} />
          </div>

          {/* Cards */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {H2H_CARDS.map((id) => (
              <H2HCard
                key={id}
                label={t(`metrics.${id}.label`)}
                tooltip={t(`metrics.${id}.tooltip`)}
                pair={profile.summary[id]}
                unit={METRIC_CATALOG[id].unit}
                higherBetter={METRIC_CATALOG[id].higherBetter}
                locale={locale}
              />
            ))}
          </div>

          {/* Trend chart */}
          <TrendChart
            races={profile.races.filter((r) => r.counts)}
            nameA={localName(driverA)}
            nameB={localName(driverB)}
            selected={chartMetrics}
            onToggle={(m) =>
              setChartMetrics((prev) => (prev.includes(m) ? prev.filter((x) => x !== m) : [...prev, m]))
            }
            t={t}
          />

          {/* Event table */}
          <div className="overflow-x-auto rounded-[2px] border border-[color:var(--isl-hairline)] bg-paper">
            <table className="w-full min-w-[760px] text-sm">
              <thead className="bg-sink">
                <tr className="border-b border-[color:var(--isl-hairline-strong)] text-xs uppercase tracking-wider text-meta">
                  <th className="px-3 py-3 text-start font-medium" rowSpan={2}>{t("h2h.table.race")}</th>
                  <th className="px-3 py-3 text-center font-medium" rowSpan={2}>{t("h2h.table.season")}</th>
                  <th className="border-s border-[color:var(--isl-hairline)] px-3 py-2 text-center font-medium" colSpan={2}>{t("h2h.table.finish")}</th>
                  <th className="border-s border-[color:var(--isl-hairline)] px-3 py-2 text-center font-medium" colSpan={2}>{t("h2h.table.grid")}</th>
                  <th className="border-s border-[color:var(--isl-hairline)] px-3 py-3 text-center font-medium" rowSpan={2}>{t("h2h.table.better")}</th>
                </tr>
                <tr className="border-b border-[color:var(--isl-hairline)] text-[10px] uppercase tracking-wider">
                  <th className="border-s border-[color:var(--isl-hairline)] px-3 py-1 text-center font-medium" style={{ color: SINGLE_COLOR }}>{localName(driverA)}</th>
                  <th className="px-3 py-1 text-center font-medium" style={{ color: COMPARE_COLOR }}>{localName(driverB)}</th>
                  <th className="border-s border-[color:var(--isl-hairline)] px-3 py-1 text-center font-medium" style={{ color: SINGLE_COLOR }}>{localName(driverA)}</th>
                  <th className="px-3 py-1 text-center font-medium" style={{ color: COMPARE_COLOR }}>{localName(driverB)}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[color:var(--isl-hairline)]">
                {profile.races.map((race) => {
                  const ev = eventById.get(race.eventId);
                  const raceName = ev ? localizedRaceName(ev, locale) : race.raceName;
                  const circuitName = ev ? localizedTrack(ev, locale) ?? race.track : race.track;
                  const cellA = race.statusA !== "finished" ? t(`status.${race.statusA}.label`) : race.finishA ?? "-";
                  const cellB = race.statusB !== "finished" ? t(`status.${race.statusB}.label`) : race.finishB ?? "-";
                  return (
                    <tr key={race.eventId} className={`transition hover:bg-sink/50 ${race.counts ? "" : "opacity-60"}`}>
                      <td className="px-3 py-2.5 font-medium text-ink-2">
                        <button type="button" onClick={() => setResultsEventId(race.eventId)} className="text-start underline decoration-[color:var(--isl-hairline-strong)] underline-offset-2 transition hover:text-oxblood hover:decoration-oxblood">
                          {raceName}
                        </button>
                        {circuitName && circuitName !== raceName && (
                          <span className="ms-1.5 text-[10px] text-faint">{circuitName}</span>
                        )}
                        {!race.counts && (
                          <span className="ms-1.5 text-[10px] font-semibold text-faint">· {t("h2h.dnsExcluded")}</span>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-center">
                        {race.seasonKey && <span className="num inline-block rounded-[2px] bg-sink px-2 py-0.5 text-[10px] font-semibold text-meta">{race.seasonKey}</span>}
                      </td>
                      <td className="num border-s border-[color:var(--isl-hairline)] px-3 py-2.5 text-center font-semibold" style={{ color: race.winner === "a" ? SINGLE_COLOR : undefined }}>{cellA}</td>
                      <td className="num px-3 py-2.5 text-center font-semibold" style={{ color: race.winner === "b" ? COMPARE_COLOR : undefined }}>{cellB}</td>
                      <td className="num border-s border-[color:var(--isl-hairline)] px-3 py-2.5 text-center" style={{ color: race.gridWinner === "a" ? SINGLE_COLOR : undefined }}>{race.gridA ?? "-"}</td>
                      <td className="num px-3 py-2.5 text-center" style={{ color: race.gridWinner === "b" ? COMPARE_COLOR : undefined }}>{race.gridB ?? "-"}</td>
                      <td className="border-s border-[color:var(--isl-hairline)] px-3 py-2.5 text-center">
                        {race.winner === "a" && <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: SINGLE_COLOR }} />}
                        {race.winner === "b" && <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: COMPARE_COLOR }} />}
                        {race.winner === "tie" && <span className="text-xs text-faint">—</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Results modal */}
      {resultsEventId && (() => {
        const resultRows = raceResults[resultsEventId] ?? [];
        const ev = eventById.get(resultsEventId);
        const modalName = ev ? localizedRaceName(ev, locale) : resultsEventId;
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80" onClick={() => setResultsEventId(null)}>
            <div className="relative mx-4 w-full max-w-5xl" onClick={(e) => e.stopPropagation()}>
              <div className="mb-3 flex items-center justify-between">
                <h3 className="font-display text-sm font-semibold text-ink md:text-base">{modalName}</h3>
                <button onClick={() => setResultsEventId(null)} className="flex h-8 w-8 items-center justify-center rounded-full border border-[color:var(--isl-hairline-strong)] bg-paper text-ink transition hover:text-oxblood">×</button>
              </div>
              {resultRows.length > 0 ? (
                <div className="max-h-[85vh] overflow-auto rounded-[2px] border border-[color:var(--isl-hairline)] bg-paper p-3">
                  <RaceResultsTable results={resultRows} caption={t("h2h.raceResultsCaption", { race: modalName })} />
                </div>
              ) : (
                <div className="flex items-center justify-center rounded-[2px] border border-[color:var(--isl-hairline)] bg-paper py-16">
                  <p className="text-sm text-meta">{t("h2h.resultsNotAvailable")}</p>
                </div>
              )}
            </div>
          </div>
        );
      })()}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Comparison card                                                    */
/* ------------------------------------------------------------------ */

function H2HCard({
  label,
  tooltip,
  pair,
  unit,
  higherBetter,
  locale,
}: {
  label: string;
  tooltip: string;
  pair: { a: number | null; b: number | null } | undefined;
  unit: Parameters<typeof formatMetric>[1];
  higherBetter: boolean;
  locale: string;
}) {
  const a = pair?.a ?? null;
  const b = pair?.b ?? null;
  let winner: "a" | "b" | null = null;
  if (a !== null && b !== null && a !== b) {
    winner = higherBetter ? (a > b ? "a" : "b") : a < b ? "a" : "b";
  }
  return (
    <div className={`rounded-[2px] border bg-cream px-4 pb-3 pt-4 ${winner ? "border-[color:var(--isl-hairline-strong)]" : "border-[color:var(--isl-hairline)]"}`} title={tooltip}>
      <span className="mb-3 block text-center text-[10px] font-semibold uppercase tracking-widest text-meta">{label}</span>
      <div className="flex items-end justify-between gap-2">
        <span className="num text-xl font-extrabold leading-none" style={{ color: winner === "a" ? SINGLE_COLOR : "var(--isl-meta,#6E6455)" }}>
          {formatMetric(a, unit, locale)}
        </span>
        <span className="mb-1 text-[10px] font-bold text-faint">{winner ? "" : "="}</span>
        <span className="num text-xl font-extrabold leading-none" style={{ color: winner === "b" ? COMPARE_COLOR : "var(--isl-meta,#6E6455)" }}>
          {formatMetric(b, unit, locale)}
        </span>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Win bar                                                            */
/* ------------------------------------------------------------------ */

function WinBar({
  winsA,
  winsB,
  ties,
  labels,
}: {
  winsA: number;
  winsB: number;
  ties: number;
  labels: { wins: (n: number) => string; ties: (n: number) => string };
}) {
  const total = winsA + winsB + ties;
  if (total === 0) return null;
  return (
    <div className="space-y-2">
      <div className="flex justify-between text-sm font-semibold">
        <span className="num" style={{ color: SINGLE_COLOR }}>{labels.wins(winsA)}</span>
        {ties > 0 && <span className="num text-meta">{labels.ties(ties)}</span>}
        <span className="num" style={{ color: COMPARE_COLOR }}>{labels.wins(winsB)}</span>
      </div>
      <div className="flex h-3 overflow-hidden rounded-[2px] bg-sink">
        <div className="transition-all" style={{ width: `${(winsA / total) * 100}%`, background: SINGLE_COLOR }} />
        <div className="bg-[color:var(--isl-hairline-strong)] transition-all" style={{ width: `${(ties / total) * 100}%` }} />
        <div className="transition-all" style={{ width: `${(winsB / total) * 100}%`, background: COMPARE_COLOR }} />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Trend chart                                                        */
/* ------------------------------------------------------------------ */

function TrendChart({
  races,
  nameA,
  nameB,
  selected,
  onToggle,
  t,
}: {
  races: H2HRaceLine[];
  nameA: string;
  nameB: string;
  selected: ChartMetric[];
  onToggle: (m: ChartMetric) => void;
  t: ReturnType<typeof useTranslations>;
}) {
  const data = useMemo(() => {
    let cumPtsA = 0, cumPtsB = 0, cumWinsA = 0, cumWinsB = 0, cumPodA = 0, cumPodB = 0;
    return races.map((r) => {
      cumPtsA += r.pointsA; cumPtsB += r.pointsB;
      if (r.winner === "a") cumWinsA++; else if (r.winner === "b") cumWinsB++;
      if (r.finishA !== null && r.finishA <= 3) cumPodA++;
      if (r.finishB !== null && r.finishB <= 3) cumPodB++;
      return {
        name: r.raceName,
        finishA: r.finishA, finishB: r.finishB,
        gridA: r.gridA, gridB: r.gridB,
        pointsA: r.pointsA, pointsB: r.pointsB,
        netA: r.gridA !== null && r.finishA !== null ? r.gridA - r.finishA : null,
        netB: r.gridB !== null && r.finishB !== null ? r.gridB - r.finishB : null,
        cumPointsA: cumPtsA, cumPointsB: cumPtsB,
        cumWinsA, cumWinsB,
        cumPodiumsA: cumPodA, cumPodiumsB: cumPodB,
      };
    });
  }, [races]);

  if (races.length < 2) return null;

  const keyFor = (m: ChartMetric): { a: string; b: string } => {
    switch (m) {
      case "finish": return { a: "finishA", b: "finishB" };
      case "grid": return { a: "gridA", b: "gridB" };
      case "points": return { a: "pointsA", b: "pointsB" };
      case "net": return { a: "netA", b: "netB" };
      case "cumPoints": return { a: "cumPointsA", b: "cumPointsB" };
      case "cumWins": return { a: "cumWinsA", b: "cumWinsB" };
      case "cumPodiums": return { a: "cumPodiumsA", b: "cumPodiumsB" };
    }
  };

  return (
    <div className="space-y-4 rounded-[2px] border border-[color:var(--isl-hairline)] bg-cream p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-meta">{t("h2h.trendOverRaces")}</h3>
        <div className="flex flex-wrap gap-1.5">
          {CHART_METRICS.map((m) => (
            <Pill key={m} active={selected.includes(m)} onClick={() => onToggle(m)}>
              {t(`h2h.chart.${m}`)}
            </Pill>
          ))}
        </div>
      </div>
      {selected.length === 0 ? (
        <p className="py-8 text-center text-sm text-meta">{t("h2h.selectAtLeastOneMetric")}</p>
      ) : (
        <div className="h-72">
          <ResponsiveContainer width="100%" height={288}>
            <LineChart data={data} margin={{ top: 8, right: 12, bottom: 4, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={CHART_THEME.grid} />
              <XAxis dataKey="name" tick={{ fill: CHART_THEME.text, fontSize: 10 }} axisLine={{ stroke: CHART_THEME.border }} tickLine={false} interval="preserveStartEnd" angle={-18} textAnchor="end" height={56} />
              <YAxis tick={{ fill: CHART_THEME.text, fontSize: 10 }} axisLine={{ stroke: CHART_THEME.border }} tickLine={false} width={36} />
              <Tooltip contentStyle={{ background: CHART_THEME.bg, border: `1px solid ${CHART_THEME.border}`, borderRadius: 2, fontSize: 12, color: CHART_THEME.text, boxShadow: "none" }} />
              <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
              {selected.map((m) => {
                const k = keyFor(m);
                const mLabel = t(`h2h.chart.${m}`);
                return [
                  <Line key={k.a} type="monotone" dataKey={k.a} name={`${nameA} · ${mLabel}`} stroke={SINGLE_COLOR} strokeWidth={2} dot={{ r: 3 }} connectNulls />,
                  <Line key={k.b} type="monotone" dataKey={k.b} name={`${nameB} · ${mLabel}`} stroke={COMPARE_COLOR} strokeWidth={2} dot={{ r: 3 }} connectNulls />,
                ];
              })}
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
