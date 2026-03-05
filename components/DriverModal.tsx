"use client";

import { useState, useRef, useCallback, useEffect, createContext, useContext } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import LoadingLink from "@/components/LoadingLink";
import type { Driver } from "@/lib/driversData";
import { buildAchievements, getAwardIcon } from "@/components/AchievementBadges";
import type { AwardCode, RewardCompetition } from "@/lib/rewardsData";

type DriverModalProps = {
  driver: Driver;
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
  }, [container, wide]);

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

export default function DriverModal({ driver, placeholderSrc, onClose, currentSeasonLabel }: DriverModalProps) {
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
  const driverRewards = driver.rewards ?? [];
  const countRewards = (
    competition: RewardCompetition,
    awardCode: AwardCode,
  ): number =>
    driverRewards.filter(
      (r) => r.competition === competition && r.award_code === awardCode,
    ).length;
  const seasonsFor = (
    competitions: RewardCompetition[],
    awardCodes: AwardCode[],
  ): number[] =>
    Array.from(
      new Set(
        driverRewards
          .filter(
            (r) =>
              competitions.includes(r.competition) &&
              awardCodes.includes(r.award_code),
          )
          .map((r) => r.season_id),
      ),
    ).sort((a, b) => a - b);
  const rewardStatCards = [
    {
      label: "Main Champion Titles",
      value: countRewards("main", "champion"),
      tooltip: "Seasons won as Main League champion.",
      awardCode: "champion" as AwardCode,
      iconCompetition: "main" as RewardCompetition,
      seasons: seasonsFor(["main"], ["champion"]),
    },
    {
      label: "Main 2nd Titles",
      value: countRewards("main", "runner_up"),
      tooltip: "Seasons finished 2nd in Main League.",
      awardCode: "runner_up" as AwardCode,
      iconCompetition: "main" as RewardCompetition,
      seasons: seasonsFor(["main"], ["runner_up"]),
    },
    {
      label: "Main 3rd Titles",
      value: countRewards("main", "third_place"),
      tooltip: "Seasons finished 3rd in Main League.",
      awardCode: "third_place" as AwardCode,
      iconCompetition: "main" as RewardCompetition,
      seasons: seasonsFor(["main"], ["third_place"]),
    },
    {
      label: "Lower Champion Titles",
      value: countRewards("lower", "champion"),
      tooltip: "Seasons won as Lower League champion.",
      awardCode: "champion" as AwardCode,
      iconCompetition: "lower" as RewardCompetition,
      seasons: seasonsFor(["lower"], ["champion"]),
    },
    {
      label: "Lower 2nd Titles",
      value: countRewards("lower", "runner_up"),
      tooltip: "Seasons finished 2nd in Lower League.",
      awardCode: "runner_up" as AwardCode,
      iconCompetition: "lower" as RewardCompetition,
      seasons: seasonsFor(["lower"], ["runner_up"]),
    },
    {
      label: "Lower 3rd Titles",
      value: countRewards("lower", "third_place"),
      tooltip: "Seasons finished 3rd in Lower League.",
      awardCode: "third_place" as AwardCode,
      iconCompetition: "lower" as RewardCompetition,
      seasons: seasonsFor(["lower"], ["third_place"]),
    },
    {
      label: "Wild Champion Titles",
      value: countRewards("wild", "champion"),
      tooltip: "Seasons won as Wild League champion.",
      awardCode: "champion" as AwardCode,
      iconCompetition: "wild" as RewardCompetition,
      seasons: seasonsFor(["wild"], ["champion"]),
    },
    {
      label: "Wild 2nd Titles",
      value: countRewards("wild", "runner_up"),
      tooltip: "Seasons finished 2nd in Wild League.",
      awardCode: "runner_up" as AwardCode,
      iconCompetition: "wild" as RewardCompetition,
      seasons: seasonsFor(["wild"], ["runner_up"]),
    },
    {
      label: "Wild 3rd Titles",
      value: countRewards("wild", "third_place"),
      tooltip: "Seasons finished 3rd in Wild League.",
      awardCode: "third_place" as AwardCode,
      iconCompetition: "wild" as RewardCompetition,
      seasons: seasonsFor(["wild"], ["third_place"]),
    },
    {
      label: "Best of the Rest",
      value:
        countRewards("main", "best_of_rest") +
        countRewards("lower", "best_of_rest") +
        countRewards("wild", "best_of_rest"),
      tooltip: "Finished 4th overall in a season championship.",
      awardCode: "best_of_rest" as AwardCode,
      iconCompetition: "main" as RewardCompetition,
      seasons: seasonsFor(["main", "lower", "wild"], ["best_of_rest"]),
    },
    {
      label: "Cleanest Driver",
      value:
        countRewards("main", "cleanest_driver") +
        countRewards("lower", "cleanest_driver") +
        countRewards("wild", "cleanest_driver"),
      tooltip: "Lowest combined penalties (game + stewards) across a season.",
      awardCode: "cleanest_driver" as AwardCode,
      iconCompetition: "main" as RewardCompetition,
      seasons: seasonsFor(["main", "lower", "wild"], ["cleanest_driver"]),
    },
    {
      label: "Driver of the Season",
      value:
        countRewards("main", "driver_of_season") +
        countRewards("lower", "driver_of_season") +
        countRewards("wild", "driver_of_season"),
      tooltip: "Most Driver of the Day awards in a season.",
      awardCode: "driver_of_season" as AwardCode,
      iconCompetition: "main" as RewardCompetition,
      seasons: seasonsFor(["main", "lower", "wild"], ["driver_of_season"]),
    },
    {
      label: "Grid Climber",
      value:
        countRewards("main", "grid_climber") +
        countRewards("lower", "grid_climber") +
        countRewards("wild", "grid_climber"),
      tooltip: "Most total positions gained across a season.",
      awardCode: "grid_climber" as AwardCode,
      iconCompetition: "main" as RewardCompetition,
      seasons: seasonsFor(["main", "lower", "wild"], ["grid_climber"]),
    },
    {
      label: "Mr. Consistent",
      value:
        countRewards("main", "mr_consistent") +
        countRewards("lower", "mr_consistent") +
        countRewards("wild", "mr_consistent"),
      tooltip: "Finished the most races in a season.",
      awardCode: "mr_consistent" as AwardCode,
      iconCompetition: "main" as RewardCompetition,
      seasons: seasonsFor(["main", "lower", "wild"], ["mr_consistent"]),
    },
    {
      label: "Most Improved",
      value: countRewards("community", "most_improved"),
      tooltip: "Community vote: Most Improved Driver.",
      awardCode: "most_improved" as AwardCode,
      iconCompetition: "community" as RewardCompetition,
      seasons: seasonsFor(["community"], ["most_improved"]),
    },
    {
      label: "Most Valuable",
      value: countRewards("community", "most_valuable"),
      tooltip: "Community vote: Most Valuable Driver.",
      awardCode: "most_valuable" as AwardCode,
      iconCompetition: "community" as RewardCompetition,
      seasons: seasonsFor(["community"], ["most_valuable"]),
    },
  ];
  const earnedRewardStats = rewardStatCards.filter((item) => item.value > 0);

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
                            className="flex min-h-[26px] min-w-[26px] cursor-help items-center justify-center rounded-md border border-white/10 bg-white/5 px-0.5 transition hover:bg-white/10"
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
            {earnedRewardStats.length > 0 && (
              <div className="mt-8">
                <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-white/60">
                  Records & Awards
                </h3>
                <div className="mt-3 rounded-xl border border-white/10 bg-white/5 px-4 py-2">
                  <ul className="divide-y divide-white/10">
                    {earnedRewardStats.map((item) => (
                      <li key={item.label} className="flex items-center justify-between py-1.5 text-sm">
                        <Tooltip text={item.tooltip}>
                          <span className="inline-flex cursor-help items-center gap-2 text-white/75">
                            <span className="inline-flex h-4 w-4 items-center justify-center">
                              {getAwardIcon(item.awardCode, 14, item.iconCompetition)}
                            </span>
                            <span className="text-[13px]">{item.label}</span>
                          </span>
                        </Tooltip>
                        <Tooltip
                          text={
                            item.seasons.length > 0
                              ? `Seasons: ${item.seasons.map((s: number) => `S${s}`).join(", ")}`
                              : "No seasons found"
                          }
                        >
                          <span className="cursor-help font-display text-sm font-semibold text-[#D4AF37]">
                            {item.value}
                          </span>
                        </Tooltip>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}

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
                              <span className="absolute right-2 top-2 text-xs font-medium text-[#D4AF37]/80">
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
                              <span className="text-xs font-medium text-[#D4AF37]/80">
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
            {/* ---- Full Driver Stats link ---- */}
            <div className="mt-8 flex justify-center">
              <LoadingLink
                href={`/stats?driver=${encodeURIComponent(driver.name)}`}
                className="inline-flex items-center gap-2 rounded-lg border border-[#D4AF37]/30 bg-[#D4AF37]/10 px-5 py-2.5 text-sm font-semibold text-[#D4AF37] transition hover:bg-[#D4AF37]/20 hover:border-[#D4AF37]/50"
                showLoadingText
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
                Full Driver Stats
              </LoadingLink>
            </div>
          </TooltipPortalContext.Provider>
        </div>
      </div>
    </div>
  );
}
