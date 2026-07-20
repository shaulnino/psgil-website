"use client";

import { useState, useMemo, useCallback } from "react";
import { useTranslations } from "next-intl";

/* ------------------------------------------------------------------ */
/*  Shared constants                                                    */
/* ------------------------------------------------------------------ */

export const SINGLE_COLOR = "#7E2A1E";
export const COMPARE_COLOR = "#2F5A6E";

export const CHART_THEME = {
  bg: "#FBF8F0",
  border: "rgba(28,23,18,0.14)",
  grid: "rgba(28,23,18,0.10)",
  text: "#3A322A",
  muted: "#6E6455",
  highlight: "#7E2A1E",
  neutral: "#8A7E6A",
};

/* ------------------------------------------------------------------ */
/*  Lightweight hover tooltip                                           */
/* ------------------------------------------------------------------ */

export function MetricTooltip({
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
/*  Empty state                                                         */
/* ------------------------------------------------------------------ */

export function EmptyState({ message }: { message: string }) {
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
/*  Toggle (All-time / Season style)                                    */
/* ------------------------------------------------------------------ */

export function Toggle({
  options,
  value,
  onChange,
  labelFor,
}: {
  options: string[];
  value: string;
  onChange: (v: string) => void;
  labelFor?: (v: string) => string;
}) {
  return (
    <div className="flex gap-1 rounded-[2px] border border-[color:var(--isl-hairline)] bg-cream p-0.5">
      {options.map((o) => (
        <button
          key={o}
          type="button"
          onClick={() => onChange(o)}
          className={`rounded-[2px] px-3 py-1.5 text-sm font-semibold transition ${
            value === o ? "bg-ink text-bone" : "text-meta hover:text-ink"
          }`}
        >
          {labelFor ? labelFor(o) : o}
        </button>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Pill                                                                */
/* ------------------------------------------------------------------ */

export function Pill({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-[2px] px-2.5 py-1.5 text-xs font-semibold transition sm:text-sm ${
        active
          ? "bg-ink text-bone"
          : "border border-[color:var(--isl-hairline)] bg-paper text-meta hover:border-ink hover:text-ink"
      }`}
    >
      {children}
    </button>
  );
}

/* ------------------------------------------------------------------ */
/*  Active-filter chip                                                  */
/* ------------------------------------------------------------------ */

export function Chip({
  children,
  onRemove,
}: {
  children: React.ReactNode;
  onRemove?: () => void;
}) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-[2px] border border-[color:var(--isl-hairline)] bg-cream px-2 py-1 text-[11px] font-semibold text-meta">
      {children}
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          className="text-faint transition hover:text-oxblood"
          aria-label="remove filter"
        >
          ✕
        </button>
      )}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/*  Section card with anchor + heading                                  */
/* ------------------------------------------------------------------ */

export function SectionCard({
  id,
  title,
  note,
  action,
  children,
}: {
  id?: string;
  title: string;
  note?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-24 space-y-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="font-isl-body text-[0.75rem] font-semibold uppercase tracking-[0.2em] text-oxblood">
          {title}
        </h3>
        {action}
      </div>
      {note && <p className="text-xs text-faint">{note}</p>}
      {children}
    </section>
  );
}

/* ------------------------------------------------------------------ */
/*  Stat cards & lines                                                  */
/* ------------------------------------------------------------------ */

export function StatCard({
  label,
  value,
  sub,
  tooltip,
  trend,
}: {
  label: string;
  value: string;
  sub?: string;
  tooltip?: string;
  trend?: "up" | "down" | "flat";
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
      <div className="mt-1.5 flex items-baseline gap-1.5">
        <span className="num text-xl font-extrabold tracking-tight text-ink sm:text-2xl">
          {value}
        </span>
        {trend && (
          <span
            className={`text-sm font-bold ${
              trend === "up"
                ? "text-emerald-700"
                : trend === "down"
                  ? "text-oxblood"
                  : "text-faint"
            }`}
            aria-hidden
          >
            {trend === "up" ? "↑" : trend === "down" ? "↓" : "→"}
          </span>
        )}
      </div>
      {sub && <div className="num mt-0.5 text-[11px] font-medium text-faint">{sub}</div>}
    </div>
  );
}

export function StatLine({
  label,
  value,
  tooltip,
  sample,
}: {
  label: string;
  value: string;
  tooltip?: string;
  sample?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-2 rounded-[2px] px-3 py-1.5 transition hover:bg-sink">
      <span className="flex min-w-0 items-center gap-1.5">
        {tooltip ? (
          <MetricTooltip text={tooltip}>
            <span className="truncate text-sm text-meta">{label}</span>
          </MetricTooltip>
        ) : (
          <span className="truncate text-sm text-meta">{label}</span>
        )}
      </span>
      <span className="flex min-w-0 max-w-[60%] items-baseline justify-end gap-1.5">
        {sample && (
          <span className="num truncate text-[11px] text-faint" title={sample}>
            {sample}
          </span>
        )}
        <span className="num shrink-0 text-sm font-semibold text-ink">{value}</span>
      </span>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Searchable select (driver / circuit picker)                        */
/* ------------------------------------------------------------------ */

export function SearchableSelect({
  options,
  value,
  onChange,
  placeholder,
  labelFor,
}: {
  options: string[];
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  /** Optional display label for a value/option (value stays the raw string). */
  labelFor?: (v: string) => string;
}) {
  const t = useTranslations("stats");
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const label = useCallback(
    (v: string) => (labelFor ? labelFor(v) : v),
    [labelFor],
  );

  const filtered = useMemo(() => {
    const s = search.toLowerCase();
    return options.filter(
      (o) =>
        o.toLowerCase().includes(s) || label(o).toLowerCase().includes(s),
    );
  }, [options, search, label]);

  const select = useCallback(
    (item: string) => {
      onChange(item);
      setOpen(false);
      setSearch("");
    },
    [onChange],
  );

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-2 rounded-[2px] border border-[color:var(--isl-hairline-strong)] bg-paper px-3 py-2 text-start text-sm text-ink transition hover:border-oxblood"
      >
        <span className="truncate">{value ? label(value) : placeholder}</span>
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
          {filtered.map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => select(item)}
              className={`flex w-full items-center gap-2 px-3 py-2 text-start text-sm transition hover:bg-sink ${
                item === value ? "text-oxblood" : "text-ink-2"
              }`}
            >
              {label(item)}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
