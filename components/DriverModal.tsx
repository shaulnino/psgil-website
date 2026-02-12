"use client";

import { useState, useRef, useCallback, useEffect, createContext, useContext } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import type { Driver, Team } from "@/lib/driversData";
import { buildAchievements } from "@/components/AchievementBadges";

type DriverModalProps = {
  driver: Driver;
  team: Team;
  placeholderSrc: string;
  onClose: () => void;
  currentSeasonLabel?: string;
};

type StatMode = "alltime" | "season";

/* ------------------------------------------------------------------ */
/*  Tooltip portal context                                             */
/* ------------------------------------------------------------------ */

type TooltipPortalCtx = {
  container: HTMLDivElement | null;
  scrollContainer: HTMLDivElement | null;
};

const TooltipPortalContext = createContext<TooltipPortalCtx>({
  container: null,
  scrollContainer: null,
});

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function isRemote(src?: string) {
  return !!src && src.startsWith("http");
}

function getRankExplanation(mode: StatMode): string {
  return mode === "season"
    ? "Gold number indicates the driver\u2019s rank in this stat among active drivers in the current season."
    : "Gold number indicates the driver\u2019s rank in this stat among all-time drivers.";
}


const statItems = [
  { key: "points", label: "Points", isDecimal: false, tooltipDesc: "Total championship points earned across all races in this scope." },
  { key: "wins", label: "Wins", isDecimal: false, tooltipDesc: "Number of race victories achieved." },
  { key: "podiums", label: "Podiums", isDecimal: false, tooltipDesc: "Total top-3 finishes (P1\u2013P3)." },
  { key: "poles", label: "Poles", isDecimal: false, tooltipDesc: "Number of pole positions achieved in qualifying." },
  { key: "avg_finish", label: "Avg Finish", isDecimal: true, tooltipDesc: "Average finishing position across all races. Lower is better." },
  { key: "dnfs", label: "DNFs", isDecimal: false, tooltipDesc: "Number of races not finished (DNF)." },
  { key: "avg_grid", label: "Avg Grid", isDecimal: true, tooltipDesc: "Average starting position across all races. Lower is better." },
  { key: "avg_points", label: "Avg Points", isDecimal: true, tooltipDesc: "Average points scored per race." },
] as const;

const ratingItems = [
  {
    key: "rating_speed",
    label: "Speed",
    tooltip: "Pace and qualifying/race position strength.",
  },
  {
    key: "rating_consistency",
    label: "Consistency",
    tooltip: "Ability to deliver stable results and avoid DNFs/major swings.",
  },
  {
    key: "rating_performance",
    label: "Performance",
    tooltip: "Overall outcome strength (wins/podiums/points efficiency).",
  },
  {
    key: "rating_agility",
    label: "Agility",
    tooltip: "Ability in rain/changing conditions and adapting during races.",
  },
  {
    key: "rating_overall",
    label: "Driver Rating",
    tooltip: "Weighted overall rating combining all categories.",
  },
] as const;

function formatStatValue(value: string | undefined, isDecimal: boolean): string {
  if (!value) return "—";
  if (isDecimal) {
    const num = parseFloat(value);
    return Number.isFinite(num) ? num.toFixed(1) : "—";
  }
  return value;
}

function getStatValue(driver: Driver, key: string, mode: StatMode): string | undefined {
  if (mode === "season") {
    return driver[`season_${key}` as keyof Driver] as string | undefined;
  }
  return driver[key as keyof Driver] as string | undefined;
}

function getRatingValue(driver: Driver, key: string, mode: StatMode): string | undefined {
  if (mode === "season") {
    return driver[`season_${key}` as keyof Driver] as string | undefined;
  }
  return driver[key as keyof Driver] as string | undefined;
}

function getStatRank(driver: Driver, key: string, mode: StatMode): string | undefined {
  if (mode === "season") {
    return driver[`season_rank_${key}` as keyof Driver] as string | undefined;
  }
  return driver[`rank_${key}` as keyof Driver] as string | undefined;
}

function getRatingRank(driver: Driver, key: string, mode: StatMode): string | undefined {
  if (mode === "season") {
    return driver[`season_rank_${key}` as keyof Driver] as string | undefined;
  }
  return driver[`rank_${key}` as keyof Driver] as string | undefined;
}

/* ------------------------------------------------------------------ */
/*  Tooltip – portalled into the modal wrapper (outside overflow)      */
/* ------------------------------------------------------------------ */

function Tooltip({ text, children, triggerClassName, wide }: { text: React.ReactNode; children: React.ReactNode; triggerClassName?: string; wide?: boolean }) {
  const { container, scrollContainer } = useContext(TooltipPortalContext);
  const triggerRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number; above: boolean }>({
    top: 0,
    left: 0,
    above: true,
  });

  const reposition = useCallback(() => {
    if (!triggerRef.current || !container) return;
    const triggerRect = triggerRef.current.getBoundingClientRect();
    const containerRect = container.getBoundingClientRect();

    const TOOLTIP_W = wide ? 280 : 200; // approximate width
    const TOOLTIP_H = wide ? 80 : 60; // approximate height
    const GAP = 8;

    // Prefer above; fall back to below when clipped
    const spaceAbove = triggerRect.top - containerRect.top;
    const above = spaceAbove > TOOLTIP_H + GAP;

    const top = above
      ? triggerRect.top - containerRect.top - GAP
      : triggerRect.bottom - containerRect.top + GAP;

    // Centre horizontally, but clamp within container bounds
    let left =
      triggerRect.left - containerRect.left + triggerRect.width / 2 - TOOLTIP_W / 2;
    left = Math.max(8, Math.min(left, containerRect.width - TOOLTIP_W - 8));

    setPos({ top, left, above });
  }, [container]);

  const show = useCallback(() => {
    reposition();
    setIsVisible(true);
  }, [reposition]);

  const hide = useCallback(() => setIsVisible(false), []);

  // Re-position while visible (handles scroll)
  useEffect(() => {
    if (!isVisible || !scrollContainer) return;
    const scrollEl = scrollContainer;
    const onScroll = () => reposition();
    scrollEl.addEventListener("scroll", onScroll, { passive: true });
    return () => scrollEl.removeEventListener("scroll", onScroll);
  }, [isVisible, scrollContainer, reposition]);

  // Close on outside tap (mobile)
  useEffect(() => {
    if (!isVisible) return;
    const handler = (e: PointerEvent) => {
      if (
        triggerRef.current &&
        !triggerRef.current.contains(e.target as Node)
      ) {
        hide();
      }
    };
    document.addEventListener("pointerdown", handler, true);
    return () => document.removeEventListener("pointerdown", handler, true);
  }, [isVisible, hide]);

  const tooltipNode = isVisible && container
    ? createPortal(
        <div
          ref={tooltipRef}
          style={{ top: pos.top, left: pos.left }}
          className={`pointer-events-none absolute z-30 ${wide ? "w-[280px]" : "w-[200px]"} rounded-lg border border-white/10 bg-[#1a1a1f] px-3 py-2 text-xs leading-relaxed text-white/80 shadow-lg ${
            pos.above ? "-translate-y-full" : ""
          }`}
        >
          {text}
          {/* Arrow */}
          <div
            className={`absolute left-1/2 -translate-x-1/2 border-[5px] border-transparent ${
              pos.above
                ? "top-full border-t-[#1a1a1f]"
                : "bottom-full border-b-[#1a1a1f]"
            }`}
          />
        </div>,
        container,
      )
    : null;

  return (
    <>
      <div
        ref={triggerRef}
        className={triggerClassName ?? "inline-flex items-center"}
        onMouseEnter={show}
        onMouseLeave={hide}
        onClick={() => (isVisible ? hide() : show())}
      >
        {children}
      </div>
      {tooltipNode}
    </>
  );
}

/* ------------------------------------------------------------------ */
/*  Shared style tokens                                                */
/* ------------------------------------------------------------------ */


/* ------------------------------------------------------------------ */
/*  DriverModal                                                        */
/* ------------------------------------------------------------------ */

export default function DriverModal({ driver, team, placeholderSrc, onClose, currentSeasonLabel }: DriverModalProps) {
  const [statMode, setStatMode] = useState<StatMode>("alltime");
  const [portalEl, setPortalEl] = useState<HTMLDivElement | null>(null);
  const [scrollEl, setScrollEl] = useState<HTMLDivElement | null>(null);
  const photoSrc = driver.photo_url || placeholderSrc;

  // Check if driver has any stats / ratings for either mode
  const hasAllTimeStats = statItems.some((stat) => driver[stat.key as keyof Driver]);
  const hasSeasonStats = statItems.some((stat) => driver[`season_${stat.key}` as keyof Driver]);
  const hasAnyStats = hasAllTimeStats || hasSeasonStats;

  const hasAllTimeRatings = ratingItems.some((rating) => driver[rating.key as keyof Driver]);
  const hasSeasonRatings = ratingItems.some((rating) => driver[`season_${rating.key}` as keyof Driver]);
  const hasAnyRatings = hasAllTimeRatings || hasSeasonRatings;

  const achievements = buildAchievements(driver);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
      onClick={onClose}
    >
      {/* Modal wrapper – tooltip portal target (no overflow clipping) */}
      <div
        ref={setPortalEl}
        className="relative mx-4 w-full max-w-3xl"
        onClick={(event) => event.stopPropagation()}
      >
        <button
          onClick={onClose}
          aria-label="Close driver profile"
          className="absolute right-3 top-3 z-10 flex h-9 w-9 items-center justify-center rounded-full border border-white/20 bg-black/60 text-white/80 transition hover:border-[#D4AF37]/60 hover:text-white"
        >
          ×
        </button>

        {/* Scrollable content */}
        <div
          ref={setScrollEl}
          className="max-h-[85vh] overflow-y-auto rounded-2xl border border-[#D4AF37]/30 bg-[#0B0B0E] p-6 shadow-[0_0_30px_rgba(0,0,0,0.4),0_0_60px_rgba(212,175,55,0.1)]"
        >
          <TooltipPortalContext.Provider
            value={{ container: portalEl, scrollContainer: scrollEl }}
          >
            {/* ---- Header ---- */}
            <div className="grid gap-6 md:grid-cols-[180px_1fr]">
              <div className="relative aspect-[4/5] w-full overflow-hidden rounded-2xl border border-white/10 bg-black/60">
                <Image
                  src={photoSrc}
                  alt={driver.name}
                  fill
                  sizes="180px"
                  className="object-cover"
                  unoptimized={isRemote(photoSrc)}
                />
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-3">
                  <h2 className="font-display text-2xl font-semibold text-white">{driver.name}</h2>
                  {driver.number && (
                    <span className="inline-flex items-center rounded-full border border-[#D4AF37]/30 bg-[#D4AF37]/10 px-3 py-0.5 text-sm font-semibold text-[#D4AF37]">
                      #{driver.number}
                    </span>
                  )}
                  <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs uppercase tracking-[0.2em] text-white/60">
                    {driver.role === "reserve" ? "Reserve" : "Main"}
                  </span>
                  {/* ---- Achievement icons ---- */}
                  {achievements.length > 0 && (
                    <div className="flex items-center gap-1">
                      {achievements.map((ach, i) => (
                        <Tooltip key={i} text={ach.tooltip}>
                          <span
                            className="flex h-[26px] w-[26px] cursor-help items-center justify-center rounded-md border border-white/10 bg-white/5 transition hover:bg-white/10"
                            aria-label={ach.ariaLabel}
                            role="img"
                          >
                            {ach.icon}
                          </span>
                        </Tooltip>
                      ))}
                    </div>
                  )}
                </div>
                {driver.about && (
                  <p className="mt-4 text-sm text-white/60">{driver.about}</p>
                )}

                {/* ---- League Standing (inline under About) ---- */}
                {(driver.league_rank_main || driver.league_rank_wild) && (
                  <div className="mt-4 flex items-center gap-4">
                    <h4 className="text-xs font-semibold uppercase tracking-[0.2em] text-white/50">
                      League Standing
                    </h4>
                    <div className="flex items-center gap-3">
                      <span className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs">
                        <span className="text-white/60">Main</span>
                        <span className="font-semibold text-[#D4AF37]">
                          {driver.league_rank_main ? `#${driver.league_rank_main}` : "—"}
                        </span>
                      </span>
                      <span className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs">
                        <span className="text-white/60">Wild</span>
                        <span className="font-semibold text-[#D4AF37]">
                          {driver.league_rank_wild ? `#${driver.league_rank_wild}` : "—"}
                        </span>
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* ---- Quick Stats + Toggle ---- */}
            {(hasAnyStats || hasAnyRatings) && (
              <div className="mt-8">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-white/60">
                      Quick stats
                    </h3>
                    {/* Race Events – inline next to header */}
                    {(driver.events || driver.season_events) && (
                      <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-2.5 py-0.5">
                        <Tooltip text="Total number of race events the driver participated in (Regular Races + 25% Races + Sprint Races combined).">
                          <span className="flex items-center gap-1 cursor-help text-xs text-white/60">
                            Race Events
                            <svg
                              className="h-3 w-3 text-white/40"
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                              strokeWidth={2}
                            >
                              <circle cx="12" cy="12" r="10" />
                              <path d="M12 16v-4M12 8h.01" />
                            </svg>
                          </span>
                        </Tooltip>
                        <span className="font-semibold text-[#D4AF37]">
                          {(statMode === "season"
                            ? driver.season_events
                            : driver.events) || "—"}
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="flex rounded-lg border border-white/10 bg-white/5 p-1">
                    <button
                      type="button"
                      onClick={() => setStatMode("alltime")}
                      className={`rounded-md px-3 py-1.5 text-xs font-medium transition ${
                        statMode === "alltime"
                          ? "bg-[#7020B0] text-white"
                          : "text-white/60 hover:text-white"
                      }`}
                    >
                      All-time
                    </button>
                    <button
                      type="button"
                      onClick={() => setStatMode("season")}
                      className={`rounded-md px-3 py-1.5 text-xs font-medium transition ${
                        statMode === "season"
                          ? "bg-[#7020B0] text-white"
                          : "text-white/60 hover:text-white"
                      }`}
                    >
                      {currentSeasonLabel || "Season"}
                    </button>
                  </div>
                </div>

                {hasAnyStats && (
                  <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                    {statItems.map((stat) => {
                      const value = getStatValue(driver, stat.key, statMode);
                      const rank = getStatRank(driver, stat.key, statMode);
                      return (
                        <Tooltip key={stat.key} text={<><p>{stat.tooltipDesc}</p><p className="mt-1.5 text-white/50">{getRankExplanation(statMode)}</p></>} triggerClassName="block" wide>
                          <div
                            className="relative cursor-help rounded-xl border border-white/10 bg-white/5 px-4 py-3"
                          >
                            {rank && (
                              <span className="absolute right-2 top-2 text-[10px] font-medium text-[#D4AF37]/80">
                                #{rank}
                              </span>
                            )}
                            <p className="text-xs uppercase tracking-[0.2em] text-white/50">
                              {stat.label}
                            </p>
                            <p className="font-display text-lg font-semibold text-white">
                              {formatStatValue(value, stat.isDecimal)}
                            </p>
                          </div>
                        </Tooltip>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* ---- Driver Ratings ---- */}
            {hasAnyRatings && (
              <div className="mt-8">
                <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-white/60">
                  Driver Ratings
                </h3>
                <div className="mt-4 space-y-3">
                  {ratingItems.map((rating) => {
                    const value = getRatingValue(driver, rating.key, statMode);
                    const rank = getRatingRank(driver, rating.key, statMode);
                    const parsed = value ? Number(value) : NaN;
                    const numValue = Number.isFinite(parsed) ? parsed : 0;
                    const width = Math.min(100, Math.max(0, numValue));
                    const hasValue = !!value && value !== "0" && Number.isFinite(parsed);

                    return (
                      <div key={rating.key}>
                        <div className="flex items-center justify-between text-sm">
                          <div className="flex items-center gap-2">
                            <Tooltip text={rating.tooltip}>
                              <span className="cursor-help text-white/70">
                                {rating.label}
                              </span>
                            </Tooltip>
                            {rank && (
                              <span className="text-[10px] font-medium text-[#D4AF37]/80">
                                #{rank}
                              </span>
                            )}
                          </div>
                          <span
                            className={`font-semibold ${
                              hasValue ? "text-[#D4AF37]" : "text-white/30"
                            }`}
                          >
                            {hasValue ? numValue : "—"}
                          </span>
                        </div>
                        <div className="mt-2 h-2 overflow-hidden rounded-full border border-white/10 bg-white/5">
                          <div
                            className={`h-full rounded-full transition-all duration-300 ${
                              hasValue
                                ? "bg-gradient-to-r from-[#7020B0] to-[#9030D0]"
                                : "bg-white/10"
                            }`}
                            style={{ width: hasValue ? `${width}%` : "0%" }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </TooltipPortalContext.Provider>
        </div>
      </div>
    </div>
  );
}
