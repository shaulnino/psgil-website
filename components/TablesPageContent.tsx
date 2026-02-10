"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import SeasonSelector from "@/components/SeasonSelector";
import StandingsSection from "@/components/StandingsSection";
import DriverLookupProvider from "@/components/DriverLookupProvider";
import type { Driver, Team } from "@/lib/driversData";
import {
  ALL_SEASONS,
  filterBySeason,
  getTableImage,
  type StandingsRow,
} from "@/lib/resultsData";

/* ------------------------------------------------------------------ */
/*  Translation keys (future i18n ready)                               */
/* ------------------------------------------------------------------ */

const TRANSLATIONS: Record<string, string> = {
  "tables.season1Notice":
    "This season came to an early end on October 7th, after only three races had been completed.\nIn remembrance of Itay Saadon, who lost his life while fighting for our country at the outbreak of the war, the championship title was awarded in his honor.",
};

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

/** Static fallback images keyed by section (used when table_image is empty). */
type FallbackImages = {
  driversMain: string;
  constructorsMain: string;
  driversWild: string;
  constructorsWild: string;
};

export type TablesPageContentProps = {
  /** Default season to select (typically the latest found in data). */
  defaultSeason: string;
  driversMain: StandingsRow[];
  constructorsMain: StandingsRow[];
  driversWild: StandingsRow[];
  constructorsWild: StandingsRow[];
  fallbackImages: FallbackImages;
  /** Driver card data for clickable driver names */
  drivers: Driver[];
  teams: Team[];
  placeholderSrc: string;
};

/* ------------------------------------------------------------------ */
/*  Inner component (reads ?season= via useSearchParams)               */
/* ------------------------------------------------------------------ */

function TablesInner({
  defaultSeason,
  driversMain,
  constructorsMain,
  driversWild,
  constructorsWild,
  fallbackImages,
  drivers,
  teams,
  placeholderSrc,
}: TablesPageContentProps) {
  const searchParams = useSearchParams();
  const selectedSeason = searchParams.get("season") || defaultSeason;

  /* ---------- filter by season ---------- */
  const dMain = filterBySeason(driversMain, selectedSeason);
  const cMain = filterBySeason(constructorsMain, selectedSeason);
  const dWild = filterBySeason(driversWild, selectedSeason);
  const cWild = filterBySeason(constructorsWild, selectedSeason);

  /* ---------- resolve fallback images ---------- */
  // Only use the static fallback images for the default (latest) season.
  // For all other seasons, rely solely on the CSV table_image field;
  // if it's empty the section shows "Results not uploaded yet."
  const isDefault = selectedSeason === defaultSeason;
  const dMainImg =
    getTableImage(driversMain, selectedSeason) ||
    (isDefault ? fallbackImages.driversMain : "");
  const cMainImg =
    getTableImage(constructorsMain, selectedSeason) ||
    (isDefault ? fallbackImages.constructorsMain : "");
  const dWildImg =
    getTableImage(driversWild, selectedSeason) ||
    (isDefault ? fallbackImages.driversWild : "");
  const cWildImg =
    getTableImage(constructorsWild, selectedSeason) ||
    (isDefault ? fallbackImages.constructorsWild : "");

  const seasonNum = parseInt(selectedSeason.replace(/\D/g, ""), 10) || 0;

  /* ---------- wild visibility ---------- */
  // S1–S3: never show wild. S4–S5: only if rows exist. S6+: always show.
  const showWild =
    seasonNum >= 6
      ? true
      : seasonNum >= 4
        ? dWild.length > 0 || cWild.length > 0
        : false;

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
        <SeasonSelector seasons={ALL_SEASONS} selected={selectedSeason} />
      </div>

      <div className="flex flex-col gap-12">
        {/* ============ SEASON 1 NOTICE ============ */}
        {selectedSeason === "S1" && (
          <div className="rounded-xl border border-[#D4AF37]/20 bg-[#D4AF37]/5 px-5 py-4">
            {TRANSLATIONS["tables.season1Notice"].split("\n").map((line, i) => (
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
        <StandingsSection
          title="Drivers Main Championship standings"
          subtitle="Current points table after the latest round."
          image={{
            src: dMainImg,
            alt: "Drivers Main Championship standings table",
          }}
          standingsData={dMain}
          type="drivers"
        />

        {/* ============ CONSTRUCTORS MAIN ============ */}
        <StandingsSection
          title="Constructors Main Championship standings"
          subtitle="Team standings in the Main Championship."
          image={{
            src: cMainImg,
            alt: "Constructors Main Championship standings table",
          }}
          standingsData={cMain}
          type="constructors"
        />

        {/* ============ WILD (hidden for S1–S3, conditional for S4–S5) ============ */}
        {showWild && (
          <>
            <StandingsSection
              title="Drivers Wild Championship standings"
              subtitle="Points table for the Wild Championship."
              image={{
                src: dWildImg,
                alt: "Drivers Wild Championship standings table",
              }}
              standingsData={dWild}
              type="drivers"
            />
            <StandingsSection
              title="Constructors Wild Championship standings"
              subtitle="Team standings in the Wild Championship."
              image={{
                src: cWildImg,
                alt: "Constructors Wild Championship standings table",
              }}
              standingsData={cWild}
              type="constructors"
            />
          </>
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
