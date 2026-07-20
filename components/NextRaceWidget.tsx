"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Image from "next/image";
import LoadingLink from "@/components/LoadingLink";
import YouTubeEmbed from "@/components/YouTubeEmbed";

/* ------------------------------------------------------------------ */
/*  Types                                                               */
/* ------------------------------------------------------------------ */

export type NextRaceData = {
  eventId: string;
  raceName: string;
  raceNumber: string;
  season: string;
  league: string;
  track?: string;
  countryCode: string;
  posterImage?: string;
  date: string; // DD.MM.YYYY
  startTime?: string; // HH:MM
  /** UTC timestamp (ms) of race start */
  startTimestamp: number;
  /** UTC timestamp (ms) of race end (start + duration, or explicit end_time) */
  endTimestamp: number;
  youtubeUrl?: string;
  /** Whether the race was already live when the server rendered */
  isLive?: boolean;
  /** Whether this is the last remaining race of the season (championship finale) */
  isChampionshipFinale?: boolean;
};

type Countdown = {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  total: number;
};

/* ------------------------------------------------------------------ */
/*  Constants                                                           */
/* ------------------------------------------------------------------ */

const STORAGE_KEY = "psgil-next-race-hidden";

/* ------------------------------------------------------------------ */
/*  Countdown helper                                                    */
/* ------------------------------------------------------------------ */

function computeCountdown(targetMs: number): Countdown {
  const total = Math.max(0, targetMs - Date.now());
  const seconds = Math.floor((total / 1000) % 60);
  const minutes = Math.floor((total / 60_000) % 60);
  const hours = Math.floor((total / 3_600_000) % 24);
  const days = Math.floor(total / 86_400_000);
  return { days, hours, minutes, seconds, total };
}

/* ------------------------------------------------------------------ */
/*  Country flag (same approach used in ScheduleList)                   */
/* ------------------------------------------------------------------ */

function MiniFlag({ code }: { code: string }) {
  const trimmed = (code ?? "").trim().toLowerCase();
  if (!trimmed || trimmed.length !== 2) {
    return <span className="text-xs">🏁</span>;
  }
  return (
    <span className="inline-flex shrink-0 items-center justify-center overflow-hidden rounded-[2px]" style={{ width: 20, height: 14 }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={`https://flagcdn.com/w40/${trimmed}.png`}
        alt={trimmed.toUpperCase()}
        className="h-full w-full object-cover"
        loading="lazy"
      />
    </span>
  );
}

/* ------------------------------------------------------------------ */
/*  Countdown digit block                                               */
/* ------------------------------------------------------------------ */

function CountdownUnit({ value, label }: { value: number; label: string }) {
  return (
    <div className="flex flex-col items-center">
      <span className="num font-display text-lg font-bold leading-none text-ink tabular-nums md:text-xl">
        {String(value).padStart(2, "0")}
      </span>
      <span className="mt-0.5 text-[10px] uppercase tracking-wider text-meta">
        {label}
      </span>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Inline watch modal                                                  */
/* ------------------------------------------------------------------ */

function WidgetWatchModal({
  raceName,
  youtubeUrl,
  onClose,
}: {
  raceName: string;
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
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80"
      onClick={onClose}
    >
      <div
        className="relative mx-4 w-full max-w-4xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center gap-1.5 rounded-[2px] border border-oxblood px-2.5 py-1 text-xs font-bold uppercase tracking-[0.15em] text-oxblood">
              <span className="h-1.5 w-1.5 rounded-full bg-oxblood" />
              Race Broadcast
            </span>
            <h3 className="font-display text-sm font-semibold text-ink-2 md:text-base">
              {raceName}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-[2px] border border-[color:var(--isl-hairline)] bg-paper text-ink-2 transition-colors hover:border-ink hover:text-ink"
          >
            ×
          </button>
        </div>
        <YouTubeEmbed youtubeUrl={youtubeUrl} title={`${raceName} – Race Broadcast`} />
        <div className="mt-3 flex justify-end">
          <a
            href={youtubeUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-[2px] border border-[color:var(--isl-hairline)] bg-paper px-3 py-1.5 text-[11px] font-medium text-meta transition-colors hover:border-ink hover:text-ink"
          >
            Open on YouTube
          </a>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Widget component                                                    */
/* ------------------------------------------------------------------ */

export default function NextRaceWidget({ race }: { race: NextRaceData | null }) {
  const [hidden, setHidden] = useState(true); // Start hidden, reveal after hydration
  const [minimised, setMinimised] = useState(false);
  const [countdown, setCountdown] = useState<Countdown | null>(null);
  const [showWatch, setShowWatch] = useState(false);

  // Client-side live state: starts with server's determination, then transitions
  const [clientLive, setClientLive] = useState(race?.isLive ?? false);
  const reloadScheduledRef = useRef(false);

  // Hydrate visibility from localStorage
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === race?.eventId) {
      setHidden(true);
    } else {
      setHidden(false);
    }
  }, [race?.eventId]);

  // Live countdown ticker
  useEffect(() => {
    if (!race) return;
    const tick = () => {
      const now = Date.now();
      setCountdown(computeCountdown(race.startTimestamp));

      // Transition to live when countdown expires
      if (now >= race.startTimestamp && now < race.endTimestamp) {
        setClientLive(true);
      }

      // Auto-reload when race ends (so the widget re-fetches and shows next race)
      if (now >= race.endTimestamp && !reloadScheduledRef.current) {
        reloadScheduledRef.current = true;
        window.location.reload();
      }
    };
    tick();
    const id = setInterval(tick, 1_000);
    return () => clearInterval(id);
  }, [race]);

  const handleDismiss = useCallback(() => {
    if (race) {
      localStorage.setItem(STORAGE_KEY, race.eventId);
    }
    setHidden(true);
  }, [race]);

  const isLiveNow = clientLive || (race?.isLive ?? false);

  // Don't render anything if no race or hidden
  // Note: we DO render during live state (no hiding when countdown expires)
  if (!race || hidden) return null;

  // If not live and countdown expired, don't render (race ended but page hasn't reloaded yet)
  if (!isLiveNow && countdown && countdown.total <= 0) return null;

  // race.season may be "S6" or "6"; normalize to "S6" format for the URL param.
  // Use the `event` query param (not a hash): ScheduleList reads it to scroll to
  // the round card AND open its details modal. A raw hash lands at the top of the
  // page because the list renders client-side after the hash scroll has fired.
  const seasonParam = race.season.startsWith("S") ? race.season : `S${race.season}`;
  const scheduleUrl = `/schedule?season=${seasonParam}&event=${race.eventId}`;

  /* ---------- Minimised pill ---------- */
  if (minimised) {
    return (
      <div className="fixed bottom-4 right-4 z-40 animate-in fade-in pb-[env(safe-area-inset-bottom)] md:bottom-6 md:right-6">
        <button
          type="button"
          onClick={() => setMinimised(false)}
          className={`flex items-center gap-2 rounded-[2px] bg-paper px-3 py-2 transition-colors ${
            isLiveNow
              ? "border border-oxblood"
              : "border border-[color:var(--isl-hairline-strong)] hover:border-ink"
          }`}
        >
          {isLiveNow ? (
            <>
              <span className="h-2 w-2 rounded-full bg-oxblood animate-[f1-tick_1s_step-end_infinite]" />
              <span className="text-sm font-bold uppercase tracking-wider text-oxblood">LIVE</span>
            </>
          ) : (
            <>
              <span className="h-2 w-2 rounded-full bg-status-success" />
              {race.isChampionshipFinale ? (
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5 shrink-0 text-brass-ink">
                  <path fillRule="evenodd" d="M10 1a.75.75 0 0 1 .692.462l1.7 3.644 3.945.576a.75.75 0 0 1 .416 1.279l-2.855 2.783.674 3.93a.75.75 0 0 1-1.088.791L10 12.347l-3.484 1.818a.75.75 0 0 1-1.088-.79l.674-3.931L3.247 6.96a.75.75 0 0 1 .416-1.28l3.945-.575L9.308 1.46A.75.75 0 0 1 10 1Z" clipRule="evenodd" />
                </svg>
              ) : null}
              <span className="text-sm font-semibold text-ink-2">
                {race.isChampionshipFinale ? "Season Finale" : "Next Race"}
              </span>
              {countdown && (
                <span dir="ltr" className="num font-display text-sm font-bold tabular-nums text-ink">
                  {countdown.days > 0 && `${countdown.days}d `}
                  {String(countdown.hours).padStart(2, "0")}:
                  {String(countdown.minutes).padStart(2, "0")}:
                  {String(countdown.seconds).padStart(2, "0")}
                </span>
              )}
            </>
          )}
        </button>
      </div>
    );
  }

  /* ---------- Full widget ---------- */
  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 pb-[env(safe-area-inset-bottom)] md:bottom-6 md:left-auto md:right-6 md:w-[340px]">
      <div
        className={`border-t bg-paper md:rounded-[2px] md:border ${
          isLiveNow
            ? "border-oxblood"
            : race.isChampionshipFinale
              ? "border-brass"
              : "border-[color:var(--isl-hairline)]"
        }`}
      >
        {/* Header bar */}
        <div className="flex items-center justify-between px-4 pt-3 pb-1">
          <div className="flex items-center gap-2">
            {isLiveNow ? (
              <>
                <span className="h-2 w-2 rounded-full bg-oxblood animate-[f1-tick_1s_step-end_infinite]" />
                <span className="text-xs font-bold uppercase tracking-[0.2em] text-oxblood">
                  LIVE
                </span>
              </>
            ) : (
              <>
                <span className="h-2 w-2 rounded-full bg-status-success" />
                <span className="font-isl-body text-[0.75rem] font-semibold uppercase tracking-[0.2em] text-oxblood">
                  Next Race
                </span>
              </>
            )}
            {race.isChampionshipFinale && !isLiveNow && (
              <span className="inline-flex items-center gap-1 rounded-[2px] border border-brass px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.15em] text-brass-ink">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-3 w-3 shrink-0">
                  <path fillRule="evenodd" d="M10 1a.75.75 0 0 1 .692.462l1.7 3.644 3.945.576a.75.75 0 0 1 .416 1.279l-2.855 2.783.674 3.93a.75.75 0 0 1-1.088.791L10 12.347l-3.484 1.818a.75.75 0 0 1-1.088-.79l.674-3.931L3.247 6.96a.75.75 0 0 1 .416-1.28l3.945-.575L9.308 1.46A.75.75 0 0 1 10 1Z" clipRule="evenodd" />
                </svg>
                Season Finale
              </span>
            )}
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setMinimised(true)}
              className="flex h-6 w-6 items-center justify-center rounded-[2px] text-meta transition-colors hover:bg-cream hover:text-ink"
              title="Minimise"
            >
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><line x1="2" y1="6" x2="10" y2="6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
            </button>
            <button
              type="button"
              onClick={handleDismiss}
              className="flex h-6 w-6 items-center justify-center rounded-[2px] text-meta transition-colors hover:bg-cream hover:text-ink"
              title="Dismiss until next race"
            >
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><line x1="2" y1="2" x2="10" y2="10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /><line x1="10" y1="2" x2="2" y2="10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
            </button>
          </div>
        </div>

        {/* Content */}
        <LoadingLink href={scheduleUrl} className="group block px-4 pb-3">
          <div className="flex gap-3">
            {/* Poster thumbnail */}
            {race.posterImage && (
              <div className={`relative h-[72px] w-[52px] shrink-0 overflow-hidden rounded-[2px] border bg-cream ${
                isLiveNow ? "border-oxblood" : "border-[color:var(--isl-hairline)]"
              }`}>
                <Image
                  src={race.posterImage}
                  alt={`${race.raceName} poster`}
                  fill
                  sizes="52px"
                  className="object-cover"
                  unoptimized
                />
              </div>
            )}

            {/* Info */}
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <MiniFlag code={race.countryCode} />
                <h4 className={`truncate font-display text-base font-semibold transition-colors ${
                  isLiveNow
                    ? "text-oxblood"
                    : "text-ink group-hover:text-oxblood"
                }`}>
                  {race.raceName}
                </h4>
                {race.youtubeUrl && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setShowWatch(true);
                    }}
                    className="flex h-5 w-5 shrink-0 items-center justify-center rounded-[2px] bg-oxblood text-bone transition-colors hover:bg-oxblood-deep"
                    title={isLiveNow ? "Watch Live" : "Watch the Race"}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-2.5 w-2.5">
                      <path d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z" />
                    </svg>
                  </button>
                )}
              </div>

              {race.track && (
                <p className="mt-0.5 truncate text-xs text-meta">
                  {race.track}
                </p>
              )}

              <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
                <span className="text-ink-2">
                  Round <span className="num">{race.raceNumber}</span>
                </span>
                <span className={`rounded-[2px] px-1.5 py-px font-semibold uppercase leading-none tracking-wider ${
                  race.league.toLowerCase() === "main"
                    ? "border border-oxblood text-oxblood"
                    : "border border-brass text-brass-ink"
                }`}>
                  {race.league}
                </span>
                <span className="num text-meta">
                  {race.date}
                  {race.startTime && ` · ${race.startTime}`}
                </span>
              </div>
            </div>
          </div>

          {/* Countdown OR Live indicator */}
          {isLiveNow ? (
            <div className="mt-3 flex items-center justify-center gap-2 rounded-[2px] border border-oxblood bg-cream px-3 py-2.5">
              <span className="h-2.5 w-2.5 rounded-full bg-oxblood animate-[f1-tick_1s_step-end_infinite]" />
              <span className="font-display text-base font-bold uppercase tracking-[0.15em] text-oxblood">
                Race in progress
              </span>
            </div>
          ) : countdown && countdown.total > 0 ? (
            <div dir="ltr" className="mt-3 flex items-center justify-center gap-3 rounded-[2px] border border-[color:var(--isl-hairline)] bg-cream px-3 py-2.5">
              <CountdownUnit value={countdown.days} label="days" />
              <span className="font-display text-lg font-bold text-faint">:</span>
              <CountdownUnit value={countdown.hours} label="hrs" />
              <span className="font-display text-lg font-bold text-faint">:</span>
              <CountdownUnit value={countdown.minutes} label="min" />
              <span className="font-display text-lg font-bold text-faint">:</span>
              <CountdownUnit value={countdown.seconds} label="sec" />
            </div>
          ) : null}
        </LoadingLink>
      </div>

      {/* Watch modal */}
      {showWatch && race.youtubeUrl && (
        <WidgetWatchModal
          raceName={race.raceName}
          youtubeUrl={race.youtubeUrl}
          onClose={() => setShowWatch(false)}
        />
      )}
    </div>
  );
}
