"use client";

import { useState, useEffect, useCallback } from "react";
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
  youtubeUrl?: string;
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
      <span className="font-display text-lg font-bold leading-none text-white tabular-nums md:text-xl">
        {String(value).padStart(2, "0")}
      </span>
      <span className="mt-0.5 text-[9px] uppercase tracking-wider text-white/40">
        {label}
      </span>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Widget component                                                    */
/* ------------------------------------------------------------------ */

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
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative mx-4 w-full max-w-4xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[#7020B0]/20 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.15em] text-[#a855f7]">
              <span className="h-1.5 w-1.5 rounded-full bg-[#a855f7]" />
              Race Broadcast
            </span>
            <h3 className="font-display text-sm font-semibold text-white/80 md:text-base">
              {raceName}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full border border-white/20 bg-black/60 text-white/80 transition hover:text-white"
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
            className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-[11px] font-medium text-white/50 transition hover:border-white/20 hover:text-white/80"
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
    const tick = () => setCountdown(computeCountdown(race.startTimestamp));
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

  // Don't render anything if no race, hidden, or countdown expired
  if (!race || hidden || (countdown && countdown.total <= 0)) return null;

  // race.season may be "S6" or "6"; normalize to "S6" format for the URL param
  const seasonParam = race.season.startsWith("S") ? race.season : `S${race.season}`;
  const scheduleUrl = `/schedule?season=${seasonParam}#${race.eventId}`;

  /* ---------- Minimised pill ---------- */
  if (minimised) {
    return (
      <div className="fixed bottom-4 right-4 z-40 animate-in fade-in md:bottom-6 md:right-6">
        <button
          type="button"
          onClick={() => setMinimised(false)}
          className="flex items-center gap-2 rounded-full border border-[#7020B0]/50 bg-[#0e0e14]/95 px-3 py-2 shadow-lg shadow-black/40 backdrop-blur-md transition hover:border-[#7020B0]/80"
        >
          <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-400" />
          <span className="text-xs font-semibold text-white/80">Next Race</span>
          {countdown && (
            <span className="font-display text-xs font-bold tabular-nums text-[#D4AF37]">
              {countdown.days > 0 && `${countdown.days}d `}
              {String(countdown.hours).padStart(2, "0")}:
              {String(countdown.minutes).padStart(2, "0")}:
              {String(countdown.seconds).padStart(2, "0")}
            </span>
          )}
        </button>
      </div>
    );
  }

  /* ---------- Full widget ---------- */
  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 md:bottom-6 md:left-auto md:right-6 md:w-[340px]">
      <div className="border-t border-white/10 bg-[#0e0e14]/95 shadow-2xl shadow-black/50 backdrop-blur-md md:rounded-2xl md:border md:border-white/10">
        {/* Header bar */}
        <div className="flex items-center justify-between px-4 pt-3 pb-1">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-400" />
            <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/50">
              Next Race
            </span>
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setMinimised(true)}
              className="flex h-6 w-6 items-center justify-center rounded-full text-white/40 transition hover:bg-white/10 hover:text-white/70"
              title="Minimise"
            >
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><line x1="2" y1="6" x2="10" y2="6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
            </button>
            <button
              type="button"
              onClick={handleDismiss}
              className="flex h-6 w-6 items-center justify-center rounded-full text-white/40 transition hover:bg-white/10 hover:text-white/70"
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
              <div className="relative h-[72px] w-[52px] shrink-0 overflow-hidden rounded-lg border border-white/10 bg-white/5">
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
                <h4 className="truncate font-display text-sm font-semibold text-white group-hover:text-[#D4AF37] transition-colors">
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
                    className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#7020B0]/80 text-white transition hover:bg-[#7020B0] hover:shadow-[0_0_10px_rgba(112,32,176,0.5)]"
                    title="Watch the Race"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-2.5 w-2.5">
                      <path d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z" />
                    </svg>
                  </button>
                )}
              </div>

              {race.track && (
                <p className="mt-0.5 truncate text-[11px] text-white/40">
                  {race.track}
                </p>
              )}

              <div className="mt-1 flex flex-wrap items-center gap-2 text-[10px]">
                <span className="text-white/50">
                  Round {race.raceNumber}
                </span>
                <span className={`rounded-full px-1.5 py-px font-semibold uppercase leading-none tracking-wider ${
                  race.league.toLowerCase() === "main"
                    ? "border border-[#7020B0]/40 bg-[#7020B0]/20 text-[#a855f7]"
                    : "border border-[#D4AF37]/30 bg-[#D4AF37]/15 text-[#D4AF37]"
                }`}>
                  {race.league}
                </span>
                <span className="text-white/40">
                  {race.date}
                  {race.startTime && ` · ${race.startTime}`}
                </span>
              </div>
            </div>
          </div>

          {/* Countdown */}
          {countdown && countdown.total > 0 && (
            <div className="mt-3 flex items-center justify-center gap-3 rounded-xl bg-white/5 px-3 py-2.5 border border-white/5">
              <CountdownUnit value={countdown.days} label="days" />
              <span className="font-display text-lg font-bold text-white/20">:</span>
              <CountdownUnit value={countdown.hours} label="hrs" />
              <span className="font-display text-lg font-bold text-white/20">:</span>
              <CountdownUnit value={countdown.minutes} label="min" />
              <span className="font-display text-lg font-bold text-white/20">:</span>
              <CountdownUnit value={countdown.seconds} label="sec" />
            </div>
          )}
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
