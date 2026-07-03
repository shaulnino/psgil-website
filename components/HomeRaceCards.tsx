"use client";

import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useTranslations, useLocale } from "next-intl";
import Image from "next/image";
import ZoomableImage from "@/components/ZoomableImage";
import type { RaceGroup, RaceEvent } from "@/lib/scheduleData";
import { toIsraelTimestamp, localizedRaceName } from "@/lib/scheduleData";
import type { RaceResultRow } from "@/lib/resultsData";
import type { Driver, Team } from "@/lib/driversData";
import RaceResultsTable from "@/components/RaceResultsTable";
import DriverLookupProvider from "@/components/DriverLookupProvider";
import YouTubeEmbed from "@/components/YouTubeEmbed";
import { Button } from "@/components/ui/button";
import { getYouTubeVideoId } from "@/lib/youtube";
import { gaClickWatchYouTube, gaClickRaceResults } from "@/lib/ga";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

/** A live group includes start/end timestamps for the client. */
type LiveGroupData = RaceGroup & {
  startTimestamp: number;
  endTimestamp: number;
};

type HomeRaceCardsProps = {
  lastGroup: RaceGroup | null;
  nextGroup: RaceGroup | null;
  /** A group that is currently LIVE (started, not ended) from server. */
  liveGroup?: LiveGroupData | null;
  /** Pre-computed start/end timestamps for the next group (for client-side live transition). */
  nextGroupTimestamps?: { startTimestamp: number; endTimestamp: number } | null;
  raceResultsByEvent?: Record<string, RaceResultRow[]>;
  allDrivers?: Driver[];
  allTeams?: Team[];
};

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

/** Short label for a race (tab/button text). */
function raceLabel(event: RaceEvent, locale: string): string {
  return localizedRaceName(event, locale) || `Race #${event.race_number}`;
}

/** Collect unique youtube URLs from a group. */
function uniqueYoutubeUrls(group: RaceGroup, watchLabel: string): { label: string; url: string }[] {
  const seen = new Set<string>();
  const result: { label: string; url: string }[] = [];
  for (const e of group.events) {
    const youtubeUrl = (e.youtube_url ?? "").trim();
    const hasValidYoutube = !!getYouTubeVideoId(youtubeUrl);
    if (hasValidYoutube && !seen.has(youtubeUrl)) {
      seen.add(youtubeUrl);
      result.push({
        label: group.events.length > 1 ? `Watch Race #${e.race_number}` : watchLabel,
        url: youtubeUrl,
      });
    }
  }
  // If all races share the same URL, use a single generic label
  if (result.length === 1) result[0].label = watchLabel;
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
  const t = useTranslations("home");
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-4xl rounded-[2px] border border-[color:var(--isl-hairline)] bg-paper p-4"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="mb-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center gap-1.5 rounded-[2px] border border-oxblood px-2 py-0.5 text-[0.75rem] font-semibold uppercase tracking-[0.2em] text-oxblood">
              <span className="h-1.5 w-1.5 rounded-full bg-oxblood" />
              {t("raceCards.raceBroadcast")}
            </span>
            <h3 className="font-display font-bold tracking-[0.005em] text-sm text-ink md:text-base">
              {label}
            </h3>
          </div>
          <button
            onClick={onClose}
            aria-label={t("raceCards.close")}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[2px] border border-[color:var(--isl-hairline)] text-xl text-ink-2 transition-colors hover:border-ink hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--isl-oxblood)]"
          >
            ×
          </button>
        </div>

        {/* Embed */}
        <YouTubeEmbed youtubeUrl={youtubeUrl} title={`${label} – ${t("raceCards.raceBroadcast")}`} />

        {/* External link fallback */}
        <div className="mt-3 flex justify-end">
          <a
            href={youtubeUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-[2px] border border-[color:var(--isl-hairline)] px-3 py-1.5 text-[11px] font-medium uppercase tracking-[0.08em] text-meta transition-colors hover:border-ink hover:text-ink"
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
            {t("raceCards.openOnYouTube")}
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
      className={`inline-flex items-center justify-center rounded-[2px] border px-2 py-0.5 text-[0.75rem] font-semibold uppercase leading-none tracking-[0.2em] ${
        isMain
          ? "border-[color:var(--isl-hairline-strong)] text-ink-2"
          : "border-brass text-brass-ink"
      }`}
    >
      {isMain ? "MAIN" : "WILD"}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/*  Countdown for next race card                                       */
/* ------------------------------------------------------------------ */

function RaceCountdown({
  targetMs,
  onReachedZero,
}: {
  targetMs: number;
  onReachedZero?: () => void;
}) {
  // Starts null so the server and the first client render match (the countdown
  // is time-dependent — computing it during SSR would mismatch on hydration).
  // The live value fills in immediately after mount.
  const [now, setNow] = useState<number | null>(null);
  const calledRef = useRef(false);

  useEffect(() => {
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 1_000);
    return () => clearInterval(id);
  }, []);

  const total = now === null ? null : Math.max(0, targetMs - now);

  useEffect(() => {
    if (total !== null && total <= 0 && !calledRef.current && onReachedZero) {
      calledRef.current = true;
      onReachedZero();
    }
  }, [total, onReachedZero]);

  if (total !== null && total <= 0) return null;

  const t = total ?? 0;
  const days = Math.floor(t / 86_400_000);
  const hours = Math.floor((t / 3_600_000) % 24);
  const minutes = Math.floor((t / 60_000) % 60);
  const seconds = Math.floor((t / 1_000) % 60);

  const pad = (v: number) => String(v).padStart(2, "0");

  return (
    <div dir="ltr" className="inline-flex h-[34px] items-center gap-1.5 rounded-[2px] border border-[color:var(--isl-hairline)] bg-cream px-3 transition-colors hover:border-[color:var(--isl-hairline-strong)]">
      {[
        { v: days, l: "d" },
        { v: hours, l: "h" },
        { v: minutes, l: "m" },
        { v: seconds, l: "s" },
      ].map((unit, i) => (
        <div key={unit.l} className="flex items-center gap-1">
          {i > 0 && (
            <span className="num text-[11px] font-bold text-faint">:</span>
          )}
          <div className="flex items-baseline gap-px">
            <span className="num text-[13px] font-semibold leading-none text-brass-ink">
              {total === null ? "––" : pad(unit.v)}
            </span>
            <span className="text-[9px] font-medium uppercase text-meta">
              {unit.l}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  LIVE badge with pulsing dot                                        */
/* ------------------------------------------------------------------ */

function LiveBadge() {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-[2px] border border-status-danger px-2.5 py-1 text-sm font-semibold uppercase tracking-[0.2em] text-status-danger">
      <span className="h-2 w-2 rounded-full bg-status-danger animate-[f1-tick_1s_step-end_infinite]" />
      LIVE
    </span>
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
  isLive = false,
  startTimestamp,
  endTimestamp,
}: {
  heading: string;
  group: RaceGroup;
  raceResultsByEvent?: Record<string, RaceResultRow[]>;
  onShowResults?: () => void;
  onWatch?: (label: string, url: string) => void;
  showCountdown?: boolean;
  /** Is this race currently live? */
  isLive?: boolean;
  /** UTC ms when the race starts (for client-side live transition). */
  startTimestamp?: number | null;
  /** UTC ms when the race ends (for auto-reload after live). */
  endTimestamp?: number | null;
}) {
  const t = useTranslations("home");
  const locale = useLocale();
  const isSingle = group.events.length === 1;
  const first = group.events[0];
  const poster = group.events.find((e) => !!e.poster_image) ?? first;
  const hasPoster = !!poster.poster_image;
  const completed = isGroupCompleted(group);
  const youtubeLinks = uniqueYoutubeUrls(group, t("raceCards.watchTheRace"));
  const hasYoutube = youtubeLinks.length > 0;
  const showResults = completed && hasAnyResults(group, raceResultsByEvent) && !!onShowResults;
  const isWild = group.league.toLowerCase() === "wild";

  // Client-side live state (transitions from countdown → live → ended)
  const [clientLive, setClientLive] = useState(isLive);

  // Compute race start timestamp for countdown (use earliest event with a start_time)
  const countdownTargetMs = useMemo(() => {
    if (clientLive || isLive || !showCountdown || completed) return null;
    // Use pre-computed timestamp if available
    if (startTimestamp && startTimestamp > Date.now()) return startTimestamp;
    // Fallback: compute from events
    for (const e of group.events) {
      const ts = toIsraelTimestamp(e.date, e.start_time);
      if (ts !== null && ts > Date.now()) return ts;
    }
    return null;
  }, [showCountdown, completed, group.events, startTimestamp, clientLive, isLive]);

  // When countdown reaches zero, transition to live
  const handleCountdownZero = useCallback(() => {
    setClientLive(true);
  }, []);

  // Auto-reload after race ends
  useEffect(() => {
    if (!clientLive && !isLive) return;
    const end = endTimestamp;
    if (!end) return;

    const check = () => {
      if (Date.now() >= end) {
        window.location.reload();
      }
    };
    check();
    const id = setInterval(check, 10_000); // check every 10s
    return () => clearInterval(id);
  }, [clientLive, isLive, endTimestamp]);

  const liveNow = isLive || clientLive;

  return (
    <div
      className={`relative isl-corner-ticks flex flex-col rounded-[2px] border border-t-2 bg-cream p-5 transition-colors ${
        liveNow
          ? "border-status-danger border-t-status-danger"
          : "border-[color:var(--isl-hairline)] border-t-oxblood"
      }`}
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          {liveNow ? (
            <LiveBadge />
          ) : (
            <h3 className="font-display font-bold tracking-[0.005em] leading-[1.05] text-xl text-oxblood">{heading}</h3>
          )}
          <LeagueBadge league={group.league} />
        </div>
        {liveNow ? (
          <span className="num text-sm font-medium text-status-danger">{group.date}</span>
        ) : (
          <span className="num text-sm text-meta">{group.date}</span>
        )}
      </div>

      {/* Poster */}
      <div className={`mt-4 overflow-hidden rounded-[2px] border bg-paper ${
        liveNow ? "border-oxblood" : "border-[color:var(--isl-hairline)]"
      }`}>
        {hasPoster ? (
          <ZoomableImage
            src={poster.poster_image!}
            alt={`${localizedRaceName(first, locale)} poster`}
            fill
            sizes="(max-width: 768px) 100vw, 50vw"
            triggerClassName="group relative aspect-video cursor-pointer"
            imageClassName="object-cover transition duration-200 group-hover:scale-[1.02]"
          />
        ) : (
          <div className="flex aspect-video items-center justify-center bg-sink">
            <span className="font-isl-body text-[0.75rem] font-semibold uppercase tracking-[0.2em] text-meta">
              {t("raceCards.posterComingSoon")}
            </span>
          </div>
        )}
      </div>

      {/* Description */}
      <div className="mt-4 space-y-1">
        {isSingle ? (
          <p className="text-sm text-ink-2">
            Season {first.season} · Race #{first.race_number}, {localizedRaceName(first, locale)}
            {isWild ? " · Wild Event" : ""} · {group.date}
          </p>
        ) : (
          <>
            <p className="text-sm font-medium text-ink">
              Season {group.season} · {isWild ? "Wild Event Day" : "Race Day"} · {group.date}
            </p>
            {group.events.map((e) => (
              <p key={e.race_number} className="text-sm text-meta">
                Race #{e.race_number}: {localizedRaceName(e, locale)}
              </p>
            ))}
          </>
        )}
      </div>

      {/* Actions — pushed to the bottom of the card */}
      <div className="mt-auto flex flex-wrap items-center gap-3 pt-5">
        {hasYoutube ? (
          youtubeLinks.map((yt) => (
            <Button
              key={yt.url}
              type="button"
              onClick={() => onWatch?.(yt.label, yt.url)}
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                <path d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z" />
              </svg>
              {yt.label}
            </Button>
          ))
        ) : (
          <Button
            type="button"
            disabled
            aria-disabled="true"
            title={t("raceCards.youtubeNotAvailable")}
            variant="secondary"
            className="cursor-not-allowed"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
              <path d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z" />
            </svg>
            {t("raceCards.watchTheRace")}
          </Button>
        )}
        {showResults && (
          <Button type="button" onClick={onShowResults} variant="secondary">
            {t("raceCards.raceResults")}
          </Button>
        )}
        {liveNow && (
          <span className="inline-flex items-center gap-1.5 rounded-[2px] border border-status-danger px-4 py-2 text-sm font-semibold uppercase tracking-[0.08em] text-status-danger">
            <span className="h-1.5 w-1.5 rounded-full bg-status-danger animate-[f1-tick_1s_step-end_infinite]" />
            {t("raceCards.raceInProgress")}
          </span>
        )}
        {!completed && !liveNow && (
          <span className="inline-flex h-[34px] items-center gap-2 rounded-[2px] border border-status-info px-3 text-status-info">
            <span className="h-1.5 w-1.5 rounded-full bg-status-info" />
            <span className="text-[13px] font-medium uppercase tracking-[0.08em]">{t("raceCards.upcoming")}</span>
          </span>
        )}
        {countdownTargetMs && !liveNow && (
          <div className="ms-auto">
            <RaceCountdown targetMs={countdownTargetMs} onReachedZero={handleCountdownZero} />
          </div>
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
  const t = useTranslations("home");
  const locale = useLocale();
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
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
      onClick={onClose}
    >
      <div className="relative w-full max-w-5xl rounded-[2px] border border-[color:var(--isl-hairline)] bg-paper p-4" onClick={(e) => e.stopPropagation()}>
        {/* Top bar */}
        <div className="mb-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <h3 className="font-display font-bold tracking-[0.005em] text-sm text-ink md:text-base">
              {localizedRaceName(current, locale)}
            </h3>
            {hasTable && hasImage && (
              <button
                onClick={() => {
                  setShowImage((v) => !v);
                  setZoom(1);
                }}
                className="inline-flex items-center gap-1.5 rounded-[2px] border border-[color:var(--isl-hairline)] px-3 py-1.5 text-[11px] font-medium uppercase tracking-[0.08em] text-meta transition-colors hover:border-ink hover:text-ink"
              >
                {showImage ? (
                  <>
                    <span>📊</span> {t("raceCards.showTable")}
                  </>
                ) : (
                  <>
                    <span>🖼️</span> {t("raceCards.showImage")}
                  </>
                )}
              </button>
            )}
          </div>
          <button
            onClick={onClose}
            aria-label={t("raceCards.close")}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[2px] border border-[color:var(--isl-hairline)] text-xl text-ink-2 transition-colors hover:border-ink hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--isl-oxblood)]"
          >
            ×
          </button>
        </div>

        {/* Tab selector for multi-race groups */}
        {!isSingle && (
          <div className="mb-3 flex items-center gap-1 rounded-[2px] border border-[color:var(--isl-hairline)] bg-sink p-1">
            {withResults.map((e, idx) => (
              <button
                key={e.race_number}
                onClick={() => setActiveIdx(idx)}
                className={`rounded-[2px] px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.08em] transition-colors ${
                  idx === activeIdx
                    ? "bg-ink text-bone"
                    : "text-meta hover:text-ink"
                }`}
              >
                {raceLabel(e, locale)}
              </button>
            ))}
          </div>
        )}

        {/* Zoom controls (image mode only) */}
        {showImage && hasImage && (
          <div className="mb-3 flex items-center gap-2">
            <button
              onClick={() => setZoom((z) => clamp(z - 0.25))}
              aria-label={t("raceCards.zoomOut")}
              className="flex h-8 w-8 items-center justify-center rounded-[2px] border border-[color:var(--isl-hairline)] text-ink-2 transition-colors hover:border-ink hover:text-ink"
            >
              −
            </button>
            <span className="num text-xs text-meta">{Math.round(zoom * 100)}%</span>
            <button
              onClick={() => setZoom((z) => clamp(z + 0.25))}
              aria-label={t("raceCards.zoomIn")}
              className="flex h-8 w-8 items-center justify-center rounded-[2px] border border-[color:var(--isl-hairline)] text-ink-2 transition-colors hover:border-ink hover:text-ink"
            >
              +
            </button>
            <button
              onClick={() => setZoom(1)}
              className="flex h-8 items-center justify-center rounded-[2px] border border-[color:var(--isl-hairline)] px-3 text-xs uppercase tracking-[0.08em] text-ink-2 transition-colors hover:border-ink hover:text-ink"
            >
              {t("raceCards.reset")}
            </button>
          </div>
        )}

        {/* Content: table or image */}
        {showImage && hasImage ? (
          <div
            ref={scrollRef}
            className={`max-h-[85vh] overflow-auto rounded-[2px] border border-[color:var(--isl-hairline)] bg-paper p-3 ${
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
              alt={`${localizedRaceName(current, locale)} results`}
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
          <div className="max-h-[85vh] overflow-auto rounded-[2px] border border-[color:var(--isl-hairline)] bg-paper p-3">
            <RaceResultsTable
              results={tableData}
              caption={`${localizedRaceName(current, locale)} — Race Results`}
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
  liveGroup,
  nextGroupTimestamps,
  raceResultsByEvent = {},
  allDrivers = [],
  allTeams = [],
}: HomeRaceCardsProps) {
  const t = useTranslations("home");
  const [showResultsGroup, setShowResultsGroup] = useState<RaceGroup | null>(null);
  const [watchTarget, setWatchTarget] = useState<{ label: string; url: string } | null>(null);

  /** Check if a group has any results (image or CSV table data). */
  const groupHasResults = (group: RaceGroup) =>
    group.events.some(
      (e) => !!e.results_image || (raceResultsByEvent[e.event_id]?.length ?? 0) > 0,
    );

  const handleWatch = (label: string, url: string) => {
    gaClickWatchYouTube(label);
    setWatchTarget({ label, url });
  };

  // Nothing to show at all
  if (!lastGroup && !nextGroup && !liveGroup) {
    return (
      <div className="isl-speed-lines flex items-center justify-center rounded-[2px] border border-dashed border-[color:var(--isl-hairline-strong)] bg-cream py-16">
        <p className="font-isl-body text-xs font-semibold uppercase tracking-[0.2em] text-meta">{t("raceCards.scheduleNotAvailable")}</p>
      </div>
    );
  }

  // The right card shows either a LIVE race (server-detected) or the next race
  // (which can transition to live client-side when countdown hits zero)
  const rightCardGroup = liveGroup ?? nextGroup;
  const rightCardIsLive = !!liveGroup;

  return (
    <>
      <div className="grid gap-6 lg:grid-cols-2">
        {lastGroup ? (
          <RaceGroupCard
            heading={t("raceCards.lastRace")}
            group={lastGroup}
            raceResultsByEvent={raceResultsByEvent}
            onShowResults={
              groupHasResults(lastGroup)
                ? () => {
                    gaClickRaceResults(lastGroup.events[0]?.race_name);
                    setShowResultsGroup(lastGroup);
                  }
                : undefined
            }
            onWatch={handleWatch}
          />
        ) : (
          <div className="isl-speed-lines flex items-center justify-center rounded-[2px] border border-dashed border-[color:var(--isl-hairline-strong)] bg-cream py-16">
            <p className="font-isl-body text-xs font-semibold uppercase tracking-[0.2em] text-meta">{t("raceCards.noPastRaces")}</p>
          </div>
        )}
        {rightCardGroup ? (
          <RaceGroupCard
            heading={t("raceCards.nextRace")}
            group={rightCardGroup}
            onWatch={handleWatch}
            showCountdown={!rightCardIsLive}
            isLive={rightCardIsLive}
            startTimestamp={
              rightCardIsLive
                ? liveGroup?.startTimestamp
                : nextGroupTimestamps?.startTimestamp
            }
            endTimestamp={
              rightCardIsLive
                ? liveGroup?.endTimestamp
                : nextGroupTimestamps?.endTimestamp
            }
          />
        ) : (
          <div className="isl-speed-lines flex items-center justify-center rounded-[2px] border border-dashed border-[color:var(--isl-hairline-strong)] bg-cream py-16">
            <p className="font-isl-body text-xs font-semibold uppercase tracking-[0.2em] text-meta">{t("raceCards.seasonComplete")}</p>
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
