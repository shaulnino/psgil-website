"use client";

/* ------------------------------------------------------------------ */
/*  Stats V2 — Persistent FilterBar                                    */
/*                                                                     */
/*  Renders the multi-dimension filter controls shared across every    */
/*  /stats-v2 page. State is held in URL query params so navigation    */
/*  preserves the user's selection.                                    */
/* ------------------------------------------------------------------ */

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import {
  parseFiltersFromParams,
  serializeFilters,
  isDefaultFilters,
  DEFAULT_FILTERS,
  type StatsV2Filters,
  type LeagueFilter,
  type WeatherFilter,
  type RoundType,
  type DriverPool,
} from "@/lib/statsV2/filters";
import type { RaceFormat } from "@/lib/scheduleData";

type FilterBarProps = {
  /** Available season keys, e.g. ["S1","S2","S3","S4","S5","S6"]. */
  seasonOptions: string[];
  /** Available circuit names. */
  circuitOptions: string[];
};

export default function FilterBar({ seasonOptions, circuitOptions }: FilterBarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);

  const filters = useMemo(
    () => parseFiltersFromParams(searchParams),
    [searchParams],
  );

  const update = (next: StatsV2Filters) => {
    const qs = serializeFilters(next);
    const url = qs ? `${pathname}?${qs}` : pathname;
    startTransition(() => {
      router.replace(url, { scroll: false });
    });
  };

  const toggleArr = <T extends string>(arr: T[], val: T): T[] =>
    arr.includes(val) ? arr.filter((x) => x !== val) : [...arr, val];

  const reset = () => update(DEFAULT_FILTERS);

  const activeChips = ((): { key: string; label: string; remove: () => void }[] => {
    const chips: { key: string; label: string; remove: () => void }[] = [];
    for (const s of filters.seasons) {
      chips.push({
        key: `season-${s}`,
        label: s,
        remove: () => update({ ...filters, seasons: filters.seasons.filter((x) => x !== s) }),
      });
    }
    for (const l of filters.leagues) {
      chips.push({
        key: `league-${l}`,
        label: l === "main" ? "Main" : "Wild",
        remove: () => update({ ...filters, leagues: filters.leagues.filter((x) => x !== l) }),
      });
    }
    for (const f of filters.formats) {
      chips.push({
        key: `format-${f}`,
        label: f,
        remove: () => update({ ...filters, formats: filters.formats.filter((x) => x !== f) }),
      });
    }
    for (const w of filters.weather) {
      chips.push({
        key: `weather-${w}`,
        label: w[0].toUpperCase() + w.slice(1),
        remove: () => update({ ...filters, weather: filters.weather.filter((x) => x !== w) }),
      });
    }
    for (const c of filters.circuits) {
      chips.push({
        key: `circuit-${c}`,
        label: c,
        remove: () => update({ ...filters, circuits: filters.circuits.filter((x) => x !== c) }),
      });
    }
    for (const r of filters.roundTypes) {
      chips.push({
        key: `round-${r}`,
        label: r === "playoff" ? "Playoff" : "Regular",
        remove: () => update({ ...filters, roundTypes: filters.roundTypes.filter((x) => x !== r) }),
      });
    }
    if (filters.driverPool !== "all") {
      chips.push({
        key: "pool",
        label: filters.driverPool === "active" ? "Active drivers" : "Historical only",
        remove: () => update({ ...filters, driverPool: "all" }),
      });
    }
    if (filters.minSample > 1) {
      chips.push({
        key: "min",
        label: `Min ${filters.minSample} races`,
        remove: () => update({ ...filters, minSample: 1 }),
      });
    }
    return chips;
  })();

  return (
    <div className="sticky top-0 z-30 border-b border-white/10 bg-[#0B0B0E]/95 backdrop-blur supports-[backdrop-filter]:bg-[#0B0B0E]/80">
      <div className="mx-auto max-w-7xl px-4 py-3">
        <div className="flex items-center gap-3 flex-wrap">
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="inline-flex items-center gap-2 rounded-md border border-white/15 bg-white/5 px-3 py-1.5 text-sm font-medium text-white hover:bg-white/10"
            aria-expanded={open}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="3" y1="6" x2="21" y2="6" />
              <line x1="6" y1="12" x2="18" y2="12" />
              <line x1="9" y1="18" x2="15" y2="18" />
            </svg>
            Filters
            {!isDefaultFilters(filters) && (
              <span className="ml-1 inline-flex h-5 w-5 items-center justify-center rounded-full bg-cyan-500/80 text-[10px] font-bold text-black">
                {activeChips.length}
              </span>
            )}
          </button>

          {activeChips.length > 0 && (
            <div className="flex items-center gap-1.5 flex-wrap">
              {activeChips.map((c) => (
                <button
                  key={c.key}
                  type="button"
                  onClick={c.remove}
                  className="inline-flex items-center gap-1 rounded-full bg-cyan-500/15 border border-cyan-500/30 px-2.5 py-0.5 text-xs text-cyan-200 hover:bg-cyan-500/25"
                  title="Remove filter"
                >
                  {c.label}
                  <span aria-hidden>×</span>
                </button>
              ))}
              <button
                type="button"
                onClick={reset}
                className="text-xs text-white/60 underline hover:text-white"
              >
                Reset all
              </button>
            </div>
          )}

          {isPending && <span className="text-xs text-white/50">Updating…</span>}
        </div>

        {open && (
          <div className="mt-4 grid gap-4 rounded-lg border border-white/10 bg-white/[0.02] p-4 sm:grid-cols-2 lg:grid-cols-4">
            <FilterGroup label="Seasons">
              <ChipRow
                values={seasonOptions}
                selected={filters.seasons}
                onToggle={(v) => update({ ...filters, seasons: toggleArr(filters.seasons, v) })}
              />
            </FilterGroup>

            <FilterGroup label="League">
              <ChipRow<LeagueFilter>
                values={["main", "wild"]}
                selected={filters.leagues}
                renderLabel={(v) => (v === "main" ? "Main" : "Wild")}
                onToggle={(v) => update({ ...filters, leagues: toggleArr(filters.leagues, v) })}
              />
            </FilterGroup>

            <FilterGroup label="Format">
              <ChipRow<RaceFormat>
                values={["50%", "25%", "sprint"]}
                selected={filters.formats}
                onToggle={(v) => update({ ...filters, formats: toggleArr(filters.formats, v) })}
              />
            </FilterGroup>

            <FilterGroup label="Weather">
              <ChipRow<WeatherFilter>
                values={["dry", "wet", "mixed"]}
                selected={filters.weather}
                renderLabel={(v) => v[0].toUpperCase() + v.slice(1)}
                onToggle={(v) => update({ ...filters, weather: toggleArr(filters.weather, v) })}
              />
            </FilterGroup>

            <FilterGroup label="Round type">
              <ChipRow<RoundType>
                values={["regular", "playoff"]}
                selected={filters.roundTypes}
                renderLabel={(v) => (v === "playoff" ? "Playoff" : "Regular")}
                onToggle={(v) => update({ ...filters, roundTypes: toggleArr(filters.roundTypes, v) })}
              />
            </FilterGroup>

            <FilterGroup label="Driver pool">
              <ChipRow<DriverPool>
                values={["all", "active", "historical"]}
                selected={[filters.driverPool]}
                renderLabel={(v) => (v === "all" ? "All" : v === "active" ? "Active" : "Historical")}
                onToggle={(v) => update({ ...filters, driverPool: v })}
              />
            </FilterGroup>

            <FilterGroup label="Min races">
              <input
                type="number"
                min={1}
                value={filters.minSample}
                onChange={(e) =>
                  update({
                    ...filters,
                    minSample: Math.max(1, parseInt(e.target.value || "1", 10) || 1),
                  })
                }
                className="w-24 rounded-md bg-white/5 border border-white/15 px-2 py-1 text-sm text-white"
              />
            </FilterGroup>

            {circuitOptions.length > 0 && (
              <FilterGroup label="Circuits" full>
                <ChipRow
                  values={circuitOptions}
                  selected={filters.circuits}
                  onToggle={(v) => update({ ...filters, circuits: toggleArr(filters.circuits, v) })}
                />
              </FilterGroup>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function FilterGroup({
  label,
  children,
  full,
}: {
  label: string;
  children: React.ReactNode;
  full?: boolean;
}) {
  return (
    <div className={full ? "sm:col-span-2 lg:col-span-4" : undefined}>
      <div className="text-xs uppercase tracking-wide text-white/50 mb-1.5">{label}</div>
      {children}
    </div>
  );
}

function ChipRow<T extends string>({
  values,
  selected,
  onToggle,
  renderLabel,
}: {
  values: T[];
  selected: T[];
  onToggle: (v: T) => void;
  renderLabel?: (v: T) => string;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {values.map((v) => {
        const isOn = selected.includes(v);
        return (
          <button
            key={v}
            type="button"
            onClick={() => onToggle(v)}
            className={`rounded-full px-2.5 py-0.5 text-xs border transition-colors ${
              isOn
                ? "bg-cyan-500/25 border-cyan-500/50 text-white"
                : "bg-white/5 border-white/10 text-white/70 hover:bg-white/10"
            }`}
          >
            {renderLabel ? renderLabel(v) : v}
          </button>
        );
      })}
    </div>
  );
}
