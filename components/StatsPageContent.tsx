"use client";

import { useState, useMemo, useCallback, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
} from "recharts";
import type {
  DriverStatRow,
  LeagueStatRow,
  CircuitStatRow,
  MetricInfo,
} from "@/lib/statsData";
import {
  detectMetrics,
  detectCircuitMetrics,
  DRIVER_HIGHLIGHT_METRICS,
  DRIVER_CHART_METRICS,
  DRIVER_RATING_METRICS,
  DRIVER_SEASON_KEYS,
} from "@/lib/statsData";

/* ------------------------------------------------------------------ */
/*  Props                                                              */
/* ------------------------------------------------------------------ */

type StatsData = {
  driversAllTime: { rows: DriverStatRow[]; headers: string[] };
  driversBySeason: Record<string, { rows: DriverStatRow[]; headers: string[] }>;
  league: LeagueStatRow[];
  circuits: { rows: CircuitStatRow[]; headers: string[] };
};

type Props = { data: StatsData };

/* ------------------------------------------------------------------ */
/*  Constants & helpers                                                 */
/* ------------------------------------------------------------------ */

const TABS = ["Drivers", "League", "Circuits"] as const;
type Tab = (typeof TABS)[number];

const COMPARE_COLORS = ["#7020B0", "#D4AF37", "#22d3ee", "#f472b6"];
const SINGLE_COLOR = "#7020B0";

function parseNum(v: string): number | null {
  if (!v || v === "-" || v === "N/A") return null;
  const n = Number(v.replace(/%/g, "").replace(/,/g, "").trim());
  return isNaN(n) ? null : n;
}

function fmtVal(v: number | string | undefined, pct = false): string {
  if (v === undefined || v === null) return "-";
  if (typeof v === "string") return v || "-";
  if (pct) return `${v.toFixed(1)}%`;
  return Number.isInteger(v) ? String(v) : v.toFixed(2);
}

/**
 * Find the best matching metric key in a set of available keys.
 * Handles the "Event Podiums" vs "Podiums" naming difference across seasons.
 */
function findMetricKey(wanted: string, availableKeys: Set<string>): string | null {
  if (availableKeys.has(wanted)) return wanted;
  // Try without "Event " prefix
  const stripped = wanted.replace(/^Event\s+/i, "");
  if (availableKeys.has(stripped)) return stripped;
  // Try with "Event " prefix
  const prefixed = `Event ${wanted}`;
  if (availableKeys.has(prefixed)) return prefixed;
  // Try matching by end of string (e.g. "Participation %" matches "Event Participation %")
  for (const k of availableKeys) {
    if (k.endsWith(wanted) || wanted.endsWith(k)) return k;
  }
  return null;
}

/**
 * Resolve a list of curated metric names against available keys.
 * Returns pairs of [display label, actual key].
 */
function resolveMetrics(
  curated: string[],
  availableKeys: Set<string>,
): { label: string; key: string }[] {
  const result: { label: string; key: string }[] = [];
  for (const wanted of curated) {
    const actual = findMetricKey(wanted, availableKeys);
    if (actual) {
      result.push({ label: wanted.replace(/^Event\s+/i, ""), key: actual });
    }
  }
  return result;
}

/* ------------------------------------------------------------------ */
/*  Shared UI atoms                                                    */
/* ------------------------------------------------------------------ */

function TabBar({ tabs, active, onChange }: { tabs: readonly string[]; active: string; onChange: (t: string) => void }) {
  return (
    <div className="flex gap-1 rounded-xl bg-white/5 p-1">
      {tabs.map((t) => (
        <button
          key={t}
          onClick={() => onChange(t)}
          className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${
            active === t
              ? "bg-[#7020B0] text-white shadow"
              : "text-white/60 hover:text-white hover:bg-white/5"
          }`}
        >
          {t}
        </button>
      ))}
    </div>
  );
}

function Toggle({ options, value, onChange }: { options: string[]; value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex gap-1 rounded-lg bg-white/5 p-0.5">
      {options.map((o) => (
        <button
          key={o}
          onClick={() => onChange(o)}
          className={`rounded-md px-3 py-1.5 text-xs font-semibold transition ${
            value === o
              ? "bg-[#D4AF37] text-black"
              : "text-white/60 hover:text-white"
          }`}
        >
          {o}
        </button>
      ))}
    </div>
  );
}

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-white/40">{label}</p>
      <p className="mt-1 font-display text-2xl font-bold text-white">{value}</p>
      {sub && <p className="mt-0.5 text-[11px] text-white/40">{sub}</p>}
    </div>
  );
}

function SearchableSelect({
  options,
  value,
  onChange,
  placeholder = "Select…",
  multiple = false,
  maxItems,
}: {
  options: string[];
  value: string | string[];
  onChange: (v: string | string[]) => void;
  placeholder?: string;
  multiple?: boolean;
  maxItems?: number;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const filtered = useMemo(
    () => options.filter((o) => o.toLowerCase().includes(search.toLowerCase())),
    [options, search],
  );

  const selected = Array.isArray(value) ? value : [value].filter(Boolean);

  const toggle = useCallback(
    (item: string) => {
      if (multiple) {
        const arr = [...selected];
        const idx = arr.indexOf(item);
        if (idx >= 0) {
          arr.splice(idx, 1);
          onChange(arr);
        } else if (!maxItems || arr.length < maxItems) {
          arr.push(item);
          onChange(arr);
        }
      } else {
        onChange(item);
        setOpen(false);
        setSearch("");
      }
    },
    [multiple, maxItems, selected, onChange],
  );

  const displayText = multiple
    ? selected.length > 0
      ? selected.join(", ")
      : placeholder
    : (value as string) || placeholder;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-left text-sm text-white transition hover:border-white/20"
      >
        <span className="truncate">{displayText}</span>
        <svg className="h-4 w-4 shrink-0 text-white/40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && (
        <div className="absolute left-0 right-0 top-full z-50 mt-1 max-h-60 overflow-auto rounded-lg border border-white/10 bg-[#1a1a24] shadow-xl">
          <div className="sticky top-0 border-b border-white/10 bg-[#1a1a24] p-2">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search…"
              className="w-full rounded-md bg-white/5 px-2 py-1.5 text-sm text-white placeholder-white/30 outline-none focus:ring-1 focus:ring-[#7020B0]"
              autoFocus
            />
          </div>
          {filtered.length === 0 && (
            <p className="px-3 py-2 text-xs text-white/40">No results</p>
          )}
          {filtered.map((item) => {
            const isSelected = selected.includes(item);
            return (
              <button
                key={item}
                type="button"
                onClick={() => toggle(item)}
                className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition hover:bg-white/5 ${
                  isSelected ? "text-[#D4AF37]" : "text-white/80"
                }`}
              >
                {multiple && (
                  <span
                    className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border text-[10px] ${
                      isSelected
                        ? "border-[#D4AF37] bg-[#D4AF37]/20 text-[#D4AF37]"
                        : "border-white/20"
                    }`}
                  >
                    {isSelected && "✓"}
                  </span>
                )}
                {item}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex items-center justify-center rounded-2xl border border-white/10 bg-white/5 py-16">
      <p className="text-sm text-white/50">{message}</p>
    </div>
  );
}

function ErrorState({ message }: { message: string }) {
  return (
    <div className="flex items-center justify-center rounded-2xl border border-red-500/20 bg-red-500/5 py-10">
      <p className="text-sm text-red-400">{message}</p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Chart wrappers                                                     */
/* ------------------------------------------------------------------ */

const CHART_THEME = {
  bg: "rgba(255,255,255,0.03)",
  border: "rgba(255,255,255,0.1)",
  grid: "rgba(255,255,255,0.08)",
  text: "rgba(255,255,255,0.5)",
  tooltipBg: "#1a1a24",
  tooltipBorder: "rgba(255,255,255,0.15)",
};

function CustomTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ name: string; value: number; color: string }>; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-white/10 bg-[#1a1a24] px-3 py-2 shadow-xl">
      <p className="mb-1 text-xs font-semibold text-white/70">{label}</p>
      {payload.map((p, i) => (
        <p key={i} className="text-xs" style={{ color: p.color }}>
          {p.name}: <span className="font-bold">{fmtVal(p.value)}</span>
        </p>
      ))}
    </div>
  );
}

function StatsBarChart({
  data,
  bars,
  xKey,
  height = 320,
}: {
  data: Record<string, string | number>[];
  bars: { key: string; color: string; name: string }[];
  xKey: string;
  height?: number;
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 40 }}>
          <XAxis
            dataKey={xKey}
            tick={{ fill: CHART_THEME.text, fontSize: 11 }}
            angle={-30}
            textAnchor="end"
            height={60}
            axisLine={{ stroke: CHART_THEME.grid }}
            tickLine={false}
          />
          <YAxis
            tick={{ fill: CHART_THEME.text, fontSize: 11 }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip content={<CustomTooltip />} />
          {bars.length > 1 && (
            <Legend
              wrapperStyle={{ fontSize: 12, color: "rgba(255,255,255,0.6)" }}
            />
          )}
          {bars.map((b) => (
            <Bar
              key={b.key}
              dataKey={b.key}
              name={b.name}
              fill={b.color}
              radius={[4, 4, 0, 0]}
              maxBarSize={40}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function StatsRadarChart({
  data,
  subjects,
  height = 350,
}: {
  data: { subject: string; [key: string]: string | number }[];
  subjects: { key: string; color: string; name: string }[];
  height?: number;
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
      <ResponsiveContainer width="100%" height={height}>
        <RadarChart cx="50%" cy="50%" outerRadius="70%" data={data}>
          <PolarGrid stroke={CHART_THEME.grid} />
          <PolarAngleAxis
            dataKey="subject"
            tick={{ fill: CHART_THEME.text, fontSize: 11 }}
          />
          <PolarRadiusAxis
            angle={90}
            tick={{ fill: CHART_THEME.text, fontSize: 10 }}
            axisLine={false}
          />
          {subjects.map((s) => (
            <Radar
              key={s.key}
              name={s.name}
              dataKey={s.key}
              stroke={s.color}
              fill={s.color}
              fillOpacity={0.15}
              strokeWidth={2}
            />
          ))}
          <Tooltip content={<CustomTooltip />} />
          {subjects.length > 1 && (
            <Legend wrapperStyle={{ fontSize: 12, color: "rgba(255,255,255,0.6)" }} />
          )}
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Section: DRIVERS                                                   */
/* ------------------------------------------------------------------ */

function DriversSection({
  allTime,
  bySeason,
  initialDriver,
}: {
  allTime: { rows: DriverStatRow[]; headers: string[] };
  bySeason: Record<string, { rows: DriverStatRow[]; headers: string[] }>;
  initialDriver?: string;
}) {
  const [mode, setMode] = useState<"All-time" | "Season">("All-time");
  const [season, setSeason] = useState<string>("S6");
  const [compare, setCompare] = useState(false);
  const [selectedDrivers, setSelectedDrivers] = useState<string[]>(
    initialDriver ? [initialDriver] : [],
  );

  // Pick the correct dataset
  const dataset = mode === "All-time" ? allTime : (bySeason[season] ?? { rows: [], headers: [] });
  const driverNames = useMemo(
    () => dataset.rows.map((r) => r.driver_name).sort(),
    [dataset.rows],
  );

  const metrics = useMemo(() => detectMetrics(dataset.rows), [dataset.rows]);

  // Ensure selected drivers exist in the current dataset
  const validDrivers = useMemo(
    () => selectedDrivers.filter((d) => driverNames.includes(d)),
    [selectedDrivers, driverNames],
  );

  // Auto-select first driver if none selected
  useEffect(() => {
    if (validDrivers.length === 0 && driverNames.length > 0 && !compare) {
      setSelectedDrivers([driverNames[0]]);
    }
  }, [validDrivers, driverNames, compare]);

  const selectedRows = useMemo(
    () =>
      validDrivers
        .map((name) => dataset.rows.find((r) => r.driver_name === name))
        .filter((r): r is DriverStatRow => !!r),
    [validDrivers, dataset.rows],
  );

  // Resolve curated metric names against available columns (handles "Event Podiums" vs "Podiums" etc.)
  const availableKeys = useMemo(() => new Set(metrics.map((m) => m.key)), [metrics]);

  const highlightMetrics = useMemo(
    () => resolveMetrics(DRIVER_HIGHLIGHT_METRICS, availableKeys),
    [availableKeys],
  );

  const chartMetrics = useMemo(
    () => resolveMetrics(DRIVER_CHART_METRICS, availableKeys),
    [availableKeys],
  );

  const ratingMetrics = useMemo(
    () => resolveMetrics(DRIVER_RATING_METRICS, availableKeys),
    [availableKeys],
  );

  // Season keys that actually have data
  const availableSeasons = useMemo(
    () => DRIVER_SEASON_KEYS.filter((k) => (bySeason[k]?.rows.length ?? 0) > 0),
    [bySeason],
  );

  if (dataset.rows.length === 0) {
    return <EmptyState message={`No driver stats available${mode === "Season" ? ` for ${season}` : ""}.`} />;
  }

  /* ---------- Single driver view ---------- */
  const singleDriver = !compare && selectedRows.length === 1 ? selectedRows[0] : null;

  /* ---------- Compare data for charts ---------- */
  const barData = useMemo(() => {
    if (selectedRows.length === 0) return [];
    return chartMetrics.map(({ label, key }) => {
      const row: Record<string, string | number> = { metric: label };
      for (const dr of selectedRows) {
        row[dr.driver_name] = dr.metrics[key] ?? 0;
      }
      return row;
    });
  }, [selectedRows, chartMetrics]);

  const radarData = useMemo(() => {
    if (ratingMetrics.length === 0 || selectedRows.length === 0) return [];
    return ratingMetrics.map(({ label, key }) => {
      const row: { subject: string; [key: string]: string | number } = { subject: label };
      for (const dr of selectedRows) {
        row[dr.driver_name] = dr.metrics[key] ?? 0;
      }
      return row;
    });
  }, [selectedRows, ratingMetrics]);

  return (
    <div className="space-y-6">
      {/* Controls */}
      <div className="flex flex-wrap items-center gap-3">
        <Toggle options={["All-time", "Season"]} value={mode} onChange={(v) => setMode(v as "All-time" | "Season")} />
        {mode === "Season" && (
          <select
            value={season}
            onChange={(e) => setSeason(e.target.value)}
            className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none"
          >
            {availableSeasons.map((k) => (
              <option key={k} value={k} className="bg-[#1a1a24]">
                Season {k.replace("S", "")}
              </option>
            ))}
          </select>
        )}
        <div className="flex-1" />
        <button
          onClick={() => {
            setCompare(!compare);
            if (!compare && validDrivers.length < 2) {
              setSelectedDrivers(driverNames.slice(0, 2));
            }
          }}
          className={`rounded-lg px-3 py-2 text-xs font-semibold transition ${
            compare
              ? "bg-[#D4AF37] text-black"
              : "border border-white/10 text-white/60 hover:text-white"
          }`}
        >
          {compare ? "✕ Compare" : "⇆ Compare"}
        </button>
      </div>

      {/* Driver selector */}
      <div className="max-w-sm">
        <SearchableSelect
          options={driverNames}
          value={compare ? validDrivers : validDrivers[0] ?? ""}
          onChange={(v) => setSelectedDrivers(Array.isArray(v) ? v : [v])}
          placeholder={compare ? "Select up to 4 drivers…" : "Select a driver…"}
          multiple={compare}
          maxItems={4}
        />
      </div>

      {/* Single driver quick stats */}
      {singleDriver && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-5">
          {highlightMetrics.map(({ label, key }) => (
            <StatCard
              key={key}
              label={label}
              value={fmtVal(singleDriver.metrics[key], key.includes("%"))}
            />
          ))}
        </div>
      )}

      {/* Compare quick stats */}
      {compare && selectedRows.length > 1 && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10">
                <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wider text-white/40">Metric</th>
                {selectedRows.map((dr, i) => (
                  <th key={dr.driver_name} className="px-3 py-2 text-right text-[10px] font-semibold uppercase tracking-wider" style={{ color: COMPARE_COLORS[i] }}>
                    {dr.driver_name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {highlightMetrics.map(({ label, key }) => (
                <tr key={key} className="border-b border-white/5">
                  <td className="px-3 py-2 text-white/60">{label}</td>
                  {selectedRows.map((dr) => (
                    <td key={dr.driver_name} className="px-3 py-2 text-right font-semibold text-white">
                      {fmtVal(dr.metrics[key], key.includes("%"))}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Charts */}
      {selectedRows.length > 0 && (
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Bar chart */}
          {barData.length > 0 && (
            <div>
              <h3 className="mb-2 text-sm font-semibold text-white/60">Key Metrics</h3>
              <StatsBarChart
                data={barData}
                bars={selectedRows.map((dr, i) => ({
                  key: dr.driver_name,
                  color: compare ? COMPARE_COLORS[i] : SINGLE_COLOR,
                  name: dr.driver_name,
                }))}
                xKey="metric"
              />
            </div>
          )}

          {/* Radar chart (ratings) */}
          {radarData.length > 0 && (
            <div>
              <h3 className="mb-2 text-sm font-semibold text-white/60">Driver Ratings</h3>
              <StatsRadarChart
                data={radarData}
                subjects={selectedRows.map((dr, i) => ({
                  key: dr.driver_name,
                  color: compare ? COMPARE_COLORS[i] : SINGLE_COLOR,
                  name: dr.driver_name,
                }))}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Section: LEAGUE                                                    */
/* ------------------------------------------------------------------ */

function LeagueSection({ league }: { league: LeagueStatRow[] }) {
  const seasonCols = useMemo(() => {
    if (league.length === 0) return [];
    return Object.keys(league[0].seasons);
  }, [league]);

  const [mode, setMode] = useState<"All-time" | "Season">("All-time");
  const [compare, setCompare] = useState(false);
  const [selectedSeasons, setSelectedSeasons] = useState<string[]>(
    seasonCols.length >= 2 ? [seasonCols[seasonCols.length - 1], seasonCols[seasonCols.length - 2]] : seasonCols.slice(0, 2),
  );

  if (league.length === 0) {
    return <EmptyState message="No league statistics available." />;
  }

  // Curated highlight metrics for league
  const highlights = [
    "Total Events",
    "Amount of Races",
    "Spots Occupied",
    "Participation %",
    "Avg. Participation",
    "# Drivers Participating*",
    "Dry Events",
    "Rainy Events",
    "Safety Cars",
    "Broadcasted Events",
  ];

  const displayMetrics = league.filter((r) =>
    highlights.some((h) => r.metric.toLowerCase().includes(h.toLowerCase())) || highlights.length === 0,
  );
  const displayList = displayMetrics.length > 0 ? displayMetrics : league;

  // Season compare bar chart data
  const barData = useMemo(() => {
    const cols = compare ? selectedSeasons : ["Total"];
    return displayList.map((r) => {
      const row: Record<string, string | number> = { metric: r.metric };
      for (const c of cols) {
        const val = c === "Total" ? r.total : r.seasons[c] ?? "";
        const n = parseNum(val);
        if (n !== null) row[c] = n;
      }
      return row;
    }).filter((r) => Object.keys(r).length > 1);
  }, [displayList, compare, selectedSeasons]);

  return (
    <div className="space-y-6">
      {/* Controls */}
      <div className="flex flex-wrap items-center gap-3">
        <Toggle options={["All-time", "Season"]} value={mode} onChange={(v) => setMode(v as "All-time" | "Season")} />
        {mode === "Season" && (
          <button
            onClick={() => setCompare(!compare)}
            className={`rounded-lg px-3 py-2 text-xs font-semibold transition ${
              compare
                ? "bg-[#D4AF37] text-black"
                : "border border-white/10 text-white/60 hover:text-white"
            }`}
          >
            {compare ? "✕ Compare Seasons" : "⇆ Compare Seasons"}
          </button>
        )}
      </div>

      {compare && mode === "Season" && (
        <div className="max-w-sm">
          <SearchableSelect
            options={seasonCols}
            value={selectedSeasons}
            onChange={(v) => setSelectedSeasons(Array.isArray(v) ? v : [v])}
            placeholder="Select 2 seasons…"
            multiple
            maxItems={2}
          />
        </div>
      )}

      {/* Stats table */}
      <div className="overflow-x-auto rounded-xl border border-white/10">
        <table role="table" className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/10 bg-white/5">
              <th className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-wider text-white/40">Metric</th>
              {mode === "All-time" ? (
                <>
                  <th className="px-4 py-3 text-right text-[10px] font-semibold uppercase tracking-wider text-[#D4AF37]">Total</th>
                  {seasonCols.map((sc) => (
                    <th key={sc} className="px-4 py-3 text-right text-[10px] font-semibold uppercase tracking-wider text-white/40">{sc}</th>
                  ))}
                </>
              ) : compare ? (
                selectedSeasons.map((sc, i) => (
                  <th key={sc} className="px-4 py-3 text-right text-[10px] font-semibold uppercase tracking-wider" style={{ color: COMPARE_COLORS[i] }}>{sc}</th>
                ))
              ) : (
                seasonCols.map((sc) => (
                  <th key={sc} className="px-4 py-3 text-right text-[10px] font-semibold uppercase tracking-wider text-white/40">{sc}</th>
                ))
              )}
            </tr>
          </thead>
          <tbody>
            {(mode === "All-time" ? league : displayList).map((r) => (
              <tr key={r.metric} className="border-b border-white/5 hover:bg-white/[0.02] transition">
                <td className="px-4 py-2 text-white/70 font-medium">{r.metric}</td>
                {mode === "All-time" ? (
                  <>
                    <td className="px-4 py-2 text-right font-semibold text-[#D4AF37]">{r.total}</td>
                    {seasonCols.map((sc) => (
                      <td key={sc} className="px-4 py-2 text-right text-white/60">{r.seasons[sc] ?? "-"}</td>
                    ))}
                  </>
                ) : compare ? (
                  selectedSeasons.map((sc) => (
                    <td key={sc} className="px-4 py-2 text-right font-semibold text-white">{r.seasons[sc] ?? "-"}</td>
                  ))
                ) : (
                  seasonCols.map((sc) => (
                    <td key={sc} className="px-4 py-2 text-right text-white/60">{r.seasons[sc] ?? "-"}</td>
                  ))
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Bar chart (compare mode) */}
      {compare && mode === "Season" && barData.length > 0 && (
        <div>
          <h3 className="mb-2 text-sm font-semibold text-white/60">Season Comparison</h3>
          <StatsBarChart
            data={barData}
            bars={selectedSeasons.map((sc, i) => ({
              key: sc,
              color: COMPARE_COLORS[i],
              name: sc,
            }))}
            xKey="metric"
            height={380}
          />
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Section: CIRCUITS                                                  */
/* ------------------------------------------------------------------ */

function CircuitsSection({
  circuits,
}: {
  circuits: { rows: CircuitStatRow[]; headers: string[] };
}) {
  const [compare, setCompare] = useState(false);
  const [selectedCircuits, setSelectedCircuits] = useState<string[]>([]);

  const circuitNames = useMemo(
    () => circuits.rows.map((r) => r.circuit).sort(),
    [circuits.rows],
  );

  const metrics = useMemo(() => detectCircuitMetrics(circuits.rows), [circuits.rows]);

  // Auto-select first circuit
  useEffect(() => {
    if (selectedCircuits.length === 0 && circuitNames.length > 0) {
      setSelectedCircuits([circuitNames[0]]);
    }
  }, [selectedCircuits, circuitNames]);

  const validCircuits = useMemo(
    () => selectedCircuits.filter((c) => circuitNames.includes(c)),
    [selectedCircuits, circuitNames],
  );

  const selectedRows = useMemo(
    () =>
      validCircuits
        .map((name) => circuits.rows.find((r) => r.circuit === name))
        .filter((r): r is CircuitStatRow => !!r),
    [validCircuits, circuits.rows],
  );

  if (circuits.rows.length === 0) {
    return <EmptyState message="No circuit statistics available." />;
  }

  // Curated highlight metrics
  const circuitHighlights = [
    "Event held",
    "Races Held",
    "Sprints Held",
    "Spots Occupied",
    "Participation %",
    "Dry Events",
    "Rainy Events",
    "Changing Weather Events",
  ];

  const availableHighlights = circuitHighlights.filter((m) =>
    metrics.some((met) => met.key === m),
  );

  // Non-season numeric columns for chart
  const chartCols = useMemo(() => {
    return metrics
      .filter((m) => !m.key.startsWith("Season ") && !m.isPercentage)
      .map((m) => m.key)
      .slice(0, 8);
  }, [metrics]);

  // Season columns for per-season chart
  const seasonCols = useMemo(() => {
    return metrics
      .filter((m) => m.key.startsWith("Season "))
      .map((m) => m.key);
  }, [metrics]);

  const singleCircuit = !compare && selectedRows.length === 1 ? selectedRows[0] : null;

  // Bar chart data for compare
  const barData = useMemo(() => {
    if (selectedRows.length === 0 || chartCols.length === 0) return [];
    return chartCols.map((m) => {
      const row: Record<string, string | number> = { metric: m };
      for (const cr of selectedRows) {
        row[cr.circuit] = cr.metrics[m] ?? 0;
      }
      return row;
    });
  }, [selectedRows, chartCols]);

  // Season breakdown for single circuit
  const seasonData = useMemo(() => {
    if (!singleCircuit || seasonCols.length === 0) return [];
    return seasonCols.map((sc) => ({
      season: sc.replace("Season ", "S"),
      value: singleCircuit.metrics[sc] ?? 0,
    }));
  }, [singleCircuit, seasonCols]);

  return (
    <div className="space-y-6">
      {/* Controls */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex-1" />
        <button
          onClick={() => {
            setCompare(!compare);
            if (!compare && validCircuits.length < 2) {
              setSelectedCircuits(circuitNames.slice(0, 2));
            }
          }}
          className={`rounded-lg px-3 py-2 text-xs font-semibold transition ${
            compare
              ? "bg-[#D4AF37] text-black"
              : "border border-white/10 text-white/60 hover:text-white"
          }`}
        >
          {compare ? "✕ Compare" : "⇆ Compare Circuits"}
        </button>
      </div>

      {/* Circuit selector */}
      <div className="max-w-sm">
        <SearchableSelect
          options={circuitNames}
          value={compare ? validCircuits : validCircuits[0] ?? ""}
          onChange={(v) => setSelectedCircuits(Array.isArray(v) ? v : [v])}
          placeholder={compare ? "Select up to 2 circuits…" : "Select a circuit…"}
          multiple={compare}
          maxItems={2}
        />
      </div>

      {/* Single circuit quick stats */}
      {singleCircuit && (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
            {availableHighlights.map((m) => (
              <StatCard
                key={m}
                label={m}
                value={fmtVal(singleCircuit.metrics[m], m.includes("%"))}
              />
            ))}
          </div>

          {/* Winners */}
          {singleCircuit.raw["Winners"] && (
            <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-white/40">Winners</p>
              <p className="mt-1 text-sm text-white/80">{singleCircuit.raw["Winners"]}</p>
            </div>
          )}

          {/* Season breakdown chart */}
          {seasonData.length > 0 && (
            <div>
              <h3 className="mb-2 text-sm font-semibold text-white/60">Appearances per Season</h3>
              <StatsBarChart
                data={seasonData}
                bars={[{ key: "value", color: SINGLE_COLOR, name: "Events" }]}
                xKey="season"
                height={250}
              />
            </div>
          )}
        </>
      )}

      {/* Compare view */}
      {compare && selectedRows.length > 1 && (
        <>
          {/* Compare table */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wider text-white/40">Metric</th>
                  {selectedRows.map((cr, i) => (
                    <th key={cr.circuit} className="px-3 py-2 text-right text-[10px] font-semibold uppercase tracking-wider" style={{ color: COMPARE_COLORS[i] }}>
                      {cr.circuit}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {availableHighlights.map((m) => (
                  <tr key={m} className="border-b border-white/5">
                    <td className="px-3 py-2 text-white/60">{m}</td>
                    {selectedRows.map((cr) => (
                      <td key={cr.circuit} className="px-3 py-2 text-right font-semibold text-white">
                        {fmtVal(cr.metrics[m], m.includes("%"))}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Compare bar chart */}
          {barData.length > 0 && (
            <div>
              <h3 className="mb-2 text-sm font-semibold text-white/60">Comparison</h3>
              <StatsBarChart
                data={barData}
                bars={selectedRows.map((cr, i) => ({
                  key: cr.circuit,
                  color: COMPARE_COLORS[i],
                  name: cr.circuit,
                }))}
                xKey="metric"
              />
            </div>
          )}
        </>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main component                                                     */
/* ------------------------------------------------------------------ */

export default function StatsPageContent({ data }: Props) {
  const searchParams = useSearchParams();
  const initialDriver = searchParams.get("driver") ?? undefined;
  const initialTab = searchParams.get("tab") ?? undefined;

  const [tab, setTab] = useState<Tab>(() => {
    if (initialTab && TABS.includes(initialTab as Tab)) return initialTab as Tab;
    return "Drivers";
  });

  return (
    <div className="space-y-8">
      {/* Tab bar */}
      <div className="flex justify-center">
        <TabBar tabs={TABS} active={tab} onChange={(t) => setTab(t as Tab)} />
      </div>

      {/* Content */}
      {tab === "Drivers" && (
        <DriversSection
          allTime={data.driversAllTime}
          bySeason={data.driversBySeason}
          initialDriver={initialDriver}
        />
      )}
      {tab === "League" && <LeagueSection league={data.league} />}
      {tab === "Circuits" && (
        <CircuitsSection circuits={data.circuits} />
      )}
    </div>
  );
}
