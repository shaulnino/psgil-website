"use client";

import type { StatsFilters } from "@/lib/statsComputed";

type Format = StatsFilters["format"];
type Comp = StatsFilters["competition"];
type Round = StatsFilters["roundType"];

function Pill({
  active,
  children,
  onClick,
}: {
  active: boolean;
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-lg px-2.5 py-1.5 text-xs font-semibold transition sm:text-sm ${
        active
          ? "bg-[#D4AF37] text-black shadow"
          : "border border-white/10 bg-white/[0.03] text-white/55 hover:border-white/20 hover:text-white/90"
      }`}
    >
      {children}
    </button>
  );
}

export default function StatsFilterPills({
  formatFilter,
  competitionFilter,
  roundTypeFilter,
  onFormat,
  onCompetition,
  onRoundType,
  onClearAll,
}: {
  formatFilter: Format;
  competitionFilter: Comp;
  roundTypeFilter: Round;
  onFormat: (v: Format) => void;
  onCompetition: (v: Comp) => void;
  onRoundType: (v: Round) => void;
  onClearAll: () => void;
}) {
  const any =
    formatFilter !== undefined ||
    competitionFilter !== undefined ||
    roundTypeFilter !== undefined;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[10px] font-bold uppercase tracking-wider text-white/35">Format</span>
        <Pill active={formatFilter === undefined} onClick={() => onFormat(undefined)}>
          All
        </Pill>
        <Pill active={formatFilter === "50%"} onClick={() => onFormat("50%")}>
          50%
        </Pill>
        <Pill active={formatFilter === "25%"} onClick={() => onFormat("25%")}>
          25%
        </Pill>
        <Pill active={formatFilter === "sprint"} onClick={() => onFormat("sprint")}>
          Sprint
        </Pill>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[10px] font-bold uppercase tracking-wider text-white/35">League</span>
        <Pill active={competitionFilter === undefined} onClick={() => onCompetition(undefined)}>
          All
        </Pill>
        <Pill active={competitionFilter === "main"} onClick={() => onCompetition("main")}>
          Main
        </Pill>
        <Pill active={competitionFilter === "wild"} onClick={() => onCompetition("wild")}>
          Wild
        </Pill>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[10px] font-bold uppercase tracking-wider text-white/35">Round</span>
        <Pill active={roundTypeFilter === undefined} onClick={() => onRoundType(undefined)}>
          All
        </Pill>
        <Pill active={roundTypeFilter === "regular"} onClick={() => onRoundType("regular")}>
          Regular
        </Pill>
        <Pill active={roundTypeFilter === "playoff"} onClick={() => onRoundType("playoff")}>
          Playoffs
        </Pill>
        {any && (
          <button
            type="button"
            onClick={onClearAll}
            className="ml-auto rounded-lg px-2 py-1.5 text-xs font-semibold text-white/40 underline-offset-2 hover:text-white/75 hover:underline"
          >
            Clear filters
          </button>
        )}
      </div>
    </div>
  );
}
