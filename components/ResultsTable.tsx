"use client";

import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";

/* ------------------------------------------------------------------ */
/*  Generic reusable data-table — ISL "Qav Rishon" editorial styling   */
/*  • Sticky header (gold-hairline thead, mono numerals)               */
/*  • Horizontal scroll on small screens; frozen columns via hairline  */
/*  • Zebra rows (solid cream) so sticky/frozen cells stay opaque       */
/*  • P1/P2/P3 medal accent = metal hairline on the row start edge      */
/* ------------------------------------------------------------------ */

export type ColumnDef<T> = {
  /** Header label */
  label: string;
  /** Key accessor OR render function */
  accessor: keyof T | ((row: T, idx: number) => React.ReactNode);
  /** Text alignment (default "left") */
  align?: "left" | "center" | "right";
  /** Use monospace/tabular numerals? (times / gaps / points) */
  mono?: boolean;
  /** Extra className applied to <td> */
  className?: string;
  /** Min-width in px (for horizontal scroll sizing) */
  minWidth?: number;
  /** Hide on mobile? */
  hideMobile?: boolean;
};

/** Cumulative `left` (px) for horizontal `position:sticky` on the first `count`
 *  columns, estimated from each column's `minWidth`. Used for the very first
 *  paint / SSR; once mounted we replace these with the *measured* widths (see
 *  `useLayoutEffect` below), because columns almost always render wider than
 *  their `minWidth`, and under-estimating the offset makes frozen columns
 *  overlap each other when the table is scrolled horizontally. */
function computeStickyLeftPx<T>(columns: ColumnDef<T>[], count: number): number[] {
  const lefts: number[] = [];
  let acc = 0;
  const n = Math.max(0, Math.min(count, columns.length));
  for (let i = 0; i < n; i++) {
    lefts[i] = acc;
    const w = columns[i].minWidth ?? 72;
    acc += w;
  }
  return lefts;
}

/** A labelled group of rows rendered with a section header inside the table. */
export type SectionGroup<T> = {
  label: string;
  rows: T[];
};

type Props<T extends Record<string, unknown>> = {
  data: T[];
  columns: ColumnDef<T>[];
  caption?: string;
  /** Callback that returns "p1" | "p2" | "p3" | "highlight" | null for a row */
  rowHighlight?: (row: T, idx: number) => string | null;
  /** Extra CSS class for wrapper */
  className?: string;
  /** Optional section groups – renders section-header rows between groups.
   *  When provided, `data` is ignored and groups.rows are used instead. */
  groups?: SectionGroup<T>[];
  /** First N columns stay fixed on the left when the table scrolls horizontally. */
  horizontalStickyCount?: number;
};

/* Medal / highlight accent — a metal hairline on the row's inline-start edge
   (no fill). P1 brass, P2 silver, P3 bronze, highlight oxblood. */
const HIGHLIGHT_STYLES: Record<string, string> = {
  p1: "border-s-2 border-brass",
  p2: "border-s-2 border-silver-ink",
  p3: "border-s-2 border-bronze-ink",
  highlight: "border-s-2 border-oxblood",
};

/** Opaque solid background for sticky/frozen cells (no blend math): paper for
 *  even rows, cream for zebra rows — always opaque so scrolled columns never
 *  bleed through. */
function stickyBodyCellBg(ri: number): string {
  return ri % 2 === 1 ? "var(--isl-cream)" : "var(--isl-paper)";
}

export default function ResultsTable<T extends Record<string, unknown>>({
  data,
  columns,
  caption,
  rowHighlight,
  className = "",
  groups,
  horizontalStickyCount,
}: Props<T>) {
  const t = useTranslations("schedule");
  const stickyN = Math.max(0, horizontalStickyCount ?? 0);

  // Resolve effective rows: if groups are provided use them, otherwise use data
  const effectiveRows = groups ? groups.flatMap((g) => g.rows) : data;

  // Sticky-column offsets. Start from the minWidth estimate (SSR/first paint),
  // then correct with the real rendered widths so frozen columns line up edge
  // to edge instead of overlapping when scrolled sideways. We also read the
  // table's text direction and apply a *physical* left/right inset (logical
  // `inset-inline-start` is unreliable for sticky in RTL horizontal scroll).
  const headRowRef = useRef<HTMLTableRowElement>(null);
  const [measuredLefts, setMeasuredLefts] = useState<number[] | null>(null);
  const [dir, setDir] = useState<"ltr" | "rtl">("ltr");
  const fallbackLefts = computeStickyLeftPx(columns, stickyN);
  const stickyLefts = measuredLefts ?? fallbackLefts;
  const insetKey: "left" | "right" = dir === "rtl" ? "right" : "left";

  // Freeze columns only on wider viewports (matches the previous `md:` gating).
  const [isDesktop, setIsDesktop] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)");
    const update = () => setIsDesktop(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  useLayoutEffect(() => {
    if (stickyN === 0) {
      setMeasuredLefts(null);
      return;
    }
    const measure = () => {
      const row = headRowRef.current;
      if (!row) return;
      setDir(getComputedStyle(row).direction === "rtl" ? "rtl" : "ltr");
      const cells = Array.from(row.children) as HTMLElement[];
      const lefts: number[] = [];
      let acc = 0;
      for (let i = 0; i < Math.min(stickyN, cells.length); i++) {
        lefts[i] = acc;
        acc += cells[i].getBoundingClientRect().width;
      }
      setMeasuredLefts((prev) =>
        prev && prev.length === lefts.length && prev.every((v, i) => Math.abs(v - lefts[i]) < 0.5)
          ? prev
          : lefts,
      );
    };
    measure();
    const row = headRowRef.current;
    const ro = new ResizeObserver(measure);
    if (row) {
      (Array.from(row.children) as HTMLElement[])
        .slice(0, stickyN)
        .forEach((el) => ro.observe(el));
    }
    window.addEventListener("resize", measure);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", measure);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stickyN, columns, effectiveRows.length]);

  if (effectiveRows.length === 0) {
    return (
      <div className="flex items-center justify-center rounded-[2px] border border-[color:var(--isl-hairline)] bg-paper py-12">
        <p className="text-sm text-meta">{t("resultsTable.noData")}</p>
      </div>
    );
  }

  /* Helper: render a single data row */
  const renderRow = (row: T, ri: number) => {
    const highlight = rowHighlight?.(row, ri) ?? null;
    const hlClass = highlight ? HIGHLIGHT_STYLES[highlight] ?? "" : "";
    const zebra = ri % 2 === 1;

    return (
      <tr
        key={ri}
        className={`border-b border-[color:var(--isl-hairline)] transition-colors hover:bg-sink/50 ${hlClass} ${
          zebra ? "bg-cream" : ""
        }`}
      >
        {columns.map((col, ci) => {
          const value =
            typeof col.accessor === "function"
              ? col.accessor(row, ri)
              : (row[col.accessor] as React.ReactNode) ?? "";

          const isHSticky = ci < stickyN;
          const lastFrozen = isHSticky && ci === stickyN - 1;
          const stickyActive = isHSticky && isDesktop;

          return (
            <td
              key={ci}
              className={`whitespace-nowrap px-3 py-2 text-ink-2 ${
                col.align === "center"
                  ? "text-center"
                  : col.align === "right"
                    ? "text-end"
                    : "text-start"
              } ${col.mono ? "num" : ""} ${col.className ?? ""} ${col.hideMobile ? "hidden md:table-cell" : ""} ${
                stickyActive && lastFrozen ? "border-e border-[color:var(--isl-hairline-strong)]" : ""
              }`}
              style={
                stickyActive
                  ? ({
                      position: "sticky",
                      [insetKey]: `${stickyLefts[ci]}px`,
                      zIndex: 1,
                      backgroundColor: stickyBodyCellBg(ri),
                    } as React.CSSProperties)
                  : undefined
              }
            >
              {value}
            </td>
          );
        })}
      </tr>
    );
  };

  return (
    <div
      className={`overflow-hidden rounded-[2px] border border-[color:var(--isl-hairline)] bg-paper ${className}`}
    >
      {caption && (
        <div className="border-b border-[color:var(--isl-hairline)] px-4 py-2">
          <span className="font-isl-body text-xs font-semibold uppercase tracking-[0.2em] text-meta">
            {caption}
          </span>
        </div>
      )}

      {/* Scrollable wrapper */}
      <div className="overflow-x-auto">
        <table className="w-full min-w-max border-collapse text-sm">
          {/* Sticky header — gold (oxblood) top hairline + strong bottom rule */}
          <thead className="bg-sink">
            <tr ref={headRowRef}>
              {columns.map((col, ci) => {
                const isHSticky = ci < stickyN;
                const lastFrozen = isHSticky && ci === stickyN - 1;
                const stickyActive = isHSticky && isDesktop;
                return (
                  <th
                    key={ci}
                    className={`sticky top-0 z-10 border-t-2 border-[color:var(--isl-oxblood)] border-b border-[color:var(--isl-hairline-strong)] bg-sink px-3 py-3 font-isl-body text-xs font-semibold uppercase leading-tight tracking-[0.12em] text-meta ${
                      col.align === "center"
                        ? "text-center"
                        : col.align === "right"
                          ? "text-end"
                          : "text-start"
                    } ${col.hideMobile ? "hidden md:table-cell" : ""} ${
                      stickyActive && lastFrozen ? "border-e border-[color:var(--isl-hairline-strong)]" : ""
                    }`}
                    style={{
                      ...(col.minWidth ? { minWidth: col.minWidth } : {}),
                      ...(stickyActive
                        ? ({ [insetKey]: `${stickyLefts[ci]}px`, zIndex: 20 } as React.CSSProperties)
                        : {}),
                    }}
                  >
                    {col.label}
                  </th>
                );
              })}
            </tr>
          </thead>

          <tbody>
            {groups
              ? /* ---- Grouped rendering with section headers ---- */
                groups.map((group, gi) => {
                  const rows = group.rows;
                  if (rows.length === 0) return null;
                  return (
                    <React.Fragment key={gi}>
                      {/* Spacer row between groups (not before the first) */}
                      {gi > 0 && (
                        <tr aria-hidden="true">
                          <td
                            colSpan={columns.length}
                            className="h-3 border-b border-[color:var(--isl-hairline)] bg-transparent"
                          />
                        </tr>
                      )}
                      {/* Section header row */}
                      <tr>
                        <td
                          colSpan={columns.length}
                          className="border-b border-[color:var(--isl-hairline)] bg-cream px-4 py-2.5"
                        >
                          <span className="font-isl-body text-xs font-bold uppercase tracking-[0.18em] text-brass-ink">
                            {group.label}
                          </span>
                        </td>
                      </tr>
                      {/* Data rows */}
                      {rows.map((row, ri) => renderRow(row, ri))}
                    </React.Fragment>
                  );
                })
              : /* ---- Flat rendering (unchanged behaviour) ---- */
                effectiveRows.map((row, ri) => renderRow(row, ri))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
