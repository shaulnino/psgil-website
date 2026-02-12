"use client";

import { Suspense, useState, useEffect, useRef, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import Image from "next/image";
import type { RaceEvent } from "@/lib/scheduleData";
import { toIsraelTimestamp } from "@/lib/scheduleData";
import type { RaceResultRow } from "@/lib/resultsData";
import type { Driver, Team } from "@/lib/driversData";
import type { SeasonConfig } from "@/lib/seasonConfig";
import { getSeasonsForDropdown, matchesSeason } from "@/lib/seasonConfig";
import SeasonSelector from "@/components/SeasonSelector";
import RaceResultsTable from "@/components/RaceResultsTable";
import DriverLookupProvider from "@/components/DriverLookupProvider";
import YouTubeEmbed from "@/components/YouTubeEmbed";
import { getYouTubeVideoId } from "@/lib/youtube";

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
/*  Race time state helper                                              */
/* ------------------------------------------------------------------ */

type RaceTimeState = "upcoming" | "started" | "unknown";

/**
 * Determine if a race is upcoming, started, or unknown based on
 * date + start_time in Israel timezone.
 */
function getRaceTimeState(event: RaceEvent): RaceTimeState {
  if (!event.date) return "unknown";
  const ts = toIsraelTimestamp(event.date, event.start_time);
  if (ts === null) return "unknown";
  return Date.now() >= ts ? "started" : "upcoming";
}

/* ------------------------------------------------------------------ */
/*  Watch modal – embeds YouTube player on-site                         */
/* ------------------------------------------------------------------ */

function WatchModal({
  event,
  onClose,
}: {
  event: RaceEvent;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const timeState = getRaceTimeState(event);
  const hasEmbed = !!getYouTubeVideoId(event.youtube_url);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative mx-4 w-full max-w-4xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[#7020B0]/20 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.15em] text-[#a855f7]">
              <span className="h-1.5 w-1.5 rounded-full bg-[#a855f7]" />
              Race Broadcast
            </span>
            <h3 className="font-display text-sm font-semibold text-white/80 md:text-base">
              {event.race_name}
            </h3>
            {timeState === "upcoming" && event.start_time && (
              <span className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] font-medium text-white/60">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                  className="h-3.5 w-3.5 text-white/40"
                >
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zm.75-13a.75.75 0 00-1.5 0v5c0 .414.336.75.75.75h4a.75.75 0 000-1.5h-3.25V5z"
                    clipRule="evenodd"
                  />
                </svg>
                Stream starts at {event.start_time}
              </span>
            )}
            {timeState === "started" && (
              <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-medium text-emerald-400">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
                {event.status.toLowerCase() === "completed"
                  ? "Replay available"
                  : "Live / Replay"}
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full border border-white/20 bg-black/60 text-white/80 transition hover:text-white"
          >
            ×
          </button>
        </div>

        {/* Embed or placeholder */}
        <YouTubeEmbed
          youtubeUrl={event.youtube_url}
          title={`${event.race_name} – Race Broadcast`}
        />

        {/* External link fallback */}
        {hasEmbed && (
          <div className="mt-3 flex justify-end">
            <a
              href={event.youtube_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-[11px] font-medium text-white/50 transition hover:border-white/20 hover:text-white/80"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 20 20"
                fill="currentColor"
                className="h-3.5 w-3.5"
              >
                <path
                  fillRule="evenodd"
                  d="M4.25 5.5a.75.75 0 00-.75.75v8.5c0 .414.336.75.75.75h8.5a.75.75 0 00.75-.75v-4a.75.75 0 011.5 0v4A2.25 2.25 0 0112.75 17h-8.5A2.25 2.25 0 012 14.75v-8.5A2.25 2.25 0 014.25 4h5a.75.75 0 010 1.5h-5zm7.25-.75a.75.75 0 01.75-.75h3.5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0V6.31l-5.47 5.47a.75.75 0 01-1.06-1.06l5.47-5.47H12.5a.75.75 0 01-.75-.75z"
                  clipRule="evenodd"
                />
              </svg>
              Open on YouTube
            </a>
          </div>
        )}
      </div>
    </div>
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
                dragStart.current.scrollLeft -
                (e.clientX - dragStart.current.x);
              scrollRef.current.scrollTop =
                dragStart.current.scrollTop -
                (e.clientY - dragStart.current.y);
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
  onWatch,
}: {
  event: RaceEvent;
  /** Whether CSV table data exists for this event. */
  hasTableData: boolean;
  onClose: () => void;
  onShowResults: () => void;
  onWatch: () => void;
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
  const timeState = getRaceTimeState(event);

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
              <CountryFlag
                code={event.country_code}
                width={30}
                height={20}
              />
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
              Season {event.season} · Race #{event.race_number} ·{" "}
              {event.date}
              {event.start_time && ` · ${event.start_time}`}
            </p>

            {/* Action buttons */}
            {(hasResults || hasYoutube) && (
              <div className="mt-4 flex flex-wrap items-center gap-3">
                {/* See result — only for completed races */}
                {isCompleted && hasResults && (
                  <button
                    onClick={onShowResults}
                    className="inline-flex items-center justify-center rounded-full border border-white/20 px-4 py-2 text-sm font-semibold text-white/90 transition hover:border-[#7020B0]/60 hover:text-white hover:shadow-[0_0_16px_rgba(112,32,176,0.35)]"
                  >
                    See result
                  </button>
                )}

                {/* Watch the race — for any race with youtube_url */}
                {hasYoutube && (
                  <button
                    onClick={onWatch}
                    className="inline-flex items-center justify-center gap-2 rounded-full bg-[#7020B0] px-4 py-2 text-sm font-semibold text-white shadow-[0_0_20px_rgba(112,32,176,0.35)] transition hover:-translate-y-0.5 hover:shadow-[0_0_28px_rgba(112,32,176,0.6)]"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                      className="h-4 w-4"
                    >
                      <path d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z" />
                    </svg>
                    {timeState === "upcoming"
                      ? "Watch live"
                      : "Watch the race"}
                  </button>
                )}

                {/* Upcoming race: show start time hint */}
                {timeState === "upcoming" && event.start_time && (
                  <span className="inline-flex items-center gap-1.5 text-xs text-white/40">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                      className="h-3.5 w-3.5"
                    >
                      <path
                        fillRule="evenodd"
                        d="M10 18a8 8 0 100-16 8 8 0 000 16zm.75-13a.75.75 0 00-1.5 0v5c0 .414.336.75.75.75h4a.75.75 0 000-1.5h-3.25V5z"
                        clipRule="evenodd"
                      />
                    </svg>
                    Stream starts at {event.start_time}
                  </span>
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
/*  Lightweight tooltip wrapper                                        */
/* ------------------------------------------------------------------ */

function Tooltip({
  text,
  children,
}: {
  text: string;
  children: React.ReactNode;
}) {
  return (
    <span className="group/tip relative inline-flex">
      {children}
      <span className="pointer-events-none absolute bottom-full left-1/2 z-50 mb-2 -translate-x-1/2 whitespace-nowrap rounded-md bg-[#1a1a2e] px-2.5 py-1 text-[11px] font-medium text-white/90 opacity-0 shadow-lg ring-1 ring-white/10 transition-opacity group-hover/tip:opacity-100">
        {text}
      </span>
    </span>
  );
}

/* ------------------------------------------------------------------ */
/*  SVG icons (inline, no external dependency)                         */
/* ------------------------------------------------------------------ */

function SunIcon({ className = "" }: { className?: string }) {
  return (
    <svg
      className={className}
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="5" />
      <line x1="12" y1="1" x2="12" y2="3" />
      <line x1="12" y1="21" x2="12" y2="23" />
      <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
      <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
      <line x1="1" y1="12" x2="3" y2="12" />
      <line x1="21" y1="12" x2="23" y2="12" />
      <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
      <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
    </svg>
  );
}

function CloudRainIcon({ className = "" }: { className?: string }) {
  return (
    <svg
      className={className}
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M20 17.58A5 5 0 0 0 18 8h-1.26A8 8 0 1 0 4 16.25" />
      <line x1="8" y1="16" x2="8" y2="20" />
      <line x1="12" y1="18" x2="12" y2="22" />
      <line x1="16" y1="16" x2="16" y2="20" />
    </svg>
  );
}

function CloudSunRainIcon({ className = "" }: { className?: string }) {
  return (
    <svg
      className={className}
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 2v2" />
      <path d="m4.93 4.93 1.41 1.41" />
      <path d="M20 12h2" />
      <path d="m19.07 4.93-1.41 1.41" />
      <path d="M15.947 12.65a4 4 0 0 0-5.925-4.128" />
      <path d="M13 22H7" />
      <path d="M17 17.58A5 5 0 0 0 15 8h-.6A8 8 0 1 0 1 16" />
      <line x1="7" y1="17" x2="7" y2="21" />
      <line x1="11" y1="19" x2="11" y2="23" />
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/*  Race metadata badges (weather, safety cars, reverse grid)          */
/* ------------------------------------------------------------------ */

function RaceBadges({ event }: { event: RaceEvent }) {
  const weather = event.weather;
  const safetyCars = event.safety_cars ?? 0;
  const reverseGrid = event.reverse_grid === "yes";

  const hasBadges = !!weather || safetyCars > 0 || reverseGrid;
  if (!hasBadges) return null;

  return (
    <span className="inline-flex flex-wrap items-center gap-1.5">
      {/* Weather */}
      {weather === "dry" && (
        <Tooltip text="Weather: Dry race">
          <span className="inline-flex items-center gap-1 rounded-md border border-amber-500/25 bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-medium leading-none text-amber-300/90">
            <SunIcon className="shrink-0" />
            Dry
          </span>
        </Tooltip>
      )}
      {weather === "wet" && (
        <Tooltip text="Weather: Wet race">
          <span className="inline-flex items-center gap-1 rounded-md border border-sky-400/25 bg-sky-400/10 px-1.5 py-0.5 text-[10px] font-medium leading-none text-sky-300/90">
            <CloudRainIcon className="shrink-0" />
            Wet
          </span>
        </Tooltip>
      )}
      {weather === "mixed" && (
        <Tooltip text="Weather: Mixed conditions (dry & wet)">
          <span className="inline-flex items-center gap-1 rounded-md border border-teal-400/25 bg-teal-400/10 px-1.5 py-0.5 text-[10px] font-medium leading-none text-teal-300/90">
            <CloudSunRainIcon className="shrink-0" />
            Mixed
          </span>
        </Tooltip>
      )}

      {/* Safety cars */}
      {safetyCars > 0 && (
        <Tooltip text={`Safety Cars: ${safetyCars}`}>
          <span className="inline-flex items-center gap-1 rounded-md border border-yellow-400/25 bg-yellow-400/10 px-1.5 py-0.5 text-[10px] font-bold leading-none text-yellow-300/90">
            SC
            <span className="font-semibold">{safetyCars}</span>
          </span>
        </Tooltip>
      )}

      {/* Reverse grid */}
      {reverseGrid && (
        <Tooltip text="Reverse grid was used for this race">
          <span className="inline-flex items-center gap-1 rounded-md border border-[#a855f7]/30 bg-[#a855f7]/10 px-1.5 py-0.5 text-[10px] font-medium leading-none text-[#c084fc]/90">
            RG
          </span>
        </Tooltip>
      )}
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
/*  Inner component                                                    */
/* ------------------------------------------------------------------ */

type ScheduleListProps = {
  seasonsConfig: SeasonConfig[];
  defaultSeasonKey: string;
  /** ALL events across every season. */
  allEvents: RaceEvent[];
  /** ALL race results across every season, grouped by event_id. */
  allRaceResults: Record<string, RaceResultRow[]>;
  allDrivers?: Driver[];
  allTeams?: Team[];
};

function ScheduleListInner({
  seasonsConfig,
  defaultSeasonKey,
  allEvents,
  allRaceResults,
  allDrivers = [],
  allTeams = [],
}: ScheduleListProps) {
  const searchParams = useSearchParams();
  const selectedSeasonKey =
    searchParams.get("season") || defaultSeasonKey;

  const seasonsList = getSeasonsForDropdown(seasonsConfig);

  /* ---------- Filter events by selected season ---------- */
  const events = useMemo(() => {
    return allEvents.filter((e) =>
      matchesSeason(e.season, selectedSeasonKey),
    );
  }, [allEvents, selectedSeasonKey]);

  /* ---------- Filter race results to only those matching filtered events ---------- */
  const raceResults = useMemo(() => {
    const eventIds = new Set(events.map((e) => e.event_id));
    const filtered: Record<string, RaceResultRow[]> = {};
    for (const [eid, rows] of Object.entries(allRaceResults)) {
      if (eventIds.has(eid)) {
        filtered[eid] = rows;
      }
    }
    return filtered;
  }, [events, allRaceResults]);

  const [posterEvent, setPosterEvent] = useState<RaceEvent | null>(null);
  const [resultsEvent, setResultsEvent] = useState<RaceEvent | null>(
    null,
  );
  const [watchEvent, setWatchEvent] = useState<RaceEvent | null>(null);

  if (seasonsConfig.length === 0) {
    return (
      <div className="flex items-center justify-center rounded-2xl border border-white/10 bg-white/5 py-16">
        <p className="text-sm text-white/50">
          No race events available yet.
        </p>
      </div>
    );
  }

  return (
    <>
      {/* Season selector */}
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div />
        <SeasonSelector
          seasons={seasonsList}
          selected={selectedSeasonKey}
        />
      </div>

      {events.length === 0 && (
        <div className="flex items-center justify-center rounded-2xl border border-white/10 bg-white/5 py-16">
          <p className="text-sm text-white/50">
            No race events available for this season.
          </p>
        </div>
      )}

      {events.length > 0 && (
        <div className="flex flex-col gap-10">
          <div>
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

              {events.map((event, idx) => {
                const isCompleted =
                  event.status.toLowerCase() === "completed";
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

                      {/* Race name + metadata badges */}
                      <span className="font-display text-sm font-semibold text-white md:text-base">
                        <span className="inline-flex flex-wrap items-center gap-2">
                          {event.race_name}
                          <RaceBadges event={event} />
                        </span>
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
                        <CountryFlag
                          code={event.country_code}
                          width={30}
                          height={20}
                        />
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Poster modal */}
      {posterEvent && (
        <PosterModal
          event={posterEvent}
          hasTableData={
            (raceResults[posterEvent.event_id]?.length ?? 0) > 0
          }
          onClose={() => setPosterEvent(null)}
          onShowResults={() => {
            const ev = posterEvent;
            setPosterEvent(null);
            setResultsEvent(ev);
          }}
          onWatch={() => {
            const ev = posterEvent;
            setPosterEvent(null);
            setWatchEvent(ev);
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
            tableData={raceResults[resultsEvent.event_id] ?? []}
            onClose={() => setResultsEvent(null)}
          />
        </DriverLookupProvider>
      )}

      {/* Watch modal (YouTube embed) */}
      {watchEvent && (
        <WatchModal
          event={watchEvent}
          onClose={() => setWatchEvent(null)}
        />
      )}
    </>
  );
}

/* ------------------------------------------------------------------ */
/*  Exported wrapper (Suspense required for useSearchParams)            */
/* ------------------------------------------------------------------ */

export default function ScheduleList(props: ScheduleListProps) {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center py-16">
          <p className="text-sm text-white/40">Loading schedule…</p>
        </div>
      }
    >
      <ScheduleListInner {...props} />
    </Suspense>
  );
}
