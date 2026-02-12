"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import Image from "next/image";
import ZoomableImage from "@/components/ZoomableImage";
import type { RaceGroup, RaceEvent } from "@/lib/scheduleData";
import { toIsraelTimestamp } from "@/lib/scheduleData";
import type { RaceResultRow } from "@/lib/resultsData";
import type { Driver, Team } from "@/lib/driversData";
import RaceResultsTable from "@/components/RaceResultsTable";
import DriverLookupProvider from "@/components/DriverLookupProvider";
import YouTubeEmbed from "@/components/YouTubeEmbed";
import { getYouTubeVideoId } from "@/lib/youtube";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

type HomeRaceCardsProps = {
  lastGroup: RaceGroup | null;
  nextGroup: RaceGroup | null;
  raceResultsByEvent?: Record<string, RaceResultRow[]>;
  allDrivers?: Driver[];
  allTeams?: Team[];
};

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

/** Short label for a race (tab/button text). */
function raceLabel(event: RaceEvent): string {
  return event.race_name || `Race #${event.race_number}`;
}

/** Collect unique youtube URLs from a group. */
function uniqueYoutubeUrls(group: RaceGroup): { label: string; url: string }[] {
  const seen = new Set<string>();
  const result: { label: string; url: string }[] = [];
  for (const e of group.events) {
    if (e.youtube_url && !seen.has(e.youtube_url)) {
      seen.add(e.youtube_url);
      result.push({
        label: group.events.length > 1 ? `Watch Race #${e.race_number}` : "Watch the Race",
        url: e.youtube_url,
      });
    }
  }
  // If all races share the same URL, use a single generic label
  if (result.length === 1) result[0].label = "Watch the Race";
  return result;
}

/** Check if at least one event has a results image or table data. */
function hasAnyResults(group: RaceGroup, raceResultsByEvent: Record<string, RaceResultRow[]> = {}): boolean {
  return group.events.some((e) => !!e.results_image || (raceResultsByEvent[e.event_id]?.length ?? 0) > 0);
}

/** Check if the group is completed (any event completed). */
function isGroupCompleted(group: RaceGroup): boolean {
  return group.events.some((e) => e.status.toLowerCase() === "completed");
}

/* ------------------------------------------------------------------ */
/*  Watch modal – embeds YouTube player on-site                        */
/* ------------------------------------------------------------------ */

function HomeWatchModal({
  label,
  youtubeUrl,
  onClose,
}: {
  label: string;
  youtubeUrl: string;
  onClose: () => void;
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
              {label}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full border border-white/20 bg-black/60 text-white/80 transition hover:text-white"
          >
            ×
          </button>
        </div>

        {/* Embed */}
        <YouTubeEmbed youtubeUrl={youtubeUrl} title={`${label} – Race Broadcast`} />

        {/* External link fallback */}
        <div className="mt-3 flex justify-end">
          <a
            href={youtubeUrl}
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
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  League badge                                                       */
/* ------------------------------------------------------------------ */

function LeagueBadge({ league }: { league: string }) {
  const isMain = league.toLowerCase() === "main";
  return (
    <span
      className={`inline-flex items-center justify-center rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase leading-none tracking-wider ${
        isMain
          ? "border border-[#7020B0]/40 bg-[#7020B0]/20 text-[#a855f7]"
          : "border border-[#D4AF37]/30 bg-[#D4AF37]/15 text-[#D4AF37]"
      }`}
    >
      {isMain ? "MAIN" : "WILD"}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/*  Countdown for next race card                                       */
/* ------------------------------------------------------------------ */

function RaceCountdown({ targetMs }: { targetMs: number }) {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1_000);
    return () => clearInterval(id);
  }, []);

  const total = Math.max(0, targetMs - now);
  if (total <= 0) return null;

  const days = Math.floor(total / 86_400_000);
  const hours = Math.floor((total / 3_600_000) % 24);
  const minutes = Math.floor((total / 60_000) % 60);
  const seconds = Math.floor((total / 1_000) % 60);

  const pad = (v: number) => String(v).padStart(2, "0");

  return (
    <div className="flex items-center justify-center gap-2 rounded-lg border border-white/5 bg-white/5 px-2 py-1.5">
      {[
        { v: days, l: "d" },
        { v: hours, l: "h" },
        { v: minutes, l: "m" },
        { v: seconds, l: "s" },
      ].map((unit, i) => (
        <div key={unit.l} className="flex items-center gap-2">
          {i > 0 && (
            <span className="font-display text-xs font-bold text-[#D4AF37]/40">:</span>
          )}
          <div className="flex items-baseline gap-0.5">
            <span className="font-display text-sm font-bold leading-none text-white tabular-nums">
              {pad(unit.v)}
            </span>
            <span className="text-[8px] uppercase text-[#D4AF37]">
              {unit.l}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Race day card                                                      */
/* ------------------------------------------------------------------ */

function RaceGroupCard({
  heading,
  group,
  raceResultsByEvent = {},
  onShowResults,
  onWatch,
  showCountdown = false,
}: {
  heading: string;
  group: RaceGroup;
  raceResultsByEvent?: Record<string, RaceResultRow[]>;
  onShowResults?: () => void;
  onWatch?: (label: string, url: string) => void;
  showCountdown?: boolean;
}) {
  const isSingle = group.events.length === 1;
  const first = group.events[0];
  const poster = group.events.find((e) => !!e.poster_image) ?? first;
  const hasPoster = !!poster.poster_image;
  const completed = isGroupCompleted(group);
  const youtubeLinks = uniqueYoutubeUrls(group);
  const showResults = completed && hasAnyResults(group, raceResultsByEvent) && !!onShowResults;
  const isWild = group.league.toLowerCase() === "wild";

  // Compute race start timestamp for countdown (use earliest event with a start_time)
  const countdownTargetMs = useMemo(() => {
    if (!showCountdown || completed) return null;
    for (const e of group.events) {
      const ts = toIsraelTimestamp(e.date, e.start_time);
      if (ts !== null && ts > Date.now()) return ts;
    }
    return null;
  }, [showCountdown, completed, group.events]);

  return (
    <div className="flex flex-col rounded-2xl border border-white/10 bg-white/5 p-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <h3 className="font-display text-lg font-semibold text-white">{heading}</h3>
          <LeagueBadge league={group.league} />
        </div>
        {countdownTargetMs ? (
          <RaceCountdown targetMs={countdownTargetMs} />
        ) : (
          <span className="text-sm text-white/60">{group.date}</span>
        )}
      </div>

      {/* Poster */}
      <div className="mt-4 overflow-hidden rounded-xl border border-white/10 bg-[#0B0B0E]">
        {hasPoster ? (
          <ZoomableImage
            src={poster.poster_image!}
            alt={`${first.race_name} poster`}
            fill
            sizes="(max-width: 768px) 100vw, 50vw"
            triggerClassName="group relative aspect-video cursor-pointer"
            imageClassName="object-cover transition duration-200 group-hover:scale-[1.02]"
          />
        ) : (
          <div className="flex aspect-video items-center justify-center bg-gradient-to-br from-[#111122] via-[#0B0B0E] to-[#1b0b2e]">
            <span className="text-xs uppercase tracking-[0.2em] text-white/60">
              Poster coming soon
            </span>
          </div>
        )}
      </div>

      {/* Description */}
      <div className="mt-4 space-y-1">
        {isSingle ? (
          <p className="text-sm text-white/70">
            Season {first.season} · Race #{first.race_number}, {first.race_name}
            {isWild ? " · Wild Event" : ""} · {group.date}
          </p>
        ) : (
          <>
            <p className="text-sm font-medium text-white/80">
              Season {group.season} · {isWild ? "Wild Event Day" : "Race Day"} · {group.date}
            </p>
            {group.events.map((e) => (
              <p key={e.race_number} className="text-sm text-white/60">
                Race #{e.race_number}: {e.race_name}
              </p>
            ))}
          </>
        )}
      </div>

      {/* Actions — pushed to the bottom of the card */}
      <div className="mt-auto flex flex-wrap gap-3 pt-5">
        {youtubeLinks.map((yt) => (
          <button
            key={yt.url}
            type="button"
            onClick={() => onWatch?.(yt.label, yt.url)}
            className="inline-flex items-center justify-center gap-2 rounded-full bg-[#7020B0] px-4 py-2 text-sm font-semibold text-white shadow-[0_0_20px_rgba(112,32,176,0.35)] transition hover:-translate-y-0.5 hover:shadow-[0_0_28px_rgba(112,32,176,0.6)]"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
              <path d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z" />
            </svg>
            {yt.label}
          </button>
        ))}
        {showResults && (
          <button
            type="button"
            onClick={onShowResults}
            className="inline-flex items-center justify-center rounded-full border border-white/20 px-4 py-2 text-sm font-semibold text-white/90 transition hover:border-[#7020B0]/60 hover:text-white hover:shadow-[0_0_16px_rgba(112,32,176,0.35)]"
          >
            Race Results
          </button>
        )}
        {!completed && (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-[#FF0000]/30 bg-[#FF0000]/10 px-4 py-2 text-sm font-semibold text-white animate-[upcoming-pulse_2s_ease-in-out_infinite]">
            <span className="h-1.5 w-1.5 rounded-full bg-[#FF0000] animate-[upcoming-pulse_2s_ease-in-out_infinite]" />
            Upcoming
          </span>
        )}
      </div>

    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Multi-race results modal with tab selector + table/image toggle    */
/* ------------------------------------------------------------------ */

function GroupResultsModal({
  group,
  raceResultsByEvent = {},
  onClose,
}: {
  group: RaceGroup;
  raceResultsByEvent?: Record<string, RaceResultRow[]>;
  onClose: () => void;
}) {
  // Events that have either a results image or CSV table data
  const withResults = group.events.filter(
    (e) => !!e.results_image || (raceResultsByEvent[e.event_id]?.length ?? 0) > 0,
  );
  const isSingle = withResults.length <= 1;
  const [activeIdx, setActiveIdx] = useState(0);
  const current = withResults[activeIdx] ?? withResults[0];

  const tableData = current ? (raceResultsByEvent[current.event_id] ?? []) : [];
  const hasTable = tableData.length > 0;
  const hasImage = !!current?.results_image;
  const [showImage, setShowImage] = useState(!hasTable && hasImage);

  // Image zoom state
  const [zoom, setZoom] = useState(1);
  const [isDragging, setIsDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0, scrollLeft: 0, scrollTop: 0 });
  const scrollRef = useRef<HTMLDivElement>(null);
  const clamp = (v: number) => Math.min(3, Math.max(1, v));

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // When switching tabs, reset to table view if available
  useEffect(() => {
    const td = current ? (raceResultsByEvent[current.event_id] ?? []) : [];
    setShowImage(td.length === 0 && !!current?.results_image);
    setZoom(1);
  }, [activeIdx, current, raceResultsByEvent]);

  if (!current || (!hasImage && !hasTable)) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
      onClick={onClose}
    >
      <div className="relative mx-4 w-full max-w-5xl" onClick={(e) => e.stopPropagation()}>
        {/* Top bar */}
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h3 className="font-display text-sm font-semibold text-white/80 md:text-base">
              {current.race_name}
            </h3>
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

        {/* Tab selector for multi-race groups */}
        {!isSingle && (
          <div className="mb-3 flex items-center gap-1 rounded-full border border-white/10 bg-black/60 p-1 backdrop-blur-sm">
            {withResults.map((e, idx) => (
              <button
                key={e.race_number}
                onClick={() => setActiveIdx(idx)}
                className={`rounded-full px-4 py-1.5 text-xs font-semibold transition ${
                  idx === activeIdx
                    ? "bg-[#7020B0]/80 text-white shadow-[0_0_12px_rgba(112,32,176,0.3)]"
                    : "text-white/50 hover:text-white/80"
                }`}
              >
                {raceLabel(e)}
              </button>
            ))}
          </div>
        )}

        {/* Zoom controls (image mode only) */}
        {showImage && hasImage && (
          <div className="mb-3 flex items-center gap-2">
            <button
              onClick={() => setZoom((z) => clamp(z - 0.25))}
              className="flex h-8 w-8 items-center justify-center rounded-full border border-white/20 bg-black/60 text-white/80 transition hover:text-white"
            >
              −
            </button>
            <span className="text-xs text-white/60">{Math.round(zoom * 100)}%</span>
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

        {/* Content: table or image */}
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
              key={current.race_number}
              src={current.results_image!}
              alt={`${current.race_name} results`}
              width={2000}
              height={1200}
              sizes="100vw"
              quality={100}
              unoptimized
              className="h-auto w-full object-contain transition-transform"
              style={{ width: `${zoom * 100}%` }}
            />
          </div>
        ) : hasTable ? (
          <div className="max-h-[85vh] overflow-auto rounded-2xl border border-white/10 bg-[#0B0B0E] p-3 shadow-[0_0_30px_rgba(0,0,0,0.4)]">
            <RaceResultsTable
              results={tableData}
              caption={`${current.race_name} — Race Results`}
            />
          </div>
        ) : null}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main export                                                        */
/* ------------------------------------------------------------------ */

export default function HomeRaceCards({
  lastGroup,
  nextGroup,
  raceResultsByEvent = {},
  allDrivers = [],
  allTeams = [],
}: HomeRaceCardsProps) {
  const [showResultsGroup, setShowResultsGroup] = useState<RaceGroup | null>(null);
  const [watchTarget, setWatchTarget] = useState<{ label: string; url: string } | null>(null);

  /** Check if a group has any results (image or CSV table data). */
  const groupHasResults = (group: RaceGroup) =>
    group.events.some(
      (e) => !!e.results_image || (raceResultsByEvent[e.event_id]?.length ?? 0) > 0,
    );

  const handleWatch = (label: string, url: string) => setWatchTarget({ label, url });

  // Nothing to show at all
  if (!lastGroup && !nextGroup) {
    return (
      <div className="flex items-center justify-center rounded-2xl border border-white/10 bg-white/5 py-16">
        <p className="text-sm text-white/50">Race schedule not available yet.</p>
      </div>
    );
  }

  return (
    <>
      <div className="grid gap-6 lg:grid-cols-2">
        {lastGroup ? (
          <RaceGroupCard
            heading="Last Race"
            group={lastGroup}
            raceResultsByEvent={raceResultsByEvent}
            onShowResults={
              groupHasResults(lastGroup)
                ? () => setShowResultsGroup(lastGroup)
                : undefined
            }
            onWatch={handleWatch}
          />
        ) : (
          <div className="flex items-center justify-center rounded-2xl border border-white/10 bg-white/5 py-16">
            <p className="text-sm text-white/50">No past races yet.</p>
          </div>
        )}
        {nextGroup ? (
          <RaceGroupCard heading="Next Race" group={nextGroup} onWatch={handleWatch} showCountdown />
        ) : (
          <div className="flex items-center justify-center rounded-2xl border border-white/10 bg-white/5 py-16">
            <p className="text-sm text-white/50">Season complete — stay tuned!</p>
          </div>
        )}
      </div>

      {/* Results modal (table + image toggle) */}
      {showResultsGroup && groupHasResults(showResultsGroup) && (
        <DriverLookupProvider
          drivers={allDrivers}
          teams={allTeams}
          placeholderSrc="/placeholders/driver.png"
        >
          <GroupResultsModal
            group={showResultsGroup}
            raceResultsByEvent={raceResultsByEvent}
            onClose={() => setShowResultsGroup(null)}
          />
        </DriverLookupProvider>
      )}

      {/* Watch modal (YouTube embed) */}
      {watchTarget && (
        <HomeWatchModal
          label={watchTarget.label}
          youtubeUrl={watchTarget.url}
          onClose={() => setWatchTarget(null)}
        />
      )}
    </>
  );
}
