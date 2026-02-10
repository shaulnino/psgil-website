"use client";

import { useState, useEffect, useRef } from "react";
import Image from "next/image";
import type { RaceEvent } from "@/lib/scheduleData";
import { groupBySeason } from "@/lib/scheduleData";
import type { RaceResultRow } from "@/lib/resultsData";
import type { Driver, Team } from "@/lib/driversData";
import RaceResultsTable from "@/components/RaceResultsTable";
import DriverLookupProvider from "@/components/DriverLookupProvider";

/* ------------------------------------------------------------------ */
/*  Country flag image (works on Windows, macOS, all browsers)         */
/* ------------------------------------------------------------------ */

function CountryFlag({
  code,
  width = 30,
  height = 20,
  className = "",
}: {
  code: string;
  width?: number;
  height?: number;
  className?: string;
}) {
  const trimmed = (code ?? "").trim().toLowerCase();
  if (!trimmed || trimmed.length !== 2) {
    return (
      <span
        className="inline-flex items-center justify-center text-base"
        style={{ width, height }}
      >
        🏁
      </span>
    );
  }
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center overflow-hidden rounded-[3px] ${className}`}
      style={{ width, height }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={`https://flagcdn.com/w80/${trimmed}.png`}
        srcSet={`https://flagcdn.com/w160/${trimmed}.png 2x`}
        alt={trimmed.toUpperCase()}
        className="h-full w-full object-cover"
        loading="lazy"
      />
    </span>
  );
}

/* ------------------------------------------------------------------ */
/*  Results modal – shows table (primary) with image toggle             */
/* ------------------------------------------------------------------ */

function ResultsModal({
  event,
  tableData,
  onClose,
}: {
  event: RaceEvent;
  tableData: RaceResultRow[];
  onClose: () => void;
}) {
  const hasTable = tableData.length > 0;
  const hasImage = !!event.results_image;
  const [showImage, setShowImage] = useState(!hasTable && hasImage);

  // Image zoom state (only used when showing image)
  const [zoom, setZoom] = useState(1);
  const [isDragging, setIsDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0, scrollLeft: 0, scrollTop: 0 });
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const clamp = (v: number) => Math.min(3, Math.max(1, v));

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative mx-4 w-full max-w-5xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top bar: close + toggle */}
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h3 className="font-display text-sm font-semibold text-white/80 md:text-base">
              {event.race_name}
            </h3>
            {/* Toggle between table and image when both exist */}
            {hasTable && hasImage && (
              <button
                onClick={() => {
                  setShowImage((v) => !v);
                  setZoom(1);
                }}
                className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-[11px] font-medium uppercase tracking-wider text-white/50 transition hover:border-[#7020B0]/40 hover:text-white/80"
              >
                {showImage ? (
                  <>
                    <span>📊</span> Show table
                  </>
                ) : (
                  <>
                    <span>🖼️</span> Show image
                  </>
                )}
              </button>
            )}
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full border border-white/20 bg-black/60 text-white/80 transition hover:text-white"
          >
            ×
          </button>
        </div>

        {/* Image zoom controls (only when showing image) */}
        {showImage && hasImage && (
          <div className="mb-3 flex items-center gap-2">
            <button
              onClick={() => setZoom((z) => clamp(z - 0.25))}
              className="flex h-8 w-8 items-center justify-center rounded-full border border-white/20 bg-black/60 text-white/80 transition hover:text-white"
            >
              −
            </button>
            <span className="text-xs text-white/60">
              {Math.round(zoom * 100)}%
            </span>
            <button
              onClick={() => setZoom((z) => clamp(z + 0.25))}
              className="flex h-8 w-8 items-center justify-center rounded-full border border-white/20 bg-black/60 text-white/80 transition hover:text-white"
            >
              +
            </button>
            <button
              onClick={() => setZoom(1)}
              className="flex h-8 items-center justify-center rounded-full border border-white/20 bg-black/60 px-3 text-xs text-white/80 transition hover:text-white"
            >
              Reset
            </button>
          </div>
        )}

        {/* Content */}
        {showImage && hasImage ? (
          <div
            ref={scrollRef}
            className={`max-h-[85vh] overflow-auto rounded-2xl border border-white/10 bg-[#0B0B0E] p-3 shadow-[0_0_30px_rgba(0,0,0,0.4)] ${
              zoom > 1
                ? isDragging
                  ? "cursor-grabbing"
                  : "cursor-grab"
                : "cursor-default"
            }`}
            onWheel={(e) => {
              e.stopPropagation();
              setZoom((z) => clamp(z - e.deltaY * 0.002));
            }}
            onPointerDown={(e) => {
              if (zoom <= 1 || !scrollRef.current) return;
              scrollRef.current.setPointerCapture(e.pointerId);
              setIsDragging(true);
              dragStart.current = {
                x: e.clientX,
                y: e.clientY,
                scrollLeft: scrollRef.current.scrollLeft,
                scrollTop: scrollRef.current.scrollTop,
              };
            }}
            onPointerMove={(e) => {
              if (!isDragging || !scrollRef.current) return;
              scrollRef.current.scrollLeft =
                dragStart.current.scrollLeft - (e.clientX - dragStart.current.x);
              scrollRef.current.scrollTop =
                dragStart.current.scrollTop - (e.clientY - dragStart.current.y);
            }}
            onPointerUp={() => setIsDragging(false)}
            onPointerLeave={() => setIsDragging(false)}
            style={{ touchAction: zoom > 1 ? "none" : "auto" }}
          >
            <Image
              src={event.results_image!}
              alt={`${event.race_name} results`}
              width={2000}
              height={1200}
              sizes="100vw"
              quality={100}
              priority
              className="h-auto w-full object-contain transition-transform"
              style={{ width: `${zoom * 100}%` }}
            />
          </div>
        ) : hasTable ? (
          <div className="max-h-[85vh] overflow-auto rounded-2xl border border-white/10 bg-[#0B0B0E] p-3 shadow-[0_0_30px_rgba(0,0,0,0.4)]">
            <RaceResultsTable
              results={tableData}
              caption={`${event.race_name} — Race Results`}
            />
          </div>
        ) : (
          <div className="flex items-center justify-center rounded-2xl border border-white/10 bg-[#0B0B0E] py-16">
            <p className="text-sm text-white/50">
              Results not available yet.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Poster modal                                                       */
/* ------------------------------------------------------------------ */

function PosterModal({
  event,
  hasTableData,
  onClose,
  onShowResults,
}: {
  event: RaceEvent;
  /** Whether CSV table data exists for this event. */
  hasTableData: boolean;
  onClose: () => void;
  onShowResults: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const isCompleted = event.status.toLowerCase() === "completed";
  const hasPoster = !!event.poster_image;
  const hasResults = !!event.results_image || hasTableData;
  const hasYoutube = !!event.youtube_url;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative mx-4 flex w-full max-w-2xl flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute right-3 top-3 z-10 flex h-9 w-9 items-center justify-center rounded-full border border-white/20 bg-black/60 text-white/80 transition hover:text-white"
        >
          ×
        </button>

        <div className="max-h-[90vh] overflow-hidden overflow-y-auto rounded-2xl border border-white/10 bg-[#0B0B0E] shadow-[0_0_30px_rgba(0,0,0,0.4)]">
          {/* Poster image */}
          <div className="w-full overflow-hidden bg-gradient-to-br from-[#111122] via-[#0B0B0E] to-[#1b0b2e]">
            {hasPoster ? (
              <Image
                src={event.poster_image!}
                alt={`${event.race_name} poster`}
                width={1200}
                height={1600}
                sizes="(max-width: 768px) 100vw, 640px"
                className="h-auto max-h-[65vh] w-full object-contain"
                unoptimized
              />
            ) : (
              <div className="flex items-center justify-center py-20">
                <span className="text-xs uppercase tracking-[0.2em] text-white/60">
                  Poster not available
                </span>
              </div>
            )}
          </div>

          {/* Info + actions */}
          <div className="p-5">
            <div className="flex flex-wrap items-center gap-3">
              <CountryFlag code={event.country_code} width={30} height={20} />
              <h3 className="font-display text-lg font-semibold text-white">
                {event.race_name}
              </h3>
              <span
                className={`inline-flex items-center justify-center rounded-full px-2 py-px text-[10px] font-semibold uppercase leading-none tracking-wider ${
                  event.league.toLowerCase() === "main"
                    ? "bg-[#7020B0]/20 text-[#a855f7] border border-[#7020B0]/40"
                    : "bg-[#D4AF37]/15 text-[#D4AF37] border border-[#D4AF37]/30"
                }`}
              >
                {event.league}
              </span>
            </div>
            <p className="mt-1 text-sm text-white/50">
              Season {event.season} · Race #{event.race_number} · {event.date}
            </p>

            {isCompleted && (hasResults || hasYoutube) && (
              <div className="mt-4 flex flex-wrap gap-3">
                {hasResults && (
                  <button
                    onClick={onShowResults}
                    className="inline-flex items-center justify-center rounded-full border border-white/20 px-4 py-2 text-sm font-semibold text-white/90 transition hover:border-[#7020B0]/60 hover:text-white hover:shadow-[0_0_16px_rgba(112,32,176,0.35)]"
                  >
                    See result
                  </button>
                )}
                {hasYoutube && (
                  <a
                    href={event.youtube_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center rounded-full bg-[#7020B0] px-4 py-2 text-sm font-semibold text-white shadow-[0_0_20px_rgba(112,32,176,0.35)] transition hover:-translate-y-0.5 hover:shadow-[0_0_28px_rgba(112,32,176,0.6)]"
                  >
                    Watch the race
                  </a>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Status badge                                                       */
/* ------------------------------------------------------------------ */

function StatusBadge({ status }: { status: string }) {
  const isCompleted = status.toLowerCase() === "completed";
  return (
    <span
      className={`inline-flex items-center justify-center gap-1 rounded-full px-2 py-px text-[10px] font-semibold uppercase leading-none tracking-wider md:justify-self-center ${
        isCompleted
          ? "border border-emerald-500/30 bg-emerald-500/15 text-emerald-400"
          : "border border-white/10 bg-white/5 text-white/50"
      }`}
    >
      <span
        className={`h-1.5 w-1.5 shrink-0 rounded-full ${
          isCompleted ? "bg-emerald-400" : "bg-white/40"
        }`}
      />
      {status}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/*  League badge                                                       */
/* ------------------------------------------------------------------ */

function LeagueBadge({ league }: { league: string }) {
  const isMain = league.toLowerCase() === "main";
  return (
    <span
      className={`inline-flex items-center justify-center rounded-full px-2 py-px text-[10px] font-semibold uppercase leading-none tracking-wider md:justify-self-center ${
        isMain
          ? "border border-[#7020B0]/40 bg-[#7020B0]/20 text-[#a855f7]"
          : "border border-[#D4AF37]/30 bg-[#D4AF37]/15 text-[#D4AF37]"
      }`}
    >
      {league}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/*  Main ScheduleList component                                        */
/* ------------------------------------------------------------------ */

type ScheduleListProps = {
  events: RaceEvent[];
  /** Race results grouped by event_id (from CSV). */
  raceResultsByEvent?: Record<string, RaceResultRow[]>;
  /** All drivers for driver card lookup. */
  allDrivers?: Driver[];
  /** All teams for driver card lookup. */
  allTeams?: Team[];
};

export default function ScheduleList({
  events,
  raceResultsByEvent = {},
  allDrivers = [],
  allTeams = [],
}: ScheduleListProps) {
  const [posterEvent, setPosterEvent] = useState<RaceEvent | null>(null);
  const [resultsEvent, setResultsEvent] = useState<RaceEvent | null>(null);

  const seasons = groupBySeason(events);

  if (events.length === 0) {
    return (
      <div className="flex items-center justify-center rounded-2xl border border-white/10 bg-white/5 py-16">
        <p className="text-sm text-white/50">No race events available yet.</p>
      </div>
    );
  }

  return (
    <>
      <div className="flex flex-col gap-10">
        {seasons.map(({ season, events: seasonEvents }) => (
          <div key={season}>
            <h2 className="mb-4 font-display text-xl font-semibold text-white md:text-2xl">
              Season {season}
            </h2>
            <div className="overflow-hidden rounded-2xl border border-white/10">
              {/* Desktop header */}
              <div className="hidden border-b border-white/10 bg-white/5 px-5 py-3 text-[10px] font-semibold uppercase tracking-[0.2em] text-white/40 md:grid md:grid-cols-[60px_1fr_120px_100px_100px_90px]">
                <span>#</span>
                <span>Race</span>
                <span className="text-center">Date</span>
                <span className="text-center">League</span>
                <span className="text-center">Status</span>
                <span className="text-center">Flag</span>
              </div>

              {seasonEvents.map((event, idx) => {
                const isCompleted = event.status.toLowerCase() === "completed";
                return (
                  <button
                    key={`${event.season}-${event.race_number}-${event.league}-${idx}`}
                    type="button"
                    onClick={() => setPosterEvent(event)}
                    className={`group flex w-full flex-col gap-2 border-b border-white/5 px-5 py-4 text-left transition hover:bg-white/5 md:grid md:grid-cols-[60px_1fr_120px_100px_100px_90px] md:items-center md:gap-0 ${
                      isCompleted ? "cursor-pointer" : "cursor-pointer"
                    }`}
                  >
                    {/* Race number */}
                    <div className="flex items-center gap-3 md:contents">
                      <span className="font-display text-sm font-semibold text-[#D4AF37]">
                        #{event.race_number}
                      </span>

                      {/* Race name (mobile: inline, desktop: own column) */}
                      <span className="font-display text-sm font-semibold text-white md:text-base">
                        {event.race_name}
                      </span>
                    </div>

                    {/* Mobile: meta row */}
                    <div className="flex flex-wrap items-center gap-3 md:contents">
                      <span className="text-xs text-white/50 md:text-center md:text-sm">
                        {event.date}
                      </span>
                      <LeagueBadge league={event.league} />
                      <StatusBadge status={event.status} />
                      <span className="ml-auto md:ml-0 md:flex md:justify-center">
                        <CountryFlag code={event.country_code} width={30} height={20} />
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Poster modal */}
      {posterEvent && (
        <PosterModal
          event={posterEvent}
          hasTableData={
            (raceResultsByEvent[posterEvent.event_id]?.length ?? 0) > 0
          }
          onClose={() => setPosterEvent(null)}
          onShowResults={() => {
            const ev = posterEvent;
            setPosterEvent(null);
            setResultsEvent(ev);
          }}
        />
      )}

      {/* Results modal (table + image toggle) */}
      {resultsEvent && (
        <DriverLookupProvider
          drivers={allDrivers}
          teams={allTeams}
          placeholderSrc="/placeholders/driver.png"
        >
          <ResultsModal
            event={resultsEvent}
            tableData={raceResultsByEvent[resultsEvent.event_id] ?? []}
            onClose={() => setResultsEvent(null)}
          />
        </DriverLookupProvider>
      )}
    </>
  );
}
