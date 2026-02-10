"use client";

import ResultsTable, { type ColumnDef } from "@/components/ResultsTable";
import type { RaceResultRow } from "@/lib/resultsData";
import { useDriverLookup } from "@/components/DriverLookupProvider";

/* ------------------------------------------------------------------ */
/*  Position-change arrow                                               */
/* ------------------------------------------------------------------ */

function PosChange({ value }: { value: string }) {
  const n = parseInt(value, 10);
  if (!value || isNaN(n) || n === 0) return <span className="text-white/30">–</span>;
  if (n > 0)
    return <span className="text-emerald-400">▲{n}</span>;
  return <span className="text-red-400">▼{Math.abs(n)}</span>;
}

/* ------------------------------------------------------------------ */
/*  Badge helpers                                                       */
/* ------------------------------------------------------------------ */

function FastestLapBadge() {
  return (
    <span
      title="Fastest Lap"
      className="ml-1 inline-flex cursor-default items-center rounded-full bg-purple-500/20 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-purple-300"
    >
      FL
    </span>
  );
}

function DotdBadge() {
  return (
    <span
      title="Driver of the Day"
      className="ml-1 inline-flex cursor-default items-center rounded-full bg-[#D4AF37]/20 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-[#D4AF37]"
    >
      DOTD
    </span>
  );
}

/* ------------------------------------------------------------------ */
/*  Clickable driver name cell                                          */
/* ------------------------------------------------------------------ */

function DriverNameCell({
  row,
}: {
  row: RaceResultRow;
}) {
  const { getDriver, openDriverModal } = useDriverLookup();
  const hasCard = !!row.driver_id && !!getDriver(row.driver_id);

  const badges = (
    <>
      {row.fastest_lap?.toLowerCase() === "yes" && <FastestLapBadge />}
      {row.dotd?.toLowerCase() === "yes" && <DotdBadge />}
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
          className="font-semibold text-white transition-colors hover:text-[#D4AF37] hover:underline decoration-[#D4AF37]/40 underline-offset-2 cursor-pointer"
        >
          {row.driver_name}
        </button>
        {badges}
      </span>
    );
  }

  return (
    <span className="font-semibold text-white">
      {row.driver_name}
      {badges}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/*  Column definitions (matches the PNG layout)                         */
/* ------------------------------------------------------------------ */

const raceResultsColumns: ColumnDef<RaceResultRow>[] = [
  {
    label: "Pos",
    accessor: "position",
    align: "center",
    minWidth: 40,
  },
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
  {
    label: "Team",
    accessor: "team",
    minWidth: 120,
    hideMobile: true,
  },
  {
    label: "Time / Gap",
    accessor: "time_or_gap",
    mono: true,
    minWidth: 110,
  },
  {
    label: "Best Lap",
    accessor: "best_lap",
    mono: true,
    minWidth: 90,
    hideMobile: true,
  },
  {
    label: "Laps",
    accessor: "laps",
    align: "center",
    minWidth: 48,
    hideMobile: true,
  },
  {
    label: "Grid",
    accessor: "grid",
    align: "center",
    minWidth: 48,
    hideMobile: true,
  },
  {
    label: "Stops",
    accessor: "stops",
    align: "center",
    minWidth: 48,
    hideMobile: true,
  },
  {
    label: "Points",
    accessor: (row) => (
      <span className="font-semibold text-[#D4AF37]">
        {row.points || "0"}
      </span>
    ),
    align: "center",
    minWidth: 44,
  },
  {
    label: "Status",
    accessor: (row) => {
      const st = row.status.toLowerCase();
      if (st === "dnf" || st === "dsq")
        return (
          <span className="font-semibold text-red-400 uppercase">
            {row.status}
          </span>
        );
      return <span className="text-white/40">{row.status || "Finished"}</span>;
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
  highlightDriverId?: string;
};

export default function RaceResultsTable({
  results,
  caption,
}: RaceResultsTableProps) {
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
