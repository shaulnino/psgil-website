"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import type { RaceResultRow } from "@/lib/resultsData";
import type { RaceEvent, RaceFormat } from "@/lib/scheduleData";
import { getNextRaceGroup } from "@/lib/scheduleData";
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
  computeCircuitProfile,
  listCircuitsWithHistory,
} from "@/lib/stats/circuitProfile";
import {
  buildCircuitIdentities,
  localizedCircuitName,
  resolveCircuitId,
  type CircuitIdentity,
} from "@/lib/stats/circuitIdentity";
import StatsFilterPills from "@/components/stats/StatsFilterPills";
import { EmptyState, SearchableSelect, Toggle, Pill, Chip } from "@/components/stats/shared";
import {
  CircuitSnapshotSection,
  CircuitQualifyingSection,
  CircuitSpecialistsSection,
  CircuitCharacteristicsSection,
  CircuitConditionsSection,
  CircuitRecordsSection,
  CircuitHistorySection,
} from "@/components/stats/circuits/sections";

type Props = {
  raceResults?: Record<string, RaceResultRow[]>;
  events?: RaceEvent[];
  seasons?: SeasonConfig[];
  /** Hebrew driver display names keyed by driver_id (label-only). */
  driverNamesHe?: Record<string, string>;
  /** Jump to the Drivers tab for a driver (drill-down from specialists/records). */
  onSelectDriver?: (driverName: string) => void;
};

const WEATHER_ORDER: WeatherKind[] = ["dry", "wet", "mixed"];

export default function CircuitsSection({
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

  /* ---------- Normalized dataset (built once) ---------- */
  const allRaces = useMemo<NormalizedRace[]>(
    () => normalizeRaces(Object.values(raceResults).flat(), events),
    [raceResults, events],
  );

  const identities = useMemo(() => buildCircuitIdentities(events), [events]);

  const circuitList = useMemo(() => listCircuitsWithHistory(allRaces), [allRaces]);
  const circuitIds = useMemo(() => circuitList.map((c) => c.id), [circuitList]);

  const nameFor = useCallback(
    (id: string) => {
      const idn = identities.get(id);
      if (idn) return localizedCircuitName(idn, locale);
      return id;
    },
    [identities, locale],
  );

  const seasonOptions = useMemo(() => {
    const set = new Set<string>();
    for (const r of allRaces) if (r.seasonKey) set.add(r.seasonKey);
    return [...set].sort(
      (a, b) =>
        (parseInt(b.replace(/\D/g, ""), 10) || 0) - (parseInt(a.replace(/\D/g, ""), 10) || 0),
    );
  }, [allRaces]);

  /* ---------- Upcoming circuit (for the "next race here" hint) ---------- */
  const upcomingCircuitId = useMemo(() => {
    const g = getNextRaceGroup(events);
    const track = g?.events[0]?.track;
    return track ? resolveCircuitId(track) : "";
  }, [events]);

  /* ---------- State (hydrated once from the URL) ---------- */
  const defaultCircuit = circuitIds[0] ?? "";
  const [circuitId, setCircuitId] = useState<string>(() => {
    const c = searchParams.get("circuitid");
    return c && circuitIds.includes(c) ? c : defaultCircuit;
  });
  const [scope, setScope] = useState<"all-time" | "season">(
    () => (searchParams.get("cscope") === "season" ? "season" : "all-time"),
  );
  const [season, setSeason] = useState<string>(() => {
    const sn = searchParams.get("cseason");
    return sn && seasonOptions.includes(sn) ? sn : seasonOptions[0] ?? "S1";
  });
  const [format, setFormat] = useState<RaceFormat | undefined>(() => {
    const f = searchParams.get("cformat");
    return f === "50%" || f === "25%" || f === "sprint" ? f : undefined;
  });
  const [competition, setCompetition] = useState<LeagueKind | undefined>(() => {
    const c = searchParams.get("ccomp");
    return c === "main" || c === "wild" ? c : undefined;
  });
  const [roundType, setRoundType] = useState<"regular" | "playoff" | undefined>(() => {
    const r = searchParams.get("cround");
    return r === "regular" || r === "playoff" ? r : undefined;
  });
  const [weather, setWeather] = useState<"dry" | "wet" | "mixed" | undefined>(() => {
    const w = searchParams.get("cweather");
    return w === "dry" || w === "wet" || w === "mixed" ? w : undefined;
  });
  const [showAdvanced, setShowAdvanced] = useState<boolean>(
    () =>
      !!(
        searchParams.get("cformat") ||
        searchParams.get("ccomp") ||
        searchParams.get("cround") ||
        searchParams.get("cweather")
      ),
  );

  // Effective selection — clamp to a valid circuit without a setState-in-effect
  // pass (mirrors the availability-clamping pattern used by the Drivers tab).
  const effCircuitId = circuitIds.includes(circuitId)
    ? circuitId
    : circuitIds[0] ?? "";

  /* ---------- Availability (from the selected circuit, all-time) ---------- */
  const careerRaces = useMemo(
    () => allRaces.filter((r) => resolveCircuitId(r.track) === effCircuitId),
    [allRaces, effCircuitId],
  );
  const availability = useMemo(() => {
    const formats = new Set<RaceFormat>();
    const weathers = new Set<WeatherKind>();
    let wild = false;
    let hasRegular = false;
    let hasPlayoffs = false;
    for (const r of careerRaces) {
      formats.add(r.format);
      if (r.weather !== "unknown") weathers.add(r.weather);
      if (r.league === "wild") wild = true;
      if (r.isPlayoff) hasPlayoffs = true;
      else hasRegular = true;
    }
    const order: RaceFormat[] = ["50%", "25%", "sprint"];
    return {
      formats: order.filter((f) => formats.has(f)),
      weathers: WEATHER_ORDER.filter((w) => weathers.has(w)),
      wild,
      hasRegular,
      hasPlayoffs,
    };
  }, [careerRaces]);

  const effFormat = format && availability.formats.includes(format) ? format : undefined;
  const effCompetition = competition === "wild" && !availability.wild ? undefined : competition;
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
    set("circuitid", effCircuitId || undefined);
    set("cscope", scope === "season" ? "season" : undefined);
    set("cseason", scope === "season" ? season : undefined);
    set("cformat", effFormat);
    set("ccomp", effCompetition);
    set("cround", effRoundType);
    set("cweather", effWeather);
    const qs = next.toString();
    if (qs !== searchParams.toString()) {
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    }
  }, [
    searchParams,
    effCircuitId,
    scope,
    season,
    effFormat,
    effCompetition,
    effRoundType,
    effWeather,
    pathname,
    router,
  ]);

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
    () =>
      effCircuitId
        ? computeCircuitProfile(allRaces, events, effCircuitId, filters)
        : null,
    [allRaces, events, effCircuitId, filters],
  );

  const identity: CircuitIdentity | undefined = identities.get(effCircuitId);

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

  const anyAdvanced = hasAdvancedFilter({ ...filters, circuit: undefined });
  const resetAll = useCallback(() => {
    setFormat(undefined);
    setCompetition(undefined);
    setRoundType(undefined);
    setWeather(undefined);
  }, []);

  const showFilterGroups =
    availability.formats.length >= 2 ||
    availability.wild ||
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

  /* ---------- Empty: no circuits with history yet ---------- */
  if (circuitList.length === 0) {
    return <EmptyState message={t("circuitsTab.empty.noCircuits")} />;
  }

  return (
    <div className="space-y-6">
      {/* ── Context bar ── */}
      <div className="space-y-3 rounded-[2px] border border-[color:var(--isl-hairline)] bg-cream p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="min-w-[16rem] flex-1">
            <SearchableSelect
              options={circuitIds}
              value={effCircuitId}
              onChange={setCircuitId}
              placeholder={t("select.selectCircuit")}
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
              {showAdvanced
                ? t("driversTab.context.hideFilters")
                : t("driversTab.context.advancedFilters")}
            </button>
          )}
        </div>

        {upcomingCircuitId && circuitIds.includes(upcomingCircuitId) && upcomingCircuitId !== effCircuitId && (
          <button
            type="button"
            onClick={() => setCircuitId(upcomingCircuitId)}
            className="inline-flex items-center gap-1.5 rounded-[2px] border border-oxblood/40 bg-paper px-2.5 py-1.5 text-xs font-semibold text-oxblood transition hover:bg-oxblood/5"
          >
            {t("circuitsTab.nextRaceHere", { circuit: nameFor(upcomingCircuitId) })}
          </button>
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
                  <Pill
                    key={w}
                    active={effWeather === w}
                    onClick={() => setWeather(w as "dry" | "wet" | "mixed")}
                  >
                    {t(`weather.${w}`)}
                  </Pill>
                ))}
              </div>
            )}
          </div>
        )}

        {(activeChips.length > 0 || anyAdvanced) && (
          <div className="flex flex-wrap items-center gap-2 border-t border-[color:var(--isl-hairline)] pt-3">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-faint">
              {contextLabel}
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
      {!profile ? (
        <EmptyState message={t("circuitsTab.empty.forFilters")} />
      ) : (
        <div className="space-y-8">
          <CircuitSnapshotSection profile={profile} identity={identity} />
          <CircuitHistorySection profile={profile} />
          <CircuitQualifyingSection profile={profile} />
          <CircuitSpecialistsSection
            profile={profile}
            driverNamesHe={driverNamesHe}
            onSelectDriver={onSelectDriver}
          />
          <CircuitCharacteristicsSection profile={profile} />
          <CircuitConditionsSection profile={profile} />
          <CircuitRecordsSection
            profile={profile}
            driverNamesHe={driverNamesHe}
            onSelectDriver={onSelectDriver}
          />
        </div>
      )}
    </div>
  );
}
