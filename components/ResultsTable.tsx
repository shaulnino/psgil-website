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
};

/* Medal colours */
const HIGHLIGHT_STYLES: Record<string, string> = {
  p1: "bg-[#D4AF37]/10 border-l-2 border-l-[#D4AF37]",
  p2: "bg-[#C0C0C0]/10 border-l-2 border-l-[#C0C0C0]",
  p3: "bg-[#CD7F32]/10 border-l-2 border-l-[#CD7F32]",
  highlight: "bg-[#7020B0]/10 border-l-2 border-l-[#7020B0]",
};

export default function ResultsTable<T extends Record<string, unknown>>({
  data,
  columns,
  caption,
  rowHighlight,
  className = "",
  groups,
}: Props<T>) {
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

          return (
            <td
              key={ci}
              className={`whitespace-nowrap px-3 py-2 text-white/80 ${
                col.align === "center"
                  ? "text-center"
                  : col.align === "right"
                    ? "text-right"
                    : "text-left"
              } ${col.mono ? "font-mono text-xs" : ""} ${col.className ?? ""} ${col.hideMobile ? "hidden md:table-cell" : ""}`}
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
          <thead className="sticky top-0 z-10 bg-[#111118]">
            <tr>
              {columns.map((col, ci) => (
                <th
                  key={ci}
                  className={`border-b border-white/10 px-3 py-3 text-[10px] font-semibold uppercase leading-tight tracking-[0.12em] text-white/90 ${
                    col.align === "center"
                      ? "text-center"
                      : col.align === "right"
                        ? "text-right"
                        : "text-left"
                  } ${col.hideMobile ? "hidden md:table-cell" : ""}`}
                  style={col.minWidth ? { minWidth: col.minWidth } : undefined}
                >
                  {col.label}
                </th>
              ))}
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
