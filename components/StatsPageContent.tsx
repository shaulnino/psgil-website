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
  MetricCategory,
} from "@/lib/statsData";
import {
  detectMetrics,
  detectCircuitMetrics,
  categoriseMetrics,
  getMetricTooltip,
  DRIVER_CHART_METRICS,
  DRIVER_RATING_METRICS,
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

const TABS = ["Drivers", "League", "Circuits", "Rankings"] as const;
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
  const stripped = wanted.replace(/^Event\s+/i, "");
  if (availableKeys.has(stripped)) return stripped;
  const prefixed = `Event ${wanted}`;
  if (availableKeys.has(prefixed)) return prefixed;
  for (const k of availableKeys) {
    if (k.endsWith(wanted) || wanted.endsWith(k)) return k;
  }
  return null;
}

/**
 * Resolve a list of curated metric names against available keys.
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
          className={`rounded-md px-3 py-1.5 text-sm font-semibold transition ${
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
        className="flex w-full items-center justify-between gap-2 rounded-lg border-2 border-[#7020B0] bg-white/5 px-3 py-2 text-left text-sm text-white transition hover:border-[#9030D0]"
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
            <p className="px-3 py-2 text-sm text-white/40">No results</p>
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
                    className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border text-sm ${
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

/* ------------------------------------------------------------------ */
/*  Collapsible category group                                         */
/* ------------------------------------------------------------------ */

function CategoryGroup({
  category,
  defaultOpen = false,
  children,
}: {
  category: MetricCategory;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="rounded-xl border border-white/10 overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between gap-2 bg-[#7020B0]/80 px-4 py-3 text-left transition hover:bg-[#7020B0]"
      >
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-white">{category.label}</span>
          <span className="rounded-full bg-white/20 px-2 py-0.5 text-sm font-medium text-white/70">
            {category.metrics.length}
          </span>
        </div>
        <svg
          className={`h-4 w-4 shrink-0 text-white/70 transition-transform ${open ? "rotate-180" : ""}`}
          fill="none" stroke="currentColor" viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && <div className="border-t border-[#7020B0]/30 bg-white/[0.02] px-4 py-3">{children}</div>}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Lightweight tooltip                                                */
/* ------------------------------------------------------------------ */

function MetricTooltip({
  text,
  children,
}: {
  text: string;
  children: React.ReactNode;
}) {
  return (
    <span className="group/tip relative inline-flex cursor-help">
      {children}
      <span className="pointer-events-none absolute bottom-full left-0 z-50 mb-2 w-max max-w-[220px] rounded-md bg-[#1a1a2e] px-2.5 py-1.5 text-[11px] font-medium text-white/90 opacity-0 shadow-lg ring-1 ring-white/10 transition-opacity group-hover/tip:opacity-100 text-left leading-snug">
        {text}
      </span>
    </span>
  );
}

/* ------------------------------------------------------------------ */
/*  Stat display row for a single metric (compact)                     */
/* ------------------------------------------------------------------ */

function StatRow({
  label,
  value,
  isPct,
  tooltip,
}: {
  label: string;
  value: number | undefined;
  isPct: boolean;
  tooltip?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-2 rounded-lg px-3 py-1.5 transition hover:bg-white/[0.03]">
      {tooltip ? (
        <MetricTooltip text={tooltip}>
          <span className="text-sm text-white/60 truncate">
            {label}
          </span>
        </MetricTooltip>
      ) : (
        <span className="text-sm text-white/60 truncate">{label}</span>
      )}
      <span className="text-sm font-semibold text-[#D4AF37] tabular-nums shrink-0">
        {fmtVal(value, isPct)}
      </span>
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
      <p className="mb-1 text-sm font-semibold text-white/70">{label}</p>
      {payload.map((p, i) => (
        <p key={i} className="text-sm" style={{ color: p.color }}>
          {p.name}: <span className="font-bold">{fmtVal(p.value)}</span>
        </p>
      ))}
    </div>
  );
}

/**
 * Custom X-axis tick that wraps long labels across 2 lines.
 */
function WrappedXTick({ x, y, payload }: { x?: number; y?: number; payload?: { value: string } }) {
  const text = payload?.value ?? "";
  const MAX_LINE = 14;
  let line1 = text;
  let line2 = "";
  if (text.length > MAX_LINE) {
    const mid = text.lastIndexOf(" ", MAX_LINE);
    if (mid > 0) {
      line1 = text.slice(0, mid);
      line2 = text.slice(mid + 1);
    } else {
      line1 = text.slice(0, MAX_LINE) + "…";
    }
  }
  return (
    <g transform={`translate(${x},${y})`}>
      <text x={0} y={0} dy={12} textAnchor="middle" fill="#fff" fontSize={11}>
        {line1}
      </text>
      {line2 && (
        <text x={0} y={0} dy={26} textAnchor="middle" fill="#fff" fontSize={11}>
          {line2}
        </text>
      )}
    </g>
  );
}

function StatsBarChart({
  data,
  bars,
  xKey,
  height = 320,
  normalise = false,
  hideLegend = false,
}: {
  data: Record<string, string | number>[];
  bars: { key: string; color: string; name: string }[];
  xKey: string;
  height?: number;
  /** Normalise each metric row to 0-100% of max so disparate scales become comparable */
  normalise?: boolean;
  /** Hide the built-in Recharts legend (useful when rendering a separate sticky legend) */
  hideLegend?: boolean;
}) {
  // Build actual and normalised data
  const { chartData, actualData } = useMemo(() => {
    if (!normalise) return { chartData: data, actualData: data };
    const barKeys = bars.map((b) => b.key);
    const norm = data.map((row) => {
      const maxVal = Math.max(
        ...barKeys.map((k) => {
          const v = typeof row[k] === "number" ? (row[k] as number) : 0;
          return Math.abs(v);
        }),
        0.01, // prevent division by zero
      );
      const r: Record<string, string | number> = { [xKey]: row[xKey] };
      for (const k of barKeys) {
        const v = typeof row[k] === "number" ? (row[k] as number) : 0;
        r[k] = Math.max(0, Math.min(100, Math.round((Math.abs(v) / maxVal) * 100)));
      }
      return r;
    });
    return { chartData: norm, actualData: data };
  }, [data, bars, xKey, normalise]);

  // Custom tooltip showing actual values when normalised
  function NormTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ name: string; value: number; color: string; dataKey: string }>; label?: string }) {
    if (!active || !payload?.length) return null;
    const origRow = actualData.find((r) => r[xKey] === label);
    return (
      <div className="rounded-lg border border-white/10 bg-[#1a1a24] px-3 py-2 shadow-xl">
        <p className="mb-1 text-sm font-semibold text-white/70">{label}</p>
        {payload.map((p, i) => {
          const actual = origRow ? origRow[p.dataKey ?? p.name] : p.value;
          return (
            <p key={i} className="text-sm" style={{ color: p.color }}>
              {p.name}: <span className="font-bold">{fmtVal(typeof actual === "number" ? actual : p.value)}</span>
            </p>
          );
        })}
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 40 }}>
          <XAxis
            dataKey={xKey}
            tick={(props: Record<string, unknown>) => <WrappedXTick x={props.x as number} y={props.y as number} payload={props.payload as { value: string }} />}
            height={50}
            axisLine={{ stroke: CHART_THEME.grid }}
            tickLine={false}
            interval={0}
          />
          <YAxis
            tick={{ fill: "#fff", fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            domain={normalise ? [0, 100] : undefined}
            allowDataOverflow={normalise}
            tickFormatter={normalise ? (v: number) => `${v}%` : undefined}
          />
          <Tooltip content={normalise ? <NormTooltip /> : <CustomTooltip />} />
          {!hideLegend && (
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
        <RadarChart cx="50%" cy="50%" outerRadius="55%" data={data}>
          <PolarGrid stroke={CHART_THEME.grid} />
          <PolarAngleAxis
            dataKey="subject"
            tick={{ fill: "#D4AF37", fontSize: 12, fontWeight: 600 }}
          />
          <PolarRadiusAxis
            angle={90}
            tick={{ fill: "#fff", fontSize: 10 }}
            axisLine={false}
            domain={[0, 100]}
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

/** Number of categories to open by default */
const DEFAULT_OPEN_CATEGORIES = 1;

function DriversSection({
  allTime,
  bySeason,
  initialDriver,
}: {
  allTime: { rows: DriverStatRow[]; headers: string[] };
  bySeason: Record<string, { rows: DriverStatRow[]; headers: string[] }>;
  initialDriver?: string;
}) {
  // Derive the default season from bySeason keys (newest first)
  const defaultSeason = useMemo(() => {
    const keys = Object.keys(bySeason).sort((a, b) => {
      const numA = parseInt(a.replace(/\D/g, ""), 10) || 0;
      const numB = parseInt(b.replace(/\D/g, ""), 10) || 0;
      return numB - numA;
    });
    return keys[0] || "S1";
  }, [bySeason]);

  const [mode, setMode] = useState<"All-time" | "Season">("All-time");
  const [season, setSeason] = useState<string>(defaultSeason);
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
  const categories = useMemo(() => categoriseMetrics(metrics), [metrics]);

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

  // Chart metrics resolution
  const availableKeys = useMemo(() => new Set(metrics.map((m) => m.key)), [metrics]);

  const chartMetrics = useMemo(
    () => resolveMetrics(DRIVER_CHART_METRICS, availableKeys),
    [availableKeys],
  );
  const ratingMetrics = useMemo(
    () => resolveMetrics(DRIVER_RATING_METRICS, availableKeys),
    [availableKeys],
  );

  // Season keys that actually have data — derived dynamically from bySeason
  const availableSeasons = useMemo(
    () =>
      Object.keys(bySeason)
        .filter((k) => (bySeason[k]?.rows.length ?? 0) > 0)
        .sort((a, b) => {
          // Sort newest season first (S6, S5, S4, …)
          const numA = parseInt(a.replace(/\D/g, ""), 10) || 0;
          const numB = parseInt(b.replace(/\D/g, ""), 10) || 0;
          return numB - numA;
        }),
    [bySeason],
  );

  if (dataset.rows.length === 0) {
    return <EmptyState message={`No driver stats available${mode === "Season" ? ` for ${season}` : ""}.`} />;
  }

  const singleDriver = !compare && selectedRows.length === 1 ? selectedRows[0] : null;

  const [showAllMetrics, setShowAllMetrics] = useState(false);

  /** All chartable metrics (non-rating, non-percentage) */
  const allChartableMetrics = useMemo(
    () => metrics.filter((m) => !m.isRating && !m.isPercentage),
    [metrics],
  );
  const [modalSelectedKeys, setModalSelectedKeys] = useState<Set<string>>(new Set());

  // Reset modal selection when opening / metrics change
  useEffect(() => {
    if (showAllMetrics) {
      setModalSelectedKeys(new Set(allChartableMetrics.map((m) => m.key)));
    }
  }, [showAllMetrics, allChartableMetrics]);

  /* ---------- Chart data ---------- */
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

  /** Filtered bar data for the modal */
  const modalBarData = useMemo(() => {
    if (selectedRows.length === 0) return [];
    return allChartableMetrics
      .filter((m) => modalSelectedKeys.has(m.key))
      .map(({ label, key }) => {
        const row: Record<string, string | number> = { metric: label };
        for (const dr of selectedRows) {
          row[dr.driver_name] = dr.metrics[key] ?? 0;
        }
        return row;
      });
  }, [selectedRows, allChartableMetrics, modalSelectedKeys]);

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
            className="rounded-lg border-2 border-[#7020B0] bg-white/5 px-3 py-2 text-sm text-white outline-none"
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
          className={`rounded-lg px-3 py-2 text-sm font-semibold transition ${
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

      {/* ---- SINGLE DRIVER: All stats in categorised groups ---- */}
      {singleDriver && (
        <div className="space-y-3">
          {categories.map((cat, catIdx) => (
            <CategoryGroup
              key={cat.id}
              category={cat}
              defaultOpen={catIdx < DEFAULT_OPEN_CATEGORIES}
            >
              <div className="grid grid-cols-1 gap-x-6 sm:grid-cols-2 lg:grid-cols-3">
                {cat.metrics.map((m) => (
                  <StatRow
                    key={m.key}
                    label={m.label}
                    value={singleDriver.metrics[m.key]}
                    isPct={m.isPercentage}
                    tooltip={m.tooltip}
                  />
                ))}
              </div>
            </CategoryGroup>
          ))}
        </div>
      )}

      {/* ---- COMPARE MODE: Full table with all metrics ---- */}
      {compare && selectedRows.length > 1 && (
        <div className="space-y-3">
          {categories.map((cat, catIdx) => (
            <CategoryGroup
              key={cat.id}
              category={cat}
              defaultOpen={catIdx < DEFAULT_OPEN_CATEGORIES}
            >
              <div className="overflow-x-auto -mx-4">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-white/10">
                      <th className="px-4 py-2 text-left text-sm font-semibold uppercase tracking-wider text-white/40">
                        Metric
                      </th>
                      {selectedRows.map((dr, i) => (
                        <th
                          key={dr.driver_name}
                          className="px-4 py-2 text-right text-sm font-semibold uppercase tracking-wider"
                          style={{ color: COMPARE_COLORS[i] }}
                        >
                          {dr.driver_name}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {cat.metrics.map((m) => (
                      <tr key={m.key} className="border-b border-white/5">
                        <td className="px-4 py-1.5 text-sm text-white/60">
                          {m.tooltip ? (
                            <MetricTooltip text={m.tooltip}>
                              <span>{m.label}</span>
                            </MetricTooltip>
                          ) : m.label}
                        </td>
                        {selectedRows.map((dr) => (
                          <td key={dr.driver_name} className="px-4 py-1.5 text-right text-sm font-semibold text-[#D4AF37] tabular-nums">
                            {fmtVal(dr.metrics[m.key], m.isPercentage)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CategoryGroup>
          ))}
        </div>
      )}

      {/* Charts — only useful in compare mode */}
      {compare && selectedRows.length > 1 && (
        <div className="grid gap-6 lg:grid-cols-2">
          {barData.length > 0 && (
            <div>
              <h3 className="mb-2 text-sm font-semibold text-white/60">Key Metrics (normalised)</h3>
              <StatsBarChart
                data={barData}
                bars={selectedRows.map((dr, i) => ({
                  key: dr.driver_name,
                  color: COMPARE_COLORS[i],
                  name: dr.driver_name,
                }))}
                xKey="metric"
                normalise
              />
              <div className="mt-2 flex justify-end">
                <button
                  onClick={() => setShowAllMetrics(true)}
                  className="text-sm font-semibold text-[#D4AF37]/80 hover:text-[#D4AF37] transition"
                >
                  All Metrics →
                </button>
              </div>
            </div>
          )}
          {radarData.length > 0 && (
            <div>
              <h3 className="mb-2 text-sm font-semibold text-white/60">Driver Ratings</h3>
              <StatsRadarChart
                data={radarData}
                subjects={selectedRows.map((dr, i) => ({
                  key: dr.driver_name,
                  color: COMPARE_COLORS[i],
                  name: dr.driver_name,
                }))}
              />
            </div>
          )}
        </div>
      )}

      {/* ---- All Metrics Modal ---- */}
      {showAllMetrics && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
          onClick={() => setShowAllMetrics(false)}
        >
          <div
            className="relative mx-4 flex w-full max-w-6xl max-h-[90vh] flex-col rounded-2xl border border-white/10 bg-[#0e0e14] shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-white/10 px-6 py-4">
              <h2 className="text-lg font-bold text-white">All Metrics (normalised)</h2>
              <button
                onClick={() => setShowAllMetrics(false)}
                className="rounded-lg p-1.5 text-white/40 transition hover:bg-white/10 hover:text-white"
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Metric picker */}
            <div className="border-b border-white/10 px-6 py-3">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-sm font-semibold text-white/50 uppercase tracking-wider">
                  Metrics ({modalSelectedKeys.size}/{allChartableMetrics.length})
                </span>
                <div className="flex gap-2">
                  <button
                    onClick={() => setModalSelectedKeys(new Set(allChartableMetrics.map((m) => m.key)))}
                    className="text-[11px] font-semibold text-[#D4AF37]/70 hover:text-[#D4AF37] transition"
                  >
                    Select All
                  </button>
                  <span className="text-white/20">|</span>
                  <button
                    onClick={() => setModalSelectedKeys(new Set())}
                    className="text-[11px] font-semibold text-white/40 hover:text-white/70 transition"
                  >
                    Clear
                  </button>
                </div>
              </div>
              <div className="flex flex-wrap gap-1.5 max-h-28 overflow-auto">
                {allChartableMetrics.map((m) => {
                  const selected = modalSelectedKeys.has(m.key);
                  return (
                    <button
                      key={m.key}
                      onClick={() => {
                        setModalSelectedKeys((prev) => {
                          const next = new Set(prev);
                          if (next.has(m.key)) next.delete(m.key);
                          else next.add(m.key);
                          return next;
                        });
                      }}
                      className={`rounded-md px-2 py-1 text-[11px] font-medium transition ${
                        selected
                          ? "bg-[#7020B0]/60 text-white ring-1 ring-[#7020B0]"
                          : "bg-white/5 text-white/40 hover:text-white/60"
                      }`}
                    >
                      {m.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Sticky driver legend */}
            {selectedRows.length > 0 && (
              <div className="flex items-center gap-4 border-b border-white/10 bg-[#0e0e14] px-6 py-2">
                {selectedRows.map((dr, i) => (
                  <div key={dr.driver_name} className="flex items-center gap-1.5">
                    <span
                      className="inline-block h-3 w-3 rounded-sm"
                      style={{ backgroundColor: compare ? COMPARE_COLORS[i] : SINGLE_COLOR }}
                    />
                    <span className="text-sm font-medium text-white/80">{dr.driver_name}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Horizontally scrollable chart */}
            <div className="flex-1 overflow-auto px-6 py-4">
              {modalBarData.length === 0 ? (
                <div className="flex items-center justify-center py-16">
                  <p className="text-sm text-white/40">Select at least one metric above</p>
                </div>
              ) : (
                <div
                  className="overflow-x-auto"
                  style={{ minWidth: 0 }}
                >
                  <div style={{ width: Math.max(700, modalBarData.length * 90) }}>
                    <StatsBarChart
                      data={modalBarData}
                      bars={selectedRows.map((dr, i) => ({
                        key: dr.driver_name,
                        color: compare ? COMPARE_COLORS[i] : SINGLE_COLOR,
                        name: dr.driver_name,
                      }))}
                      xKey="metric"
                      normalise
                      height={400}
                      hideLegend
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
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

  // Season compare bar chart data
  const barData = useMemo(() => {
    const cols = compare ? selectedSeasons : ["Total"];
    return league.map((r) => {
      const row: Record<string, string | number> = { metric: r.metric };
      for (const c of cols) {
        const val = c === "Total" ? r.total : r.seasons[c] ?? "";
        const n = parseNum(val);
        if (n !== null) row[c] = n;
      }
      return row;
    }).filter((r) => Object.keys(r).length > 1);
  }, [league, compare, selectedSeasons]);

  return (
    <div className="space-y-6">
      {/* Controls */}
      <div className="flex flex-wrap items-center gap-3">
        <Toggle options={["All-time", "Season"]} value={mode} onChange={(v) => setMode(v as "All-time" | "Season")} />
        {mode === "Season" && (
          <button
            onClick={() => setCompare(!compare)}
            className={`rounded-lg px-3 py-2 text-sm font-semibold transition ${
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
              <th className="px-4 py-3 text-left text-sm font-semibold uppercase tracking-wider text-white/40">Metric</th>
              {mode === "All-time" ? (
                <th className="px-4 py-3 text-right text-sm font-semibold uppercase tracking-wider text-[#D4AF37]">Total</th>
              ) : compare ? (
                selectedSeasons.map((sc, i) => (
                  <th key={sc} className="px-4 py-3 text-right text-sm font-semibold uppercase tracking-wider" style={{ color: COMPARE_COLORS[i] }}>{sc}</th>
                ))
              ) : (
                seasonCols.map((sc) => (
                  <th key={sc} className="px-4 py-3 text-right text-sm font-semibold uppercase tracking-wider text-white/40">{sc}</th>
                ))
              )}
            </tr>
          </thead>
          <tbody>
            {league.map((r) => {
              const tip = getMetricTooltip(r.metric, r.metric);
              const hasTip = tip !== r.metric;
              return (
              <tr key={r.metric} className="border-b border-white/5 hover:bg-white/[0.02] transition">
                <td className="px-4 py-2 text-white/70 font-medium">
                  {hasTip ? (
                    <MetricTooltip text={tip}>
                      <span>{r.metric}</span>
                    </MetricTooltip>
                  ) : r.metric}
                </td>
                {mode === "All-time" ? (
                  <td className="px-4 py-2 text-right font-semibold text-[#D4AF37]">{r.total}</td>
                ) : compare ? (
                  selectedSeasons.map((sc) => (
                    <td key={sc} className="px-4 py-2 text-right font-semibold text-[#D4AF37]">{r.seasons[sc] ?? "-"}</td>
                  ))
                ) : (
                  seasonCols.map((sc) => (
                    <td key={sc} className="px-4 py-2 text-right text-[#D4AF37]/70">{r.seasons[sc] ?? "-"}</td>
                  ))
                )}
              </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Bar chart (compare mode) */}
      {compare && mode === "Season" && barData.length > 0 && (
        <div>
          <h3 className="mb-2 text-sm font-semibold text-white/60">Season Comparison (normalised)</h3>
          <div className="overflow-x-auto">
            <div style={{ width: Math.max(700, barData.length * 90) }}>
              <StatsBarChart
                data={barData}
                bars={selectedSeasons.map((sc, i) => ({
                  key: sc,
                  color: COMPARE_COLORS[i],
                  name: sc,
                }))}
                xKey="metric"
                height={380}
                normalise
              />
            </div>
          </div>
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
  const categories = useMemo(() => categoriseMetrics(metrics), [metrics]);

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

  // Non-season numeric columns for chart
  const chartCols = useMemo(() => {
    return metrics
      .filter((m) => !m.key.startsWith("Season ") && !m.isPercentage)
      .map((m) => m.key)
      .slice(0, 8);
  }, [metrics]);

  const ALL_SEASONS = ["S1", "S2", "S3", "S4", "S5", "S6"] as const;

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

  // Season appearances for single circuit (S1–S6, boolean)
  const seasonAppearances = useMemo(() => {
    if (!singleCircuit) return [];
    return ALL_SEASONS.map((label) => ({
      label,
      appeared: (singleCircuit.metrics[`Season ${label.slice(1)}`] ?? 0) > 0,
    }));
  }, [singleCircuit]);

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
          className={`rounded-lg px-3 py-2 text-sm font-semibold transition ${
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

      {/* ---- SINGLE CIRCUIT: All stats in categorised groups ---- */}
      {singleCircuit && (
        <div className="space-y-3">
          {/* Podium placements (special non-metric fields) */}
          {[
            { key: "Winners", label: "Winners", border: "border-[#D4AF37]/30", bg: "bg-[#D4AF37]/10", text: "text-[#D4AF37]/60" },
            { key: "2nd Place", label: "2nd Place", border: "border-[#C0C0C0]/30", bg: "bg-[#C0C0C0]/10", text: "text-[#C0C0C0]/60" },
            { key: "3rd Place", label: "3rd Place", border: "border-[#CD7F32]/30", bg: "bg-[#CD7F32]/10", text: "text-[#CD7F32]/60" },
          ].map(({ key, label, border, bg, text }) =>
            singleCircuit.raw[key] ? (
              <div key={key} className={`rounded-xl border ${border} ${bg} px-4 py-3`}>
                <p className={`text-sm font-semibold uppercase tracking-wider ${text}`}>{label}</p>
                <p className="mt-1 text-sm font-semibold text-white">{singleCircuit.raw[key]}</p>
              </div>
            ) : null,
          )}

          {categories.map((cat, catIdx) => (
            <CategoryGroup
              key={cat.id}
              category={cat}
              defaultOpen={catIdx < DEFAULT_OPEN_CATEGORIES}
            >
              <div className="grid grid-cols-1 gap-x-6 sm:grid-cols-2 lg:grid-cols-3">
                {cat.metrics.map((m) => (
                  <StatRow
                    key={m.key}
                    label={m.label}
                    value={singleCircuit.metrics[m.key]}
                    isPct={m.isPercentage}
                    tooltip={m.tooltip}
                  />
                ))}
              </div>
            </CategoryGroup>
          ))}

          {/* Season appearances timeline */}
          {seasonAppearances.length > 0 && (
            <div>
              <h3 className="mb-3 text-sm font-semibold text-white/60">Season Appearances</h3>
              <div className="rounded-xl border border-white/10 bg-white/[0.03] px-5 py-4">
                <div className="flex items-center justify-between gap-2">
                  {seasonAppearances.map(({ label, appeared }) => (
                    <div key={label} className="flex flex-col items-center gap-2">
                      <div
                        className={`flex h-10 w-10 items-center justify-center rounded-full border-2 transition-all ${
                          appeared
                            ? "border-[#7020B0] bg-[#7020B0]/20 shadow-[0_0_12px_rgba(112,32,176,0.4)]"
                            : "border-white/10 bg-white/[0.03]"
                        }`}
                      >
                        {appeared && (
                          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5 text-[#7020B0]">
                            <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clipRule="evenodd" />
                          </svg>
                        )}
                      </div>
                      <span className={`text-xs font-semibold tracking-wider ${appeared ? "text-white" : "text-white/30"}`}>
                        {label}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ---- COMPARE MODE ---- */}
      {compare && selectedRows.length > 1 && (
        <div className="space-y-3">
          {categories.map((cat, catIdx) => (
            <CategoryGroup
              key={cat.id}
              category={cat}
              defaultOpen={catIdx < DEFAULT_OPEN_CATEGORIES}
            >
              <div className="overflow-x-auto -mx-4">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-white/10">
                      <th className="px-4 py-2 text-left text-sm font-semibold uppercase tracking-wider text-white/40">
                        Metric
                      </th>
                      {selectedRows.map((cr, i) => (
                        <th
                          key={cr.circuit}
                          className="px-4 py-2 text-right text-sm font-semibold uppercase tracking-wider"
                          style={{ color: COMPARE_COLORS[i] }}
                        >
                          {cr.circuit}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {cat.metrics.map((m) => (
                      <tr key={m.key} className="border-b border-white/5">
                        <td className="px-4 py-1.5 text-sm text-white/60">
                          {m.tooltip ? (
                            <MetricTooltip text={m.tooltip}>
                              <span>{m.label}</span>
                            </MetricTooltip>
                          ) : m.label}
                        </td>
                        {selectedRows.map((cr) => (
                          <td key={cr.circuit} className="px-4 py-1.5 text-right text-sm font-semibold text-[#D4AF37] tabular-nums">
                            {fmtVal(cr.metrics[m.key], m.isPercentage)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CategoryGroup>
          ))}

          {/* Compare bar chart */}
          {barData.length > 0 && (
            <div>
              <h3 className="mb-2 text-sm font-semibold text-white/60">Comparison (normalised)</h3>
              <div className="overflow-x-auto">
                <div style={{ width: Math.max(700, barData.length * 90) }}>
                  <StatsBarChart
                    data={barData}
                    bars={selectedRows.map((cr, i) => ({
                      key: cr.circuit,
                      color: COMPARE_COLORS[i],
                      name: cr.circuit,
                    }))}
                    xKey="metric"
                    normalise
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Section: RANKINGS                                                  */
/* ------------------------------------------------------------------ */

/** Metrics where ascending sort (lower value = rank 1) is the natural default */
const ASCENDING_STATS = new Set([
  "avg. final position",
  "avg. grid position",
  "avg. grid position*",
  "avg. final positions - dry",
  "avg. final positions - dry*",
  "avg. final positions - rain",
  "avg. final positions - rain*",
  "avg. final positions - changing weather",
  "best final position",
  "best grid position",
  "lowest final position",
  "lowest grid position",
  "dnf",
  "dns",
  "dsq",
  "avg. position changes per race",
]);

/** Common team column names (case-insensitive) */
const TEAM_COL_NAMES = ["team", "constructor", "team_name", "constructors"];

function findTeamCol(headers: string[]): string | null {
  for (const h of headers) {
    if (TEAM_COL_NAMES.includes(h.toLowerCase().trim())) return h;
  }
  return null;
}

function RankingsSection({
  allTime,
  bySeason,
  onSelectDriver,
}: {
  allTime: { rows: DriverStatRow[]; headers: string[] };
  bySeason: Record<string, { rows: DriverStatRow[]; headers: string[] }>;
  onSelectDriver?: (driverName: string) => void;
}) {
  /* ---------- Season helpers ---------- */
  const defaultSeason = useMemo(() => {
    const keys = Object.keys(bySeason).sort((a, b) => {
      const numA = parseInt(a.replace(/\D/g, ""), 10) || 0;
      const numB = parseInt(b.replace(/\D/g, ""), 10) || 0;
      return numB - numA;
    });
    return keys[0] || "S1";
  }, [bySeason]);

  const availableSeasons = useMemo(
    () =>
      Object.keys(bySeason)
        .filter((k) => (bySeason[k]?.rows.length ?? 0) > 0)
        .sort((a, b) => {
          const numA = parseInt(a.replace(/\D/g, ""), 10) || 0;
          const numB = parseInt(b.replace(/\D/g, ""), 10) || 0;
          return numB - numA;
        }),
    [bySeason],
  );

  /* ---------- State ---------- */
  const [mode, setMode] = useState<"All-time" | "Season">("All-time");
  const [season, setSeason] = useState<string>(defaultSeason);
  const [selectedStat, setSelectedStat] = useState<string>("");
  const [sortAsc, setSortAsc] = useState<boolean | null>(null); // null = use default

  /* ---------- Dataset & metrics ---------- */
  const dataset = mode === "All-time" ? allTime : (bySeason[season] ?? { rows: [], headers: [] });
  const metrics = useMemo(() => detectMetrics(dataset.rows), [dataset.rows]);
  const teamCol = useMemo(() => findTeamCol(dataset.headers), [dataset.headers]);

  // Reset selected stat when dataset changes and current stat is not available
  useEffect(() => {
    if (metrics.length > 0 && !metrics.find((m) => m.key === selectedStat)) {
      // Default to "Total Points" if available, otherwise first metric
      const defaultKey =
        metrics.find((m) => m.key.toLowerCase().includes("total points"))?.key ??
        metrics[0].key;
      setSelectedStat(defaultKey);
      setSortAsc(null);
    }
  }, [metrics, selectedStat]);

  const currentMetric = metrics.find((m) => m.key === selectedStat);

  // Determine sort direction: user override → default per-stat
  const isAscending =
    sortAsc !== null
      ? sortAsc
      : ASCENDING_STATS.has(selectedStat.toLowerCase().trim());

  /* ---------- Label ↔ key mappings for the dropdown ---------- */
  const metricOptions = useMemo(() => metrics.map((m) => m.label), [metrics]);
  const labelToKey = useMemo(() => {
    const map: Record<string, string> = {};
    for (const m of metrics) map[m.label] = m.key;
    return map;
  }, [metrics]);

  /* ---------- Ranked data ---------- */
  const ranked = useMemo(() => {
    if (!selectedStat || dataset.rows.length === 0) return [];

    return dataset.rows
      .filter((r) => r.metrics[selectedStat] !== undefined)
      .sort((a, b) => {
        const va = a.metrics[selectedStat] ?? 0;
        const vb = b.metrics[selectedStat] ?? 0;
        if (va !== vb) return isAscending ? va - vb : vb - va;
        // Stable tie: sort alphabetically by driver name
        return a.driver_name.localeCompare(b.driver_name);
      })
      .map((r, i) => ({
        rank: i + 1,
        driverName: r.driver_name,
        team: teamCol ? (r.raw[teamCol] ?? "").trim() || "-" : null,
        value: r.metrics[selectedStat],
        isPct: currentMetric?.isPercentage ?? false,
      }));
  }, [dataset.rows, selectedStat, isAscending, teamCol, currentMetric]);

  /* ---------- Empty state ---------- */
  if (dataset.rows.length === 0) {
    return (
      <EmptyState
        message={`No driver stats available${mode === "Season" ? ` for ${season}` : ""}.`}
      />
    );
  }

  /* ---------- Render ---------- */
  return (
    <div className="space-y-6">
      {/* Controls row */}
      <div className="flex flex-wrap items-center gap-3">
        <Toggle
          options={["All-time", "Season"]}
          value={mode}
          onChange={(v) => {
            setMode(v as "All-time" | "Season");
            setSortAsc(null);
          }}
        />
        {mode === "Season" && (
          <select
            value={season}
            onChange={(e) => setSeason(e.target.value)}
            className="rounded-lg border-2 border-[#7020B0] bg-white/5 px-3 py-2 text-sm text-white outline-none"
          >
            {availableSeasons.map((k) => (
              <option key={k} value={k} className="bg-[#1a1a24]">
                Season {k.replace("S", "")}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* Stat selector + sort toggle */}
      <div className="flex flex-wrap items-end gap-3">
        <div className="w-full max-w-sm">
          <label className="mb-1 block text-sm font-semibold uppercase tracking-wider text-white/50">
            Stat
          </label>
          <SearchableSelect
            options={metricOptions}
            value={currentMetric?.label ?? ""}
            onChange={(v) => {
              const key = labelToKey[v as string];
              if (key) {
                setSelectedStat(key);
                setSortAsc(null); // reset to default direction
              }
            }}
            placeholder="Select a stat…"
          />
        </div>
        <button
          onClick={() => setSortAsc(!isAscending)}
          className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm font-semibold text-white/60 transition hover:border-white/20 hover:text-white"
          title={
            isAscending
              ? "Sorted ascending (lowest first)"
              : "Sorted descending (highest first)"
          }
        >
          {isAscending ? "↑ Lowest first" : "↓ Highest first"}
        </button>
      </div>

      {/* Metric tooltip */}
      {currentMetric && currentMetric.tooltip !== currentMetric.key && (
        <p className="text-sm text-white/40 -mt-3">{currentMetric.tooltip}</p>
      )}

      {/* Rankings table */}
      {ranked.length > 0 ? (
        <div className="overflow-x-auto rounded-xl border border-white/10">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10 bg-white/5">
                <th className="w-16 px-4 py-3 text-center text-sm font-semibold uppercase tracking-wider text-white/40">
                  #
                </th>
                <th className="px-4 py-3 text-left text-sm font-semibold uppercase tracking-wider text-white/40">
                  Driver
                </th>
                {ranked[0]?.team !== null && (
                  <th className="px-4 py-3 text-left text-sm font-semibold uppercase tracking-wider text-white/40">
                    Team
                  </th>
                )}
                <th className="px-4 py-3 text-right text-sm font-semibold uppercase tracking-wider text-[#D4AF37]">
                  {currentMetric?.label ?? selectedStat}
                </th>
              </tr>
            </thead>
            <tbody>
              {ranked.map((r) => {
                const isGold = r.rank === 1;
                const isSilver = r.rank === 2;
                const isBronze = r.rank === 3;

                return (
                  <tr
                    key={r.driverName}
                    className={`border-b border-white/5 transition hover:bg-white/[0.03] ${
                      isGold
                        ? "bg-[#D4AF37]/[0.06]"
                        : isSilver
                          ? "bg-white/[0.03]"
                          : isBronze
                            ? "bg-[#CD7F32]/[0.04]"
                            : ""
                    }`}
                  >
                    {/* Rank badge */}
                    <td className="px-4 py-2.5 text-center">
                      <span
                        className={`inline-flex h-7 w-7 items-center justify-center rounded-full text-sm font-bold ${
                          isGold
                            ? "bg-[#D4AF37]/20 text-[#D4AF37]"
                            : isSilver
                              ? "bg-white/10 text-white/80"
                              : isBronze
                                ? "bg-[#CD7F32]/20 text-[#CD7F32]"
                                : "text-white/40"
                        }`}
                      >
                        {r.rank}
                      </span>
                    </td>

                    {/* Driver name (clickable) */}
                    <td className="px-4 py-2.5">
                      {onSelectDriver ? (
                        <button
                          type="button"
                          onClick={() => onSelectDriver(r.driverName)}
                          className="font-semibold text-white transition hover:text-[#D4AF37]"
                        >
                          {r.driverName}
                        </button>
                      ) : (
                        <span className="font-semibold text-white">
                          {r.driverName}
                        </span>
                      )}
                    </td>

                    {/* Team */}
                    {r.team !== null && (
                      <td className="px-4 py-2.5 text-white/50">{r.team}</td>
                    )}

                    {/* Stat value */}
                    <td className="px-4 py-2.5 text-right font-bold tabular-nums text-[#D4AF37]">
                      {fmtVal(r.value, r.isPct)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        selectedStat && (
          <EmptyState message="No drivers have data for this metric." />
        )
      )}

      {/* Summary footnote */}
      {ranked.length > 0 && (
        <p className="text-sm text-white/30">
          {ranked.length} driver{ranked.length !== 1 ? "s" : ""} ranked
          {mode === "Season" ? ` · Season ${season.replace("S", "")}` : " · All-time"}
          {currentMetric?.isPercentage ? " · Values shown as %" : ""}
        </p>
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

  // Override driver — set when clicking a driver name in Rankings
  const [overrideDriver, setOverrideDriver] = useState<string | undefined>(
    undefined,
  );

  const handleSelectDriverFromRanking = useCallback((driverName: string) => {
    setOverrideDriver(driverName);
    setTab("Drivers");
  }, []);

  // Effective initial driver: override takes precedence over URL param
  const effectiveDriver = overrideDriver ?? initialDriver;

  return (
    <div className="space-y-8">
      {/* Tab bar */}
      <div className="flex justify-center">
        <TabBar tabs={TABS} active={tab} onChange={(t) => setTab(t as Tab)} />
      </div>

      {/* Content */}
      {tab === "Drivers" && (
        <DriversSection
          key={effectiveDriver ?? "default"}
          allTime={data.driversAllTime}
          bySeason={data.driversBySeason}
          initialDriver={effectiveDriver}
        />
      )}
      {tab === "League" && <LeagueSection league={data.league} />}
      {tab === "Circuits" && (
        <CircuitsSection circuits={data.circuits} />
      )}
      {tab === "Rankings" && (
        <RankingsSection
          allTime={data.driversAllTime}
          bySeason={data.driversBySeason}
          onSelectDriver={handleSelectDriverFromRanking}
        />
      )}
    </div>
  );
}
