"use client";

import React from "react";

/* ------------------------------------------------------------------ */
/*  Generic reusable data-table with PSGiL dark-theme styling          */
/*  • Sticky header                                                     */
/*  • Horizontal scroll on small screens                               */
/*  • Zebra rows + subtle separators                                   */
/*  • P1/P2/P3 highlighting (gold / silver / bronze)                   */
/* ------------------------------------------------------------------ */

export type ColumnDef<T> = {
  /** Header label */
  label: string;
  /** Key accessor OR render function */
  accessor: keyof T | ((row: T, idx: number) => React.ReactNode);
  /** Text alignment (default "left") */
  align?: "left" | "center" | "right";
  /** Use monospace font? (useful for times / gaps) */
  mono?: boolean;
  /** Extra className applied to <td> */
  className?: string;
  /** Min-width in px (for horizontal scroll sizing) */
  minWidth?: number;
  /** Hide on mobile? */
  hideMobile?: boolean;
};

/** Cumulative `left` (px) for horizontal `position:sticky` on the first `count` columns. */
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

/* Medal colours (row: includes left accent; sticky cells use bg-only — see below) */
const HIGHLIGHT_STYLES: Record<string, string> = {
  p1: "bg-[#D4AF37]/10 border-l-2 border-l-[#D4AF37]",
  p2: "bg-[#C0C0C0]/10 border-l-2 border-l-[#C0C0C0]",
  p3: "bg-[#CD7F32]/10 border-l-2 border-l-[#CD7F32]",
  highlight: "bg-[#7020B0]/10 border-l-2 border-l-[#7020B0]",
};

/**
 * Solid background hex values for sticky cells – pre-blended against the base
 * table background (#0B0B0E) so transparent colours don't let scrolled columns
 * bleed through.
 *
 * Formula: base + alpha*(colour - base), where alpha = row highlight opacity.
 * P1/P2/P3/highlight use 10 %; zebra uses 2 %.
 */
const STICKY_CELL_BG: Record<string, string> = {
  p1: "#1F1B12",        // #D4AF37 @ 10% on #0B0B0E
  p2: "#1D1D20",        // #C0C0C0 @ 10% on #0B0B0E
  p3: "#1E1712",        // #CD7F32 @ 10% on #0B0B0E
  highlight: "#150D1E", // #7020B0 @ 10% on #0B0B0E
  _zebra: "#101013",    // white  @  2% on #0B0B0E
  _default: "#0B0B0E",
};

function stickyBodyCellBg(highlight: string | null, ri: number): string {
  if (highlight && STICKY_CELL_BG[highlight]) return STICKY_CELL_BG[highlight];
  if (ri % 2 === 1) return STICKY_CELL_BG._zebra;
  return STICKY_CELL_BG._default;
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
  const stickyN = Math.max(0, horizontalStickyCount ?? 0);
  const stickyLefts = computeStickyLeftPx(columns, stickyN);

  // Resolve effective rows: if groups are provided use them, otherwise use data
  const effectiveRows = groups ? groups.flatMap((g) => g.rows) : data;

  if (effectiveRows.length === 0) {
    return (
      <div className="flex items-center justify-center rounded-2xl border border-white/10 bg-white/5 py-12">
        <p className="text-sm text-white/50">No data available yet.</p>
      </div>
    );
  }

  /* Helper: render a single data row */
  const renderRow = (row: T, ri: number) => {
    const highlight = rowHighlight?.(row, ri) ?? null;
    const hlClass = highlight ? HIGHLIGHT_STYLES[highlight] ?? "" : "";
    const zebraClass =
      !highlight && ri % 2 === 1 ? "bg-white/[0.02]" : "";

    return (
      <tr
        key={ri}
        className={`border-b border-white/5 transition hover:bg-white/5 ${hlClass} ${zebraClass}`}
      >
        {columns.map((col, ci) => {
          const value =
            typeof col.accessor === "function"
              ? col.accessor(row, ri)
              : (row[col.accessor] as React.ReactNode) ?? "";

          const isHSticky = ci < stickyN;
          const lastFrozen = isHSticky && ci === stickyN - 1;

          return (
            <td
              key={ci}
              className={`whitespace-nowrap px-3 py-2 text-white/80 ${
                col.align === "center"
                  ? "text-center"
                  : col.align === "right"
                    ? "text-right"
                    : "text-left"
              } ${col.mono ? "font-mono text-xs" : ""} ${col.className ?? ""} ${col.hideMobile ? "hidden md:table-cell" : ""} ${
                isHSticky
                  ? `sticky z-[1] ${lastFrozen ? "shadow-[4px_0_10px_-2px_rgba(0,0,0,0.55)]" : ""}`
                  : ""
              }`}
              style={
                isHSticky
                  ? {
                      left: stickyLefts[ci],
                      backgroundColor: stickyBodyCellBg(highlight, ri),
                    }
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
      className={`overflow-hidden rounded-2xl border border-white/10 bg-[linear-gradient(140deg,_rgba(255,255,255,0.06),_rgba(255,255,255,0.02))] ${className}`}
    >
      {caption && (
        <div className="border-b border-white/5 px-4 py-2">
          <span className="text-xs font-semibold uppercase tracking-[0.2em] text-white/40">
            {caption}
          </span>
        </div>
      )}

      {/* Scrollable wrapper */}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] border-collapse text-sm">
          {/* Sticky header */}
          <thead className="bg-[#111118]">
            <tr>
              {columns.map((col, ci) => {
                const isHSticky = ci < stickyN;
                const lastFrozen = isHSticky && ci === stickyN - 1;
                return (
                  <th
                    key={ci}
                    className={`sticky top-0 z-10 border-b border-white/10 bg-[#111118] px-3 py-3 text-xs font-semibold uppercase leading-tight tracking-[0.12em] text-white/90 ${
                      col.align === "center"
                        ? "text-center"
                        : col.align === "right"
                          ? "text-right"
                          : "text-left"
                    } ${col.hideMobile ? "hidden md:table-cell" : ""} ${
                      isHSticky
                        ? `z-20 ${lastFrozen ? "shadow-[4px_0_10px_-2px_rgba(0,0,0,0.55)]" : ""}`
                        : ""
                    }`}
                    style={{
                      ...(col.minWidth ? { minWidth: col.minWidth } : {}),
                      ...(isHSticky ? { left: stickyLefts[ci] } : {}),
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
                            className="h-3 border-b border-[#7020B0]/30 bg-transparent"
                          />
                        </tr>
                      )}
                      {/* Section header row */}
                      <tr>
                        <td
                          colSpan={columns.length}
                          className="border-b border-[#D4AF37]/20 bg-[#D4AF37]/[0.06] px-4 py-2.5"
                        >
                          <span className="text-xs font-bold uppercase tracking-[0.18em] text-[#D4AF37]">
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
