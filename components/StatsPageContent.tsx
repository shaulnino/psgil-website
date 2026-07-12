"use client";

import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { useTranslations, useLocale } from "next-intl";
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
import { localizedRaceName, localizedTrack } from "@/lib/scheduleData";
import type { Reward } from "@/lib/rewardsData";
import type { SeasonConfig } from "@/lib/seasonConfig";
import { seasonHasWild } from "@/lib/seasonConfig";
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

const COMPARE_COLORS = ["#7E2A1E", "#2F5A6E", "#3F6B3A", "#B07A1E"];
const SINGLE_COLOR = "#7E2A1E";

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

const MAIN_TAB_LABEL_KEYS: Record<string, string> = {
  Drivers: "tabs.drivers",
  League: "tabs.league",
  Circuits: "tabs.circuits",
  "Head-to-Head": "tabs.headToHead",
  Rankings: "tabs.rankings",
};

function TabBar({ tabs, active, onChange }: { tabs: readonly string[]; active: string; onChange: (t: string) => void }) {
  const t = useTranslations("stats");
  return (
    <div className="overflow-x-auto pb-1 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
      <div className="inline-flex min-w-max snap-x snap-mandatory gap-1 rounded-[2px] border border-[color:var(--isl-hairline)] bg-cream p-1">
        {tabs.map((tabId) => (
          <button
            key={tabId}
            onClick={() => onChange(tabId)}
            className={`shrink-0 snap-start rounded-[2px] px-3 py-2 text-xs font-semibold uppercase tracking-[0.08em] transition sm:px-4 sm:text-sm ${
              active === tabId
                ? "bg-oxblood text-bone"
                : "text-meta hover:bg-sink hover:text-ink"
            }`}
          >
            {MAIN_TAB_LABEL_KEYS[tabId] ? t(MAIN_TAB_LABEL_KEYS[tabId]) : tabId}
          </button>
        ))}
      </div>
    </div>
  );
}

const TOGGLE_LABEL_KEYS: Record<string, string> = {
  "All-time": "toggle.allTime",
  Season: "toggle.season",
};

function Toggle({ options, value, onChange }: { options: string[]; value: string; onChange: (v: string) => void }) {
  const t = useTranslations("stats");
  return (
    <div className="flex gap-1 rounded-[2px] border border-[color:var(--isl-hairline)] bg-cream p-0.5">
      {options.map((o) => (
        <button
          key={o}
          onClick={() => onChange(o)}
          className={`rounded-[2px] px-3 py-1.5 text-sm font-semibold transition ${
            value === o
              ? "bg-ink text-bone"
              : "text-meta hover:text-ink"
          }`}
        >
          {TOGGLE_LABEL_KEYS[o] ? t(TOGGLE_LABEL_KEYS[o]) : o}
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
  const t = useTranslations("stats");
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
        className="flex w-full items-center justify-between gap-2 rounded-[2px] border border-[color:var(--isl-hairline-strong)] bg-paper px-3 py-2 text-start text-sm text-ink transition hover:border-oxblood"
      >
        <span className="truncate">{displayText}</span>
        <svg className="h-4 w-4 shrink-0 text-meta" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && (
        <div className="absolute start-0 end-0 top-full z-50 mt-1 max-h-60 overflow-auto rounded-[2px] border border-[color:var(--isl-hairline)] bg-paper shadow-none">
          <div className="sticky top-0 border-b border-[color:var(--isl-hairline)] bg-paper p-2">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t("select.search")}
              className="w-full rounded-[2px] border border-[color:var(--isl-hairline)] bg-sink px-2 py-1.5 text-sm text-ink placeholder-faint outline-none focus:ring-1 focus:ring-oxblood"
              autoFocus
            />
          </div>
          {filtered.length === 0 && (
            <p className="px-3 py-2 text-sm text-meta">{t("select.noResults")}</p>
          )}
          {filtered.map((item) => {
            const isSelected = selected.includes(item);
            return (
              <button
                key={item}
                type="button"
                onClick={() => toggle(item)}
                className={`flex w-full items-center gap-2 px-3 py-2 text-start text-sm transition hover:bg-sink ${
                  isSelected ? "text-oxblood" : "text-ink-2"
                }`}
              >
                {multiple && (
                  <span
                    className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-[2px] border text-sm ${
                      isSelected
                        ? "border-oxblood text-oxblood"
                        : "border-[color:var(--isl-hairline-strong)]"
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
    <div className="isl-speed-lines flex flex-col items-center justify-center gap-3 rounded-[2px] border border-dashed border-[color:var(--isl-hairline-strong)] bg-cream px-6 py-16 text-center">
      <span className="inline-flex h-10 w-10 items-center justify-center rounded-[2px] border border-brass text-brass-ink">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
          <path d="M3 3.75A.75.75 0 013.75 3h.5a.75.75 0 01.75.75v12.5a.75.75 0 01-.75.75h-.5a.75.75 0 01-.75-.75V3.75z" />
          <path d="M8 8.75A.75.75 0 018.75 8h.5a.75.75 0 01.75.75v7.5a.75.75 0 01-.75.75h-.5a.75.75 0 01-.75-.75v-7.5zM13 5.75a.75.75 0 01.75-.75h.5a.75.75 0 01.75.75v10.5a.75.75 0 01-.75.75h-.5a.75.75 0 01-.75-.75V5.75z" />
        </svg>
      </span>
      <p className="max-w-md font-isl-body text-xs font-semibold uppercase tracking-[0.2em] text-meta">{message}</p>
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
    <div className="rounded-[2px] border border-[color:var(--isl-hairline)] overflow-hidden">
      <button
        type="button"
        onClick={handleToggle}
        className="flex w-full items-center justify-between gap-2 bg-ink px-4 py-3 text-start transition hover:bg-ink/90"
      >
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-bone">{category.label}</span>
          <span className="num rounded-[2px] bg-bone/20 px-2 py-0.5 text-sm font-medium text-bone/80">
            {category.metrics.length}
          </span>
        </div>
        <svg
          className={`h-4 w-4 shrink-0 text-bone/70 transition-transform ${isOpen ? "rotate-180" : ""}`}
          fill="none" stroke="currentColor" viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {isOpen && <div className="border-t border-[color:var(--isl-hairline)] bg-cream px-4 py-3">{children}</div>}
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
      <span className="pointer-events-none absolute bottom-full start-0 z-50 mb-2 w-max max-w-[220px] rounded-[2px] border border-[color:var(--isl-hairline)] bg-paper px-2.5 py-1.5 text-[11px] font-medium text-ink opacity-0 transition-opacity group-hover/tip:opacity-100 text-start leading-snug">
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
    <div className="flex items-center justify-between gap-2 rounded-[2px] px-3 py-1.5 transition hover:bg-sink">
      {tooltip ? (
        <MetricTooltip text={tooltip}>
          <span className="text-sm text-meta truncate">
            {label}
          </span>
        </MetricTooltip>
      ) : (
        <span className="text-sm text-meta truncate">{label}</span>
      )}
      <span className="num text-sm font-semibold text-ink shrink-0">
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
    <div className="rounded-[2px] border border-[color:var(--isl-hairline)] bg-cream px-4 py-3">
      <div className="text-[10px] font-bold uppercase tracking-wider text-meta">
        {tooltip ? (
          <MetricTooltip text={tooltip}>
            <span>{label}</span>
          </MetricTooltip>
        ) : (
          label
        )}
      </div>
      <div className="num mt-1.5 text-xl font-extrabold tracking-tight text-ink sm:text-2xl">
        {fmtVal(value, isPct)}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Chart wrappers                                                     */
/* ------------------------------------------------------------------ */

const CHART_THEME = {
  bg: "#FBF8F0",
  border: "rgba(28,23,18,0.14)",
  grid: "rgba(28,23,18,0.14)",
  text: "#3A322A",
  muted: "#6E6455",
  highlight: "#7E2A1E",
  neutral: "#8A7E6A",
  tooltipBg: "#FBF8F0",
  tooltipBorder: "rgba(28,23,18,0.14)",
};

function CustomTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ name: string; value: number; color: string }>; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-[2px] border border-[color:var(--isl-hairline)] bg-paper px-3 py-2">
      <p className="mb-1 text-sm font-semibold text-ink-2">{label}</p>
      {payload.map((p, i) => (
        <p key={i} className="num text-sm" style={{ color: p.color }}>
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
      <text x={0} y={0} dy={12} textAnchor="middle" fill="#3A322A" fontSize={11}>
        {line1}
      </text>
      {line2 && (
        <text x={0} y={0} dy={26} textAnchor="middle" fill="#3A322A" fontSize={11}>
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
      <div className="rounded-[2px] border border-[color:var(--isl-hairline)] bg-paper px-3 py-2">
        <p className="mb-1 text-sm font-semibold text-ink-2">{label}</p>
        {payload.map((p, i) => {
          const actual = origRow ? origRow[p.dataKey ?? p.name] : p.value;
          return (
            <p key={i} className="num text-sm" style={{ color: p.color }}>
              {p.name}: <span className="font-bold">{fmtVal(typeof actual === "number" ? actual : p.value)}</span>
            </p>
          );
        })}
      </div>
    );
  }

  return (
    <div className="rounded-[2px] border border-[color:var(--isl-hairline)] bg-paper p-4">
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
            tick={{ fill: "#3A322A", fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            domain={normalise ? [0, 100] : undefined}
            allowDataOverflow={normalise}
            tickFormatter={normalise ? (v: number) => `${v}%` : undefined}
          />
          <Tooltip content={normalise ? <NormTooltip /> : <CustomTooltip />} />
          {!hideLegend && (
            <Legend
              wrapperStyle={{ fontSize: 12, color: "#3A322A" }}
            />
          )}
          {bars.map((b) => (
            <Bar
              key={b.key}
              dataKey={b.key}
              name={b.name}
              fill={b.color}
              radius={[2, 2, 0, 0]}
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
                    stroke={leaderAware && isLeader ? "rgba(28,23,18,0.35)" : "none"}
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
    <div className="rounded-[2px] border border-[color:var(--isl-hairline)] bg-paper p-4">
      <ResponsiveContainer width="100%" height={height}>
        <RadarChart cx="50%" cy="50%" outerRadius="72%" data={data}>
          <PolarGrid stroke="rgba(28,23,18,0.14)" />
          <PolarAngleAxis
            dataKey="subject"
            tick={{ fill: "#7E2A1E", fontSize: 12, fontWeight: 600 }}
          />
          <PolarRadiusAxis
            angle={90}
            tick={{ fill: "#3A322A", fontSize: 10 }}
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
            <Legend wrapperStyle={{ fontSize: 12, color: "#3A322A" }} />
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
  const t = useTranslations("stats");
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
    <div className="space-y-4 rounded-[2px] border border-[color:var(--isl-hairline)] bg-cream p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-meta">{t("charts.driverCumulativeTrend")}</h3>
        <div className="flex gap-1 rounded-[2px] border border-[color:var(--isl-hairline)] bg-paper p-0.5">
          {[5, 10, 15, 0].map((n) => (
            <button
              key={n}
              onClick={() => setRaceCount(n)}
              className={`rounded-[2px] px-2.5 py-1 text-xs font-semibold transition ${
                raceCount === n
                  ? "bg-ink text-bone"
                  : "text-meta hover:text-ink"
              }`}
            >
              {n === 0 ? t("raceCount.all") : t("raceCount.last", { n })}
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
          placeholder={t("select.selectMetric")}
        />
      </div>

      {chartData.length === 0 ? (
        <div className="flex h-48 items-center justify-center rounded-[2px] border border-[color:var(--isl-hairline)] bg-cream">
          <p className="text-sm text-meta">
            {t("empty.noRaceByRaceDriver")}
          </p>
        </div>
      ) : (
        <div className="h-72">
          <ResponsiveContainer width="100%" height={288}>
            <LineChart data={chartData} margin={{ top: 8, right: 12, bottom: 4, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(28,23,18,0.10)" />
              <XAxis
                dataKey="name"
                tick={{ fill: "#3A322A", fontSize: 10 }}
                axisLine={{ stroke: "rgba(28,23,18,0.14)" }}
                tickLine={false}
                interval="preserveStartEnd"
                angle={-18}
                textAnchor="end"
                height={56}
              />
              <YAxis
                tick={{ fill: "#3A322A", fontSize: 10 }}
                axisLine={{ stroke: "rgba(28,23,18,0.14)" }}
                tickLine={false}
                width={40}
              />
              <Tooltip
                contentStyle={{
                  background: "#FBF8F0",
                  border: "1px solid rgba(28,23,18,0.14)",
                  borderRadius: 2,
                  fontSize: 12,
                  color: "#1C1712",
                  boxShadow: "none",
                }}
                labelStyle={{ color: "#3A322A", marginBottom: 4 }}
              />
              <Line
                type="monotone"
                dataKey="value"
                name={selectedMetricLabel}
                stroke="#7E2A1E"
                strokeWidth={2.5}
                dot={{ r: 3, fill: "#7E2A1E" }}
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
  const t = useTranslations("stats");
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
    <div className="space-y-4 rounded-[2px] border border-[color:var(--isl-hairline)] bg-cream p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-meta">{t("charts.compareCumulativeTrend")}</h3>
        <div className="flex gap-1 rounded-[2px] border border-[color:var(--isl-hairline)] bg-paper p-0.5">
          {[5, 10, 15, 0].map((n) => (
            <button
              key={n}
              onClick={() => setRaceCount(n)}
              className={`rounded-[2px] px-2.5 py-1 text-xs font-semibold transition ${
                raceCount === n ? "bg-ink text-bone" : "text-meta hover:text-ink"
              }`}
            >
              {n === 0 ? t("raceCount.all") : t("raceCount.last", { n })}
            </button>
          ))}
        </div>
      </div>
      <p className="text-xs text-meta">
        {t("charts.compareCumulativeNote")}
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
          placeholder={t("select.selectMetric")}
        />
      </div>

      {chartData.length === 0 ? (
        <div className="flex h-48 items-center justify-center rounded-[2px] border border-[color:var(--isl-hairline)] bg-cream">
          <p className="text-sm text-meta">{t("empty.noRaceByRaceCompare")}</p>
        </div>
      ) : (
        <div className="h-72">
          <ResponsiveContainer width="100%" height={288}>
            <LineChart data={chartData} margin={{ top: 8, right: 12, bottom: 4, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(28,23,18,0.10)" />
              <XAxis
                dataKey="name"
                tick={{ fill: "#3A322A", fontSize: 10 }}
                axisLine={{ stroke: "rgba(28,23,18,0.14)" }}
                tickLine={false}
                interval="preserveStartEnd"
                angle={-18}
                textAnchor="end"
                height={56}
              />
              <YAxis
                tick={{ fill: "#3A322A", fontSize: 10 }}
                axisLine={{ stroke: "rgba(28,23,18,0.14)" }}
                tickLine={false}
                width={40}
              />
              <Tooltip
                contentStyle={{
                  background: "#FBF8F0",
                  border: "1px solid rgba(28,23,18,0.14)",
                  borderRadius: 2,
                  fontSize: 12,
                  color: "#1C1712",
                  boxShadow: "none",
                }}
                labelStyle={{ color: "#3A322A", marginBottom: 4 }}
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
  const t = useTranslations("stats");
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

  // Only offer the Wild scope when the relevant season(s) actually have it.
  const wildAvailable = useMemo(
    () => seasonHasWild(seasons ?? [], mode === "Season" ? season : undefined),
    [seasons, mode, season],
  );
  useEffect(() => {
    if (!wildAvailable && competitionFilter === "wild") setCompetitionFilter(undefined);
  }, [wildAvailable, competitionFilter]);

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
    return (
      <EmptyState
        message={
          mode === "Season"
            ? t("empty.noDriverStatsForSeason", { season })
            : t("empty.noDriverStats")
        }
      />
    );
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
            className="num rounded-[2px] border border-[color:var(--isl-hairline-strong)] bg-paper px-3 py-2 text-sm text-ink outline-none"
          >
            {availableSeasons.map((k) => (
              <option key={k} value={k} className="bg-paper">
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
          className={`rounded-[2px] px-3 py-2 text-sm font-semibold transition ${
            compare
              ? "bg-ink text-bone"
              : "border border-[color:var(--isl-hairline)] text-meta hover:text-ink"
          }`}
        >
          {compare ? t("compare.close") : t("compare.open")}
        </button>
      </div>

      <div className="rounded-[2px] border border-[color:var(--isl-hairline)] bg-cream p-4">
        <p className="mb-3 font-isl-body text-[0.75rem] font-semibold uppercase tracking-[0.2em] text-oxblood">{t("segments.results")}</p>
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
          showWild={wildAvailable}
        />
      </div>

      {/* Driver selector */}
      <div className="max-w-sm">
        <SearchableSelect
          options={driverNames}
          value={compare ? validDrivers : validDrivers[0] ?? ""}
          onChange={(v) => setSelectedDrivers(Array.isArray(v) ? v : [v])}
          placeholder={compare ? t("select.selectUpTo4Drivers") : t("select.selectDriver")}
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
            className="rounded-[2px] border border-[color:var(--isl-hairline)] bg-cream px-3 py-1.5 text-xs font-semibold text-meta transition hover:text-ink"
          >
            {allCategoriesExpanded ? t("expand.collapseAll") : t("expand.expandAll")}
          </button>
        </div>
      )}

      {/* ---- SINGLE DRIVER: hero + sub-tabs + detail grid ---- */}
      {singleDriver && (
        <div className="space-y-5">
          <div>
            <p className="mb-2 font-isl-body text-[0.75rem] font-semibold uppercase tracking-[0.2em] text-oxblood">{t("sections.overview")}</p>
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
            <p className="mb-2 font-isl-body text-[0.75rem] font-semibold uppercase tracking-[0.2em] text-oxblood">{t("sections.explore")}</p>
            <div className="flex flex-wrap gap-1.5 rounded-[2px] border border-[color:var(--isl-hairline)] bg-cream p-1.5">
              {DRIVER_STAT_TAB_ORDER.map((tabDef) => {
                const count = tabMetricGroups[tabDef.id].length;
                if (count === 0) return null;
                const active = driverStatTab === tabDef.id;
                return (
                  <button
                    key={tabDef.id}
                    type="button"
                    onClick={() => setDriverStatTab(tabDef.id)}
                    className={`rounded-[2px] px-3 py-2 text-xs font-semibold transition sm:text-sm ${
                      active
                        ? "bg-ink text-bone"
                        : "text-meta hover:bg-sink hover:text-ink"
                    }`}
                  >
                    {t(`driverStatTabs.${tabDef.id}`)}
                    <span
                      className={`num ms-1.5 rounded-[2px] px-1.5 py-0.5 text-[10px] ${
                        active ? "bg-bone/20 text-bone/90" : "bg-sink text-meta"
                      }`}
                    >
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="rounded-[2px] border border-[color:var(--isl-hairline)] bg-cream p-4">
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
                  <thead className="bg-sink">
                    <tr className="border-b border-[color:var(--isl-hairline-strong)]">
                      <th className="px-4 py-2 text-start text-sm font-semibold uppercase tracking-wider text-meta">
                        {t("table.metric")}
                      </th>
                      {selectedRows.map((dr, i) => (
                        <th
                          key={dr.driver_name}
                          className="px-4 py-2 text-end text-sm font-semibold uppercase tracking-wider"
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
                        <tr key={m.key} className="border-b border-[color:var(--isl-hairline)]">
                          <td className="px-4 py-1.5 text-sm text-meta">
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
                                className={`num px-4 py-1.5 text-end text-sm font-semibold ${
                                  isLeader
                                    ? "text-oxblood"
                                    : "text-faint"
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
                <h3 className="mb-2 text-sm font-semibold text-meta">{t("charts.keyMetricsNormalised")}</h3>
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
                <p className="mt-2 text-xs text-faint">
                  {t("charts.leaderHint")}
                </p>
                <div className="mt-2 flex justify-end">
                  <button
                    onClick={() => setShowAllMetrics(true)}
                    className="text-sm font-semibold text-oxblood hover:text-oxblood-deep transition"
                  >
                    {t("charts.allMetricsLink")}
                  </button>
                </div>
              </div>
            )}
            {radarData.length > 0 && (
              <div>
                <h3 className="mb-2 text-sm font-semibold text-meta">{t("charts.driverRatings")}</h3>
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
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80"
          onClick={() => setShowAllMetrics(false)}
        >
          <div
            className="relative mx-4 flex w-full max-w-6xl max-h-[90vh] flex-col rounded-[2px] border border-[color:var(--isl-hairline)] bg-paper"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-[color:var(--isl-hairline)] px-6 py-4">
              <h2 className="font-display text-lg font-bold text-ink">{t("modal.allMetricsNormalised")}</h2>
              <button
                onClick={() => setShowAllMetrics(false)}
                className="rounded-[2px] p-1.5 text-meta transition hover:bg-sink hover:text-ink"
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Metric picker */}
            <div className="border-b border-[color:var(--isl-hairline)] px-6 py-3">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-sm font-semibold text-meta uppercase tracking-wider">
                  {t("modal.metricsCount", { selected: modalSelectedKeys.size, total: allChartableMetrics.length })}
                </span>
                <div className="flex gap-2">
                  <button
                    onClick={() => setModalSelectedKeys(new Set(allChartableMetrics.map((m) => m.key)))}
                    className="text-[11px] font-semibold text-oxblood hover:text-oxblood-deep transition"
                  >
                    {t("modal.selectAll")}
                  </button>
                  <span className="text-faint">|</span>
                  <button
                    onClick={() => setModalSelectedKeys(new Set())}
                    className="text-[11px] font-semibold text-meta hover:text-ink transition"
                  >
                    {t("modal.clear")}
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
                      className={`rounded-[2px] px-2 py-1 text-[11px] font-medium transition ${
                        selected
                          ? "bg-ink text-bone"
                          : "bg-cream text-meta hover:text-ink"
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
              <div className="flex items-center gap-4 border-b border-[color:var(--isl-hairline)] bg-paper px-6 py-2">
                {selectedRows.map((dr, i) => (
                  <div key={dr.driver_name} className="flex items-center gap-1.5">
                    <span
                      className="inline-block h-3 w-3 rounded-[2px]"
                      style={{ backgroundColor: compare ? COMPARE_COLORS[i] : SINGLE_COLOR }}
                    />
                    <span className="text-sm font-medium text-ink-2">{dr.driver_name}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Horizontally scrollable chart */}
            <div className="flex-1 overflow-auto px-6 py-4">
              {modalBarData.length === 0 ? (
                <div className="flex items-center justify-center py-16">
                  <p className="text-sm text-meta">{t("modal.selectAtLeastOne")}</p>
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
  const t = useTranslations("stats");
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
    return <EmptyState message={t("empty.noLeagueStats")} />;
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
    { metric: "Total Events", shortKey: "league.kpi.events" },
    { metric: "# Drivers Participating*", shortKey: "league.kpi.drivers" },
    { metric: "Avg. Participation", shortKey: "league.kpi.avgParticipation" },
    { metric: "DNF Rate %", shortKey: "league.kpi.dnfRate" },
  ] as const;

  return (
    <div className="space-y-6">
      {/* Controls */}
      <div className="flex flex-wrap items-center gap-3">
        <Toggle options={["All-time", "Season"]} value={mode} onChange={(v) => setMode(v as "All-time" | "Season")} />
        {mode === "Season" && (
          <button
            onClick={() => setCompare(!compare)}
            className={`rounded-[2px] px-3 py-2 text-sm font-semibold transition ${
              compare
                ? "bg-ink text-bone"
                : "border border-[color:var(--isl-hairline)] text-meta hover:text-ink"
            }`}
          >
            {compare ? t("compare.closeSeasons") : t("compare.openSeasons")}
          </button>
        )}
      </div>

      {mode === "All-time" && (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {leagueHighlightDefs.map(({ metric, shortKey }) => {
            const row = league.find((r) => r.metric === metric);
            return (
              <div
                key={metric}
                className="rounded-[2px] border border-[color:var(--isl-hairline)] bg-cream px-4 py-3"
              >
                <div className="text-[10px] font-bold uppercase tracking-wider text-meta">{t(shortKey)}</div>
                <div className="num mt-1 text-xl font-extrabold text-ink sm:text-2xl">
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
            placeholder={t("select.select2Seasons")}
            multiple
            maxItems={2}
          />
        </div>
      )}

      {/* Stats table */}
      <div className="overflow-x-auto rounded-[2px] border border-[color:var(--isl-hairline)]">
        <table role="table" className="w-full text-sm">
          <thead className="bg-sink">
            <tr className="border-b border-[color:var(--isl-hairline-strong)]">
              <th className="px-4 py-3 text-start text-sm font-semibold uppercase tracking-wider text-meta">{t("table.metric")}</th>
              {mode === "All-time" ? (
                <th className="px-4 py-3 text-end text-sm font-semibold uppercase tracking-wider text-oxblood">{t("table.total")}</th>
              ) : compare ? (
                selectedSeasons.map((sc, i) => (
                  <th key={sc} className="px-4 py-3 text-end text-sm font-semibold uppercase tracking-wider" style={{ color: COMPARE_COLORS[i] }}>{sc}</th>
                ))
              ) : (
                seasonCols.map((sc) => (
                  <th key={sc} className="px-4 py-3 text-end text-sm font-semibold uppercase tracking-wider text-meta">{sc}</th>
                ))
              )}
            </tr>
          </thead>
          <tbody>
            {league.map((r) => {
              const tip = getMetricTooltip(r.metric, r.metric);
              const hasTip = tip !== r.metric;
              return (
              <tr key={r.metric} className="border-b border-[color:var(--isl-hairline)] hover:bg-sink/50 transition">
                <td className="px-4 py-2 text-ink-2 font-medium">
                  {hasTip ? (
                    <MetricTooltip text={tip}>
                      <span>{r.metric}</span>
                    </MetricTooltip>
                  ) : r.metric}
                </td>
                {mode === "All-time" ? (
                  <td className="num px-4 py-2 text-end font-semibold text-ink">{r.total}</td>
                ) : compare ? (
                  selectedSeasons.map((sc) => (
                    <td key={sc} className="num px-4 py-2 text-end font-semibold text-ink">{r.seasons[sc] ?? "-"}</td>
                  ))
                ) : (
                  seasonCols.map((sc) => (
                    <td key={sc} className="num px-4 py-2 text-end text-meta">{r.seasons[sc] ?? "-"}</td>
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
          <h3 className="mb-2 text-sm font-semibold text-meta">{t("charts.seasonComparisonNormalised")}</h3>
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
  const t = useTranslations("stats");
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
    return <EmptyState message={t("empty.noCircuitStats")} />;
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
          className={`rounded-[2px] px-3 py-2 text-sm font-semibold transition ${
            compare
              ? "bg-ink text-bone"
              : "border border-[color:var(--isl-hairline)] text-meta hover:text-ink"
          }`}
        >
          {compare ? t("compare.close") : t("compare.openCircuits")}
        </button>
      </div>

      {/* Circuit selector */}
      <div className="max-w-sm">
        <SearchableSelect
          options={circuitNames}
          value={compare ? validCircuits : validCircuits[0] ?? ""}
          onChange={(v) => setSelectedCircuits(Array.isArray(v) ? v : [v])}
          placeholder={compare ? t("select.selectUpTo2Circuits") : t("select.selectCircuit")}
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
            className="rounded-[2px] border border-[color:var(--isl-hairline)] bg-cream px-3 py-1.5 text-xs font-semibold text-meta transition hover:text-ink"
          >
            {allCategoriesExpanded ? t("expand.collapseAll") : t("expand.expandAll")}
          </button>
        </div>
      )}

      {/* ---- SINGLE CIRCUIT: All stats in categorised groups ---- */}
      {singleCircuit && (
        <div className="space-y-3">
          {/* Podium placements (special non-metric fields) */}
          {[
            { key: "Winners", labelKey: "circuits.winners", border: "border-brass", bg: "bg-cream", text: "text-brass-ink" },
            { key: "2nd Place", labelKey: "circuits.secondPlace", border: "border-[color:var(--isl-silver-ink)]", bg: "bg-cream", text: "text-silver-ink" },
            { key: "3rd Place", labelKey: "circuits.thirdPlace", border: "border-[color:var(--isl-bronze-ink)]", bg: "bg-cream", text: "text-bronze-ink" },
          ].map(({ key, labelKey, border, bg, text }) =>
            singleCircuit.raw[key] ? (
              <div key={key} className={`rounded-[2px] border ${border} ${bg} px-4 py-3`}>
                <p className={`text-sm font-semibold uppercase tracking-wider ${text}`}>{t(labelKey)}</p>
                <p className="mt-1 text-sm font-semibold text-ink">{singleCircuit.raw[key]}</p>
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
              <h3 className="mb-3 text-sm font-semibold text-meta">{t("circuits.seasonAppearances")}</h3>
              <div className="rounded-[2px] border border-[color:var(--isl-hairline)] bg-cream px-5 py-4">
                <div className="flex items-center justify-between gap-2">
                  {seasonAppearances.map(({ label, appeared }) => (
                    <div key={label} className="flex flex-col items-center gap-2">
                      <div
                        className={`flex h-10 w-10 items-center justify-center rounded-full border-2 transition-all ${
                          appeared
                            ? "border-oxblood bg-paper"
                            : "border-[color:var(--isl-hairline)] bg-cream"
                        }`}
                      >
                        {appeared && (
                          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5 text-oxblood">
                            <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clipRule="evenodd" />
                          </svg>
                        )}
                      </div>
                      <span className={`num text-xs font-semibold tracking-wider ${appeared ? "text-ink" : "text-faint"}`}>
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
                  <thead className="bg-sink">
                    <tr className="border-b border-[color:var(--isl-hairline-strong)]">
                      <th className="px-4 py-2 text-start text-sm font-semibold uppercase tracking-wider text-meta">
                        {t("table.metric")}
                      </th>
                      {selectedRows.map((cr, i) => (
                        <th
                          key={cr.circuit}
                          className="px-4 py-2 text-end text-sm font-semibold uppercase tracking-wider"
                          style={{ color: COMPARE_COLORS[i] }}
                        >
                          {cr.circuit}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {cat.metrics.map((m) => (
                      <tr key={m.key} className="border-b border-[color:var(--isl-hairline)]">
                        <td className="px-4 py-1.5 text-sm text-meta">
                          {m.tooltip ? (
                            <MetricTooltip text={m.tooltip}>
                              <span>{m.label}</span>
                            </MetricTooltip>
                          ) : m.label}
                        </td>
                        {selectedRows.map((cr) => (
                          <td key={cr.circuit} className="num px-4 py-1.5 text-end text-sm font-semibold text-ink">
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
              <h3 className="mb-2 text-sm font-semibold text-meta">{t("charts.comparisonNormalised")}</h3>
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
  const t = useTranslations("stats");
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

  // Only offer the Wild scope when the relevant season(s) actually have it.
  const wildAvailable = useMemo(
    () => seasonHasWild(seasons ?? [], mode === "Season" ? season : undefined),
    [seasons, mode, season],
  );
  useEffect(() => {
    if (!wildAvailable && competitionFilter === "wild") setCompetitionFilter(undefined);
  }, [wildAvailable, competitionFilter]);

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
        message={
          mode === "Season"
            ? t("empty.noDriverStatsForSeason", { season })
            : t("empty.noDriverStats")
        }
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
            className="num rounded-[2px] border border-[color:var(--isl-hairline-strong)] bg-paper px-3 py-2 text-sm text-ink outline-none"
          >
            {availableSeasons.map((k) => (
              <option key={k} value={k} className="bg-paper">
                Season {k.replace("S", "")}
              </option>
            ))}
          </select>
        )}
      </div>

      <div className="rounded-[2px] border border-[color:var(--isl-hairline)] bg-cream p-4">
        <p className="mb-3 font-isl-body text-[0.75rem] font-semibold uppercase tracking-[0.2em] text-oxblood">{t("segments.leaderboard")}</p>
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
          showWild={wildAvailable}
        />
      </div>

      <div className="flex flex-wrap gap-2">
        <span className="w-full font-isl-body text-[0.75rem] font-semibold uppercase tracking-[0.2em] text-oxblood sm:w-auto sm:self-center">
          {t("rankings.quickPicks")}
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
            className="rounded-[2px] border border-[color:var(--isl-hairline)] bg-cream px-3 py-1.5 text-xs font-semibold text-meta transition hover:border-oxblood hover:text-ink"
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Stat selector + sort toggle */}
      <div className="flex flex-wrap items-end gap-3">
        <div className="w-full max-w-sm">
          <label className="mb-1 block text-sm font-semibold uppercase tracking-wider text-meta">
            {t("rankings.stat")}
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
            placeholder={t("select.selectStat")}
          />
        </div>
        <button
          onClick={() => setSortAsc(!isAscending)}
          className="flex items-center gap-1.5 rounded-[2px] border border-[color:var(--isl-hairline)] bg-cream px-3 py-2 text-sm font-semibold text-meta transition hover:border-[color:var(--isl-hairline-strong)] hover:text-ink"
          title={
            isAscending
              ? t("rankings.sortAscTitle")
              : t("rankings.sortDescTitle")
          }
        >
          {isAscending ? t("rankings.lowestFirst") : t("rankings.highestFirst")}
        </button>
      </div>

      {/* Metric tooltip */}
      {currentMetric && currentMetric.tooltip !== currentMetric.key && (
        <p className="text-sm text-meta -mt-3">{currentMetric.tooltip}</p>
      )}

      {ranked.length >= 3 && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {ranked.slice(0, 3).map((r, idx) => {
            const ring =
              idx === 0
                ? "border-brass"
                : idx === 1
                  ? "border-[color:var(--isl-silver-ink)]"
                  : "border-[color:var(--isl-bronze-ink)]";
            const valueColor =
              idx === 0
                ? "text-brass-ink"
                : idx === 1
                  ? "text-silver-ink"
                  : "text-bronze-ink";
            return (
              <div
                key={r.driverName}
                className={`rounded-[2px] border bg-cream p-4 ${ring}`}
              >
                <div className="text-[10px] font-bold uppercase tracking-wider text-meta">
                  #{r.rank} {idx === 0 ? t("rankings.leader") : idx === 1 ? t("rankings.second") : t("rankings.third")}
                </div>
                <div className="mt-1 text-lg font-bold text-ink">
                  {onSelectDriver ? (
                    <button
                      type="button"
                      onClick={() => onSelectDriver(r.driverName)}
                      className="text-start hover:text-oxblood"
                    >
                      {r.driverName}
                    </button>
                  ) : (
                    r.driverName
                  )}
                </div>
                <div className={`num mt-2 text-2xl font-extrabold ${valueColor}`}>
                  {fmtVal(r.value, r.isPct)}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Rankings table */}
      {ranked.length > 0 ? (
        <div className="overflow-x-auto rounded-[2px] border border-[color:var(--isl-hairline)]">
          <table className="w-full text-sm">
            <thead className="bg-sink">
              <tr className="border-b border-[color:var(--isl-hairline-strong)]">
                <th className="w-16 px-4 py-3 text-center text-sm font-semibold uppercase tracking-wider text-meta">
                  #
                </th>
                <th className="px-4 py-3 text-start text-sm font-semibold uppercase tracking-wider text-meta">
                  {t("table.driver")}
                </th>
                {ranked[0]?.team !== null && (
                  <th className="px-4 py-3 text-start text-sm font-semibold uppercase tracking-wider text-meta">
                    {t("table.team")}
                  </th>
                )}
                <th className="hidden w-36 px-2 py-3 text-start text-[10px] font-bold uppercase tracking-wider text-meta sm:table-cell">
                  {t("table.vsField")}
                </th>
                <th className="px-4 py-3 text-end text-sm font-semibold uppercase tracking-wider text-oxblood">
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
                    className={`border-b border-[color:var(--isl-hairline)] transition hover:bg-sink/50 ${
                      isGold || isBronze
                        ? "bg-cream"
                        : isSilver
                          ? "bg-cream"
                          : ""
                    }`}
                  >
                    <td className="px-4 py-2.5 text-center">
                      <span
                        className={`num inline-flex h-7 w-7 items-center justify-center rounded-full text-sm font-bold ${
                          isGold
                            ? "text-brass-ink"
                            : isSilver
                              ? "text-silver-ink"
                              : isBronze
                                ? "text-bronze-ink"
                                : "text-meta"
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
                          className="font-semibold text-ink transition hover:text-oxblood"
                        >
                          {r.driverName}
                        </button>
                      ) : (
                        <span className="font-semibold text-ink">
                          {r.driverName}
                        </span>
                      )}
                    </td>

                    {r.team !== null && (
                      <td className="px-4 py-2.5 text-meta">{r.team}</td>
                    )}

                    <td className="hidden px-3 py-2.5 sm:table-cell">
                      <div className="h-2 overflow-hidden rounded-[2px] bg-sink">
                        <div
                          className="h-full rounded-[2px] bg-oxblood"
                          style={{ width: `${Math.min(100, Math.max(4, barW))}%` }}
                        />
                      </div>
                    </td>

                    <td className="num px-4 py-2.5 text-end font-bold text-ink">
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
          <EmptyState message={t("empty.noDriversForMetric")} />
        )
      )}

      {/* Summary footnote */}
      {ranked.length > 0 && (
        <p className="text-sm text-faint">
          {t("rankings.rankedCount", { count: ranked.length })}
          {mode === "Season"
            ? t("rankings.scopeSeason", { season: season.replace("S", "") })
            : t("rankings.scopeAllTime")}
          {currentMetric?.isPercentage ? t("rankings.valuesShownAsPct") : ""}
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
    <div className={`group relative rounded-[2px] border px-4 pb-3 pt-4 transition ${
      winnerSide === "a"
        ? "border-oxblood bg-cream"
        : winnerSide === "b"
          ? "border-[color:var(--isl-hairline-strong)] bg-cream"
          : "border-[color:var(--isl-hairline)] bg-cream"
    }`}>
      <span className="mb-3 block text-center text-[10px] font-semibold uppercase tracking-widest text-meta">{label}</span>
      {tip && (
        <span className="pointer-events-none absolute inset-x-0 bottom-[calc(100%+8px)] z-50 flex justify-center opacity-0 transition group-hover:opacity-100">
          <span className="w-48 rounded-[2px] border border-[color:var(--isl-hairline)] bg-paper px-3 py-2 text-[11px] font-normal normal-case leading-relaxed tracking-normal text-ink-2">
            {tip}
          </span>
        </span>
      )}
      <div className="flex items-end justify-between gap-2">
        <div className="flex flex-col items-center gap-0.5">
          <span className={`num text-xl font-extrabold leading-none ${winnerSide === "a" ? "text-oxblood" : "text-meta"}`}>
            {fmt(valueA)}
          </span>
        </div>
        <div className="mb-1 flex h-5 w-5 shrink-0 items-center justify-center">
          {winnerSide === "a" && (
            <svg className="h-3 w-3 text-oxblood" viewBox="0 0 12 12" fill="currentColor"><path d="M1 6l4-4v3h6v2H5v3z" /></svg>
          )}
          {winnerSide === "b" && (
            <svg className="h-3 w-3 text-[#2F5A6E]" viewBox="0 0 12 12" fill="currentColor"><path d="M11 6l-4-4v3H1v2h6v3z" /></svg>
          )}
          {!winnerSide && (
            <span className="text-[10px] font-bold text-faint">=</span>
          )}
        </div>
        <div className="flex flex-col items-center gap-0.5">
          <span className={`num text-xl font-extrabold leading-none ${winnerSide === "b" ? "text-[#2F5A6E]" : "text-meta"}`}>
            {fmt(valueB)}
          </span>
        </div>
      </div>
      {/* Proportional bar */}
      <div className="mt-3 flex h-1 overflow-hidden rounded-[2px] bg-sink">
        <div
          className={`transition-all duration-500 ${winnerSide === "a" ? "bg-oxblood" : "bg-oxblood/30"}`}
          style={{ width: `${pctA}%` }}
        />
        <div
          className={`transition-all duration-500 ${winnerSide === "b" ? "bg-[#2F5A6E]" : "bg-[#2F5A6E]/30"}`}
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
  const t = useTranslations("stats");
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
    <div className="space-y-4 rounded-[2px] border border-[color:var(--isl-hairline)] bg-cream p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-meta">{t("h2h.trendOverRaces")}</h3>

        {/* Race count selector */}
        <div className="flex gap-1 rounded-[2px] border border-[color:var(--isl-hairline)] bg-paper p-0.5">
          {RACE_COUNT_OPTIONS.map((n) => (
            <button
              key={n}
              onClick={() => setRaceCount(n)}
              className={`rounded-[2px] px-2.5 py-1 text-xs font-semibold transition ${
                raceCount === n
                  ? "bg-ink text-bone"
                  : "text-meta hover:text-ink"
              }`}
            >
              {n === 0 ? t("raceCount.all") : t("raceCount.last", { n })}
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
                <span className="text-[10px] font-semibold uppercase tracking-wider text-meta">{group}</span>
                <span className="group/tip relative cursor-help">
                  <svg className="h-3 w-3 text-faint" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M12 2a10 10 0 100 20 10 10 0 000-20z" />
                  </svg>
                  <span className="pointer-events-none absolute bottom-full left-1/2 z-50 mb-2 w-52 -translate-x-1/2 rounded-[2px] border border-[color:var(--isl-hairline)] bg-paper px-3 py-2 text-[11px] leading-relaxed text-ink-2 opacity-0 transition group-hover/tip:opacity-100">
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
        <p className="py-8 text-center text-sm text-meta">{t("h2h.selectAtLeastOneMetric")}</p>
      )}

      {selectedMetrics.length > 0 && (
        <div className="h-72">
          <ResponsiveContainer width="100%" height={288}>
            <LineChart data={chartData} margin={{ top: 8, right: 12, bottom: 4, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(28,23,18,0.10)" />
              <XAxis
                dataKey="name"
                tick={{ fill: "#3A322A", fontSize: 10 }}
                axisLine={{ stroke: "rgba(28,23,18,0.14)" }}
                tickLine={false}
                interval="preserveStartEnd"
                angle={-18}
                textAnchor="end"
                height={56}
              />
              <YAxis
                tick={{ fill: "#3A322A", fontSize: 10 }}
                axisLine={{ stroke: "rgba(28,23,18,0.14)" }}
                tickLine={false}
                width={36}
              />
              <Tooltip
                contentStyle={{
                  background: "#FBF8F0",
                  border: "1px solid rgba(28,23,18,0.14)",
                  borderRadius: 2,
                  fontSize: 12,
                  color: "#1C1712",
                  boxShadow: "none",
                }}
                labelStyle={{ color: "#3A322A", marginBottom: 4 }}
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
                  stroke="#7E2A1E"
                  strokeWidth={2}
                  dot={{ r: 3, fill: "#7E2A1E" }}
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
                  stroke="#2F5A6E"
                  strokeWidth={2}
                  dot={{ r: 3, fill: "#2F5A6E" }}
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
  const t = useTranslations("stats");
  const total = winsA + winsB + ties;
  if (total === 0) return null;
  const pA = (winsA / total) * 100;
  const pT = (ties / total) * 100;
  const pB = (winsB / total) * 100;

  return (
    <div className="space-y-2">
      <div className="flex justify-between text-sm font-semibold">
        <span className="num text-oxblood">{t("h2h.winsCount", { count: winsA })}</span>
        {ties > 0 && <span className="num text-meta">{t("h2h.tiesCount", { count: ties })}</span>}
        <span className="num text-[#2F5A6E]">{t("h2h.winsCount", { count: winsB })}</span>
      </div>
      <div className="flex h-3 overflow-hidden rounded-[2px] bg-sink">
        <div className="bg-oxblood transition-all" style={{ width: `${pA}%` }} />
        <div className="bg-[color:var(--isl-hairline-strong)] transition-all" style={{ width: `${pT}%` }} />
        <div className="bg-[#2F5A6E] transition-all" style={{ width: `${pB}%` }} />
      </div>
    </div>
  );
}

function H2HSection({
  raceResults,
  events,
  seasons,
}: {
  raceResults: Record<string, RaceResultRow[]>;
  events: RaceEvent[];
  seasons?: SeasonConfig[];
}) {
  const t = useTranslations("stats");
  const locale = useLocale();
  const driverIndex = useMemo(() => buildDriverIndex(raceResults), [raceResults]);
  const driverNames = useMemo(() => getDriverNames(driverIndex), [driverIndex]);
  const eventMeta = useMemo(() => buildEventMeta(events), [events]);
  const filterOptions = useMemo(() => getFilterOptions(eventMeta), [eventMeta]);
  // Lookup a RaceEvent by its event_id so visible GP / circuit names can be
  // shown in the active locale (Hebrew when available, else English fallback).
  const eventById = useMemo(() => {
    const map = new Map<string, RaceEvent>();
    for (const e of events) map.set(e.event_id, e);
    return map;
  }, [events]);

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

  // Only offer the Wild league when the selected season(s) actually have it.
  const wildAvailable = useMemo(() => {
    if (seasonFilters.length > 0) {
      return seasonFilters.some((sk) => seasonHasWild(seasons ?? [], sk));
    }
    return seasonHasWild(seasons ?? []);
  }, [seasons, seasonFilters]);
  useEffect(() => {
    if (!wildAvailable && competitionFilter === "wild") setCompetitionFilter("");
  }, [wildAvailable, competitionFilter]);
  const competitionOptions = wildAvailable
    ? ["All Leagues", "Main", "Wild"]
    : ["All Leagues", "Main"];

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
      <div className="mx-auto max-w-2xl rounded-[2px] border border-[color:var(--isl-hairline)] bg-cream px-5 py-4 text-center text-sm leading-relaxed text-meta">
        <span className="font-semibold text-ink-2">{t("h2h.explainerTitle")}</span>{" "}
        {t.rich("h2h.explainerBody", { em: (chunks) => <em>{chunks}</em> })}
      </div>

      {/* Driver selectors */}
      <div className="flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
        <div className="w-full max-w-xs">
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-oxblood">
            {t("h2h.driverA")}
          </label>
          <SearchableSelect
            options={optionsA}
            value={driverA}
            onChange={(v) => setDriverA(v as string)}
            placeholder={t("h2h.selectDriverA")}
          />
        </div>

        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[color:var(--isl-hairline)] bg-cream text-sm font-bold text-meta">
          {t("h2h.vs")}
        </div>

        <div className="w-full max-w-xs">
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-[#2F5A6E]">
            {t("h2h.driverB")}
          </label>
          <SearchableSelect
            options={optionsB}
            value={driverB}
            onChange={(v) => setDriverB(v as string)}
            placeholder={t("h2h.selectDriverB")}
          />
        </div>
      </div>

      {/* Swap + Filters row */}
      <div className="flex flex-wrap items-center justify-center gap-3">
        {driverA && driverB && (
          <button
            onClick={() => { const tmp = driverA; setDriverA(driverB); setDriverB(tmp); }}
            className="flex items-center gap-1.5 rounded-[2px] border border-[color:var(--isl-hairline)] bg-cream px-3 py-1.5 text-xs font-medium text-meta transition hover:border-[color:var(--isl-hairline-strong)] hover:text-ink"
          >
            <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
            </svg>
            {t("h2h.swap")}
          </button>
        )}

        <div className="h-5 w-px bg-[color:var(--isl-hairline)]" />

        <span className="text-xs font-medium uppercase tracking-wider text-meta">{t("h2h.filterBy")}</span>

        {/* Season multi-select */}
        <div className="w-48">
          <SearchableSelect
            options={filterOptions.seasons.map((s) => `Season ${s.replace("S", "")}`)}
            value={seasonFilters.map((s) => `Season ${s.replace("S", "")}`)}
            onChange={(v) => {
              const arr = (Array.isArray(v) ? v : [v]) as string[];
              setSeasonFilters(arr.map((label) => `S${label.replace("Season ", "")}`));
            }}
            placeholder={t("h2h.allSeasons")}
            multiple
          />
        </div>

        {/* Circuit multi-select */}
        <div className="w-48">
          <SearchableSelect
            options={filterOptions.circuits}
            value={circuitFilters}
            onChange={(v) => setCircuitFilters((Array.isArray(v) ? v : [v]) as string[])}
            placeholder={t("h2h.allCircuits")}
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
              placeholder={t("h2h.allWeather")}
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
            placeholder={t("h2h.allFormats")}
          />
        </div>

        <div className="w-36">
          <SearchableSelect
            options={competitionOptions}
            value={competitionFilter === "main" ? "Main" : competitionFilter === "wild" ? "Wild" : ""}
            onChange={(v) => {
              const s = v as string;
              setCompetitionFilter(s === "Main" ? "main" : s === "Wild" ? "wild" : "");
            }}
            placeholder={t("h2h.allLeagues")}
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
            placeholder={t("h2h.allRounds")}
          />
        </div>

        {activeFilterCount > 0 && (
          <button
            onClick={() => { setSeasonFilters([]); setCircuitFilters([]); setWeatherFilters([]); setFormatFilter(""); setCompetitionFilter(""); setRoundTypeFilter(""); }}
            className="flex items-center gap-1 rounded-[2px] border border-[color:var(--isl-hairline)] bg-cream px-2.5 py-1 text-[10px] font-medium text-meta transition hover:text-ink"
          >
            {t("h2h.clearAll")}
            <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {/* Empty state */}
      {(!driverA || !driverB) && (
        <EmptyState message={t("h2h.selectTwoDrivers")} />
      )}

      {driverA && driverB && driverA === driverB && (
        <EmptyState message={t("h2h.selectDifferentDrivers")} />
      )}

      {/* No shared races */}
      {h2h && h2h.summary.sharedRaces === 0 && (
        <EmptyState
          message={
            activeFilterCount > 0
              ? t("h2h.noSharedRacesFiltered", { driverA, driverB, filters: activeFilterLabel })
              : t("h2h.noSharedRaces", { driverA, driverB })
          }
        />
      )}

      {/* Results */}
      {h2h && h2h.summary.sharedRaces > 0 && (
        <div className="space-y-8">
          {/* Header */}
          <div className="text-center">
            <p className="text-sm text-meta">
              <span className="num font-semibold text-ink-2">{h2h.summary.sharedRaces}</span>{" "}
              {t("h2h.sharedRacesWord", { count: h2h.summary.sharedRaces })}
              {activeFilterCount > 0 && (
                <span className="text-faint"> · {activeFilterLabel}</span>
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
          <div className="overflow-x-auto rounded-[2px] border border-[color:var(--isl-hairline)] bg-paper">
            <table className="w-full min-w-[820px] text-sm">
              <thead className="bg-sink">
                <tr className="border-b border-[color:var(--isl-hairline-strong)] text-xs uppercase tracking-wider text-meta">
                  <th className="px-3 py-3 text-start font-medium" rowSpan={2}>{t("h2h.table.race")}</th>
                  <th className="px-3 py-3 text-start font-medium" rowSpan={2}>{t("h2h.table.date")}</th>
                  <th className="px-3 py-3 text-center font-medium" rowSpan={2}>{t("h2h.table.season")}</th>
                  <th className="px-3 py-3 text-center font-medium" rowSpan={2}>{t("h2h.table.league")}</th>
                  <th className="border-s border-[color:var(--isl-hairline)] px-3 py-2 text-center font-medium" colSpan={2}>{t("h2h.table.finish")}</th>
                  <th className="border-s border-[color:var(--isl-hairline)] px-3 py-2 text-center font-medium" colSpan={2}>{t("h2h.table.grid")}</th>
                  <th className="border-s border-[color:var(--isl-hairline)] px-3 py-3 text-center font-medium" rowSpan={2}>{t("h2h.table.better")}</th>
                </tr>
                <tr className="border-b border-[color:var(--isl-hairline)] text-[10px] uppercase tracking-wider">
                  <th className="border-s border-[color:var(--isl-hairline)] px-3 py-1 text-center font-medium text-oxblood">{driverA.split(" ").pop()}</th>
                  <th className="px-3 py-1 text-center font-medium text-[#2F5A6E]">{driverB.split(" ").pop()}</th>
                  <th className="border-s border-[color:var(--isl-hairline)] px-3 py-1 text-center font-medium text-oxblood">{driverA.split(" ").pop()}</th>
                  <th className="px-3 py-1 text-center font-medium text-[#2F5A6E]">{driverB.split(" ").pop()}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[color:var(--isl-hairline)]">
                {h2h.races.map((race) => {
                  const gridWinner = race.gridA !== null && race.gridB !== null
                    ? race.gridA < race.gridB ? "a" : race.gridB < race.gridA ? "b" : null
                    : null;
                  const raceEvent = eventById.get(race.eventId);
                  const raceNameDisplay = raceEvent
                    ? localizedRaceName(raceEvent, locale)
                    : race.raceName;
                  const circuitDisplay = raceEvent
                    ? localizedTrack(raceEvent, locale) ?? race.circuit
                    : race.circuit;
                  return (
                    <tr
                      key={race.eventId}
                      className="transition hover:bg-sink/50"
                    >
                      <td className="px-3 py-2.5 font-medium text-ink-2">
                        <button
                          type="button"
                          onClick={() => setResultsEventId(race.eventId)}
                          className="text-start underline decoration-[color:var(--isl-hairline-strong)] underline-offset-2 transition hover:text-oxblood hover:decoration-oxblood"
                        >
                          {raceNameDisplay}
                        </button>
                        {race.circuit && race.circuit !== race.raceName && (
                          <span className="ms-1.5 text-[10px] text-faint">{circuitDisplay}</span>
                        )}
                      </td>
                      <td className="num px-3 py-2.5 text-meta">{race.date}</td>
                      <td className="px-3 py-2.5 text-center">
                        {race.season && (
                          <span className="num inline-block rounded-[2px] bg-sink px-2 py-0.5 text-[10px] font-semibold text-meta">
                            {race.season}
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-center">
                        {race.league && (
                          <span className={`inline-block rounded-[2px] px-2 py-0.5 text-[10px] font-semibold uppercase ${
                            race.league.toLowerCase() === "wild"
                              ? "bg-cream text-status-warning"
                              : "bg-cream text-oxblood"
                          }`}>
                            {race.league}
                          </span>
                        )}
                      </td>
                      <td className={`num border-s border-[color:var(--isl-hairline)] px-3 py-2.5 text-center ${race.winner === "a" ? "font-bold text-oxblood" : "text-meta"}`}>
                        {race.statusA && race.finishA === null ? race.statusA : (race.finishA ?? "-")}
                      </td>
                      <td className={`num px-3 py-2.5 text-center ${race.winner === "b" ? "font-bold text-[#2F5A6E]" : "text-meta"}`}>
                        {race.statusB && race.finishB === null ? race.statusB : (race.finishB ?? "-")}
                      </td>
                      <td className={`num border-s border-[color:var(--isl-hairline)] px-3 py-2.5 text-center ${gridWinner === "a" ? "font-semibold text-oxblood" : "text-faint"}`}>
                        {race.gridA ?? "-"}
                      </td>
                      <td className={`num px-3 py-2.5 text-center ${gridWinner === "b" ? "font-semibold text-[#2F5A6E]" : "text-faint"}`}>
                        {race.gridB ?? "-"}
                      </td>
                      <td className="border-s border-[color:var(--isl-hairline)] px-3 py-2.5 text-center">
                        {race.winner === "a" && (
                          <span className="inline-block h-2.5 w-2.5 rounded-full bg-oxblood" />
                        )}
                        {race.winner === "b" && (
                          <span className="inline-block h-2.5 w-2.5 rounded-full bg-[#2F5A6E]" />
                        )}
                        {race.winner === "tie" && (
                          <span className="text-xs text-faint">—</span>
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
        const modalRaceName = eventObj
          ? localizedRaceName(eventObj, locale)
          : meta?.raceName ?? resultsEventId;
        return (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/80"
            onClick={() => setResultsEventId(null)}
          >
            <div
              className="relative mx-4 w-full max-w-5xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <h3 className="font-display text-sm font-semibold text-ink md:text-base">
                    {modalRaceName}
                  </h3>
                  {meta?.season && (
                    <span className="num rounded-[2px] bg-cream px-2 py-0.5 text-[10px] font-semibold text-meta">
                      {meta.season}
                    </span>
                  )}
                  {ytUrl && (
                    <a
                      href={ytUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 rounded-[2px] border border-[color:var(--isl-hairline)] bg-cream px-3 py-1 text-[11px] font-medium text-status-danger transition hover:bg-sink"
                    >
                      <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M23.5 6.2a3 3 0 00-2.1-2.1C19.5 3.5 12 3.5 12 3.5s-7.5 0-9.4.6A3 3 0 00.5 6.2 31.9 31.9 0 000 12a31.9 31.9 0 00.5 5.8 3 3 0 002.1 2.1c1.9.6 9.4.6 9.4.6s7.5 0 9.4-.6a3 3 0 002.1-2.1A31.9 31.9 0 0024 12a31.9 31.9 0 00-.5-5.8zM9.5 15.6V8.4l6.3 3.6-6.3 3.6z" />
                      </svg>
                      {t("h2h.watchRace")}
                    </a>
                  )}
                </div>
                <button
                  onClick={() => setResultsEventId(null)}
                  className="flex h-8 w-8 items-center justify-center rounded-full border border-[color:var(--isl-hairline-strong)] bg-paper text-ink transition hover:text-oxblood"
                >
                  ×
                </button>
              </div>

              {resultRows.length > 0 ? (
                <div className="max-h-[85vh] overflow-auto rounded-[2px] border border-[color:var(--isl-hairline)] bg-paper p-3">
                  <RaceResultsTable
                    results={resultRows}
                    caption={t("h2h.raceResultsCaption", { race: modalRaceName })}
                  />
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
        <H2HSection raceResults={raceResults} events={events} seasons={seasons} />
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
