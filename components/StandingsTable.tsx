"use client";

import { useMemo, type ReactNode } from "react";
import { useTranslations, useLocale } from "next-intl";
import ResultsTable, { type ColumnDef, type SectionGroup } from "@/components/ResultsTable";
import type { StandingsRow } from "@/lib/resultsData";
import { localizedDriverName } from "@/lib/driversData";
import { useDriverLookup } from "@/components/DriverLookupProvider";

type Translator = (key: string) => string;

/** En-dash for empty / zero stats (Points column is exempt — see below). */
function standingsStatCell(value: string | undefined): ReactNode {
  const s = (value ?? "").trim();
  if (s === "" || s === "-" || s === "—") {
    return <span className="text-faint">–</span>;
  }
  const n = Number(s.replace(/,/g, ""));
  if (!Number.isNaN(n) && n === 0) {
    return <span className="text-faint">–</span>;
  }
  return <span className="num">{s}</span>;
}

/* ------------------------------------------------------------------ */
/*  Position-change arrow                                               */
/* ------------------------------------------------------------------ */

function PosChange({ value }: { value: string }) {
  const n = parseInt(value, 10);
  if (!value || isNaN(n) || n === 0) return <span className="text-faint">–</span>;
  if (n > 0) return <span className="num text-status-success">▲{n}</span>;
  return <span className="num text-status-danger">▼{Math.abs(n)}</span>;
}

/* ------------------------------------------------------------------ */
/*  Common standings columns                                            */
/* ------------------------------------------------------------------ */

const buildCommonStandingsColumns = (t: Translator): ColumnDef<StandingsRow>[] => [
  {
    label: t("standingsTable.pos"),
    accessor: (row) => {
      const p = parseInt(row.position, 10);
      const podium =
        p === 1
          ? "font-bold text-brass-ink"
          : p === 2
            ? "font-bold text-silver-ink"
            : p === 3
              ? "font-bold text-bronze-ink"
              : "text-ink-2";
      return <span className={`num ${podium}`}>{row.position}</span>;
    },
    align: "center",
    mono: true,
    minWidth: 40,
  },
  {
    label: t("standingsTable.posChange"),
    accessor: (row) => <PosChange value={row.position_change} />,
    align: "center",
    mono: true,
    minWidth: 44,
  },
];

const buildTeamNameCol = (t: Translator): ColumnDef<StandingsRow> => ({
  label: t("standingsTable.team"),
  accessor: (row) => <span className="text-ink-2">{row.team}</span>,
  minWidth: 120,
});

const buildPointsAndStats = (t: Translator): ColumnDef<StandingsRow>[] => [
  {
    label: t("standingsTable.points"),
    accessor: (row) => (
      <span className="num font-semibold text-ink">{row.points || "0"}</span>
    ),
    align: "center",
    mono: true,
    minWidth: 56,
  },
  {
    label: t("standingsTable.gain"),
    accessor: (row) => standingsStatCell(row.gain),
    align: "center",
    mono: true,
    minWidth: 44,
    hideMobile: true,
  },
  {
    label: t("standingsTable.interval"),
    accessor: (row) => standingsStatCell(row.interval),
    align: "center",
    mono: true,
    minWidth: 64,
    hideMobile: true,
  },
  {
    label: t("standingsTable.gap"),
    accessor: (row) => standingsStatCell(row.gap),
    align: "center",
    mono: true,
    minWidth: 56,
    hideMobile: true,
  },
  {
    label: t("standingsTable.wins"),
    accessor: (row) => standingsStatCell(row.p1),
    align: "center",
    mono: true,
    minWidth: 42,
    hideMobile: true,
  },
  {
    label: t("standingsTable.second"),
    accessor: (row) => standingsStatCell(row.p2),
    align: "center",
    mono: true,
    minWidth: 38,
    hideMobile: true,
  },
  {
    label: t("standingsTable.third"),
    accessor: (row) => standingsStatCell(row.p3),
    align: "center",
    mono: true,
    minWidth: 38,
    hideMobile: true,
  },
  {
    label: t("standingsTable.top5"),
    accessor: (row) => standingsStatCell(row.top5),
    align: "center",
    mono: true,
    minWidth: 44,
    hideMobile: true,
  },
  {
    label: t("standingsTable.top10"),
    accessor: (row) => standingsStatCell(row.top10),
    align: "center",
    mono: true,
    minWidth: 48,
    hideMobile: true,
  },
  {
    label: t("standingsTable.bestFinish"),
    accessor: (row) => standingsStatCell(row.best_finish),
    align: "center",
    mono: true,
    minWidth: 52,
    hideMobile: true,
  },
  {
    label: t("standingsTable.bestGrid"),
    accessor: (row) => standingsStatCell(row.best_quali),
    align: "center",
    mono: true,
    minWidth: 52,
    hideMobile: true,
  },
  {
    label: t("standingsTable.fastestLaps"),
    accessor: (row) => standingsStatCell(row.fastest_laps),
    align: "center",
    mono: true,
    minWidth: 52,
    hideMobile: true,
  },
  {
    label: t("standingsTable.poles"),
    accessor: (row) => standingsStatCell(row.poles),
    align: "center",
    mono: true,
    minWidth: 44,
    hideMobile: true,
  },
  {
    label: t("standingsTable.dotd"),
    accessor: (row) => standingsStatCell(row.dotd),
    align: "center",
    mono: true,
    minWidth: 44,
    hideMobile: true,
  },
  {
    label: t("standingsTable.penaltyPts"),
    accessor: (row) => standingsStatCell(row.penalty_points),
    align: "center",
    mono: true,
    minWidth: 56,
    hideMobile: true,
  },
  {
    label: t("standingsTable.dnfs"),
    accessor: (row) => standingsStatCell(row.dnfs),
    align: "center",
    mono: true,
    minWidth: 44,
    hideMobile: true,
  },
  {
    label: t("standingsTable.races"),
    accessor: (row) => standingsStatCell(row.races),
    align: "center",
    mono: true,
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
  const locale = useLocale();
  const entry = driverId ? getDriver(driverId) : undefined;
  const hasCard = !!entry;
  // Prefer the localized (e.g. Hebrew) name from the drivers CSV when available.
  const displayName = entry
    ? localizedDriverName(entry.driver, locale) || driverName
    : driverName;

  if (hasCard) {
    return (
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          openDriverModal(driverId);
        }}
        className="font-semibold text-ink transition-colors hover:text-oxblood hover:underline underline-offset-2 cursor-pointer"
      >
        {displayName}
      </button>
    );
  }

  return <span className="font-semibold text-ink">{displayName}</span>;
}

/* ------------------------------------------------------------------ */
/*  Build final column list per type                                    */
/* ------------------------------------------------------------------ */

function getColumns(
  type: "drivers" | "constructors",
  t: Translator,
): ColumnDef<StandingsRow>[] {
  const commonStandingsColumns = buildCommonStandingsColumns(t);
  const teamNameCol = buildTeamNameCol(t);
  const pointsAndStats = buildPointsAndStats(t);

  if (type === "drivers") {
    return [
      ...commonStandingsColumns,
      {
        label: t("standingsTable.driver"),
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
        <span className="font-semibold text-ink">{row.team}</span>
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
  const t = useTranslations("schedule");
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
    if (upper.length > 0) groups.push({ label: t("standingsTable.upperBracket"), rows: upper });
    if (lower.length > 0) groups.push({ label: t("standingsTable.lowerBracket"), rows: lower });
  }

  const highlight = (row: StandingsRow) => {
    const pos = parseInt(row.position, 10);
    if (pos === 1) return "p1";
    if (pos === 2) return "p2";
    if (pos === 3) return "p3";
    return null;
  };

  const columns = useMemo(() => getColumns(type, t), [type, t]);
  const horizontalStickyCount =
    columns.findIndex((c) => c.label === t("standingsTable.points")) + 1;

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
