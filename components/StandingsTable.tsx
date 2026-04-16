"use client";

import { useMemo, type ReactNode } from "react";
import ResultsTable, { type ColumnDef, type SectionGroup } from "@/components/ResultsTable";
import type { StandingsRow } from "@/lib/resultsData";
import { useDriverLookup } from "@/components/DriverLookupProvider";

/** En-dash for empty / zero stats (Points column is exempt — see below). */
function standingsStatCell(value: string | undefined): ReactNode {
  const s = (value ?? "").trim();
  if (s === "" || s === "-" || s === "—") {
    return <span className="text-white/30">–</span>;
  }
  const n = Number(s.replace(/,/g, ""));
  if (!Number.isNaN(n) && n === 0) {
    return <span className="text-white/30">–</span>;
  }
  return s;
}

/* ------------------------------------------------------------------ */
/*  Position-change arrow                                               */
/* ------------------------------------------------------------------ */

function PosChange({ value }: { value: string }) {
  const n = parseInt(value, 10);
  if (!value || isNaN(n) || n === 0) return <span className="text-white/30">–</span>;
  if (n > 0) return <span className="text-emerald-400">▲{n}</span>;
  return <span className="text-red-400">▼{Math.abs(n)}</span>;
}

/* ------------------------------------------------------------------ */
/*  Common standings columns                                            */
/* ------------------------------------------------------------------ */

const commonStandingsColumns: ColumnDef<StandingsRow>[] = [
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
];

const teamNameCol: ColumnDef<StandingsRow> = {
  label: "Team",
  accessor: "team",
  minWidth: 120,
};

const pointsAndStats: ColumnDef<StandingsRow>[] = [
  {
    label: "Points",
    accessor: (row) => (
      <span className="font-semibold text-[#D4AF37]">{row.points || "0"}</span>
    ),
    align: "center",
    minWidth: 56,
  },
  {
    label: "Gain",
    accessor: (row) => standingsStatCell(row.gain),
    align: "center",
    minWidth: 44,
    hideMobile: true,
  },
  {
    label: "Interval",
    accessor: (row) => standingsStatCell(row.interval),
    align: "center",
    mono: true,
    minWidth: 64,
    hideMobile: true,
  },
  {
    label: "Gap",
    accessor: (row) => standingsStatCell(row.gap),
    align: "center",
    mono: true,
    minWidth: 56,
    hideMobile: true,
  },
  {
    label: "Wins",
    accessor: (row) => standingsStatCell(row.p1),
    align: "center",
    minWidth: 42,
    hideMobile: true,
  },
  {
    label: "2nd",
    accessor: (row) => standingsStatCell(row.p2),
    align: "center",
    minWidth: 38,
    hideMobile: true,
  },
  {
    label: "3rd",
    accessor: (row) => standingsStatCell(row.p3),
    align: "center",
    minWidth: 38,
    hideMobile: true,
  },
  {
    label: "Top 5",
    accessor: (row) => standingsStatCell(row.top5),
    align: "center",
    minWidth: 44,
    hideMobile: true,
  },
  {
    label: "Top 10",
    accessor: (row) => standingsStatCell(row.top10),
    align: "center",
    minWidth: 48,
    hideMobile: true,
  },
  {
    label: "Best Finish",
    accessor: (row) => standingsStatCell(row.best_finish),
    align: "center",
    minWidth: 52,
    hideMobile: true,
  },
  {
    label: "Best Grid",
    accessor: (row) => standingsStatCell(row.best_quali),
    align: "center",
    minWidth: 52,
    hideMobile: true,
  },
  {
    label: "Fastest Laps",
    accessor: (row) => standingsStatCell(row.fastest_laps),
    align: "center",
    minWidth: 52,
    hideMobile: true,
  },
  {
    label: "Poles",
    accessor: (row) => standingsStatCell(row.poles),
    align: "center",
    minWidth: 44,
    hideMobile: true,
  },
  {
    label: "DOTD",
    accessor: (row) => standingsStatCell(row.dotd),
    align: "center",
    minWidth: 44,
    hideMobile: true,
  },
  {
    label: "Penalty Pts",
    accessor: (row) => standingsStatCell(row.penalty_points),
    align: "center",
    minWidth: 56,
    hideMobile: true,
  },
  {
    label: "DNFs",
    accessor: (row) => standingsStatCell(row.dnfs),
    align: "center",
    minWidth: 44,
    hideMobile: true,
  },
  {
    label: "Races",
    accessor: (row) => standingsStatCell(row.races),
    align: "center",
    minWidth: 48,
    hideMobile: true,
  },
];

/* ------------------------------------------------------------------ */
/*  Clickable driver name cell                                          */
/* ------------------------------------------------------------------ */

function DriverNameCell({
  driverId,
  driverName,
}: {
  driverId: string;
  driverName: string;
}) {
  const { getDriver, openDriverModal } = useDriverLookup();
  const hasCard = !!driverId && !!getDriver(driverId);

  if (hasCard) {
    return (
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          openDriverModal(driverId);
        }}
        className="font-semibold text-white transition-colors hover:text-[#D4AF37] hover:underline decoration-[#D4AF37]/40 underline-offset-2 cursor-pointer"
      >
        {driverName}
      </button>
    );
  }

  return <span className="font-semibold text-white">{driverName}</span>;
}

/* ------------------------------------------------------------------ */
/*  Build final column list per type                                    */
/* ------------------------------------------------------------------ */

function getColumns(type: "drivers" | "constructors"): ColumnDef<StandingsRow>[] {
  if (type === "drivers") {
    return [
      ...commonStandingsColumns,
      {
        label: "Driver",
        accessor: (row) => (
          <DriverNameCell driverId={row.driver_id} driverName={row.driver_name} />
        ),
        minWidth: 150,
      },
      teamNameCol,
      ...pointsAndStats,
    ];
  }
  // Constructors — no driver_name, team column comes earlier
  return [
    ...commonStandingsColumns,
    {
      ...teamNameCol,
      accessor: (row) => (
        <span className="font-semibold text-white">{row.team}</span>
      ),
    },
    ...pointsAndStats,
  ];
}

/* ------------------------------------------------------------------ */
/*  Component                                                           */
/* ------------------------------------------------------------------ */

type StandingsTableProps = {
  standings: StandingsRow[];
  caption?: string;
  type: "drivers" | "constructors";
};

export default function StandingsTable({
  standings,
  caption,
  type,
}: StandingsTableProps) {
  /* Detect if any rows carry bracket info (upper / lower) */
  const hasUpper = standings.some((r) => r.bracket === "upper");
  const hasLower = standings.some((r) => r.bracket === "lower");
  const hasBrackets = hasUpper || hasLower;

  /* Build section groups when brackets exist */
  let groups: SectionGroup<StandingsRow>[] | undefined;
  if (hasBrackets) {
    const upper = standings.filter((r) => r.bracket === "upper" || (!r.bracket && !hasLower));
    const lower = standings.filter((r) => r.bracket === "lower");
    groups = [];
    if (upper.length > 0) groups.push({ label: "Upper Bracket", rows: upper });
    if (lower.length > 0) groups.push({ label: "Lower Bracket", rows: lower });
  }

  const highlight = (row: StandingsRow) => {
    const pos = parseInt(row.position, 10);
    if (pos === 1) return "p1";
    if (pos === 2) return "p2";
    if (pos === 3) return "p3";
    return null;
  };

  const columns = useMemo(() => getColumns(type), [type]);
  const horizontalStickyCount =
    columns.findIndex((c) => c.label === "Points") + 1;

  return (
    <ResultsTable<StandingsRow>
      data={standings}
      columns={columns}
      caption={caption}
      rowHighlight={highlight}
      groups={groups}
      horizontalStickyCount={horizontalStickyCount}
    />
  );
}
