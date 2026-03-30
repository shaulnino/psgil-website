"use client";

import { useEffect, useState } from "react";
import YouTubeEmbed from "@/components/YouTubeEmbed";
import RaceResultsTable from "@/components/RaceResultsTable";
import StandingsTable from "@/components/StandingsTable";
import DriverLookupProvider from "@/components/DriverLookupProvider";
import type { RaceResultRow, StandingsRow } from "@/lib/resultsData";
import type { Driver, Team } from "@/lib/driversData";

type ResultsSection = {
  raceName: string;
  rows: RaceResultRow[];
};

type NewsArticleActionsProps = {
  isRecap: boolean;
  isPreview: boolean;
  watchLinks: { label: string; url: string }[];
  resultsSections: ResultsSection[];
  articleTitle: string;
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
  watchLinks,
  resultsSections,
  articleTitle,
  seasonStandingsRows,
  seasonTableCaption,
  constructorsStandingsRows = [],
  constructorsTableCaption = "Main Constructors Standings",
  drivers,
  teams,
}: NewsArticleActionsProps) {
  const [watchTarget, setWatchTarget] = useState<{ label: string; url: string } | null>(null);
  const [resultsOpen, setResultsOpen] = useState(false);
  const [activeResultIdx, setActiveResultIdx] = useState(0);
  const [seasonTableOpen, setSeasonTableOpen] = useState(false);
  const [constructorsTableOpen, setConstructorsTableOpen] = useState(false);

  const hasWatch = watchLinks.length > 0;
  const hasResults = resultsSections.some((s) => s.rows.length > 0);
  const hasSeasonTable = seasonStandingsRows.length > 0;
  const hasConstructorsTable = constructorsStandingsRows.length > 0;
  const showResultsTabs = resultsSections.length > 1;

  const openResultsModal = () => {
    const i = resultsSections.findIndex((s) => s.rows.length > 0);
    setActiveResultIdx(i >= 0 ? i : 0);
    setResultsOpen(true);
  };

  const currentResults = resultsSections[activeResultIdx];
  const resultsCaption = currentResults
    ? `${articleTitle} — ${currentResults.raceName} — Race Results`
    : `${articleTitle} — Race Results`;

  if (!isRecap && !isPreview) return null;

  return (
    <>
      <div className="mb-6 flex flex-wrap gap-3">
        {isRecap && (
          <>
            {hasWatch ? (
              watchLinks.map((link) => (
                <button
                  key={`${link.label}-${link.url}`}
                  type="button"
                  onClick={() => setWatchTarget(link)}
                  className="inline-flex items-center gap-2 rounded-full bg-[#7020B0] px-4 py-2 text-sm font-semibold text-white shadow-[0_0_18px_rgba(112,32,176,0.35)] transition hover:-translate-y-0.5 hover:shadow-[0_0_24px_rgba(112,32,176,0.55)]"
                >
                  <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                    <path d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z" />
                  </svg>
                  {link.label}
                </button>
              ))
            ) : (
              <button
                type="button"
                disabled
                title="YouTube link not available yet"
                className="inline-flex cursor-not-allowed items-center gap-2 rounded-full bg-[#7020B0] px-4 py-2 text-sm font-semibold text-white opacity-50 shadow-[0_0_18px_rgba(112,32,176,0.35)]"
              >
                <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                  <path d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z" />
                </svg>
                Watch Race
              </button>
            )}

            <button
              type="button"
              onClick={openResultsModal}
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

      {watchTarget && (
        <ModalShell title={watchTarget.label} onClose={() => setWatchTarget(null)}>
          <YouTubeEmbed
            youtubeUrl={watchTarget.url}
            title={`${watchTarget.label} — Race Broadcast`}
          />
        </ModalShell>
      )}

      {resultsOpen && hasResults && currentResults && (
        <ModalShell title="Race Results" onClose={() => setResultsOpen(false)}>
          <div className="max-h-[85vh] overflow-auto rounded-2xl border border-white/10 bg-[#0B0B0E] p-3 shadow-[0_0_30px_rgba(0,0,0,0.4)]">
            {showResultsTabs && (
              <div className="mb-3 flex flex-wrap items-center gap-1 rounded-full border border-white/10 bg-black/60 p-1">
                {resultsSections.map((section, idx) => (
                  <button
                    key={`${section.raceName}-${idx}`}
                    type="button"
                    onClick={() => setActiveResultIdx(idx)}
                    className={`rounded-full px-4 py-1.5 text-xs font-semibold transition ${
                      idx === activeResultIdx
                        ? "bg-[#7020B0]/80 text-white shadow-[0_0_12px_rgba(112,32,176,0.3)]"
                        : "text-white/50 hover:text-white/80"
                    }`}
                  >
                    {section.raceName}
                  </button>
                ))}
              </div>
            )}
            <DriverLookupProvider
              drivers={drivers}
              teams={teams}
              placeholderSrc="/placeholders/driver.png"
            >
              {currentResults.rows.length > 0 ? (
                <RaceResultsTable results={currentResults.rows} caption={resultsCaption} />
              ) : (
                <p className="py-8 text-center text-sm text-white/50">Results are not available for this race yet.</p>
              )}
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
