"use client";

import { useEffect, useState } from "react";
import YouTubeEmbed from "@/components/YouTubeEmbed";
import RaceResultsTable from "@/components/RaceResultsTable";
import StandingsTable from "@/components/StandingsTable";
import DriverLookupProvider from "@/components/DriverLookupProvider";
import type { RaceResultRow, StandingsRow } from "@/lib/resultsData";
import type { Driver, Team } from "@/lib/driversData";

type NewsArticleActionsProps = {
  isRecap: boolean;
  isPreview: boolean;
  watchUrl: string | null;
  resultsRows: RaceResultRow[];
  resultsCaption: string;
  seasonStandingsRows: StandingsRow[];
  seasonTableCaption: string;
  constructorsStandingsRows?: StandingsRow[];
  constructorsTableCaption?: string;
  drivers: Driver[];
  teams: Team[];
};

function ModalShell({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative mx-4 w-full max-w-5xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-display text-base font-semibold text-white/85 md:text-lg">
            {title}
          </h3>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full border border-white/20 bg-black/60 text-white/80 transition hover:text-white"
            aria-label="Close modal"
          >
            ×
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export default function NewsArticleActions({
  isRecap,
  isPreview,
  watchUrl,
  resultsRows,
  resultsCaption,
  seasonStandingsRows,
  seasonTableCaption,
  constructorsStandingsRows = [],
  constructorsTableCaption = "Main Constructors Standings",
  drivers,
  teams,
}: NewsArticleActionsProps) {
  const [watchOpen, setWatchOpen] = useState(false);
  const [resultsOpen, setResultsOpen] = useState(false);
  const [seasonTableOpen, setSeasonTableOpen] = useState(false);
  const [constructorsTableOpen, setConstructorsTableOpen] = useState(false);
  const hasResults = resultsRows.length > 0;
  const hasWatch = !!watchUrl;
  const hasSeasonTable = seasonStandingsRows.length > 0;
  const hasConstructorsTable = constructorsStandingsRows.length > 0;

  if (!isRecap && !isPreview) return null;

  return (
    <>
      <div className="mb-6 flex flex-wrap gap-3">
        {isRecap && (
          <>
            <button
              type="button"
              onClick={() => setWatchOpen(true)}
              disabled={!hasWatch}
              title={hasWatch ? undefined : "YouTube link not available yet"}
              className="inline-flex items-center gap-2 rounded-full bg-[#7020B0] px-4 py-2 text-sm font-semibold text-white shadow-[0_0_18px_rgba(112,32,176,0.35)] transition enabled:hover:-translate-y-0.5 enabled:hover:shadow-[0_0_24px_rgba(112,32,176,0.55)] disabled:cursor-not-allowed disabled:opacity-50"
            >
              <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                <path d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z" />
              </svg>
              Watch Race
            </button>

            <button
              type="button"
              onClick={() => setResultsOpen(true)}
              disabled={!hasResults}
              className="inline-flex items-center gap-2 rounded-full border border-white/20 px-4 py-2 text-sm font-semibold text-white/90 transition enabled:hover:border-[#7020B0]/55 enabled:hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 17v-6m4 6V7m4 10v-3M5 21h14" />
              </svg>
              Race Results
            </button>

            <button
              type="button"
              onClick={() => setSeasonTableOpen(true)}
              disabled={!hasSeasonTable}
              className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/[0.03] px-4 py-2 text-sm font-semibold text-white/90 transition enabled:hover:border-[#7020B0]/55 enabled:hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 3v18h18M7 14v4m5-8v8m5-12v12" />
              </svg>
              Drivers Championship
            </button>

            <button
              type="button"
              onClick={() => setConstructorsTableOpen(true)}
              disabled={!hasConstructorsTable}
              className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/[0.03] px-4 py-2 text-sm font-semibold text-white/90 transition enabled:hover:border-[#7020B0]/55 enabled:hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
              Constructors Championship
            </button>
          </>
        )}

        {isPreview && (
          <button
            type="button"
            onClick={() => setSeasonTableOpen(true)}
            disabled={!hasSeasonTable}
            className="inline-flex items-center gap-2 rounded-full border border-[#D4AF37]/35 bg-[#D4AF37]/10 px-4 py-2 text-sm font-semibold text-[#D4AF37] transition enabled:hover:border-[#D4AF37]/55 enabled:hover:bg-[#D4AF37]/15 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 3v18h18M7 14v4m5-8v8m5-12v12" />
            </svg>
            Season Table
          </button>
        )}
      </div>

      {watchOpen && hasWatch && (
        <ModalShell title="Race Broadcast" onClose={() => setWatchOpen(false)}>
          <YouTubeEmbed youtubeUrl={watchUrl ?? undefined} title="Race Broadcast" />
        </ModalShell>
      )}

      {resultsOpen && hasResults && (
        <ModalShell title="Race Results" onClose={() => setResultsOpen(false)}>
          <div className="max-h-[85vh] overflow-auto rounded-2xl border border-white/10 bg-[#0B0B0E] p-3 shadow-[0_0_30px_rgba(0,0,0,0.4)]">
            <DriverLookupProvider
              drivers={drivers}
              teams={teams}
              placeholderSrc="/placeholders/driver.png"
            >
              <RaceResultsTable
                results={resultsRows}
                caption={resultsCaption}
              />
            </DriverLookupProvider>
          </div>
        </ModalShell>
      )}

      {seasonTableOpen && hasSeasonTable && (
        <ModalShell title="Drivers Championship" onClose={() => setSeasonTableOpen(false)}>
          <div className="max-h-[85vh] overflow-auto rounded-2xl border border-white/10 bg-[#0B0B0E] p-3 shadow-[0_0_30px_rgba(0,0,0,0.4)]">
            <DriverLookupProvider
              drivers={drivers}
              teams={teams}
              placeholderSrc="/placeholders/driver.png"
            >
              <StandingsTable
                standings={seasonStandingsRows}
                caption={seasonTableCaption}
                type="drivers"
              />
            </DriverLookupProvider>
          </div>
        </ModalShell>
      )}

      {constructorsTableOpen && hasConstructorsTable && (
        <ModalShell title="Constructors Championship" onClose={() => setConstructorsTableOpen(false)}>
          <div className="max-h-[85vh] overflow-auto rounded-2xl border border-white/10 bg-[#0B0B0E] p-3 shadow-[0_0_30px_rgba(0,0,0,0.4)]">
            <DriverLookupProvider
              drivers={drivers}
              teams={teams}
              placeholderSrc="/placeholders/driver.png"
            >
              <StandingsTable
                standings={constructorsStandingsRows}
                caption={constructorsTableCaption}
                type="constructors"
              />
            </DriverLookupProvider>
          </div>
        </ModalShell>
      )}
    </>
  );
}

