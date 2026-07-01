"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
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
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/50"
      onClick={onClose}
    >
      <div
        className="relative mx-4 w-full max-w-5xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-display font-bold tracking-[0.005em] leading-[1.05] text-ink text-base md:text-lg">
            {title}
          </h3>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-[2px] border border-[color:var(--isl-hairline-strong)] bg-paper text-ink-2 transition-colors hover:border-ink hover:text-ink"
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
                <Button
                  key={`${link.label}-${link.url}`}
                  type="button"
                  onClick={() => setWatchTarget(link)}
                >
                  <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                    <path d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z" />
                  </svg>
                  {link.label}
                </Button>
              ))
            ) : (
              <Button
                type="button"
                disabled
                title="YouTube link not available yet"
              >
                <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                  <path d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z" />
                </svg>
                Watch Race
              </Button>
            )}

            <Button
              type="button"
              variant="secondary"
              onClick={openResultsModal}
              disabled={!hasResults}
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 17v-6m4 6V7m4 10v-3M5 21h14" />
              </svg>
              Race Results
            </Button>

            <Button
              type="button"
              variant="secondary"
              onClick={() => setSeasonTableOpen(true)}
              disabled={!hasSeasonTable}
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 3v18h18M7 14v4m5-8v8m5-12v12" />
              </svg>
              Drivers Championship
            </Button>

            <Button
              type="button"
              variant="secondary"
              onClick={() => setConstructorsTableOpen(true)}
              disabled={!hasConstructorsTable}
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
              Constructors Championship
            </Button>
          </>
        )}

        {isPreview && (
          <Button
            type="button"
            variant="secondary"
            onClick={() => setSeasonTableOpen(true)}
            disabled={!hasSeasonTable}
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 3v18h18M7 14v4m5-8v8m5-12v12" />
            </svg>
            Season Table
          </Button>
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
          <div className="max-h-[85vh] overflow-auto rounded-[2px] border border-[color:var(--isl-hairline)] bg-paper p-3">
            {showResultsTabs && (
              <div className="mb-3 flex flex-wrap items-center gap-1 rounded-[2px] border border-[color:var(--isl-hairline)] bg-cream p-1">
                {resultsSections.map((section, idx) => (
                  <button
                    key={`${section.raceName}-${idx}`}
                    type="button"
                    onClick={() => setActiveResultIdx(idx)}
                    className={`rounded-[2px] px-4 py-1.5 text-xs font-semibold transition-colors ${
                      idx === activeResultIdx
                        ? "bg-ink text-bone"
                        : "text-meta hover:text-ink"
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
                <p className="py-8 text-center text-sm text-meta">Results are not available for this race yet.</p>
              )}
            </DriverLookupProvider>
          </div>
        </ModalShell>
      )}

      {seasonTableOpen && hasSeasonTable && (
        <ModalShell title="Drivers Championship" onClose={() => setSeasonTableOpen(false)}>
          <div className="max-h-[85vh] overflow-auto rounded-[2px] border border-[color:var(--isl-hairline)] bg-paper p-3">
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
          <div className="max-h-[85vh] overflow-auto rounded-[2px] border border-[color:var(--isl-hairline)] bg-paper p-3">
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
