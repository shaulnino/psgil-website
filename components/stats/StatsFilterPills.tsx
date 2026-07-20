"use client";

import { useTranslations } from "next-intl";
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

type RaceFormat = NonNullable<Format>;

export default function StatsFilterPills({
  formatFilter,
  competitionFilter,
  roundTypeFilter,
  onFormat,
  onCompetition,
  onRoundType,
  onClearAll,
  showWild = true,
  availableFormats,
  showRegular = true,
  showPlayoffs = true,
}: {
  formatFilter: Format;
  competitionFilter: Comp;
  roundTypeFilter: Round;
  onFormat: (v: Format) => void;
  onCompetition: (v: Comp) => void;
  onRoundType: (v: Round) => void;
  onClearAll: () => void;
  showWild?: boolean;
  /** Formats that actually occur in the current data scope. When provided,
   *  only these format pills are shown (and the group is hidden entirely
   *  when fewer than two formats exist, since filtering would be a no-op). */
  availableFormats?: RaceFormat[];
  /** Whether regular-season rounds exist in the current scope. */
  showRegular?: boolean;
  /** Whether playoff rounds exist in the current scope. */
  showPlayoffs?: boolean;
}) {
  const t = useTranslations("stats");

  const formats = availableFormats ?? ["50%", "25%", "sprint"];
  // A filter dimension is only useful when it offers at least two choices.
  const showFormatGroup = formats.length >= 2;
  const showLeagueGroup = showWild; // "All / Main" alone is redundant
  const showRoundGroup = showRegular && showPlayoffs;

  const any =
    formatFilter !== undefined ||
    competitionFilter !== undefined ||
    roundTypeFilter !== undefined;

  if (!showFormatGroup && !showLeagueGroup && !showRoundGroup) return null;

  return (
    <div className="flex flex-col gap-2">
      {showFormatGroup && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-isl-body text-[10px] font-semibold uppercase tracking-[0.2em] text-oxblood">{t("filters.format")}</span>
          <Pill active={formatFilter === undefined} onClick={() => onFormat(undefined)}>
            {t("filters.all")}
          </Pill>
          {formats.includes("50%") && (
            <Pill active={formatFilter === "50%"} onClick={() => onFormat("50%")}>
              {t("filters.format50")}
            </Pill>
          )}
          {formats.includes("25%") && (
            <Pill active={formatFilter === "25%"} onClick={() => onFormat("25%")}>
              {t("filters.format25")}
            </Pill>
          )}
          {formats.includes("sprint") && (
            <Pill active={formatFilter === "sprint"} onClick={() => onFormat("sprint")}>
              {t("filters.sprint")}
            </Pill>
          )}
        </div>
      )}
      {showLeagueGroup && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-isl-body text-[10px] font-semibold uppercase tracking-[0.2em] text-oxblood">{t("filters.league")}</span>
          <Pill active={competitionFilter === undefined} onClick={() => onCompetition(undefined)}>
            {t("filters.all")}
          </Pill>
          <Pill active={competitionFilter === "main"} onClick={() => onCompetition("main")}>
            {t("filters.main")}
          </Pill>
          <Pill active={competitionFilter === "wild"} onClick={() => onCompetition("wild")}>
            {t("filters.wild")}
          </Pill>
        </div>
      )}
      {showRoundGroup && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-isl-body text-[10px] font-semibold uppercase tracking-[0.2em] text-oxblood">{t("filters.round")}</span>
          <Pill active={roundTypeFilter === undefined} onClick={() => onRoundType(undefined)}>
            {t("filters.all")}
          </Pill>
          <Pill active={roundTypeFilter === "regular"} onClick={() => onRoundType("regular")}>
            {t("filters.regular")}
          </Pill>
          <Pill active={roundTypeFilter === "playoff"} onClick={() => onRoundType("playoff")}>
            {t("filters.playoffs")}
          </Pill>
        </div>
      )}
      {any && (
        <div className="flex">
          <button
            type="button"
            onClick={onClearAll}
            className="ms-auto rounded-[2px] px-2 py-1.5 text-xs font-semibold text-meta underline-offset-2 hover:text-oxblood hover:underline"
          >
            {t("filters.clearFilters")}
          </button>
        </div>
      )}
    </div>
  );
}
