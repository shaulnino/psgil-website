"use client";

import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import StatsFilterPills from "@/components/stats/StatsFilterPills";
import {
  DRIVER_STAT_TAB_ORDER,
  groupMetricsByDriverTab,
  resolveHeroMetrics,
  pickMetricKeyForPreset,
  RANKINGS_QUICK_PRESETS,
  type DriverStatTabId,
} from "@/lib/statsMetricRegistry";
import {
  BarChart,
  Bar,
  Cell,
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
  LineChart,
  Line,
  CartesianGrid,
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
import type { RaceResultRow } from "@/lib/resultsData";
import type { RaceEvent } from "@/lib/scheduleData";
import type { Reward } from "@/lib/rewardsData";
import type { SeasonConfig } from "@/lib/seasonConfig";
import { computeDriverStats } from "@/lib/statsComputed";
import type { StatsFilters } from "@/lib/statsComputed";
import RaceResultsTable from "@/components/RaceResultsTable";
import {
  buildDriverIndex,
  getDriverNames,
  buildEventMeta,
  getFilterOptions,
  computeH2H,
} from "@/lib/h2h";
import type { H2HRaceRow } from "@/lib/h2h";

/* ------------------------------------------------------------------ */
/*  Props                                                              */
/* ------------------------------------------------------------------ */

type StatsData = {
  driversAllTime: { rows: DriverStatRow[]; headers: string[] };
  driversBySeason: Record<string, { rows: DriverStatRow[]; headers: string[] }>;
  league: LeagueStatRow[];
  circuits: { rows: CircuitStatRow[]; headers: string[] };
};

type Props = {
  data: StatsData;
  raceResults?: Record<string, RaceResultRow[]>;
  events?: RaceEvent[];
  /** Passed from server for client-side filter computation */
  seasons?: SeasonConfig[];
  rewards?: Reward[];
};

/* ------------------------------------------------------------------ */
/*  Constants & helpers                                                 */
/* ------------------------------------------------------------------ */

const TABS = ["Drivers", "League", "Circuits", "Head-to-Head", "Rankings"] as const;
type Tab = (typeof TABS)[number];

const COMPARE_COLORS = ["#7020B0", "#D4AF37", "#22d3ee", "#f472b6"];
const SINGLE_COLOR = "#7020B0";

function parseNum(v: string): number | null {
  if (!v || v === "-" || v === "N/A") return null;
  const n = Number(v.replace(/%/g, "").replace(/,/g, "").trim());
  return isNaN(n) ? null : n;
}

function isLowerBetterMetric(metricLabel: string): boolean {
  const s = metricLabel.toLowerCase().replace(/\s+/g, " ").trim();

  // Explicit overrides from competition rules:
  // these are cumulative/achievement metrics where higher always wins.
  if (
    s.includes("top 10 finishes") ||
    s.includes("top 5 finishes") ||
    s.includes("top 3 finishes %") ||
    s.includes("position changes") ||
    s.includes("avg. position changes per race") ||
    s.includes("pole positions")
  ) {
    return false;
  }

  // Reliability penalties where lower is better.
  if (s === "dnf" || s === "dns" || s === "dsq") {
    return true;
  }

  return (
    s.includes("position") ||
    s.includes("grid") ||
    s.includes("finish") ||
    s.includes("rank") ||
    s.includes("time") ||
    s.includes("gap") ||
    s.includes("penalty")
  );
}

function getDriverParticipationCount(row: DriverStatRow): number {
  const entries = Object.entries(row.metrics).filter(
    ([key, val]) => Number.isFinite(val) && !key.includes("%"),
  );
  const raceEvents = entries.find(([key]) =>
    key.trim().toLowerCase() === "race events",
  );
  if (raceEvents) return raceEvents[1];

  const participationLike = entries
    .filter(([key]) => /participation|race events?|events participated|races participated/i.test(key))
    .map(([, val]) => val);
  if (participationLike.length > 0) return Math.max(...participationLike);

  return 0;
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
    <div className="overflow-x-auto pb-1 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
      <div className="inline-flex min-w-max snap-x snap-mandatory gap-1 rounded-xl bg-white/5 p-1">
        {tabs.map((t) => (
          <button
            key={t}
            onClick={() => onChange(t)}
            className={`shrink-0 snap-start rounded-lg px-3 py-2 text-xs font-semibold transition sm:px-4 sm:text-sm ${
              active === t
                ? "bg-[#7020B0] text-white shadow"
                : "text-white/60 hover:bg-white/5 hover:text-white"
            }`}
          >
            {t}
          </button>
        ))}
      </div>
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
  open,
  onToggle,
  children,
}: {
  category: MetricCategory;
  defaultOpen?: boolean;
  open?: boolean;
  onToggle?: () => void;
  children: React.ReactNode;
}) {
  const [internalOpen, setInternalOpen] = useState(defaultOpen);
  const isOpen = open ?? internalOpen;
  const handleToggle = () => {
    onToggle?.();
    if (open === undefined) setInternalOpen((v) => !v);
  };

  return (
    <div className="rounded-xl border border-white/10 overflow-hidden">
      <button
        type="button"
        onClick={handleToggle}
        className="flex w-full items-center justify-between gap-2 bg-[#7020B0]/80 px-4 py-3 text-left transition hover:bg-[#7020B0]"
      >
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-white">{category.label}</span>
          <span className="rounded-full bg-white/20 px-2 py-0.5 text-sm font-medium text-white/70">
            {category.metrics.length}
          </span>
        </div>
        <svg
          className={`h-4 w-4 shrink-0 text-white/70 transition-transform ${isOpen ? "rotate-180" : ""}`}
          fill="none" stroke="currentColor" viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {isOpen && <div className="border-t border-[#7020B0]/30 bg-white/[0.02] px-4 py-3">{children}</div>}
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

function StatHeroCard({
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
    <div className="rounded-xl border border-white/10 bg-gradient-to-br from-[#7020B0]/25 via-white/[0.04] to-transparent px-4 py-3 shadow-inner">
      <div className="text-[10px] font-bold uppercase tracking-wider text-white/45">
        {tooltip ? (
          <MetricTooltip text={tooltip}>
            <span>{label}</span>
          </MetricTooltip>
        ) : (
          label
        )}
      </div>
      <div className="mt-1.5 text-xl font-extrabold tabular-nums tracking-tight text-[#D4AF37] sm:text-2xl">
        {fmtVal(value, isPct)}
      </div>
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
  leaderAware = false,
  isLowerBetter = () => false,
}: {
  data: Record<string, string | number>[];
  bars: { key: string; color: string; name: string }[];
  xKey: string;
  height?: number;
  /** Normalise each metric row to 0-100% of max so disparate scales become comparable */
  normalise?: boolean;
  /** Hide the built-in Recharts legend (useful when rendering a separate sticky legend) */
  hideLegend?: boolean;
  /** Dim non-leading bars per metric row for quicker visual comparison */
  leaderAware?: boolean;
  /** Metric direction callback used by leaderAware */
  isLowerBetter?: (metricLabel: string) => boolean;
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

  const leadersByRow = useMemo(() => {
    return actualData.map((row) => {
      const label = String(row[xKey] ?? "");
      const values = bars
        .map((b) => {
          const raw = row[b.key];
          const v = typeof raw === "number" ? raw : Number(raw ?? 0);
          return { key: b.key, value: Number.isFinite(v) ? v : null };
        })
        .filter((x): x is { key: string; value: number } => x.value !== null);
      if (values.length === 0) return new Set<string>();
      const target = isLowerBetter(label)
        ? Math.min(...values.map((v) => v.value))
        : Math.max(...values.map((v) => v.value));
      return new Set(values.filter((v) => v.value === target).map((v) => v.key));
    });
  }, [actualData, bars, xKey, isLowerBetter]);

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
            >
              {chartData.map((_, idx) => {
                const isLeader = leadersByRow[idx]?.has(b.key) ?? false;
                return (
                  <Cell
                    key={`${b.key}-${idx}`}
                    fill={b.color}
                    fillOpacity={
                      leaderAware
                        ? isLeader
                          ? 1
                          : 0.28
                        : 1
                    }
                    stroke={leaderAware && isLeader ? "rgba(255,255,255,0.45)" : "none"}
                    strokeWidth={leaderAware && isLeader ? 1 : 0}
                  />
                );
              })}
            </Bar>
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function StatsRadarChart({
  data,
  subjects,
  height = 420,
}: {
  data: { subject: string; [key: string]: string | number }[];
  subjects: { key: string; color: string; name: string }[];
  height?: number;
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
      <ResponsiveContainer width="100%" height={height}>
        <RadarChart cx="50%" cy="50%" outerRadius="72%" data={data}>
          <PolarGrid stroke={CHART_THEME.grid} />
          <PolarAngleAxis
            dataKey="subject"
            tick={{ fill: "#D4AF37", fontSize: 12, fontWeight: 600 }}
          />
          <PolarRadiusAxis
            angle={90}
            tick={{ fill: "#fff", fontSize: 10 }}
            axisLine={false}
            domain={[0, 110]}
            ticks={[0, 25, 50, 75, 100] as any}
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

const DRIVER_CUM_METRICS = [
  { key: "points", label: "Points (Cumulative)" },
  { key: "wins", label: "Wins (Cumulative)" },
  { key: "podiums", label: "Podiums (Cumulative)" },
  { key: "top5", label: "Top 5 (Cumulative)" },
  { key: "top10", label: "Top 10 (Cumulative)" },
  { key: "poles", label: "Poles (Cumulative)" },
  { key: "fastestLaps", label: "Fastest Laps (Cumulative)" },
  { key: "dotd", label: "DOTD (Cumulative)" },
  { key: "dnfs", label: "DNFs (Cumulative)" },
  { key: "finished", label: "Races Finished (Cumulative)" },
  { key: "avgFinish", label: "Avg Finish (Running)" },
  { key: "avgGrid", label: "Avg Grid (Running)" },
  { key: "avgPoints", label: "Avg Points (Running)" },
] as const;

type DriverCumMetricKey = (typeof DRIVER_CUM_METRICS)[number]["key"];

type DriverRacePoint = {
  eventId: string;
  raceName: string;
  date: string;
  seasonKey: string;
  points: number;
  finish: number | null;
  grid: number | null;
  status: string;
  fastestLap: string;
  dotd: string;
};

function toSeasonKey(raw: string): string {
  const s = (raw ?? "").trim();
  if (!s) return "";
  return s.startsWith("S") || s.startsWith("s") ? s.toUpperCase() : `S${s}`;
}

function normalizeDriverName(raw: string): string {
  return (raw ?? "").trim().toLowerCase().replace(/\s+/g, " ");
}

function parseDateMaybe(value: string): number {
  const s = (value ?? "").trim();
  const m = s.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  if (!m) return Number.NaN;
  const d = parseInt(m[1], 10);
  const mo = parseInt(m[2], 10) - 1;
  const y = parseInt(m[3], 10);
  return new Date(y, mo, d).getTime();
}

function isDnfStatus(st: string): boolean {
  const s = (st ?? "").trim().toLowerCase();
  return s === "dnf" || s === "dns" || s === "dsq" || s === "retired";
}

function DriverCumulativeChart({
  driverName,
  raceResults,
  events,
  mode,
  seasonKey,
}: {
  driverName: string;
  raceResults: Record<string, RaceResultRow[]>;
  events: RaceEvent[];
  mode: "All-time" | "Season";
  seasonKey: string;
}) {
  const [metric, setMetric] = useState<DriverCumMetricKey>("points");
  const [raceCount, setRaceCount] = useState<number>(0);

  const eventMap = useMemo(() => {
    const map = new Map<
      string,
      { raceName: string; date: string; seasonKey: string }
    >();
    for (const e of events) {
      map.set(e.event_id, {
        raceName: e.race_name || e.event_id,
        date: e.date || "",
        seasonKey: toSeasonKey(e.season),
      });
    }
    return map;
  }, [events]);

  const allDriverRaces = useMemo(() => {
    const target = normalizeDriverName(driverName);
    const rows: DriverRacePoint[] = [];
    for (const [eventId, list] of Object.entries(raceResults)) {
      const row = list.find(
        (r) => normalizeDriverName(r.driver_name ?? "") === target,
      );
      if (!row) continue;
      const meta = eventMap.get(eventId);
      const finish = parseNum(row.position);
      const grid = parseNum(row.grid);
      const points = parseNum(row.points) ?? 0;
      const seasonFromId = eventId.match(/^s(\d+)/i)?.[1];
      rows.push({
        eventId,
        raceName: meta?.raceName ?? eventId,
        date: meta?.date ?? "",
        seasonKey: meta?.seasonKey ?? (seasonFromId ? `S${seasonFromId}` : ""),
        points,
        finish,
        grid,
        status: row.status ?? "",
        fastestLap: row.fastest_lap ?? "",
        dotd: row.dotd ?? "",
      });
    }
    rows.sort((a, b) => {
      const ta = parseDateMaybe(a.date);
      const tb = parseDateMaybe(b.date);
      if (Number.isFinite(ta) && Number.isFinite(tb) && ta !== tb) return ta - tb;
      return a.eventId.localeCompare(b.eventId);
    });
    return rows;
  }, [raceResults, eventMap, driverName]);

  const driverRaces = useMemo(() => {
    if (mode !== "Season") return allDriverRaces;
    return allDriverRaces.filter((r) => r.seasonKey === seasonKey);
  }, [allDriverRaces, mode, seasonKey]);

  const chartData = useMemo(() => {
    if (driverRaces.length === 0) return [];
    const sliced = raceCount > 0 ? driverRaces.slice(-raceCount) : driverRaces;

    const acc = {
      races: 0,
      points: 0,
      wins: 0,
      podiums: 0,
      top5: 0,
      top10: 0,
      poles: 0,
      fastestLaps: 0,
      dotd: 0,
      dnfs: 0,
      finished: 0,
      finishSum: 0,
      finishCount: 0,
      gridSum: 0,
      gridCount: 0,
    };

    const consume = (r: DriverRacePoint) => {
      acc.races += 1;
      acc.points += r.points;
      if (r.finish === 1) acc.wins += 1;
      if (r.finish !== null && r.finish <= 3) acc.podiums += 1;
      if (r.finish !== null && r.finish <= 5) acc.top5 += 1;
      if (r.finish !== null && r.finish <= 10) acc.top10 += 1;
      if (r.grid === 1) acc.poles += 1;
      const fl = r.fastestLap.trim().toLowerCase();
      if (fl === "yes" || fl === "1" || fl === "true") acc.fastestLaps += 1;
      const d = r.dotd.trim().toLowerCase();
      if (d === "yes" || d === "1" || d === "true") acc.dotd += 1;
      if (isDnfStatus(r.status)) acc.dnfs += 1;
      else acc.finished += 1;
      if (r.finish !== null) {
        acc.finishSum += r.finish;
        acc.finishCount += 1;
      }
      if (r.grid !== null) {
        acc.gridSum += r.grid;
        acc.gridCount += 1;
      }
    };

    return sliced.map((r) => {
      consume(r);
      let value: number | null = null;
      switch (metric) {
        case "points":
          value = acc.points;
          break;
        case "wins":
          value = acc.wins;
          break;
        case "podiums":
          value = acc.podiums;
          break;
        case "top5":
          value = acc.top5;
          break;
        case "top10":
          value = acc.top10;
          break;
        case "poles":
          value = acc.poles;
          break;
        case "fastestLaps":
          value = acc.fastestLaps;
          break;
        case "dotd":
          value = acc.dotd;
          break;
        case "dnfs":
          value = acc.dnfs;
          break;
        case "finished":
          value = acc.finished;
          break;
        case "avgFinish":
          value = acc.finishCount > 0 ? acc.finishSum / acc.finishCount : null;
          break;
        case "avgGrid":
          value = acc.gridCount > 0 ? acc.gridSum / acc.gridCount : null;
          break;
        case "avgPoints":
          value = acc.races > 0 ? acc.points / acc.races : null;
          break;
      }
      return {
        name: r.seasonKey ? `${r.raceName} (${r.seasonKey})` : r.raceName,
        value,
      };
    });
  }, [driverRaces, metric, raceCount]);

  const metricOptions = DRIVER_CUM_METRICS.map((m) => m.label);
  const selectedMetricLabel =
    DRIVER_CUM_METRICS.find((m) => m.key === metric)?.label ?? metric;

  return (
    <div className="space-y-4 rounded-xl border border-white/10 bg-white/[0.02] p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-white/60">Driver Cumulative Trend</h3>
        <div className="flex gap-1 rounded-lg bg-white/5 p-0.5">
          {[5, 10, 15, 0].map((n) => (
            <button
              key={n}
              onClick={() => setRaceCount(n)}
              className={`rounded-md px-2.5 py-1 text-xs font-semibold transition ${
                raceCount === n
                  ? "bg-[#7020B0] text-white shadow"
                  : "text-white/50 hover:text-white/80"
              }`}
            >
              {n === 0 ? "All" : `Last ${n}`}
            </button>
          ))}
        </div>
      </div>

      <div className="max-w-sm">
        <SearchableSelect
          options={metricOptions}
          value={selectedMetricLabel}
          onChange={(v) => {
            const label = String(v);
            const found = DRIVER_CUM_METRICS.find((m) => m.label === label);
            if (found) setMetric(found.key);
          }}
          placeholder="Select metric…"
        />
      </div>

      {chartData.length === 0 ? (
        <div className="flex h-48 items-center justify-center rounded-xl border border-white/10 bg-white/[0.02]">
          <p className="text-sm text-white/40">
            No race-by-race data available for this driver in the current filter.
          </p>
        </div>
      ) : (
        <div className="h-72">
          <ResponsiveContainer width="100%" height={288}>
            <LineChart data={chartData} margin={{ top: 8, right: 12, bottom: 4, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
              <XAxis
                dataKey="name"
                tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 10 }}
                axisLine={{ stroke: "rgba(255,255,255,0.1)" }}
                tickLine={false}
                interval="preserveStartEnd"
                angle={-18}
                textAnchor="end"
                height={56}
              />
              <YAxis
                tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 10 }}
                axisLine={{ stroke: "rgba(255,255,255,0.1)" }}
                tickLine={false}
                width={40}
              />
              <Tooltip
                contentStyle={{
                  background: "#1a1a24",
                  border: "1px solid rgba(255,255,255,0.1)",
                  borderRadius: 8,
                  fontSize: 12,
                  color: "#fff",
                }}
                labelStyle={{ color: "rgba(255,255,255,0.5)", marginBottom: 4 }}
              />
              <Line
                type="monotone"
                dataKey="value"
                name={selectedMetricLabel}
                stroke="#7020B0"
                strokeWidth={2.5}
                dot={{ r: 3, fill: "#7020B0" }}
                activeDot={{ r: 5 }}
                connectNulls
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

function DriverCompareCumulativeChart({
  driverNames,
  raceResults,
  events,
  mode,
  seasonKey,
}: {
  driverNames: string[];
  raceResults: Record<string, RaceResultRow[]>;
  events: RaceEvent[];
  mode: "All-time" | "Season";
  seasonKey: string;
}) {
  const [metric, setMetric] = useState<DriverCumMetricKey>("points");
  const [raceCount, setRaceCount] = useState<number>(0);

  const eventMap = useMemo(() => {
    const map = new Map<
      string,
      { raceName: string; date: string; seasonKey: string }
    >();
    for (const e of events) {
      map.set(e.event_id, {
        raceName: e.race_name || e.event_id,
        date: e.date || "",
        seasonKey: toSeasonKey(e.season),
      });
    }
    return map;
  }, [events]);

  const rowsByDriver = useMemo(() => {
    const out = new Map<string, Map<string, DriverRacePoint>>();
    for (const name of driverNames) {
      const target = normalizeDriverName(name);
      const map = new Map<string, DriverRacePoint>();
      for (const [eventId, list] of Object.entries(raceResults)) {
        const row = list.find(
          (r) => normalizeDriverName(r.driver_name ?? "") === target,
        );
        if (!row) continue;
        const meta = eventMap.get(eventId);
        const seasonFromId = eventId.match(/^s(\d+)/i)?.[1];
        map.set(eventId, {
          eventId,
          raceName: meta?.raceName ?? eventId,
          date: meta?.date ?? "",
          seasonKey: meta?.seasonKey ?? (seasonFromId ? `S${seasonFromId}` : ""),
          points: parseNum(row.points) ?? 0,
          finish: parseNum(row.position),
          grid: parseNum(row.grid),
          status: row.status ?? "",
          fastestLap: row.fastest_lap ?? "",
          dotd: row.dotd ?? "",
        });
      }
      out.set(name, map);
    }
    return out;
  }, [driverNames, raceResults, eventMap]);

  const timeline = useMemo(() => {
    const ids = new Set<string>();
    for (const map of rowsByDriver.values()) {
      for (const eid of map.keys()) ids.add(eid);
    }
    let eventsList = Array.from(ids).map((eid) => {
      const m = eventMap.get(eid);
      return {
        eventId: eid,
        raceName: m?.raceName ?? eid,
        seasonKey: m?.seasonKey ?? (eid.match(/^s(\d+)/i)?.[1] ? `S${eid.match(/^s(\d+)/i)?.[1]}` : ""),
        date: m?.date ?? "",
      };
    });
    if (mode === "Season") {
      eventsList = eventsList.filter((e) => e.seasonKey === seasonKey);
    }
    eventsList.sort((a, b) => {
      const ta = parseDateMaybe(a.date);
      const tb = parseDateMaybe(b.date);
      if (Number.isFinite(ta) && Number.isFinite(tb) && ta !== tb) return ta - tb;
      return a.eventId.localeCompare(b.eventId);
    });
    return eventsList;
  }, [rowsByDriver, eventMap, mode, seasonKey]);

  const chartData = useMemo(() => {
    if (timeline.length === 0) return [];
    const sliced = raceCount > 0 ? timeline.slice(-raceCount) : timeline;
    const before = raceCount > 0 ? timeline.slice(0, Math.max(0, timeline.length - raceCount)) : [];

    const createAcc = () => ({
      races: 0,
      points: 0,
      wins: 0,
      podiums: 0,
      top5: 0,
      top10: 0,
      poles: 0,
      fastestLaps: 0,
      dotd: 0,
      dnfs: 0,
      finished: 0,
      finishSum: 0,
      finishCount: 0,
      gridSum: 0,
      gridCount: 0,
    });

    const accByDriver = new Map<string, ReturnType<typeof createAcc>>();
    for (const n of driverNames) accByDriver.set(n, createAcc());

    const consume = (name: string, r: DriverRacePoint | undefined) => {
      if (!r) return;
      const acc = accByDriver.get(name)!;
      acc.races += 1;
      acc.points += r.points;
      if (r.finish === 1) acc.wins += 1;
      if (r.finish !== null && r.finish <= 3) acc.podiums += 1;
      if (r.finish !== null && r.finish <= 5) acc.top5 += 1;
      if (r.finish !== null && r.finish <= 10) acc.top10 += 1;
      if (r.grid === 1) acc.poles += 1;
      const fl = r.fastestLap.trim().toLowerCase();
      if (fl === "yes" || fl === "1" || fl === "true") acc.fastestLaps += 1;
      const d = r.dotd.trim().toLowerCase();
      if (d === "yes" || d === "1" || d === "true") acc.dotd += 1;
      if (isDnfStatus(r.status)) acc.dnfs += 1;
      else acc.finished += 1;
      if (r.finish !== null) {
        acc.finishSum += r.finish;
        acc.finishCount += 1;
      }
      if (r.grid !== null) {
        acc.gridSum += r.grid;
        acc.gridCount += 1;
      }
    };

    for (const ev of before) {
      for (const n of driverNames) consume(n, rowsByDriver.get(n)?.get(ev.eventId));
    }

    return sliced.map((ev) => {
      const row: Record<string, string | number | null> = {
        name: ev.seasonKey ? `${ev.raceName} (${ev.seasonKey})` : ev.raceName,
      };
      for (const n of driverNames) {
        const r = rowsByDriver.get(n)?.get(ev.eventId);
        consume(n, r);
        const acc = accByDriver.get(n)!;
        let value: number | null = null;
        switch (metric) {
          case "points": value = acc.points; break;
          case "wins": value = acc.wins; break;
          case "podiums": value = acc.podiums; break;
          case "top5": value = acc.top5; break;
          case "top10": value = acc.top10; break;
          case "poles": value = acc.poles; break;
          case "fastestLaps": value = acc.fastestLaps; break;
          case "dotd": value = acc.dotd; break;
          case "dnfs": value = acc.dnfs; break;
          case "finished": value = acc.finished; break;
          case "avgFinish": value = acc.finishCount > 0 ? acc.finishSum / acc.finishCount : null; break;
          case "avgGrid": value = acc.gridCount > 0 ? acc.gridSum / acc.gridCount : null; break;
          case "avgPoints": value = acc.races > 0 ? acc.points / acc.races : null; break;
        }
        row[n] = value;
      }
      return row;
    });
  }, [timeline, raceCount, driverNames, rowsByDriver, metric]);

  const metricOptions = DRIVER_CUM_METRICS.map((m) => m.label);
  const selectedMetricLabel =
    DRIVER_CUM_METRICS.find((m) => m.key === metric)?.label ?? metric;

  if (driverNames.length < 2) return null;

  return (
    <div className="space-y-4 rounded-xl border border-white/10 bg-white/[0.02] p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-white/60">Compare Cumulative Trend</h3>
        <div className="flex gap-1 rounded-lg bg-white/5 p-0.5">
          {[5, 10, 15, 0].map((n) => (
            <button
              key={n}
              onClick={() => setRaceCount(n)}
              className={`rounded-md px-2.5 py-1 text-xs font-semibold transition ${
                raceCount === n ? "bg-[#7020B0] text-white shadow" : "text-white/50 hover:text-white/80"
              }`}
            >
              {n === 0 ? "All" : `Last ${n}`}
            </button>
          ))}
        </div>
      </div>
      <p className="text-xs text-white/40">
        Note: this trend uses a combined race timeline (union of selected drivers&apos; races), not only shared races.
      </p>

      <div className="max-w-sm">
        <SearchableSelect
          options={metricOptions}
          value={selectedMetricLabel}
          onChange={(v) => {
            const label = String(v);
            const found = DRIVER_CUM_METRICS.find((m) => m.label === label);
            if (found) setMetric(found.key);
          }}
          placeholder="Select metric…"
        />
      </div>

      {chartData.length === 0 ? (
        <div className="flex h-48 items-center justify-center rounded-xl border border-white/10 bg-white/[0.02]">
          <p className="text-sm text-white/40">No race-by-race data available for selected drivers in the current filter.</p>
        </div>
      ) : (
        <div className="h-72">
          <ResponsiveContainer width="100%" height={288}>
            <LineChart data={chartData} margin={{ top: 8, right: 12, bottom: 4, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
              <XAxis
                dataKey="name"
                tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 10 }}
                axisLine={{ stroke: "rgba(255,255,255,0.1)" }}
                tickLine={false}
                interval="preserveStartEnd"
                angle={-18}
                textAnchor="end"
                height={56}
              />
              <YAxis
                tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 10 }}
                axisLine={{ stroke: "rgba(255,255,255,0.1)" }}
                tickLine={false}
                width={40}
              />
              <Tooltip
                contentStyle={{
                  background: "#1a1a24",
                  border: "1px solid rgba(255,255,255,0.1)",
                  borderRadius: 8,
                  fontSize: 12,
                  color: "#fff",
                }}
                labelStyle={{ color: "rgba(255,255,255,0.5)", marginBottom: 4 }}
              />
              <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
              {driverNames.map((name, i) => (
                <Line
                  key={name}
                  type="monotone"
                  dataKey={name}
                  name={name}
                  stroke={COMPARE_COLORS[i % COMPARE_COLORS.length]}
                  strokeWidth={2.5}
                  dot={{ r: 3, fill: COMPARE_COLORS[i % COMPARE_COLORS.length] }}
                  activeDot={{ r: 5 }}
                  connectNulls
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

function DriversSection({
  allTime,
  bySeason,
  raceResults = {},
  events = [],
  initialDriver,
  seasons,
  rewards,
}: {
  allTime: { rows: DriverStatRow[]; headers: string[] };
  bySeason: Record<string, { rows: DriverStatRow[]; headers: string[] }>;
  raceResults?: Record<string, RaceResultRow[]>;
  events?: RaceEvent[];
  initialDriver?: string;
  seasons?: SeasonConfig[];
  rewards?: Reward[];
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

  // ── Format / Competition / Round-type filters ──────────────────────
  const [formatFilter,      setFormatFilter]      = useState<StatsFilters["format"]>(undefined);
  const [competitionFilter, setCompetitionFilter] = useState<StatsFilters["competition"]>(undefined);
  const [roundTypeFilter,   setRoundTypeFilter]   = useState<StatsFilters["roundType"]>(undefined);
  const [driverStatTab, setDriverStatTab] = useState<DriverStatTabId>("championship");

  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const filterQueryHydrated = useRef(false);

  const anyFilterActive = !!(formatFilter || competitionFilter || roundTypeFilter);

  useEffect(() => {
    const next = new URLSearchParams(searchParams.toString());
    if (!filterQueryHydrated.current) {
      const f = next.get("format");
      if (f === "50%" || f === "25%" || f === "sprint") {
        setFormatFilter(f as StatsFilters["format"]);
      }
      const c = next.get("comp");
      if (c === "main" || c === "wild") {
        setCompetitionFilter(c as StatsFilters["competition"]);
      }
      const r = next.get("round");
      if (r === "regular" || r === "playoff") {
        setRoundTypeFilter(r as StatsFilters["roundType"]);
      }
      filterQueryHydrated.current = true;
      return;
    }
    if (formatFilter) next.set("format", formatFilter);
    else next.delete("format");
    if (competitionFilter) next.set("comp", competitionFilter);
    else next.delete("comp");
    if (roundTypeFilter) next.set("round", roundTypeFilter);
    else next.delete("round");
    const qs = next.toString();
    if (qs !== searchParams.toString()) {
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    }
  }, [
    searchParams,
    formatFilter,
    competitionFilter,
    roundTypeFilter,
    pathname,
    router,
  ]);

  // Flat race-results array for client-side computation
  const allResultsFlat = useMemo(
    () => Object.values(raceResults).flat(),
    [raceResults],
  );

  // Client-side filtered dataset — only recomputed when a filter changes
  const filteredDataset = useMemo<{ rows: DriverStatRow[]; headers: string[] } | null>(() => {
    if (!anyFilterActive) return null;
    if (!allResultsFlat.length || !events.length) return null;
    const filters: StatsFilters = {};
    if (mode === "Season") filters.season = season;
    if (formatFilter)      filters.format = formatFilter;
    if (competitionFilter) filters.competition = competitionFilter;
    if (roundTypeFilter)   filters.roundType = roundTypeFilter;
    return computeDriverStats(
      allResultsFlat,
      events,
      rewards ?? [],
      seasons ?? [],
      filters,
    );
  }, [anyFilterActive, allResultsFlat, events, mode, season, formatFilter, competitionFilter, roundTypeFilter, rewards, seasons]);

  // Pick the correct dataset: filtered > server-computed
  const serverDataset = mode === "All-time" ? allTime : (bySeason[season] ?? { rows: [], headers: [] });
  const dataset = filteredDataset ?? serverDataset;
  const driverNames = useMemo(
    () => dataset.rows.map((r) => r.driver_name).sort(),
    [dataset.rows],
  );

  const metrics = useMemo(() => detectMetrics(dataset.rows), [dataset.rows]);
  const categories = useMemo(() => categoriseMetrics(metrics), [metrics]);
  const defaultOpenCategoryIds = useMemo(
    () => new Set(categories.slice(0, DEFAULT_OPEN_CATEGORIES).map((c) => c.id)),
    [categories],
  );
  const [openCategoryIds, setOpenCategoryIds] = useState<Set<string>>(new Set());
  useEffect(() => {
    setOpenCategoryIds((prev) => {
      const valid = new Set(categories.map((c) => c.id));
      const next = new Set([...prev].filter((id) => valid.has(id)));
      if (next.size === 0) return new Set(defaultOpenCategoryIds);
      return next;
    });
  }, [categories, defaultOpenCategoryIds]);
  const allCategoriesExpanded =
    categories.length > 0 && openCategoryIds.size === categories.length;

  // Ensure selected drivers exist in the current dataset
  const validDrivers = useMemo(
    () => selectedDrivers.filter((d) => driverNames.includes(d)),
    [selectedDrivers, driverNames],
  );

  // Auto-select first driver if none selected
  useEffect(() => {
    if (validDrivers.length === 0 && driverNames.length > 0 && !compare) {
      const eligible = dataset.rows
        .filter((r) => getDriverParticipationCount(r) >= 15)
        .map((r) => r.driver_name);
      const pool = eligible.length > 0 ? eligible : driverNames;
      const random = pool[Math.floor(Math.random() * pool.length)];
      if (random) setSelectedDrivers([random]);
    }
  }, [validDrivers, driverNames, compare, dataset.rows]);

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

  const tabMetricGroups = useMemo(
    () => groupMetricsByDriverTab(metrics, availableKeys),
    [metrics, availableKeys],
  );
  const heroMetricSlots = useMemo(
    () => resolveHeroMetrics(metrics, availableKeys),
    [metrics, availableKeys],
  );

  useEffect(() => {
    if (tabMetricGroups[driverStatTab].length === 0) {
      const fb = DRIVER_STAT_TAB_ORDER.find((t) => tabMetricGroups[t.id].length > 0)?.id;
      if (fb) setDriverStatTab(fb);
    }
  }, [driverStatTab, tabMetricGroups]);

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

      <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
        <p className="mb-3 text-[10px] font-bold uppercase tracking-wider text-white/40">Segment results</p>
        <StatsFilterPills
          formatFilter={formatFilter}
          competitionFilter={competitionFilter}
          roundTypeFilter={roundTypeFilter}
          onFormat={setFormatFilter}
          onCompetition={setCompetitionFilter}
          onRoundType={setRoundTypeFilter}
          onClearAll={() => {
            setFormatFilter(undefined);
            setCompetitionFilter(undefined);
            setRoundTypeFilter(undefined);
          }}
        />
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

      {compare && categories.length > 0 && (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={() =>
              setOpenCategoryIds(
                allCategoriesExpanded
                  ? new Set()
                  : new Set(categories.map((c) => c.id)),
              )
            }
            className="rounded-md border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold text-white/70 transition hover:text-white"
          >
            {allCategoriesExpanded ? "Collapse all" : "Expand all"}
          </button>
        </div>
      )}

      {/* ---- SINGLE DRIVER: hero + sub-tabs + detail grid ---- */}
      {singleDriver && (
        <div className="space-y-5">
          <div>
            <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-white/40">Overview</p>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
              {heroMetricSlots.map(({ info, key }) => (
                <StatHeroCard
                  key={key}
                  label={info.label}
                  value={singleDriver.metrics[key]}
                  isPct={info.isPercentage}
                  tooltip={info.tooltip !== info.key ? info.tooltip : undefined}
                />
              ))}
            </div>
          </div>

          <div>
            <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-white/40">Explore</p>
            <div className="flex flex-wrap gap-1.5 rounded-xl border border-white/10 bg-white/[0.03] p-1.5">
              {DRIVER_STAT_TAB_ORDER.map((t) => {
                const count = tabMetricGroups[t.id].length;
                if (count === 0) return null;
                const active = driverStatTab === t.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setDriverStatTab(t.id)}
                    className={`rounded-lg px-3 py-2 text-xs font-semibold transition sm:text-sm ${
                      active
                        ? "bg-[#7020B0] text-white shadow"
                        : "text-white/55 hover:bg-white/5 hover:text-white"
                    }`}
                  >
                    {t.label}
                    <span
                      className={`ml-1.5 rounded-full px-1.5 py-0.5 text-[10px] ${
                        active ? "bg-white/20 text-white/90" : "bg-white/10 text-white/45"
                      }`}
                    >
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
            <div className="grid grid-cols-1 gap-x-6 gap-y-0.5 sm:grid-cols-2 lg:grid-cols-3">
              {tabMetricGroups[driverStatTab]
                .filter((m) => {
                  if (driverStatTab !== "records") return true;
                  return (singleDriver.metrics[m.key] ?? 0) > 0;
                })
                .map((m) => (
                  <StatRow
                    key={m.key}
                    label={m.label}
                    value={singleDriver.metrics[m.key]}
                    isPct={m.isPercentage}
                    tooltip={m.tooltip}
                  />
                ))}
            </div>
          </div>

          <DriverCumulativeChart
            driverName={singleDriver.driver_name}
            raceResults={raceResults}
            events={events}
            mode={mode}
            seasonKey={season}
          />
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
              open={openCategoryIds.has(cat.id)}
              onToggle={() =>
                setOpenCategoryIds((prev) => {
                  const next = new Set(prev);
                  if (next.has(cat.id)) next.delete(cat.id);
                  else next.add(cat.id);
                  return next;
                })
              }
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
                    {cat.metrics.map((m) => {
                      const numeric = selectedRows.map((dr) => ({
                        driver: dr.driver_name,
                        value: dr.metrics[m.key] ?? 0,
                      }));
                      const target = isLowerBetterMetric(m.label)
                        ? Math.min(...numeric.map((x) => x.value))
                        : Math.max(...numeric.map((x) => x.value));
                      const leaders = new Set(
                        numeric.filter((x) => x.value === target).map((x) => x.driver),
                      );
                      return (
                        <tr key={m.key} className="border-b border-white/5">
                          <td className="px-4 py-1.5 text-sm text-white/60">
                            {m.tooltip ? (
                              <MetricTooltip text={m.tooltip}>
                                <span>{m.label}</span>
                              </MetricTooltip>
                            ) : m.label}
                          </td>
                          {selectedRows.map((dr) => {
                            const isLeader = leaders.has(dr.driver_name);
                            return (
                              <td
                                key={dr.driver_name}
                                className={`px-4 py-1.5 text-right text-sm font-semibold tabular-nums ${
                                  isLeader
                                    ? "text-[#D4AF37]"
                                    : "text-white/40"
                                }`}
                              >
                                {fmtVal(dr.metrics[m.key], m.isPercentage)}
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </CategoryGroup>
          ))}
        </div>
      )}

      {/* Charts — only useful in compare mode */}
      {compare && selectedRows.length > 1 && (
        <div className="space-y-6">
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
                  leaderAware
                  isLowerBetter={isLowerBetterMetric}
                  hideLegend
                  height={360}
                />
                <p className="mt-2 text-xs text-white/35">
                  Brighter bars and highlighted values indicate the current leader for each metric.
                </p>
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

          <DriverCompareCumulativeChart
            driverNames={selectedRows.map((dr) => dr.driver_name)}
            raceResults={raceResults}
            events={events}
            mode={mode}
            seasonKey={season}
          />
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
                      leaderAware={compare}
                      isLowerBetter={isLowerBetterMetric}
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

  const leagueHighlightDefs = [
    { metric: "Total Events", short: "Events" },
    { metric: "# Drivers Participating*", short: "Drivers" },
    { metric: "Avg. Participation", short: "Avg. participation" },
    { metric: "DNF Rate %", short: "DNF rate" },
  ] as const;

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

      {mode === "All-time" && (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {leagueHighlightDefs.map(({ metric, short }) => {
            const row = league.find((r) => r.metric === metric);
            return (
              <div
                key={metric}
                className="rounded-xl border border-white/10 bg-gradient-to-br from-[#7020B0]/25 via-white/[0.04] to-transparent px-4 py-3"
              >
                <div className="text-[10px] font-bold uppercase tracking-wider text-white/45">{short}</div>
                <div className="mt-1 text-xl font-extrabold tabular-nums text-[#D4AF37] sm:text-2xl">
                  {row?.total ?? "—"}
                </div>
              </div>
            );
          })}
        </div>
      )}

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
  const defaultOpenCategoryIds = useMemo(
    () => new Set(categories.slice(0, DEFAULT_OPEN_CATEGORIES).map((c) => c.id)),
    [categories],
  );
  const [openCategoryIds, setOpenCategoryIds] = useState<Set<string>>(new Set());
  useEffect(() => {
    setOpenCategoryIds((prev) => {
      const valid = new Set(categories.map((c) => c.id));
      const next = new Set([...prev].filter((id) => valid.has(id)));
      if (next.size === 0) return new Set(defaultOpenCategoryIds);
      return next;
    });
  }, [categories, defaultOpenCategoryIds]);
  const allCategoriesExpanded =
    categories.length > 0 && openCategoryIds.size === categories.length;

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

      {categories.length > 0 && (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={() =>
              setOpenCategoryIds(
                allCategoriesExpanded
                  ? new Set()
                  : new Set(categories.map((c) => c.id)),
              )
            }
            className="rounded-md border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold text-white/70 transition hover:text-white"
          >
            {allCategoriesExpanded ? "Collapse all" : "Expand all"}
          </button>
        </div>
      )}

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
              open={openCategoryIds.has(cat.id)}
              onToggle={() =>
                setOpenCategoryIds((prev) => {
                  const next = new Set(prev);
                  if (next.has(cat.id)) next.delete(cat.id);
                  else next.add(cat.id);
                  return next;
                })
              }
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
              open={openCategoryIds.has(cat.id)}
              onToggle={() =>
                setOpenCategoryIds((prev) => {
                  const next = new Set(prev);
                  if (next.has(cat.id)) next.delete(cat.id);
                  else next.add(cat.id);
                  return next;
                })
              }
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
  raceResults = {},
  events = [],
  rewards,
  seasons,
}: {
  allTime: { rows: DriverStatRow[]; headers: string[] };
  bySeason: Record<string, { rows: DriverStatRow[]; headers: string[] }>;
  onSelectDriver?: (driverName: string) => void;
  raceResults?: Record<string, RaceResultRow[]>;
  events?: RaceEvent[];
  rewards?: Reward[];
  seasons?: SeasonConfig[];
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
  const [formatFilter,      setFormatFilter]      = useState<StatsFilters["format"]>(undefined);
  const [competitionFilter, setCompetitionFilter] = useState<StatsFilters["competition"]>(undefined);
  const [roundTypeFilter,   setRoundTypeFilter]   = useState<StatsFilters["roundType"]>(undefined);

  const anyFilterActive = !!(formatFilter || competitionFilter || roundTypeFilter);

  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const rankingsUrlHydrated = useRef(false);

  useEffect(() => {
    const next = new URLSearchParams(searchParams.toString());
    if (!rankingsUrlHydrated.current) {
      const f = next.get("format");
      if (f === "50%" || f === "25%" || f === "sprint") {
        setFormatFilter(f as StatsFilters["format"]);
      }
      const c = next.get("comp");
      if (c === "main" || c === "wild") {
        setCompetitionFilter(c as StatsFilters["competition"]);
      }
      const r = next.get("round");
      if (r === "regular" || r === "playoff") {
        setRoundTypeFilter(r as StatsFilters["roundType"]);
      }
      rankingsUrlHydrated.current = true;
      return;
    }
    if (formatFilter) next.set("format", formatFilter);
    else next.delete("format");
    if (competitionFilter) next.set("comp", competitionFilter);
    else next.delete("comp");
    if (roundTypeFilter) next.set("round", roundTypeFilter);
    else next.delete("round");
    const qs = next.toString();
    if (qs !== searchParams.toString()) {
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    }
  }, [
    searchParams,
    formatFilter,
    competitionFilter,
    roundTypeFilter,
    pathname,
    router,
  ]);

  /* ---------- Recompute dataset when filters are active ---------- */
  const allResultsFlat = useMemo(
    () => Object.values(raceResults).flat(),
    [raceResults],
  );

  const filteredDataset = useMemo(() => {
    if (!anyFilterActive) return null;
    const filters: StatsFilters = {};
    if (formatFilter)      filters.format      = formatFilter;
    if (competitionFilter) filters.competition = competitionFilter;
    if (roundTypeFilter)   filters.roundType   = roundTypeFilter;
    if (mode === "Season") filters.season = season;
    return computeDriverStats(allResultsFlat, events, rewards ?? [], seasons ?? [], filters);
  }, [anyFilterActive, allResultsFlat, events, mode, season, formatFilter, competitionFilter, roundTypeFilter, rewards, seasons]);

  /* ---------- Dataset & metrics ---------- */
  const baseAllTime  = anyFilterActive ? (filteredDataset ?? allTime)      : allTime;
  const baseBySeasonEntry = anyFilterActive
    ? (filteredDataset ?? bySeason[season] ?? { rows: [], headers: [] })
    : (bySeason[season] ?? { rows: [], headers: [] });
  const dataset = mode === "All-time" ? baseAllTime : baseBySeasonEntry;
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

  const leaderboardScale = useMemo(() => {
    if (ranked.length === 0) {
      return { min: 0, max: 1, lowerBetter: false };
    }
    const nums = ranked.map((r) => Number(r.value)).filter((n) => Number.isFinite(n));
    const min = Math.min(...nums);
    const max = Math.max(...nums);
    const lowerBetter = isLowerBetterMetric(currentMetric?.label ?? selectedStat);
    return { min, max, lowerBetter };
  }, [ranked, currentMetric?.label, selectedStat]);

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

      <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
        <p className="mb-3 text-[10px] font-bold uppercase tracking-wider text-white/40">Segment leaderboard</p>
        <StatsFilterPills
          formatFilter={formatFilter}
          competitionFilter={competitionFilter}
          roundTypeFilter={roundTypeFilter}
          onFormat={setFormatFilter}
          onCompetition={setCompetitionFilter}
          onRoundType={setRoundTypeFilter}
          onClearAll={() => {
            setFormatFilter(undefined);
            setCompetitionFilter(undefined);
            setRoundTypeFilter(undefined);
          }}
        />
      </div>

      <div className="flex flex-wrap gap-2">
        <span className="w-full text-[10px] font-bold uppercase tracking-wider text-white/35 sm:w-auto sm:self-center">
          Quick picks
        </span>
        {RANKINGS_QUICK_PRESETS.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => {
              const key = pickMetricKeyForPreset(metrics, p.id);
              if (key) {
                setSelectedStat(key);
                setSortAsc(null);
              }
            }}
            className="rounded-lg border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs font-semibold text-white/70 transition hover:border-[#7020B0]/50 hover:text-white"
          >
            {p.label}
          </button>
        ))}
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

      {ranked.length >= 3 && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {ranked.slice(0, 3).map((r, idx) => {
            const ring =
              idx === 0
                ? "border-[#D4AF37]/50 from-[#D4AF37]/15"
                : idx === 1
                  ? "border-white/20 from-white/10"
                  : "border-[#CD7F32]/40 from-[#CD7F32]/12";
            return (
              <div
                key={r.driverName}
                className={`rounded-xl border bg-gradient-to-br p-4 ${ring} to-transparent`}
              >
                <div className="text-[10px] font-bold uppercase tracking-wider text-white/45">
                  #{r.rank} {idx === 0 ? "Leader" : idx === 1 ? "2nd" : "3rd"}
                </div>
                <div className="mt-1 text-lg font-bold text-white">
                  {onSelectDriver ? (
                    <button
                      type="button"
                      onClick={() => onSelectDriver(r.driverName)}
                      className="text-left hover:text-[#D4AF37]"
                    >
                      {r.driverName}
                    </button>
                  ) : (
                    r.driverName
                  )}
                </div>
                <div className="mt-2 text-2xl font-extrabold tabular-nums text-[#D4AF37]">
                  {fmtVal(r.value, r.isPct)}
                </div>
              </div>
            );
          })}
        </div>
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
                <th className="hidden w-36 px-2 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-white/35 sm:table-cell">
                  vs field
                </th>
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
                const v = Number(r.value);
                let barW = 50;
                if (
                  Number.isFinite(v) &&
                  leaderboardScale.max !== leaderboardScale.min
                ) {
                  if (leaderboardScale.lowerBetter) {
                    barW =
                      ((leaderboardScale.max - v) /
                        (leaderboardScale.max - leaderboardScale.min)) *
                      100;
                  } else {
                    barW =
                      ((v - leaderboardScale.min) /
                        (leaderboardScale.max - leaderboardScale.min)) *
                      100;
                  }
                }

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

                    {r.team !== null && (
                      <td className="px-4 py-2.5 text-white/50">{r.team}</td>
                    )}

                    <td className="hidden px-3 py-2.5 sm:table-cell">
                      <div className="h-2 overflow-hidden rounded-full bg-white/10">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-[#7020B0] to-[#D4AF37]"
                          style={{ width: `${Math.min(100, Math.max(4, barW))}%` }}
                        />
                      </div>
                    </td>

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
/*  Head-to-Head section                                               */
/* ------------------------------------------------------------------ */

const H2H_CARD_TOOLTIPS: Record<string, string> = {
  "H2H Wins": "Times the driver finished ahead of the other in shared races.",
  "Race Wins (P1)": "Number of P1 finishes in shared races.",
  "Podiums": "Top 3 finishes (P1–P3) in shared races.",
  "Podium Rate %": "Percentage of shared races finishing on the podium.",
  "Top 5": "Finishes inside the top 5 in shared races.",
  "Top 10": "Finishes inside the top 10 in shared races.",
  "Total Points": "Sum of all points scored across shared races.",
  "Pts / Race": "Average points earned per shared race.",
  "Avg Finish": "Average finishing position across shared races. Lower is better.",
  "Best Finish": "Highest (lowest number) finishing position achieved. Lower is better.",
  "Worst Finish": "Lowest (highest number) finishing position. Lower is better.",
  "Avg Grid": "Average qualifying position across shared races. Lower is better.",
  "Best Grid": "Best qualifying position achieved. Lower is better.",
  "Grid H2H": "Times the driver out-qualified the other in shared races.",
  "Poles": "Number of pole positions (P1 grid) in shared races.",
  "Front Row": "Times starting P1 or P2 on the grid in shared races.",
  "Fastest Laps": "Number of fastest laps set in shared races.",
  "DOTDs": "Driver of the Day awards in shared races.",
  "Races Finished": "Shared races completed without retiring (no DNF/DSQ).",
  "DNFs": "Did Not Finish count (DNF, DSQ, DNS, Retired). Lower is better.",
};

function H2HStatCard({
  label,
  valueA,
  valueB,
  format = "int",
  higherIsBetter = true,
}: {
  label: string;
  valueA: number | null;
  valueB: number | null;
  format?: "int" | "float" | "pts";
  higherIsBetter?: boolean;
}) {
  const tip = H2H_CARD_TOOLTIPS[label];
  const fmt = (v: number | null) => {
    if (v === null) return "-";
    if (format === "float") return v.toFixed(2);
    if (format === "pts") return v.toFixed(1);
    return String(v);
  };

  let winnerSide: "a" | "b" | null = null;
  if (valueA !== null && valueB !== null && valueA !== valueB) {
    if (higherIsBetter) winnerSide = valueA > valueB ? "a" : "b";
    else winnerSide = valueA < valueB ? "a" : "b";
  }

  const nA = valueA ?? 0;
  const nB = valueB ?? 0;
  const total = Math.abs(nA) + Math.abs(nB);
  const pctA = total > 0 ? (Math.abs(nA) / total) * 100 : 50;
  const pctB = total > 0 ? (Math.abs(nB) / total) * 100 : 50;

  return (
    <div className={`group relative rounded-xl border px-4 pb-3 pt-4 transition ${
      winnerSide === "a"
        ? "border-[#7020B0]/30 bg-[#7020B0]/[0.06]"
        : winnerSide === "b"
          ? "border-[#D4AF37]/30 bg-[#D4AF37]/[0.06]"
          : "border-white/10 bg-white/[0.03]"
    }`}>
      <span className="mb-3 block text-center text-[10px] font-semibold uppercase tracking-widest text-white/35">{label}</span>
      {tip && (
        <span className="pointer-events-none absolute inset-x-0 bottom-[calc(100%+8px)] z-50 flex justify-center opacity-0 transition group-hover:opacity-100">
          <span className="w-48 rounded-lg border border-white/10 bg-[#1a1a24] px-3 py-2 text-[11px] font-normal normal-case leading-relaxed tracking-normal text-white/60 shadow-xl">
            {tip}
          </span>
        </span>
      )}
      <div className="flex items-end justify-between gap-2">
        <div className="flex flex-col items-center gap-0.5">
          <span className={`text-xl font-extrabold tabular-nums leading-none ${winnerSide === "a" ? "text-[#9040D0]" : "text-white/50"}`}>
            {fmt(valueA)}
          </span>
        </div>
        <div className="mb-1 flex h-5 w-5 shrink-0 items-center justify-center">
          {winnerSide === "a" && (
            <svg className="h-3 w-3 text-[#7020B0]" viewBox="0 0 12 12" fill="currentColor"><path d="M1 6l4-4v3h6v2H5v3z" /></svg>
          )}
          {winnerSide === "b" && (
            <svg className="h-3 w-3 text-[#D4AF37]" viewBox="0 0 12 12" fill="currentColor"><path d="M11 6l-4-4v3H1v2h6v3z" /></svg>
          )}
          {!winnerSide && (
            <span className="text-[10px] font-bold text-white/20">=</span>
          )}
        </div>
        <div className="flex flex-col items-center gap-0.5">
          <span className={`text-xl font-extrabold tabular-nums leading-none ${winnerSide === "b" ? "text-[#D4AF37]" : "text-white/50"}`}>
            {fmt(valueB)}
          </span>
        </div>
      </div>
      {/* Proportional bar */}
      <div className="mt-3 flex h-1 overflow-hidden rounded-full bg-white/5">
        <div
          className={`transition-all duration-500 ${winnerSide === "a" ? "bg-[#7020B0]" : "bg-[#7020B0]/30"}`}
          style={{ width: `${pctA}%` }}
        />
        <div
          className={`transition-all duration-500 ${winnerSide === "b" ? "bg-[#D4AF37]" : "bg-[#D4AF37]/30"}`}
          style={{ width: `${pctB}%` }}
        />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  H2H Trend Chart                                                    */
/* ------------------------------------------------------------------ */

const H2H_CHART_METRICS = [
  { key: "finish", label: "Finish Pos", group: "Per Race" },
  { key: "grid", label: "Grid Pos", group: "Per Race" },
  { key: "points", label: "Points", group: "Per Race" },
  { key: "posGain", label: "Pos Gain", group: "Per Race" },
  { key: "cumPoints", label: "Cum. Points", group: "Cumulative" },
  { key: "cumWins", label: "Cum. H2H Wins", group: "Cumulative" },
  { key: "cumVictories", label: "Cum. Race Wins", group: "Cumulative" },
  { key: "cumPodiums", label: "Cum. Podiums", group: "Cumulative" },
  { key: "cumTop5", label: "Cum. Top 5", group: "Cumulative" },
  { key: "cumTop10", label: "Cum. Top 10", group: "Cumulative" },
  { key: "cumFastestLaps", label: "Cum. Fastest Laps", group: "Cumulative" },
  { key: "cumPoles", label: "Cum. Poles", group: "Cumulative" },
  { key: "cumDOTDs", label: "Cum. DOTDs", group: "Cumulative" },
  { key: "cumFrontRow", label: "Cum. Front Row", group: "Cumulative" },
  { key: "cumDNFs", label: "Cum. DNFs", group: "Cumulative" },
  { key: "cumGridWins", label: "Cum. Grid H2H", group: "Cumulative" },
  { key: "avgFinish", label: "Running Avg Finish", group: "Running Avg" },
  { key: "avgGrid", label: "Running Avg Grid", group: "Running Avg" },
  { key: "avgPtsPerRace", label: "Running Pts/Race", group: "Running Avg" },
] as const;

type H2HMetricKey = (typeof H2H_CHART_METRICS)[number]["key"];
const H2H_CHART_GROUPS = [...new Set(H2H_CHART_METRICS.map((m) => m.group))];

const RACE_COUNT_OPTIONS = [5, 10, 15, 0] as const;

function H2HTrendChart({
  races,
  driverA,
  driverB,
}: {
  races: H2HRaceRow[];
  driverA: string;
  driverB: string;
}) {
  const [selectedMetrics, setSelectedMetrics] = useState<H2HMetricKey[]>(["finish"]);
  const [raceCount, setRaceCount] = useState<number>(0);

  const toggleMetric = useCallback((key: H2HMetricKey) => {
    setSelectedMetrics((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key],
    );
  }, []);

  const chartData = useMemo(() => {
    const sliced = raceCount > 0 ? races.slice(-raceCount) : races;

    const acc = {
      cumPtsA: 0, cumPtsB: 0,
      cumWinsA: 0, cumWinsB: 0,
      cumVictoriesA: 0, cumVictoriesB: 0,
      cumPodiumsA: 0, cumPodiumsB: 0,
      cumTop5A: 0, cumTop5B: 0,
      cumTop10A: 0, cumTop10B: 0,
      cumFLA: 0, cumFLB: 0,
      cumPolesA: 0, cumPolesB: 0,
      cumDOTDsA: 0, cumDOTDsB: 0,
      cumFrontRowA: 0, cumFrontRowB: 0,
      cumDNFsA: 0, cumDNFsB: 0,
      cumGridWinsA: 0, cumGridWinsB: 0,
      finishSumA: 0, finishSumB: 0, finishCountA: 0, finishCountB: 0,
      gridSumA: 0, gridSumB: 0, gridCountA: 0, gridCountB: 0,
      raceIdx: 0,
    };

    const updateAcc = (r: H2HRaceRow) => {
      acc.cumPtsA += r.pointsA; acc.cumPtsB += r.pointsB;
      if (r.winner === "a") acc.cumWinsA++; else if (r.winner === "b") acc.cumWinsB++;
      if (r.finishA === 1) acc.cumVictoriesA++; if (r.finishB === 1) acc.cumVictoriesB++;
      if (r.finishA !== null && r.finishA <= 3) acc.cumPodiumsA++; if (r.finishB !== null && r.finishB <= 3) acc.cumPodiumsB++;
      if (r.finishA !== null && r.finishA <= 5) acc.cumTop5A++; if (r.finishB !== null && r.finishB <= 5) acc.cumTop5B++;
      if (r.finishA !== null && r.finishA <= 10) acc.cumTop10A++; if (r.finishB !== null && r.finishB <= 10) acc.cumTop10B++;
      if (r.gridA === 1) acc.cumPolesA++; if (r.gridB === 1) acc.cumPolesB++;
      if (r.gridA !== null && r.gridA <= 2) acc.cumFrontRowA++; if (r.gridB !== null && r.gridB <= 2) acc.cumFrontRowB++;
      if (r.gridA !== null && r.gridB !== null) { if (r.gridA < r.gridB) acc.cumGridWinsA++; else if (r.gridB < r.gridA) acc.cumGridWinsB++; }
      const sA = (r.statusA || "").trim().toLowerCase();
      const sB = (r.statusB || "").trim().toLowerCase();
      if (["dnf","dsq","dns","retired"].includes(sA)) acc.cumDNFsA++;
      if (["dnf","dsq","dns","retired"].includes(sB)) acc.cumDNFsB++;
      if (r.fastestLapA) acc.cumFLA++;
      if (r.fastestLapB) acc.cumFLB++;
      if (r.dotdA) acc.cumDOTDsA++;
      if (r.dotdB) acc.cumDOTDsB++;
      if (r.finishA !== null) { acc.finishSumA += r.finishA; acc.finishCountA++; }
      if (r.finishB !== null) { acc.finishSumB += r.finishB; acc.finishCountB++; }
      if (r.gridA !== null) { acc.gridSumA += r.gridA; acc.gridCountA++; }
      if (r.gridB !== null) { acc.gridSumB += r.gridB; acc.gridCountB++; }
      acc.raceIdx++;
    };

    if (raceCount > 0 && races.length > raceCount) {
      for (const r of races.slice(0, races.length - raceCount)) updateAcc(r);
    }

    return sliced.map((r) => {
      updateAcc(r);
      const label = r.raceName;
      return {
        name: label,
        finishA: r.finishA, finishB: r.finishB,
        gridA: r.gridA, gridB: r.gridB,
        pointsA: r.pointsA, pointsB: r.pointsB,
        posGainA: r.gridA !== null && r.finishA !== null ? r.gridA - r.finishA : null,
        posGainB: r.gridB !== null && r.finishB !== null ? r.gridB - r.finishB : null,
        cumPointsA: acc.cumPtsA, cumPointsB: acc.cumPtsB,
        cumWinsA: acc.cumWinsA, cumWinsB: acc.cumWinsB,
        cumVictoriesA: acc.cumVictoriesA, cumVictoriesB: acc.cumVictoriesB,
        cumPodiumsA: acc.cumPodiumsA, cumPodiumsB: acc.cumPodiumsB,
        cumTop5A: acc.cumTop5A, cumTop5B: acc.cumTop5B,
        cumTop10A: acc.cumTop10A, cumTop10B: acc.cumTop10B,
        cumFastestLapsA: acc.cumFLA, cumFastestLapsB: acc.cumFLB,
        cumPolesA: acc.cumPolesA, cumPolesB: acc.cumPolesB,
        cumDOTDsA: acc.cumDOTDsA, cumDOTDsB: acc.cumDOTDsB,
        cumFrontRowA: acc.cumFrontRowA, cumFrontRowB: acc.cumFrontRowB,
        cumDNFsA: acc.cumDNFsA, cumDNFsB: acc.cumDNFsB,
        cumGridWinsA: acc.cumGridWinsA, cumGridWinsB: acc.cumGridWinsB,
        avgFinishA: acc.finishCountA > 0 ? acc.finishSumA / acc.finishCountA : null,
        avgFinishB: acc.finishCountB > 0 ? acc.finishSumB / acc.finishCountB : null,
        avgGridA: acc.gridCountA > 0 ? acc.gridSumA / acc.gridCountA : null,
        avgGridB: acc.gridCountB > 0 ? acc.gridSumB / acc.gridCountB : null,
        avgPtsPerRaceA: acc.raceIdx > 0 ? acc.cumPtsA / acc.raceIdx : null,
        avgPtsPerRaceB: acc.raceIdx > 0 ? acc.cumPtsB / acc.raceIdx : null,
      };
    });
  }, [races, raceCount]);

  const nameA = driverA.split(" ").pop() ?? driverA;
  const nameB = driverB.split(" ").pop() ?? driverB;

  const lineConfigs: { dataKeyA: string; dataKeyB: string; label: string }[] = selectedMetrics.map((key) => ({
    dataKeyA: `${key}A`,
    dataKeyB: `${key}B`,
    label: H2H_CHART_METRICS.find((m) => m.key === key)!.label,
  }));

  if (races.length < 2) return null;

  return (
    <div className="space-y-4 rounded-xl border border-white/10 bg-white/[0.02] p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-white/60">Trend Over Races</h3>

        {/* Race count selector */}
        <div className="flex gap-1 rounded-lg bg-white/5 p-0.5">
          {RACE_COUNT_OPTIONS.map((n) => (
            <button
              key={n}
              onClick={() => setRaceCount(n)}
              className={`rounded-md px-2.5 py-1 text-xs font-semibold transition ${
                raceCount === n
                  ? "bg-[#7020B0] text-white shadow"
                  : "text-white/50 hover:text-white/80"
              }`}
            >
              {n === 0 ? "All" : `Last ${n}`}
            </button>
          ))}
        </div>
      </div>

      {/* Metric selectors — dropdown per group */}
      <div className="flex flex-wrap items-start gap-3">
        {H2H_CHART_GROUPS.map((group) => {
          const groupMetrics = H2H_CHART_METRICS.filter((m) => m.group === group);
          const activeInGroup = groupMetrics.filter((m) => selectedMetrics.includes(m.key));
          const tooltip = group === "Per Race"
            ? "The actual value for each race (e.g. finish position that race)."
            : group === "Cumulative"
              ? "A running total that grows race by race (e.g. total podiums so far)."
              : "The average of all races up to that point, updated after each race.";
          return (
            <div key={group} className="relative w-52">
              <div className="mb-1 flex items-center gap-1.5">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-white/30">{group}</span>
                <span className="group/tip relative cursor-help">
                  <svg className="h-3 w-3 text-white/20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M12 2a10 10 0 100 20 10 10 0 000-20z" />
                  </svg>
                  <span className="pointer-events-none absolute bottom-full left-1/2 z-50 mb-2 w-52 -translate-x-1/2 rounded-lg border border-white/10 bg-[#1a1a24] px-3 py-2 text-[11px] leading-relaxed text-white/60 opacity-0 shadow-xl transition group-hover/tip:opacity-100">
                    {tooltip}
                  </span>
                </span>
              </div>
              <SearchableSelect
                options={groupMetrics.map((m) => m.label)}
                value={activeInGroup.map((m) => m.label)}
                onChange={(v) => {
                  const labels = (Array.isArray(v) ? v : [v]) as string[];
                  const keys = labels
                    .map((l) => groupMetrics.find((m) => m.label === l)?.key)
                    .filter(Boolean) as H2HMetricKey[];
                  const otherKeys = selectedMetrics.filter(
                    (k) => !groupMetrics.some((m) => m.key === k),
                  );
                  setSelectedMetrics([...otherKeys, ...keys]);
                }}
                placeholder={`Select ${group.toLowerCase()}…`}
                multiple
              />
            </div>
          );
        })}
      </div>

      {selectedMetrics.length === 0 && (
        <p className="py-8 text-center text-sm text-white/30">Select at least one metric to display.</p>
      )}

      {selectedMetrics.length > 0 && (
        <div className="h-72">
          <ResponsiveContainer width="100%" height={288}>
            <LineChart data={chartData} margin={{ top: 8, right: 12, bottom: 4, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
              <XAxis
                dataKey="name"
                tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 10 }}
                axisLine={{ stroke: "rgba(255,255,255,0.1)" }}
                tickLine={false}
                interval="preserveStartEnd"
                angle={-18}
                textAnchor="end"
                height={56}
              />
              <YAxis
                tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 10 }}
                axisLine={{ stroke: "rgba(255,255,255,0.1)" }}
                tickLine={false}
                width={36}
              />
              <Tooltip
                contentStyle={{
                  background: "#1a1a24",
                  border: "1px solid rgba(255,255,255,0.1)",
                  borderRadius: 8,
                  fontSize: 12,
                  color: "#fff",
                }}
                labelStyle={{ color: "rgba(255,255,255,0.5)", marginBottom: 4 }}
              />
              <Legend
                wrapperStyle={{ fontSize: 11, paddingTop: 8 }}
              />
              {lineConfigs.map((cfg) => (
                <Line
                  key={cfg.dataKeyA}
                  type="monotone"
                  dataKey={cfg.dataKeyA}
                  name={`${nameA} ${cfg.label}`}
                  stroke="#7020B0"
                  strokeWidth={2}
                  dot={{ r: 3, fill: "#7020B0" }}
                  activeDot={{ r: 5 }}
                  connectNulls
                  strokeDasharray={lineConfigs.length > 1 ? lineConfigs.indexOf(cfg) === 0 ? undefined : `${(lineConfigs.indexOf(cfg) + 1) * 4} ${(lineConfigs.indexOf(cfg) + 1) * 2}` : undefined}
                />
              ))}
              {lineConfigs.map((cfg) => (
                <Line
                  key={cfg.dataKeyB}
                  type="monotone"
                  dataKey={cfg.dataKeyB}
                  name={`${nameB} ${cfg.label}`}
                  stroke="#D4AF37"
                  strokeWidth={2}
                  dot={{ r: 3, fill: "#D4AF37" }}
                  activeDot={{ r: 5 }}
                  connectNulls
                  strokeDasharray={lineConfigs.length > 1 ? lineConfigs.indexOf(cfg) === 0 ? undefined : `${(lineConfigs.indexOf(cfg) + 1) * 4} ${(lineConfigs.indexOf(cfg) + 1) * 2}` : undefined}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

function H2HWinBar({ winsA, winsB, ties }: { winsA: number; winsB: number; ties: number }) {
  const total = winsA + winsB + ties;
  if (total === 0) return null;
  const pA = (winsA / total) * 100;
  const pT = (ties / total) * 100;
  const pB = (winsB / total) * 100;

  return (
    <div className="space-y-2">
      <div className="flex justify-between text-sm font-semibold">
        <span className="text-[#7020B0]">{winsA} wins</span>
        {ties > 0 && <span className="text-white/40">{ties} ties</span>}
        <span className="text-[#D4AF37]">{winsB} wins</span>
      </div>
      <div className="flex h-3 overflow-hidden rounded-full bg-white/5">
        <div className="bg-[#7020B0] transition-all" style={{ width: `${pA}%` }} />
        <div className="bg-white/20 transition-all" style={{ width: `${pT}%` }} />
        <div className="bg-[#D4AF37] transition-all" style={{ width: `${pB}%` }} />
      </div>
    </div>
  );
}

function H2HSection({
  raceResults,
  events,
}: {
  raceResults: Record<string, RaceResultRow[]>;
  events: RaceEvent[];
}) {
  const driverIndex = useMemo(() => buildDriverIndex(raceResults), [raceResults]);
  const driverNames = useMemo(() => getDriverNames(driverIndex), [driverIndex]);
  const eventMeta = useMemo(() => buildEventMeta(events), [events]);
  const filterOptions = useMemo(() => getFilterOptions(eventMeta), [eventMeta]);

  const [driverA, setDriverA] = useState("");
  const [driverB, setDriverB] = useState("");
  const [seasonFilters, setSeasonFilters] = useState<string[]>([]);
  const [circuitFilters, setCircuitFilters] = useState<string[]>([]);
  const [weatherFilters, setWeatherFilters] = useState<string[]>([]);
  const [formatFilter, setFormatFilter] = useState("");
  const [competitionFilter, setCompetitionFilter] = useState("");
  const [roundTypeFilter, setRoundTypeFilter] = useState("");
  const [resultsEventId, setResultsEventId] = useState<string | null>(null);

  useEffect(() => {
    if (!resultsEventId) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setResultsEventId(null); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [resultsEventId]);

  const h2h = useMemo(() => {
    if (!driverA || !driverB || driverA === driverB) return null;
    return computeH2H(driverIndex, driverA, driverB, eventMeta, {
      seasons: seasonFilters.length > 0 ? seasonFilters : undefined,
      circuits: circuitFilters.length > 0 ? circuitFilters : undefined,
      weather: weatherFilters.length > 0 ? weatherFilters : undefined,
      format: formatFilter || undefined,
      competition: competitionFilter || undefined,
      roundType: roundTypeFilter || undefined,
    });
  }, [driverIndex, driverA, driverB, eventMeta, seasonFilters, circuitFilters, weatherFilters, formatFilter, competitionFilter, roundTypeFilter]);

  const optionsA = useMemo(
    () => driverNames.filter((n) => n !== driverB),
    [driverNames, driverB],
  );
  const optionsB = useMemo(
    () => driverNames.filter((n) => n !== driverA),
    [driverNames, driverA],
  );

  const activeFilterCount = seasonFilters.length + circuitFilters.length + weatherFilters.length
    + (formatFilter ? 1 : 0) + (competitionFilter ? 1 : 0) + (roundTypeFilter ? 1 : 0);
  const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
  const activeFilterLabel = [
    seasonFilters.length > 0 && seasonFilters.map((s) => `S${s.replace("S", "")}`).join(", "),
    circuitFilters.length > 0 && circuitFilters.join(", "),
    weatherFilters.length > 0 && weatherFilters.map(capitalize).join(", "),
  ].filter(Boolean).join(" · ");

  return (
    <div className="space-y-6">
      {/* Explainer */}
      <div className="mx-auto max-w-2xl rounded-xl border border-[#7020B0]/20 bg-[#7020B0]/[0.04] px-5 py-4 text-center text-sm leading-relaxed text-white/50">
        <span className="font-semibold text-white/70">How is this different from Compare?</span>{" "}
        The Drivers tab compares career stats across <em>all</em> races each driver entered.
        Head-to-Head only counts races where <em>both</em> drivers participated,
        giving you a direct, fair comparison on the same tracks and conditions.
      </div>

      {/* Driver selectors */}
      <div className="flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
        <div className="w-full max-w-xs">
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-[#7020B0]">
            Driver A
          </label>
          <SearchableSelect
            options={optionsA}
            value={driverA}
            onChange={(v) => setDriverA(v as string)}
            placeholder="Select Driver A…"
          />
        </div>

        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/5 text-sm font-bold text-white/40">
          vs
        </div>

        <div className="w-full max-w-xs">
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-[#D4AF37]">
            Driver B
          </label>
          <SearchableSelect
            options={optionsB}
            value={driverB}
            onChange={(v) => setDriverB(v as string)}
            placeholder="Select Driver B…"
          />
        </div>
      </div>

      {/* Swap + Filters row */}
      <div className="flex flex-wrap items-center justify-center gap-3">
        {driverA && driverB && (
          <button
            onClick={() => { const tmp = driverA; setDriverA(driverB); setDriverB(tmp); }}
            className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-white/50 transition hover:border-white/20 hover:text-white/80"
          >
            <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
            </svg>
            Swap
          </button>
        )}

        <div className="h-5 w-px bg-white/10" />

        <span className="text-xs font-medium uppercase tracking-wider text-white/30">Filter by</span>

        {/* Season multi-select */}
        <div className="w-48">
          <SearchableSelect
            options={filterOptions.seasons.map((s) => `Season ${s.replace("S", "")}`)}
            value={seasonFilters.map((s) => `Season ${s.replace("S", "")}`)}
            onChange={(v) => {
              const arr = (Array.isArray(v) ? v : [v]) as string[];
              setSeasonFilters(arr.map((label) => `S${label.replace("Season ", "")}`));
            }}
            placeholder="All seasons"
            multiple
          />
        </div>

        {/* Circuit multi-select */}
        <div className="w-48">
          <SearchableSelect
            options={filterOptions.circuits}
            value={circuitFilters}
            onChange={(v) => setCircuitFilters((Array.isArray(v) ? v : [v]) as string[])}
            placeholder="All circuits"
            multiple
          />
        </div>

        {/* Weather multi-select */}
        {filterOptions.weather.length > 0 && (
          <div className="w-40">
            <SearchableSelect
              options={filterOptions.weather.map(capitalize)}
              value={weatherFilters.map(capitalize)}
              onChange={(v) => {
                const arr = (Array.isArray(v) ? v : [v]) as string[];
                setWeatherFilters(arr.map((w) => w.toLowerCase()));
              }}
              placeholder="All weather"
              multiple
            />
          </div>
        )}

        {/* Format / Competition / Round type */}
        <div className="w-40">
          <SearchableSelect
            options={["All Formats", "50% Race", "25% Race", "Sprint"]}
            value={formatFilter === "50%" ? "50% Race" : formatFilter === "25%" ? "25% Race" : formatFilter === "sprint" ? "Sprint" : ""}
            onChange={(v) => {
              const s = v as string;
              setFormatFilter(s === "50% Race" ? "50%" : s === "25% Race" ? "25%" : s === "Sprint" ? "sprint" : "");
            }}
            placeholder="All Formats"
          />
        </div>

        <div className="w-36">
          <SearchableSelect
            options={["All Leagues", "Main", "Wild"]}
            value={competitionFilter === "main" ? "Main" : competitionFilter === "wild" ? "Wild" : ""}
            onChange={(v) => {
              const s = v as string;
              setCompetitionFilter(s === "Main" ? "main" : s === "Wild" ? "wild" : "");
            }}
            placeholder="All Leagues"
          />
        </div>

        <div className="w-40">
          <SearchableSelect
            options={["All Rounds", "Regular Season", "Playoffs"]}
            value={roundTypeFilter === "regular" ? "Regular Season" : roundTypeFilter === "playoff" ? "Playoffs" : ""}
            onChange={(v) => {
              const s = v as string;
              setRoundTypeFilter(s === "Regular Season" ? "regular" : s === "Playoffs" ? "playoff" : "");
            }}
            placeholder="All Rounds"
          />
        </div>

        {activeFilterCount > 0 && (
          <button
            onClick={() => { setSeasonFilters([]); setCircuitFilters([]); setWeatherFilters([]); setFormatFilter(""); setCompetitionFilter(""); setRoundTypeFilter(""); }}
            className="flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[10px] font-medium text-white/40 transition hover:text-white/70"
          >
            Clear all
            <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {/* Empty state */}
      {(!driverA || !driverB) && (
        <EmptyState message="Select two drivers to compare their head-to-head record." />
      )}

      {driverA && driverB && driverA === driverB && (
        <EmptyState message="Please select two different drivers." />
      )}

      {/* No shared races */}
      {h2h && h2h.summary.sharedRaces === 0 && (
        <EmptyState
          message={
            activeFilterCount > 0
              ? `No shared races between ${driverA} and ${driverB} for ${activeFilterLabel}.`
              : `${driverA} and ${driverB} have no shared races.`
          }
        />
      )}

      {/* Results */}
      {h2h && h2h.summary.sharedRaces > 0 && (
        <div className="space-y-8">
          {/* Header */}
          <div className="text-center">
            <p className="text-sm text-white/40">
              <span className="font-semibold text-white/70">{h2h.summary.sharedRaces}</span>{" "}
              shared race{h2h.summary.sharedRaces !== 1 ? "s" : ""}
              {activeFilterCount > 0 && (
                <span className="text-white/30"> · {activeFilterLabel}</span>
              )}
            </p>
          </div>

          {/* Win bar */}
          <div className="mx-auto max-w-lg">
            <H2HWinBar
              winsA={h2h.summary.winsA}
              winsB={h2h.summary.winsB}
              ties={h2h.summary.ties}
            />
          </div>

          {/* Summary stat cards */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            <H2HStatCard label="H2H Wins" valueA={h2h.summary.winsA} valueB={h2h.summary.winsB} />
            <H2HStatCard label="Race Wins (P1)" valueA={h2h.summary.victoriesA} valueB={h2h.summary.victoriesB} />
            <H2HStatCard label="Podiums" valueA={h2h.summary.podiumsA} valueB={h2h.summary.podiumsB} />
            <H2HStatCard label="Podium Rate %" valueA={h2h.summary.podiumRateA} valueB={h2h.summary.podiumRateB} format="float" />
            <H2HStatCard label="Top 5" valueA={h2h.summary.top5A} valueB={h2h.summary.top5B} />
            <H2HStatCard label="Top 10" valueA={h2h.summary.top10A} valueB={h2h.summary.top10B} />
            <H2HStatCard label="Total Points" valueA={h2h.summary.pointsA} valueB={h2h.summary.pointsB} format="pts" />
            <H2HStatCard label="Pts / Race" valueA={h2h.summary.pointsPerRaceA} valueB={h2h.summary.pointsPerRaceB} format="float" />
            <H2HStatCard label="Avg Finish" valueA={h2h.summary.avgFinishA} valueB={h2h.summary.avgFinishB} format="float" higherIsBetter={false} />
            <H2HStatCard label="Best Finish" valueA={h2h.summary.bestFinishA} valueB={h2h.summary.bestFinishB} higherIsBetter={false} />
            <H2HStatCard label="Worst Finish" valueA={h2h.summary.worstFinishA} valueB={h2h.summary.worstFinishB} higherIsBetter={false} />
            <H2HStatCard label="Avg Grid" valueA={h2h.summary.avgGridA} valueB={h2h.summary.avgGridB} format="float" higherIsBetter={false} />
            <H2HStatCard label="Best Grid" valueA={h2h.summary.bestGridA} valueB={h2h.summary.bestGridB} higherIsBetter={false} />
            <H2HStatCard label="Grid H2H" valueA={h2h.summary.gridWinsA} valueB={h2h.summary.gridWinsB} />
            <H2HStatCard label="Poles" valueA={h2h.summary.polesA} valueB={h2h.summary.polesB} />
            <H2HStatCard label="Front Row" valueA={h2h.summary.frontRowA} valueB={h2h.summary.frontRowB} />
            <H2HStatCard label="Fastest Laps" valueA={h2h.summary.fastestLapsA} valueB={h2h.summary.fastestLapsB} />
            <H2HStatCard label="DOTDs" valueA={h2h.summary.dotdsA} valueB={h2h.summary.dotdsB} />
            <H2HStatCard label="Races Finished" valueA={h2h.summary.finishedA} valueB={h2h.summary.finishedB} />
            <H2HStatCard label="DNFs" valueA={h2h.summary.dnfsA} valueB={h2h.summary.dnfsB} higherIsBetter={false} />
          </div>

          {/* Trend chart */}
          <H2HTrendChart races={h2h.races} driverA={driverA} driverB={driverB} />

          {/* Race-by-race table */}
          <div className="overflow-x-auto rounded-xl border border-white/10 bg-white/[0.02]">
            <table className="w-full min-w-[820px] text-sm">
              <thead>
                <tr className="border-b border-white/10 text-xs uppercase tracking-wider text-white/40">
                  <th className="px-3 py-3 text-left font-medium" rowSpan={2}>Race</th>
                  <th className="px-3 py-3 text-left font-medium" rowSpan={2}>Date</th>
                  <th className="px-3 py-3 text-center font-medium" rowSpan={2}>Season</th>
                  <th className="px-3 py-3 text-center font-medium" rowSpan={2}>League</th>
                  <th className="border-l border-white/10 px-3 py-2 text-center font-medium" colSpan={2}>Finish</th>
                  <th className="border-l border-white/10 px-3 py-2 text-center font-medium" colSpan={2}>Grid</th>
                  <th className="border-l border-white/10 px-3 py-3 text-center font-medium" rowSpan={2}>Better</th>
                </tr>
                <tr className="border-b border-white/5 text-[10px] uppercase tracking-wider">
                  <th className="border-l border-white/10 px-3 py-1 text-center font-medium text-[#7020B0]/70">{driverA.split(" ").pop()}</th>
                  <th className="px-3 py-1 text-center font-medium text-[#D4AF37]/70">{driverB.split(" ").pop()}</th>
                  <th className="border-l border-white/10 px-3 py-1 text-center font-medium text-[#7020B0]/70">{driverA.split(" ").pop()}</th>
                  <th className="px-3 py-1 text-center font-medium text-[#D4AF37]/70">{driverB.split(" ").pop()}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {h2h.races.map((race) => {
                  const gridWinner = race.gridA !== null && race.gridB !== null
                    ? race.gridA < race.gridB ? "a" : race.gridB < race.gridA ? "b" : null
                    : null;
                  return (
                    <tr
                      key={race.eventId}
                      className="transition hover:bg-white/[0.03]"
                    >
                      <td className="px-3 py-2.5 font-medium text-white/80">
                        <button
                          type="button"
                          onClick={() => setResultsEventId(race.eventId)}
                          className="text-left underline decoration-white/20 underline-offset-2 transition hover:text-[#a855f7] hover:decoration-[#7020B0]/40"
                        >
                          {race.raceName}
                        </button>
                        {race.circuit && race.circuit !== race.raceName && (
                          <span className="ml-1.5 text-[10px] text-white/30">{race.circuit}</span>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-white/50">{race.date}</td>
                      <td className="px-3 py-2.5 text-center">
                        {race.season && (
                          <span className="inline-block rounded-full bg-white/5 px-2 py-0.5 text-[10px] font-semibold text-white/50">
                            {race.season}
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-center">
                        {race.league && (
                          <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${
                            race.league.toLowerCase() === "wild"
                              ? "bg-orange-500/10 text-orange-400"
                              : "bg-[#7020B0]/10 text-[#9040D0]"
                          }`}>
                            {race.league}
                          </span>
                        )}
                      </td>
                      <td className={`border-l border-white/10 px-3 py-2.5 text-center tabular-nums ${race.winner === "a" ? "font-bold text-[#7020B0]" : "text-white/60"}`}>
                        {race.statusA && race.finishA === null ? race.statusA : (race.finishA ?? "-")}
                      </td>
                      <td className={`px-3 py-2.5 text-center tabular-nums ${race.winner === "b" ? "font-bold text-[#D4AF37]" : "text-white/60"}`}>
                        {race.statusB && race.finishB === null ? race.statusB : (race.finishB ?? "-")}
                      </td>
                      <td className={`border-l border-white/10 px-3 py-2.5 text-center tabular-nums ${gridWinner === "a" ? "font-semibold text-[#7020B0]/80" : "text-white/40"}`}>
                        {race.gridA ?? "-"}
                      </td>
                      <td className={`px-3 py-2.5 text-center tabular-nums ${gridWinner === "b" ? "font-semibold text-[#D4AF37]/80" : "text-white/40"}`}>
                        {race.gridB ?? "-"}
                      </td>
                      <td className="border-l border-white/10 px-3 py-2.5 text-center">
                        {race.winner === "a" && (
                          <span className="inline-block h-2.5 w-2.5 rounded-full bg-[#7020B0] shadow-[0_0_6px_rgba(112,32,176,0.5)]" />
                        )}
                        {race.winner === "b" && (
                          <span className="inline-block h-2.5 w-2.5 rounded-full bg-[#D4AF37] shadow-[0_0_6px_rgba(212,175,55,0.5)]" />
                        )}
                        {race.winner === "tie" && (
                          <span className="text-xs text-white/30">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Race results modal */}
      {resultsEventId && (() => {
        const resultRows = raceResults[resultsEventId] ?? [];
        const meta = eventMeta.get(resultsEventId);
        const eventObj = events.find((e) => e.event_id === resultsEventId);
        const ytUrl = eventObj?.youtube_url;
        return (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
            onClick={() => setResultsEventId(null)}
          >
            <div
              className="relative mx-4 w-full max-w-5xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <h3 className="font-display text-sm font-semibold text-white/80 md:text-base">
                    {meta?.raceName ?? resultsEventId}
                  </h3>
                  {meta?.season && (
                    <span className="rounded-full bg-white/5 px-2 py-0.5 text-[10px] font-semibold text-white/40">
                      {meta.season}
                    </span>
                  )}
                  {ytUrl && (
                    <a
                      href={ytUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 rounded-full border border-red-500/30 bg-red-500/10 px-3 py-1 text-[11px] font-medium text-red-400 transition hover:bg-red-500/20"
                    >
                      <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M23.5 6.2a3 3 0 00-2.1-2.1C19.5 3.5 12 3.5 12 3.5s-7.5 0-9.4.6A3 3 0 00.5 6.2 31.9 31.9 0 000 12a31.9 31.9 0 00.5 5.8 3 3 0 002.1 2.1c1.9.6 9.4.6 9.4.6s7.5 0 9.4-.6a3 3 0 002.1-2.1A31.9 31.9 0 0024 12a31.9 31.9 0 00-.5-5.8zM9.5 15.6V8.4l6.3 3.6-6.3 3.6z" />
                      </svg>
                      Watch Race
                    </a>
                  )}
                </div>
                <button
                  onClick={() => setResultsEventId(null)}
                  className="flex h-8 w-8 items-center justify-center rounded-full border border-white/20 bg-black/60 text-white/80 transition hover:text-white"
                >
                  ×
                </button>
              </div>

              {resultRows.length > 0 ? (
                <div className="max-h-[85vh] overflow-auto rounded-2xl border border-white/10 bg-[#0B0B0E] p-3 shadow-[0_0_30px_rgba(0,0,0,0.4)]">
                  <RaceResultsTable
                    results={resultRows}
                    caption={`${meta?.raceName ?? resultsEventId} — Race Results`}
                  />
                </div>
              ) : (
                <div className="flex items-center justify-center rounded-2xl border border-white/10 bg-[#0B0B0E] py-16">
                  <p className="text-sm text-white/50">Results not available yet.</p>
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
/*  Main component                                                     */
/* ------------------------------------------------------------------ */

export default function StatsPageContent({ data, raceResults, events, seasons, rewards }: Props) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
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

  const handleSelectDriverFromRanking = useCallback(
    (driverName: string) => {
      setOverrideDriver(driverName);
      setTab("Drivers");
      const p = new URLSearchParams(searchParams.toString());
      p.set("tab", "Drivers");
      p.set("driver", driverName);
      router.replace(`${pathname}?${p.toString()}`, { scroll: false });
    },
    [pathname, router, searchParams],
  );

  const setTabWithUrl = useCallback(
    (t: Tab) => {
      setTab(t);
      if (t !== "Drivers") setOverrideDriver(undefined);
      const p = new URLSearchParams(searchParams.toString());
      p.set("tab", t);
      if (t !== "Drivers") p.delete("driver");
      router.replace(`${pathname}?${p.toString()}`, { scroll: false });
    },
    [pathname, router, searchParams],
  );

  // Effective initial driver: override takes precedence over URL param
  const effectiveDriver = overrideDriver ?? initialDriver;

  return (
    <div className="space-y-8">
      {/* Tab bar */}
      <div className="flex justify-center">
        <TabBar tabs={TABS} active={tab} onChange={(t) => setTabWithUrl(t as Tab)} />
      </div>

      {/* Content */}
      {tab === "Drivers" && (
        <DriversSection
          key={effectiveDriver ?? "default"}
          allTime={data.driversAllTime}
          bySeason={data.driversBySeason}
          raceResults={raceResults ?? {}}
          events={events ?? []}
          initialDriver={effectiveDriver}
          seasons={seasons}
          rewards={rewards}
        />
      )}
      {tab === "League" && <LeagueSection league={data.league} />}
      {tab === "Circuits" && (
        <CircuitsSection circuits={data.circuits} />
      )}
      {tab === "Head-to-Head" && raceResults && events && (
        <H2HSection raceResults={raceResults} events={events} />
      )}
      {tab === "Head-to-Head" && (!raceResults || !events) && (
        <EmptyState message="Race results data is not available." />
      )}
      {tab === "Rankings" && (
        <RankingsSection
          allTime={data.driversAllTime}
          bySeason={data.driversBySeason}
          onSelectDriver={handleSelectDriverFromRanking}
          raceResults={raceResults}
          events={events}
          rewards={rewards}
          seasons={seasons}
        />
      )}
    </div>
  );
}
