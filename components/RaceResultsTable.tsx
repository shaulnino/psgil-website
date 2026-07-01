"use client";

import ResultsTable, { type ColumnDef } from "@/components/ResultsTable";
import type { RaceResultRow } from "@/lib/resultsData";
import { useDriverLookup } from "@/components/DriverLookupProvider";

/* ------------------------------------------------------------------ */
/*  Position-change arrow (color + glyph + sign — never colour alone)   */
/* ------------------------------------------------------------------ */

function PosChange({ value }: { value: string }) {
  const n = parseInt(value, 10);
  if (!value || isNaN(n) || n === 0) return <span className="text-faint">–</span>;
  if (n > 0) return <span className="num text-status-success">▲{n}</span>;
  return <span className="num text-status-danger">▼{Math.abs(n)}</span>;
}

/* ------------------------------------------------------------------ */
/*  Badge helpers — uppercase, tracked, 2px, hairline outline (no fill) */
/* ------------------------------------------------------------------ */

const badgeBase =
  "ms-1 inline-flex cursor-default items-center rounded-[2px] border px-1.5 py-0.5 text-[11px] font-bold uppercase tracking-wider";

function FastestLapBadge() {
  return (
    <span title="Fastest Lap" className={`${badgeBase} border-oxblood text-oxblood`}>
      FL
    </span>
  );
}

function DotdBadge() {
  return (
    <span title="Driver of the Day" className={`${badgeBase} border-brass text-brass-ink`}>
      DOTD
    </span>
  );
}

function PoleBadge() {
  return (
    <span title="Pole Position" className={`${badgeBase} border-status-info text-status-info`}>
      POLE
    </span>
  );
}

/* ------------------------------------------------------------------ */
/*  Clickable driver name cell                                          */
/* ------------------------------------------------------------------ */

function DriverNameCell({ row }: { row: RaceResultRow }) {
  const { getDriver, openDriverModal } = useDriverLookup();
  const hasCard = !!row.driver_id && !!getDriver(row.driver_id);

  const badges = (
    <>
      {row.fastest_lap?.toLowerCase() === "yes" && <FastestLapBadge />}
      {row.dotd?.toLowerCase() === "yes" && <DotdBadge />}
      {parseInt(row.grid, 10) === 1 && <PoleBadge />}
    </>
  );

  if (hasCard) {
    return (
      <span className="inline-flex items-center">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            openDriverModal(row.driver_id);
          }}
          className="cursor-pointer font-semibold text-ink underline-offset-2 transition-colors hover:text-oxblood hover:underline hover:decoration-oxblood/50"
        >
          {row.driver_name}
        </button>
        {badges}
      </span>
    );
  }

  return (
    <span className="font-semibold text-ink">
      {row.driver_name}
      {badges}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/*  Column definitions (matches the PNG layout)                         */
/* ------------------------------------------------------------------ */

const raceResultsColumns: ColumnDef<RaceResultRow>[] = [
  { label: "Pos", accessor: "position", align: "center", mono: true, minWidth: 40 },
  {
    label: "+/−",
    accessor: (row) => <PosChange value={row.position_change} />,
    align: "center",
    minWidth: 44,
  },
  {
    label: "Driver",
    accessor: (row) => <DriverNameCell row={row} />,
    minWidth: 160,
  },
  { label: "Team", accessor: "team", minWidth: 120, hideMobile: true },
  { label: "Time / Gap", accessor: "time_or_gap", mono: true, minWidth: 110 },
  { label: "Best Lap", accessor: "best_lap", mono: true, minWidth: 90, hideMobile: true },
  { label: "Grid", accessor: "grid", align: "center", mono: true, minWidth: 48, hideMobile: true },
  { label: "Stops", accessor: "stops", align: "center", mono: true, minWidth: 48, hideMobile: true },
  {
    label: "Points",
    accessor: (row) => (
      <span className="num font-semibold text-ink">{row.points || "0"}</span>
    ),
    align: "center",
    minWidth: 44,
  },
  {
    label: "Status",
    accessor: (row) => {
      const st = row.status.toLowerCase();
      if (st === "dnf" || st === "dns" || st === "dsq")
        return <span className="font-semibold uppercase text-status-danger">{row.status}</span>;
      return <span className="text-meta">{row.status || "Finished"}</span>;
    },
    align: "center",
    minWidth: 70,
    hideMobile: true,
  },
];

/* ------------------------------------------------------------------ */
/*  Component                                                           */
/* ------------------------------------------------------------------ */

type RaceResultsTableProps = {
  results: RaceResultRow[];
  caption?: string;
};

export default function RaceResultsTable({ results, caption }: RaceResultsTableProps) {
  return (
    <ResultsTable<RaceResultRow>
      data={results}
      columns={raceResultsColumns}
      caption={caption}
      rowHighlight={(row) => {
        const pos = parseInt(row.position, 10);
        if (pos === 1) return "p1";
        if (pos === 2) return "p2";
        if (pos === 3) return "p3";
        return null;
      }}
    />
  );
}
