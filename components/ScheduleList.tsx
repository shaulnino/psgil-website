"use client";

import { Suspense, useState, useEffect, useRef, useMemo } from "react";
import { useTranslations, useLocale } from "next-intl";
import { useSearchParams } from "next/navigation";
import Image from "next/image";
import type { RaceEvent } from "@/lib/scheduleData";
import { toIsraelTimestamp, localizedRaceName } from "@/lib/scheduleData";
import type { RaceResultRow } from "@/lib/resultsData";
import type { Driver, Team } from "@/lib/driversData";
import type { SeasonConfig } from "@/lib/seasonConfig";
import { getSeasonsForDropdown, matchesSeason } from "@/lib/seasonConfig";
import SeasonSelector from "@/components/SeasonSelector";
import RaceResultsTable from "@/components/RaceResultsTable";
import DriverLookupProvider from "@/components/DriverLookupProvider";
import YouTubeEmbed from "@/components/YouTubeEmbed";
import { gaClickWatchYouTube, gaClickRaceResults } from "@/lib/ga";
import { getYouTubeVideoId } from "@/lib/youtube";
import { Button } from "@/components/ui/button";

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
      className={`inline-flex shrink-0 items-center justify-center overflow-hidden rounded-[2px] border border-[color:var(--isl-hairline)] ${className}`}
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
  const t = useTranslations("schedule");
  const locale = useLocale();
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
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80"
      onClick={onClose}
    >
      <div
        className="relative mx-4 w-full max-w-4xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="mb-3 flex items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <span className="font-isl-body inline-flex items-center gap-1.5 text-[0.75rem] font-semibold uppercase tracking-[0.2em] text-oxblood">
              <span className="h-1.5 w-1.5 rounded-full bg-oxblood" />
              {t("watchModal.eyebrow")}
            </span>
            <h3 className="font-display font-bold tracking-[0.005em] leading-[1.05] text-base text-ink md:text-lg">
              {localizedRaceName(event, locale)}
            </h3>
            {timeState === "upcoming" && event.start_time && (
              <span className="inline-flex items-center gap-1 rounded-[2px] border border-status-info px-2.5 py-1 text-[11px] font-medium text-status-info">
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
                {t("watchModal.streamStartsAt")} <span className="num">{event.start_time}</span>
              </span>
            )}
            {timeState === "started" && (
              <span className="inline-flex items-center gap-1.5 rounded-[2px] border border-oxblood px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-oxblood">
                <span className="h-1.5 w-1.5 rounded-full bg-oxblood animate-[f1-tick_1s_step-end_infinite]" />
                {event.status.toLowerCase() === "completed"
                  ? t("watchModal.replayAvailable")
                  : t("watchModal.liveOrReplay")}
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            aria-label={t("watchModal.closeBroadcast")}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[2px] border border-[color:var(--isl-hairline)] bg-paper text-xl text-ink-2 transition-colors hover:border-ink hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--isl-oxblood)]"
          >
            ×
          </button>
        </div>

        {/* Embed or placeholder */}
        <YouTubeEmbed
          youtubeUrl={event.youtube_url}
          title={`${event.race_name} ${t("watchModal.broadcastTitleSuffix")}`}
        />

        {/* External link fallback */}
        {hasEmbed && (
          <div className="mt-3 flex justify-end">
            <a
              href={event.youtube_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-[2px] border border-[color:var(--isl-hairline)] bg-paper px-3 py-1.5 text-[11px] font-medium text-ink-2 transition-colors hover:border-ink hover:text-ink"
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
              {t("watchModal.openOnYouTube")}
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
  const t = useTranslations("schedule");
  const locale = useLocale();
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
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80"
      onClick={onClose}
    >
      <div
        className="relative mx-4 w-full max-w-5xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top bar: close + toggle */}
        <div className="mb-3 flex items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <h3 className="font-display font-bold tracking-[0.005em] leading-[1.05] text-sm text-ink md:text-base">
              {localizedRaceName(event, locale)}
            </h3>
            {/* Race format + playoff badges */}
            {event.race_format === "sprint" && (
              <span className="inline-flex items-center rounded-[2px] border border-[color:var(--isl-hairline-strong)] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-ink-2">
                {t("resultsModal.sprint")}
              </span>
            )}
            {event.race_format === "25%" && (
              <span className="num inline-flex items-center rounded-[2px] border border-[color:var(--isl-hairline-strong)] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-ink-2">
                {t("resultsModal.quarterDistance")}
              </span>
            )}
            {event.is_playoff && (
              <span className="inline-flex items-center rounded-[2px] border border-brass px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-brass-ink">
                {t("resultsModal.playoff")}
              </span>
            )}
            {/* Toggle between table and image when both exist */}
            {hasTable && hasImage && (
              <span className="inline-flex rounded-[2px] border border-[color:var(--isl-hairline)] bg-sink p-1">
                <button
                  onClick={() => {
                    setShowImage(false);
                    setZoom(1);
                  }}
                  className={`rounded-[2px] px-3 py-1 text-[11px] font-medium uppercase tracking-wider transition-colors ${
                    showImage ? "text-ink-2 hover:text-ink" : "bg-ink text-bone"
                  }`}
                >
                  {t("resultsModal.table")}
                </button>
                <button
                  onClick={() => {
                    setShowImage(true);
                    setZoom(1);
                  }}
                  className={`rounded-[2px] px-3 py-1 text-[11px] font-medium uppercase tracking-wider transition-colors ${
                    showImage ? "bg-ink text-bone" : "text-ink-2 hover:text-ink"
                  }`}
                >
                  {t("resultsModal.image")}
                </button>
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            aria-label={t("resultsModal.closeResults")}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[2px] border border-[color:var(--isl-hairline)] bg-paper text-xl text-ink-2 transition-colors hover:border-ink hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--isl-oxblood)]"
          >
            ×
          </button>
        </div>

        {/* Image zoom controls (only when showing image) */}
        {showImage && hasImage && (
          <div className="mb-3 flex items-center gap-2">
            <button
              onClick={() => setZoom((z) => clamp(z - 0.25))}
              aria-label={t("resultsModal.zoomOut")}
              className="flex h-11 w-11 items-center justify-center rounded-[2px] border border-[color:var(--isl-hairline)] bg-paper text-ink-2 transition-colors hover:border-ink hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--isl-oxblood)]"
            >
              −
            </button>
            <span className="num text-xs text-meta">
              {Math.round(zoom * 100)}%
            </span>
            <button
              onClick={() => setZoom((z) => clamp(z + 0.25))}
              aria-label={t("resultsModal.zoomIn")}
              className="flex h-11 w-11 items-center justify-center rounded-[2px] border border-[color:var(--isl-hairline)] bg-paper text-ink-2 transition-colors hover:border-ink hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--isl-oxblood)]"
            >
              +
            </button>
            <button
              onClick={() => setZoom(1)}
              className="flex h-11 items-center justify-center rounded-[2px] border border-[color:var(--isl-hairline)] bg-paper px-3 text-xs text-ink-2 transition-colors hover:border-ink hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--isl-oxblood)]"
            >
              {t("resultsModal.reset")}
            </button>
          </div>
        )}

        {/* Content */}
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
          <div className="max-h-[85vh] overflow-auto rounded-[2px] border border-[color:var(--isl-hairline)] bg-paper p-3">
            <RaceResultsTable
              results={tableData}
              caption={`${event.race_name} ${t("resultsModal.resultsCaptionSuffix")}`}
            />
          </div>
        ) : (
          <div className="isl-speed-lines flex items-center justify-center rounded-[2px] border border-dashed border-[color:var(--isl-hairline-strong)] bg-paper py-16">
            <p className="font-isl-body text-xs font-semibold uppercase tracking-[0.2em] text-meta">
              {t("resultsModal.resultsNotAvailable")}
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
  const t = useTranslations("schedule");
  const locale = useLocale();
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
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80"
      onClick={onClose}
    >
      <div
        className="relative mx-4 flex w-full max-w-2xl flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          aria-label={t("posterModal.closePoster")}
          className="absolute end-3 top-3 z-10 flex h-11 w-11 items-center justify-center rounded-[2px] border border-[color:var(--isl-hairline)] bg-paper text-xl text-ink-2 transition-colors hover:border-ink hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--isl-oxblood)]"
        >
          ×
        </button>

        <div className="max-h-[90vh] overflow-hidden overflow-y-auto rounded-[2px] border border-[color:var(--isl-hairline)] bg-paper">
          {/* Poster image */}
          <div className="w-full overflow-hidden border-b border-[color:var(--isl-hairline)] bg-cream">
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
                <span className="text-xs uppercase tracking-[0.2em] text-meta">
                  {t("posterModal.posterNotAvailable")}
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
              <h3 className="font-display font-bold tracking-[0.005em] leading-[1.05] text-lg text-ink">
                {localizedRaceName(event, locale)}
              </h3>
              <span
                className={`inline-flex items-center justify-center rounded-[2px] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${
                  event.league.toLowerCase() === "main"
                    ? "border border-[color:var(--isl-hairline-strong)] text-ink-2"
                    : "border border-brass text-brass-ink"
                }`}
              >
                {event.league}
              </span>
              {/* Race format badge */}
              {event.race_format === "sprint" && (
                <span className="inline-flex items-center rounded-[2px] border border-[color:var(--isl-hairline-strong)] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-ink-2">
                  {t("posterModal.sprint")}
                </span>
              )}
              {event.race_format === "25%" && (
                <span className="num inline-flex items-center rounded-[2px] border border-[color:var(--isl-hairline-strong)] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-ink-2">
                  {t("posterModal.quarterDistance")}
                </span>
              )}
              {/* Playoff badge */}
              {event.is_playoff && (
                <span className="inline-flex items-center rounded-[2px] border border-brass px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-brass-ink">
                  {t("posterModal.playoff")}
                </span>
              )}
              {event.results_status === "provisional" && (
                <Tooltip text={t("posterModal.provisionalTooltip")}>
                  <span className="inline-flex items-center rounded-[2px] border border-status-warning px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-status-warning">
                    {t("posterModal.provisional")}
                  </span>
                </Tooltip>
              )}
            </div>
            <p className="mt-1 text-sm text-meta">
              {t("posterModal.season")} <span className="num">{event.season}</span> · {t("posterModal.race")}<span className="num">{event.race_number}</span> ·{" "}
              <span className="num">{event.date}</span>
              {event.start_time && <> · <span className="num">{event.start_time}</span></>}
            </p>

            {/* Action buttons */}
            {(hasResults || hasYoutube) && (
              <div className="mt-4 flex flex-wrap items-center gap-3">
                {/* See result — only for completed races */}
                {isCompleted && hasResults && (
                  <Button variant="secondary" size="md" onClick={onShowResults}>
                    {t("posterModal.seeResult")}
                  </Button>
                )}

                {/* Watch the race — for any race with youtube_url */}
                {hasYoutube && (
                  <Button variant="primary" size="md" onClick={onWatch}>
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                      className="h-4 w-4"
                    >
                      <path d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z" />
                    </svg>
                    {timeState === "upcoming"
                      ? t("posterModal.watchLive")
                      : t("posterModal.watchTheRace")}
                  </Button>
                )}

                {/* Upcoming race: show start time hint */}
                {timeState === "upcoming" && event.start_time && (
                  <span className="inline-flex items-center gap-1.5 text-xs text-meta">
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
                    {t("posterModal.streamStartsAt")} <span className="num">{event.start_time}</span>
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
  const t = useTranslations("schedule");
  const s = status.toLowerCase();
  const isLive = s === "live";
  const isCompleted = s === "completed";
  const isCancelled = s === "cancelled";
  const isPostponed = s === "postponed";

  const STATUS_LABEL_KEYS: Record<string, string> = {
    live: "status.live",
    upcoming: "status.upcoming",
    completed: "status.completed",
    postponed: "status.postponed",
    cancelled: "status.cancelled",
    scheduled: "status.scheduled",
  };
  const statusLabel = STATUS_LABEL_KEYS[s] ? t(STATUS_LABEL_KEYS[s]) : status;

  // Live → status-red accent + ticking dot; others → status hue + shape/label.
  const toneClass = isLive
    ? "border-status-danger text-status-danger"
    : isCompleted
    ? "border-status-success text-status-success"
    : isPostponed
    ? "border-status-warning text-status-warning"
    : isCancelled
    ? "border-status-danger text-status-danger"
    : "border-status-info text-status-info";

  return (
    <span
      className={`inline-flex items-center justify-center gap-1 rounded-[2px] border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider md:justify-self-center ${toneClass}`}
    >
      {/* Distinct glyph per state (shape, not hue alone) */}
      {isCancelled ? (
        <span aria-hidden className="shrink-0 leading-none">✕</span>
      ) : isPostponed ? (
        <span aria-hidden className="shrink-0 leading-none">‖</span>
      ) : (
        <span
          aria-hidden
          className={`h-1.5 w-1.5 shrink-0 rounded-full bg-current ${
            isLive ? "animate-[f1-tick_1s_step-end_infinite]" : ""
          }`}
        />
      )}
      {statusLabel}
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
      <span className="pointer-events-none absolute bottom-full left-1/2 z-50 mb-2 -translate-x-1/2 whitespace-nowrap rounded-[2px] border border-[color:var(--isl-hairline)] bg-paper px-2.5 py-1 text-[11px] font-medium text-ink opacity-0 transition-opacity group-hover/tip:opacity-100">
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
  const t = useTranslations("schedule");
  const weather = event.weather;
  const safetyCars = event.safety_cars ?? 0;
  const reverseGrid = event.reverse_grid === "yes";
  const isProvisional = event.results_status === "provisional";
  const raceFormat = event.race_format;
  const isPlayoff = event.is_playoff;

  const hasBadges = !!weather || safetyCars > 0 || reverseGrid || isProvisional || !!raceFormat || isPlayoff;
  if (!hasBadges) return null;

  return (
    <span className="inline-flex flex-wrap items-center gap-1.5">
      {/* Race format */}
      {raceFormat === "sprint" && (
        <Tooltip text={t("badges.sprintTooltip")}>
          <span className="inline-flex items-center gap-1 rounded-[2px] border border-[color:var(--isl-hairline-strong)] px-1.5 py-0.5 text-xs font-bold leading-none text-ink-2">
            {t("resultsModal.sprint")}
          </span>
        </Tooltip>
      )}
      {raceFormat === "25%" && (
        <Tooltip text={t("badges.quarterDistanceTooltip")}>
          <span className="num inline-flex items-center gap-1 rounded-[2px] border border-[color:var(--isl-hairline-strong)] px-1.5 py-0.5 text-xs font-bold leading-none text-ink-2">
            {t("resultsModal.quarterDistance")}
          </span>
        </Tooltip>
      )}

      {/* Playoff round */}
      {isPlayoff && (
        <Tooltip text={t("badges.playoffTooltip")}>
          <span className="inline-flex items-center gap-1 rounded-[2px] border border-brass px-1.5 py-0.5 text-xs font-bold leading-none text-brass-ink">
            {t("resultsModal.playoff")}
          </span>
        </Tooltip>
      )}

      {/* Provisional results */}
      {isProvisional && (
        <Tooltip text={t("badges.provisionalTooltip")}>
          <span className="inline-flex items-center gap-1 rounded-[2px] border border-status-warning px-1.5 py-0.5 text-xs font-bold leading-none text-status-warning">
            {t("posterModal.provisional")}
          </span>
        </Tooltip>
      )}

      {/* Weather */}
      {weather === "dry" && (
        <Tooltip text={t("badges.dryTooltip")}>
          <span className="inline-flex items-center gap-1 rounded-[2px] border border-status-warning px-1.5 py-0.5 text-xs font-medium leading-none text-status-warning">
            <SunIcon className="shrink-0" />
            {t("badges.dry")}
          </span>
        </Tooltip>
      )}
      {weather === "wet" && (
        <Tooltip text={t("badges.wetTooltip")}>
          <span className="inline-flex items-center gap-1 rounded-[2px] border border-status-info px-1.5 py-0.5 text-xs font-medium leading-none text-status-info">
            <CloudRainIcon className="shrink-0" />
            {t("badges.wet")}
          </span>
        </Tooltip>
      )}
      {weather === "mixed" && (
        <Tooltip text={t("badges.mixedTooltip")}>
          <span className="inline-flex items-center gap-1 rounded-[2px] border border-[color:var(--isl-hairline-strong)] px-1.5 py-0.5 text-xs font-medium leading-none text-ink-2">
            <CloudSunRainIcon className="shrink-0" />
            {t("badges.mixed")}
          </span>
        </Tooltip>
      )}

      {/* Safety cars */}
      {safetyCars > 0 && (
        <Tooltip text={t("badges.safetyCarsTooltip", { count: safetyCars })}>
          <span className="inline-flex items-center gap-1 rounded-[2px] border border-status-warning px-1.5 py-0.5 text-xs font-bold leading-none text-status-warning">
            SC
            <span className="num font-semibold">{safetyCars}</span>
          </span>
        </Tooltip>
      )}

      {/* Reverse grid */}
      {reverseGrid && (
        <Tooltip text={t("badges.reverseGridTooltip")}>
          <span className="inline-flex items-center gap-1 rounded-[2px] border border-[color:var(--isl-hairline-strong)] px-1.5 py-0.5 text-xs font-medium leading-none text-ink-2">
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
      className={`inline-flex items-center justify-center rounded-[2px] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider md:justify-self-center ${
        isMain
          ? "border border-[color:var(--isl-hairline-strong)] text-ink-2"
          : "border border-brass text-brass-ink"
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
  const t = useTranslations("schedule");
  const locale = useLocale();
  const searchParams = useSearchParams();
  const selectedSeasonKey =
    searchParams.get("season") || defaultSeasonKey;
  const queryEventId = (searchParams.get("event") || searchParams.get("race_id") || "")
    .trim()
    .toLowerCase();
  const queryWatch = ["1", "true", "yes"].includes(
    (searchParams.get("watch") || "").trim().toLowerCase(),
  );

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
  const queryHandledRef = useRef(false);

  useEffect(() => {
    if (!queryEventId || queryHandledRef.current) return;
    const matched = events.find(
      (event) => event.event_id.trim().toLowerCase() === queryEventId,
    );
    if (!matched) return;

    const target = document.getElementById(matched.event_id);
    if (target) target.scrollIntoView({ behavior: "smooth", block: "center" });

    if (queryWatch && matched.youtube_url) {
      setWatchEvent(matched);
    } else {
      setPosterEvent(matched);
    }
    queryHandledRef.current = true;
  }, [events, queryEventId, queryWatch]);

  if (seasonsConfig.length === 0) {
    return (
      <div className="isl-speed-lines flex items-center justify-center rounded-[2px] border border-dashed border-[color:var(--isl-hairline-strong)] bg-cream py-16">
        <p className="font-isl-body text-xs font-semibold uppercase tracking-[0.2em] text-meta">
          {t("list.noEventsAvailable")}
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
        <div className="isl-speed-lines flex items-center justify-center rounded-[2px] border border-dashed border-[color:var(--isl-hairline-strong)] bg-cream py-16">
          <p className="font-isl-body text-xs font-semibold uppercase tracking-[0.2em] text-meta">
            {t("list.noEventsForSeason")}
          </p>
        </div>
      )}

      {events.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {events.map((event, idx) => {
            const s = event.status.toLowerCase();
            const isLive = s === "live";
            const isCancelled = s === "cancelled";
            const roundNum = String(event.race_number).padStart(2, "0");
            return (
              <button
                key={`${event.season}-${event.race_number}-${event.league}-${idx}`}
                id={event.event_id}
                type="button"
                onClick={() => setPosterEvent(event)}
                className={`group relative flex cursor-pointer flex-col rounded-[2px] border border-t-2 bg-cream p-5 text-start transition-colors hover:bg-paper focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-[color:var(--isl-oxblood)] ${
                  isLive
                    ? "isl-corner-ticks border-status-danger border-t-status-danger"
                    : isCancelled
                    ? "border-[color:var(--isl-hairline)] border-t-[color:var(--isl-hairline-strong)] opacity-70"
                    : "border-[color:var(--isl-hairline)] border-t-oxblood hover:border-[color:var(--isl-oxblood)]/40"
                }`}
              >
                {/* Top: round index + status */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex flex-col">
                    <span className="font-isl-body text-[0.6rem] font-semibold uppercase tracking-[0.24em] text-brass-ink">
                      {t("list.round")}
                    </span>
                    <span className="num font-display text-[2rem] font-bold leading-none text-oxblood">
                      {roundNum}
                    </span>
                  </div>
                  <StatusBadge status={event.status} />
                </div>

                {/* Race name + flag */}
                <div className="mt-5 flex items-start gap-3">
                  <CountryFlag code={event.country_code} width={34} height={22} className="mt-0.5" />
                  <h3 className="font-display text-lg font-bold leading-[1.08] tracking-[0.005em] text-ink">
                    {localizedRaceName(event, locale)}
                  </h3>
                </div>

                {/* Date / time */}
                <div className="mt-3 flex items-center gap-2 text-sm text-meta">
                  <span className="num-date">{event.date}</span>
                  {event.start_time && (
                    <>
                      <span className="text-faint">·</span>
                      <span className="num">{event.start_time}</span>
                    </>
                  )}
                </div>

                {/* Divider */}
                <div className="isl-gold-rule my-4" />

                {/* Footer: league + badges + open */}
                <div className="mt-auto flex items-center justify-between gap-2">
                  <span className="inline-flex flex-wrap items-center gap-1.5">
                    <LeagueBadge league={event.league} />
                    <RaceBadges event={event} />
                  </span>
                  <span className="inline-flex shrink-0 items-center gap-1 text-[10px] font-medium uppercase tracking-wider text-transparent transition-colors group-hover:text-meta group-focus-visible:text-meta">
                    {t("list.open")}
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                      className="h-4 w-4 text-faint transition-all group-hover:translate-x-0.5 group-hover:text-ink group-focus-visible:translate-x-0.5 group-focus-visible:text-ink rtl:scale-x-[-1]"
                    >
                      <path fillRule="evenodd" d="M8.22 5.22a.75.75 0 011.06 0l4.25 4.25a.75.75 0 010 1.06l-4.25 4.25a.75.75 0 01-1.06-1.06L11.94 10 8.22 6.28a.75.75 0 010-1.06z" clipRule="evenodd" />
                    </svg>
                  </span>
                </div>
              </button>
            );
          })}
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
            gaClickRaceResults(ev.race_name);
            setPosterEvent(null);
            setResultsEvent(ev);
          }}
          onWatch={() => {
            const ev = posterEvent;
            gaClickWatchYouTube(ev.race_name);
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

function ScheduleListFallback() {
  const t = useTranslations("schedule");
  return (
    <div className="flex items-center justify-center py-16">
      <p className="text-sm text-meta">{t("list.loading")}</p>
    </div>
  );
}

export default function ScheduleList(props: ScheduleListProps) {
  return (
    <Suspense fallback={<ScheduleListFallback />}>
      <ScheduleListInner {...props} />
    </Suspense>
  );
}
