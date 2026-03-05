"use client";

import { Suspense, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import SeasonSelector from "@/components/SeasonSelector";
import StandingsSection from "@/components/StandingsSection";
import DriverLookupProvider, { useDriverLookup } from "@/components/DriverLookupProvider";
import { getAwardIcon } from "@/components/AchievementBadges";
import type { Driver, Team } from "@/lib/driversData";
import {
  filterBySeason,
  groupByBracket,
  getTableImage,
  type StandingsRow,
} from "@/lib/resultsData";
import {
  DEFAULT_AWARD_LABELS,
  DEFAULT_AWARD_RANK,
  DEFAULT_AWARD_TOOLTIPS,
  type Reward,
} from "@/lib/rewardsData";
import type { SeasonConfig } from "@/lib/seasonConfig";
import { getSeasonsForDropdown } from "@/lib/seasonConfig";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

type AllStandings = {
  driversMain: StandingsRow[];
  constructorsMain: StandingsRow[];
  driversWild: StandingsRow[];
  constructorsWild: StandingsRow[];
};

export type TablesPageContentProps = {
  seasonsConfig: SeasonConfig[];
  defaultSeasonKey: string;
  /** ALL standings (every season) – filtered on the client by season key. */
  allStandings: AllStandings;
  /** Driver card data for clickable driver names */
  drivers: Driver[];
  teams: Team[];
  rewards: Reward[];
  placeholderSrc: string;
};

/* ------------------------------------------------------------------ */
/*  Bracket label helper                                               */
/* ------------------------------------------------------------------ */

function bracketTitle(bracket: string): string {
  switch (bracket) {
    case "upper":
      return "Upper Bracket";
    case "lower":
      return "Lower Bracket";
    default:
      return "Overall";
  }
}

function normalizeTeamName(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function canonicalTeamName(value: string): string {
  return normalizeTeamName(value)
    .replace(/\batlassian\b/g, "")
    .replace(/\bf1 team\b/g, "")
    .replace(/\bteam\b/g, "")
    .replace(/[^\w\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

const COMPETITION_LABELS: Record<string, string> = {
  main: "Main League",
  lower: "Lower League",
  wild: "Wild League",
  constructors: "Constructors",
  community: "Community",
};

/* ------------------------------------------------------------------ */
/*  Inner component (reads ?season= via useSearchParams)               */
/* ------------------------------------------------------------------ */

function TablesInner({
  seasonsConfig,
  defaultSeasonKey,
  allStandings,
  drivers,
  teams,
  rewards,
  placeholderSrc,
}: TablesPageContentProps) {
  const searchParams = useSearchParams();
  const selectedSeasonKey =
    searchParams.get("season") || defaultSeasonKey;

  const seasonConfig = seasonsConfig.find(
    (s) => s.season_key === selectedSeasonKey,
  );
  const seasonsList = getSeasonsForDropdown(seasonsConfig);

  /* ---------- Filter standings by selected season ---------- */
  const data = useMemo(() => {
    return {
      driversMain: filterBySeason(allStandings.driversMain, selectedSeasonKey),
      constructorsMain: filterBySeason(allStandings.constructorsMain, selectedSeasonKey),
      driversWild: filterBySeason(allStandings.driversWild, selectedSeasonKey),
      constructorsWild: filterBySeason(allStandings.constructorsWild, selectedSeasonKey),
    };
  }, [allStandings, selectedSeasonKey]);

  /* ---------- Config flags ---------- */
  const showWild = seasonConfig?.has_wild ?? false;
  const showConstructors = seasonConfig?.has_constructors ?? true;
  const hasPlayoffs =
    seasonConfig?.has_playoffs &&
    seasonConfig?.playoffs_mode === "upper_lower";
  const notes = seasonConfig?.notes ?? "";
  const seasonNumber = Number.parseInt(selectedSeasonKey.replace(/^S/i, ""), 10);

  /* ---------- Fallback images from config ---------- */
  const dMainImg =
    getTableImage(data.driversMain) ||
    (seasonConfig?.fallback_image_drivers_main ?? "");
  const cMainImg =
    getTableImage(data.constructorsMain) ||
    (seasonConfig?.fallback_image_constructors_main ?? "");
  const dWildImg =
    getTableImage(data.driversWild) ||
    (seasonConfig?.fallback_image_drivers_wild ?? "");
  const cWildImg =
    getTableImage(data.constructorsWild) ||
    (seasonConfig?.fallback_image_constructors_wild ?? "");

  const seasonRewards = useMemo(() => {
    if (!Number.isFinite(seasonNumber)) return [];
    return rewards
      .filter((r) => r.season_id === seasonNumber)
      .slice()
      .sort((a, b) => (a.rank ?? DEFAULT_AWARD_RANK[a.award_code] ?? 999) - (b.rank ?? DEFAULT_AWARD_RANK[b.award_code] ?? 999));
  }, [rewards, seasonNumber]);

  const driverNameById = useMemo(
    () => new Map(drivers.map((d) => [d.driver_id, d.name])),
    [drivers],
  );
  const teamNameById = useMemo(
    () => new Map(teams.map((t) => [t.team_key, t.team_name])),
    [teams],
  );
  const seasonDriversByTeamName = useMemo(() => {
    const map = new Map<string, string[]>();
    const allSeasonDriverRows = [...data.driversMain, ...data.driversWild];
    const append = (key: string, driverName: string) => {
      if (!key) return;
      const current = map.get(key) ?? [];
      if (!current.includes(driverName)) current.push(driverName);
      map.set(key, current);
    };

    for (const row of allSeasonDriverRows) {
      const teamNorm = normalizeTeamName(row.team);
      const teamCanonical = canonicalTeamName(row.team);
      if (!teamNorm || !row.driver_name) continue;
      append(teamNorm, row.driver_name);
      append(teamCanonical, row.driver_name);
    }
    return map;
  }, [data.driversMain, data.driversWild]);

  return (
    <DriverLookupProvider
      drivers={drivers}
      teams={teams}
      placeholderSrc={placeholderSrc}
    >
      {/* Title row + season selector */}
      <div className="mb-12 flex flex-wrap items-center justify-between gap-4">
        <div className="max-w-2xl">
          <h1 className="font-display text-4xl font-bold tracking-wider md:text-5xl">
            <span className="bg-gradient-to-r from-[#7020B0] via-[#a855f7] to-[#D4AF37] bg-clip-text text-transparent drop-shadow-[0_0_24px_rgba(112,32,176,0.25)]">
              Tables
            </span>
          </h1>
          <div className="mt-3 h-[3px] w-36 rounded-full bg-gradient-to-r from-[#7020B0] to-[#D4AF37] shadow-[0_0_8px_rgba(112,32,176,0.4)]" />
          <p className="mt-4 text-base tracking-wide text-white/85 md:text-lg">
            Official championship standings, updated after each round.
          </p>
        </div>
        <SeasonSelector
          seasons={seasonsList}
          selected={selectedSeasonKey}
        />
      </div>

      <div className="flex flex-col gap-12">
        {/* ============ SEASON NOTES BANNER ============ */}
        {notes && (
          <div className="rounded-xl border border-[#D4AF37]/20 bg-[#D4AF37]/5 px-5 py-4">
            {notes.split("\n").map((line, i) => (
              <p
                key={i}
                className="text-sm font-medium leading-relaxed text-[#D4AF37]/90"
              >
                {line}
              </p>
            ))}
          </div>
        )}

        {/* ============ DRIVERS MAIN ============ */}
        {hasPlayoffs ? (
          /* Playoff bracket groups (e.g. S2/S3 upper / lower) */
          groupByBracket(data.driversMain).map(({ bracket, rows }) => (
            <StandingsSection
              key={bracket}
              title={`Drivers Main Championship – ${bracketTitle(bracket)}`}
              subtitle={
                bracket === "upper"
                  ? "Top half of the grid."
                  : bracket === "lower"
                    ? "Bottom half of the grid."
                    : "Current points table after the latest round."
              }
              image={{
                src:
                  getTableImage(
                    data.driversMain,
                    undefined,
                    bracket,
                  ) ||
                  (seasonConfig?.fallback_image_drivers_main ?? ""),
                alt: `Drivers Main Championship – ${bracketTitle(bracket)}`,
              }}
              standingsData={rows}
              type="drivers"
            />
          ))
        ) : (
          <StandingsSection
            title="Drivers Main Championship standings"
            subtitle="Current points table after the latest round."
            image={{
              src: dMainImg,
              alt: "Drivers Main Championship standings table",
            }}
            standingsData={data.driversMain}
            type="drivers"
          />
        )}

        {/* ============ CONSTRUCTORS MAIN ============ */}
        {showConstructors && (
          <StandingsSection
            title="Constructors Main Championship standings"
            subtitle="Team standings in the Main Championship."
            image={{
              src: cMainImg,
              alt: "Constructors Main Championship standings table",
            }}
            standingsData={data.constructorsMain}
            type="constructors"
          />
        )}

        {/* ============ WILD ============ */}
        {showWild && (
          <>
            <StandingsSection
              title="Drivers Wild Championship standings"
              subtitle="Points table for the Wild Championship."
              image={{
                src: dWildImg,
                alt: "Drivers Wild Championship standings table",
              }}
              standingsData={data.driversWild}
              type="drivers"
            />
            {showConstructors && (
              <StandingsSection
                title="Constructors Wild Championship standings"
                subtitle="Team standings in the Wild Championship."
                image={{
                  src: cWildImg,
                  alt: "Constructors Wild Championship standings table",
                }}
                standingsData={data.constructorsWild}
                type="constructors"
              />
            )}
          </>
        )}

        {/* ============ SEASON REWARDS ============ */}
        {seasonRewards.length > 0 && (
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
            <h3 className="font-display text-2xl font-semibold text-white">
              Season {seasonNumber} Awards
            </h3>
            <div className="mt-4 space-y-4">
              {["main", "lower", "wild", "constructors", "community"].map((competition) => {
                const rows = seasonRewards.filter((reward) => reward.competition === competition);
                if (rows.length === 0) return null;

                return (
                  <div key={competition}>
                    <p className="mb-2 text-xs font-semibold uppercase tracking-[0.15em] text-white/55">
                      {COMPETITION_LABELS[competition]}
                    </p>
                    <div className="overflow-hidden rounded-xl border border-white/10">
                      {rows.map((reward, idx) => {
                        const winner =
                          reward.recipient_type === "driver"
                            ? driverNameById.get(reward.recipient_id) || reward.recipient_id
                            : teamNameById.get(reward.recipient_id) || reward.recipient_id;
                        const teamDrivers =
                          reward.recipient_type === "team"
                            ? seasonDriversByTeamName.get(normalizeTeamName(winner)) ??
                              seasonDriversByTeamName.get(canonicalTeamName(winner)) ??
                              []
                            : [];
                        const teamDriversLabel =
                          teamDrivers.length > 0 ? teamDrivers.join(", ") : "";

                        return (
                          <RewardRow
                            key={`${reward.season_id}-${reward.award_code}-${reward.recipient_id}-${idx}`}
                            reward={reward}
                            winner={winner}
                            isDriver={reward.recipient_type === "driver"}
                            teamDriversLabel={teamDriversLabel}
                            isLast={idx === rows.length - 1}
                          />
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* No data at all for this season */}
        {data.driversMain.length === 0 &&
          data.constructorsMain.length === 0 &&
          data.driversWild.length === 0 &&
          data.constructorsWild.length === 0 &&
          seasonRewards.length === 0 &&
          !notes && (
            <div className="flex items-center justify-center rounded-2xl border border-white/10 bg-white/5 py-16">
              <p className="text-sm text-white/50">
                No standings data available for this season yet.
              </p>
            </div>
          )}
      </div>
    </DriverLookupProvider>
  );
}

function RewardRow({
  reward,
  winner,
  isDriver,
  teamDriversLabel,
  isLast,
}: {
  reward: Reward;
  winner: string;
  isDriver: boolean;
  teamDriversLabel?: string;
  isLast: boolean;
}) {
  const { openDriverModal } = useDriverLookup();
  const label = reward.award_label || DEFAULT_AWARD_LABELS[reward.award_code];
  const tooltip = reward.tooltip || DEFAULT_AWARD_TOOLTIPS[reward.award_code];
  const onClickWinner = () => {
    if (!isDriver) return;
    openDriverModal(reward.recipient_id);
  };

  return (
    <div className={`flex items-center gap-3 px-4 py-3 ${!isLast ? "border-b border-white/10" : ""}`}>
      <span className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-white/10 bg-white/5">
        {getAwardIcon(reward.award_code, 18, reward.competition)}
      </span>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-semibold text-white">{label}</div>
        <div className="text-xs text-white/55">{tooltip}</div>
      </div>
      {isDriver ? (
        <button
          type="button"
          onClick={onClickWinner}
          className="text-sm font-semibold text-[#D4AF37] transition hover:text-[#f1ce62]"
        >
          {winner}
        </button>
      ) : (
        <span className="text-right">
          <span className="block text-sm font-semibold text-white/85">{winner}</span>
          {teamDriversLabel ? (
            <span className="block text-xs text-white/55">{teamDriversLabel}</span>
          ) : null}
        </span>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Exported wrapper (Suspense required for useSearchParams)            */
/* ------------------------------------------------------------------ */

export default function TablesPageContent(props: TablesPageContentProps) {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center py-24">
          <p className="text-sm text-white/40">Loading standings…</p>
        </div>
      }
    >
      <TablesInner {...props} />
    </Suspense>
  );
}
