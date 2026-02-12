"use client";

import { Suspense, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import SeasonSelector from "@/components/SeasonSelector";
import StandingsSection from "@/components/StandingsSection";
import DriverLookupProvider from "@/components/DriverLookupProvider";
import type { Driver, Team } from "@/lib/driversData";
import {
  filterBySeason,
  groupByBracket,
  getTableImage,
  type StandingsRow,
} from "@/lib/resultsData";
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

/* ------------------------------------------------------------------ */
/*  Inner component (reads ?season= via useSearchParams)               */
/* ------------------------------------------------------------------ */

function TablesInner({
  seasonsConfig,
  defaultSeasonKey,
  allStandings,
  drivers,
  teams,
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

  return (
    <DriverLookupProvider
      drivers={drivers}
      teams={teams}
      placeholderSrc={placeholderSrc}
    >
      {/* Title row + season selector */}
      <div className="mb-10 flex flex-wrap items-center justify-between gap-4">
        <div className="max-w-2xl">
          <h2 className="font-display text-2xl font-semibold tracking-wide text-white md:text-3xl">
            Tables
          </h2>
          <p className="mt-3 text-base text-white/70">
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

        {/* No data at all for this season */}
        {data.driversMain.length === 0 &&
          data.constructorsMain.length === 0 &&
          data.driversWild.length === 0 &&
          data.constructorsWild.length === 0 &&
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
