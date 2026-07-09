"use client";

import { useState, useRef, useCallback, useEffect, createContext, useContext } from "react";
import { useTranslations, useLocale } from "next-intl";
import { createPortal } from "react-dom";
import Image from "next/image";
import LoadingLink from "@/components/LoadingLink";
import { localizedAbout, localizedDriverName, type Driver, type CompetitionStats } from "@/lib/driversData";
import { buildAchievements, getAwardIcon } from "@/components/AchievementBadges";
import type { AwardCode, RewardCompetition } from "@/lib/rewardsData";

type DriverModalProps = {
  driver: Driver;
  placeholderSrc: string;
  onClose: () => void;
  currentSeasonLabel?: string;
  /** Whether the Wild competition scope is offered. Defaults to true. */
  hasWild?: boolean;
};

type StatMode = "alltime" | "season";
type CompMode = "all" | "main" | "wild";

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

function getRankExplanation(mode: StatMode, comp: CompMode): string {
  if (comp !== "all") {
    const scope = comp === "main" ? "Main" : "Wild";
    return `Gold number indicates the driver's rank in this stat among drivers who competed in the ${scope} league${mode === "season" ? " this season" : ""}.`;
  }
  return mode === "season"
    ? "Gold number indicates the driver\u2019s rank in this stat among active drivers in the current season."
    : "Gold number indicates the driver\u2019s rank in this stat among all-time drivers.";
}

function resolveCompStats(driver: Driver, mode: StatMode, comp: CompMode): CompetitionStats | null {
  if (comp === "all") return null; // use flat Driver fields
  if (mode === "alltime") return comp === "main" ? driver.comp_main ?? null : driver.comp_wild ?? null;
  return comp === "main" ? driver.season_comp_main ?? null : driver.season_comp_wild ?? null;
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

function getStatValue(driver: Driver, key: string, mode: StatMode, comp: CompMode): string | undefined {
  const cs = resolveCompStats(driver, mode, comp);
  if (cs) return cs[key as keyof CompetitionStats];
  if (mode === "season") return driver[`season_${key}` as keyof Driver] as string | undefined;
  return driver[key as keyof Driver] as string | undefined;
}

function getRatingValue(driver: Driver, key: string, mode: StatMode, comp: CompMode): string | undefined {
  const cs = resolveCompStats(driver, mode, comp);
  if (cs) return cs[key as keyof CompetitionStats];
  if (mode === "season") return driver[`season_${key}` as keyof Driver] as string | undefined;
  return driver[key as keyof Driver] as string | undefined;
}

function getStatRank(driver: Driver, key: string, mode: StatMode, comp: CompMode): string | undefined {
  if (comp !== "all") {
    const cs = resolveCompStats(driver, mode, comp);
    return cs ? (cs as Record<string, string | undefined>)[`rank_${key}`] : undefined;
  }
  if (mode === "season") return driver[`season_rank_${key}` as keyof Driver] as string | undefined;
  return driver[`rank_${key}` as keyof Driver] as string | undefined;
}

function getRatingRank(driver: Driver, key: string, mode: StatMode, comp: CompMode): string | undefined {
  if (comp !== "all") {
    const cs = resolveCompStats(driver, mode, comp);
    return cs ? (cs as Record<string, string | undefined>)[`rank_${key}`] : undefined;
  }
  if (mode === "season") return driver[`season_rank_${key}` as keyof Driver] as string | undefined;
  return driver[`rank_${key}` as keyof Driver] as string | undefined;
}

function getEventsCount(driver: Driver, mode: StatMode, comp: CompMode): string | undefined {
  const cs = resolveCompStats(driver, mode, comp);
  if (cs) return cs.events;
  return mode === "season" ? driver.season_events : driver.events;
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
          className={`pointer-events-none absolute z-30 ${wide ? "w-[280px]" : "w-[200px]"} rounded-[2px] border border-[color:var(--isl-hairline)] bg-paper px-3 py-2 text-xs leading-relaxed text-ink ${
            pos.above ? "-translate-y-full" : ""
          }`}
        >
          {text}
          {/* Arrow */}
          <div
            className={`absolute left-1/2 -translate-x-1/2 border-[5px] border-transparent ${
              pos.above
                ? "top-full border-t-[color:var(--isl-paper)]"
                : "bottom-full border-b-[color:var(--isl-paper)]"
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

export default function DriverModal({ driver, placeholderSrc, onClose, currentSeasonLabel, hasWild = true }: DriverModalProps) {
  const t = useTranslations("drivers");
  const tr = useTranslations("rewards");
  const locale = useLocale();
  const [statMode, setStatMode] = useState<StatMode>("alltime");
  const [compMode, setCompMode] = useState<CompMode>("all");
  const compModes: CompMode[] = hasWild ? ["all", "main", "wild"] : ["all", "main"];

  // Never leave the modal stuck on a hidden Wild scope.
  useEffect(() => {
    if (!hasWild && compMode === "wild") setCompMode("all");
  }, [hasWild, compMode]);
  const [portalEl, setPortalEl] = useState<HTMLDivElement | null>(null);
  const [scrollEl, setScrollEl] = useState<HTMLDivElement | null>(null);
  const photoSrc = driver.photo_url || placeholderSrc;

  // Check if driver has any stats / ratings for either mode
  const hasAllTimeStats = statItems.some((stat) => driver[stat.key as keyof Driver]);
  const hasSeasonStats = statItems.some((stat) => driver[`season_${stat.key}` as keyof Driver]);
  const hasAnyStats = hasAllTimeStats || hasSeasonStats || !!driver.comp_main || !!driver.comp_wild;

  const hasAllTimeRatings = ratingItems.some((rating) => driver[rating.key as keyof Driver]);
  const hasSeasonRatings = ratingItems.some((rating) => driver[`season_${rating.key}` as keyof Driver]);
  const hasAnyRatings = hasAllTimeRatings || hasSeasonRatings || !!driver.comp_main || !!driver.comp_wild;

  // Whether data exists for the current combination
  const hasCompStats = compMode === "all"
    || (statMode === "alltime" && compMode === "main" && !!driver.comp_main)
    || (statMode === "alltime" && compMode === "wild" && !!driver.comp_wild)
    || (statMode === "season" && compMode === "main" && !!driver.season_comp_main)
    || (statMode === "season" && compMode === "wild" && !!driver.season_comp_wild);

  const achievements = buildAchievements(driver, tr);
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
      label: tr("cards.mainChampion.label"),
      value: countRewards("main", "champion"),
      tooltip: tr("cards.mainChampion.tooltip"),
      awardCode: "champion" as AwardCode,
      iconCompetition: "main" as RewardCompetition,
      seasons: seasonsFor(["main"], ["champion"]),
    },
    {
      label: tr("cards.mainSecond.label"),
      value: countRewards("main", "runner_up"),
      tooltip: tr("cards.mainSecond.tooltip"),
      awardCode: "runner_up" as AwardCode,
      iconCompetition: "main" as RewardCompetition,
      seasons: seasonsFor(["main"], ["runner_up"]),
    },
    {
      label: tr("cards.mainThird.label"),
      value: countRewards("main", "third_place"),
      tooltip: tr("cards.mainThird.tooltip"),
      awardCode: "third_place" as AwardCode,
      iconCompetition: "main" as RewardCompetition,
      seasons: seasonsFor(["main"], ["third_place"]),
    },
    {
      label: tr("cards.lowerChampion.label"),
      value: countRewards("lower", "champion"),
      tooltip: tr("cards.lowerChampion.tooltip"),
      awardCode: "champion" as AwardCode,
      iconCompetition: "lower" as RewardCompetition,
      seasons: seasonsFor(["lower"], ["champion"]),
    },
    {
      label: tr("cards.lowerSecond.label"),
      value: countRewards("lower", "runner_up"),
      tooltip: tr("cards.lowerSecond.tooltip"),
      awardCode: "runner_up" as AwardCode,
      iconCompetition: "lower" as RewardCompetition,
      seasons: seasonsFor(["lower"], ["runner_up"]),
    },
    {
      label: tr("cards.lowerThird.label"),
      value: countRewards("lower", "third_place"),
      tooltip: tr("cards.lowerThird.tooltip"),
      awardCode: "third_place" as AwardCode,
      iconCompetition: "lower" as RewardCompetition,
      seasons: seasonsFor(["lower"], ["third_place"]),
    },
    {
      label: tr("cards.wildChampion.label"),
      value: countRewards("wild", "champion"),
      tooltip: tr("cards.wildChampion.tooltip"),
      awardCode: "champion" as AwardCode,
      iconCompetition: "wild" as RewardCompetition,
      seasons: seasonsFor(["wild"], ["champion"]),
    },
    {
      label: tr("cards.wildSecond.label"),
      value: countRewards("wild", "runner_up"),
      tooltip: tr("cards.wildSecond.tooltip"),
      awardCode: "runner_up" as AwardCode,
      iconCompetition: "wild" as RewardCompetition,
      seasons: seasonsFor(["wild"], ["runner_up"]),
    },
    {
      label: tr("cards.wildThird.label"),
      value: countRewards("wild", "third_place"),
      tooltip: tr("cards.wildThird.tooltip"),
      awardCode: "third_place" as AwardCode,
      iconCompetition: "wild" as RewardCompetition,
      seasons: seasonsFor(["wild"], ["third_place"]),
    },
    {
      label: tr("cards.bestOfRest.label"),
      value:
        countRewards("main", "best_of_rest") +
        countRewards("lower", "best_of_rest") +
        countRewards("wild", "best_of_rest"),
      tooltip: tr("cards.bestOfRest.tooltip"),
      awardCode: "best_of_rest" as AwardCode,
      iconCompetition: "main" as RewardCompetition,
      seasons: seasonsFor(["main", "lower", "wild"], ["best_of_rest"]),
    },
    {
      label: tr("cards.cleanestDriver.label"),
      value:
        countRewards("main", "cleanest_driver") +
        countRewards("lower", "cleanest_driver") +
        countRewards("wild", "cleanest_driver"),
      tooltip: tr("cards.cleanestDriver.tooltip"),
      awardCode: "cleanest_driver" as AwardCode,
      iconCompetition: "main" as RewardCompetition,
      seasons: seasonsFor(["main", "lower", "wild"], ["cleanest_driver"]),
    },
    {
      label: tr("cards.driverOfSeason.label"),
      value:
        countRewards("main", "driver_of_season") +
        countRewards("lower", "driver_of_season") +
        countRewards("wild", "driver_of_season"),
      tooltip: tr("cards.driverOfSeason.tooltip"),
      awardCode: "driver_of_season" as AwardCode,
      iconCompetition: "main" as RewardCompetition,
      seasons: seasonsFor(["main", "lower", "wild"], ["driver_of_season"]),
    },
    {
      label: tr("cards.gridClimber.label"),
      value:
        countRewards("main", "grid_climber") +
        countRewards("lower", "grid_climber") +
        countRewards("wild", "grid_climber"),
      tooltip: tr("cards.gridClimber.tooltip"),
      awardCode: "grid_climber" as AwardCode,
      iconCompetition: "main" as RewardCompetition,
      seasons: seasonsFor(["main", "lower", "wild"], ["grid_climber"]),
    },
    {
      label: tr("cards.mrConsistent.label"),
      value:
        countRewards("main", "mr_consistent") +
        countRewards("lower", "mr_consistent") +
        countRewards("wild", "mr_consistent"),
      tooltip: tr("cards.mrConsistent.tooltip"),
      awardCode: "mr_consistent" as AwardCode,
      iconCompetition: "main" as RewardCompetition,
      seasons: seasonsFor(["main", "lower", "wild"], ["mr_consistent"]),
    },
    {
      label: tr("cards.mostImproved.label"),
      value: countRewards("community", "most_improved"),
      tooltip: tr("cards.mostImproved.tooltip"),
      awardCode: "most_improved" as AwardCode,
      iconCompetition: "community" as RewardCompetition,
      seasons: seasonsFor(["community"], ["most_improved"]),
    },
    {
      label: tr("cards.mostValuable.label"),
      value: countRewards("community", "most_valuable"),
      tooltip: tr("cards.mostValuable.tooltip"),
      awardCode: "most_valuable" as AwardCode,
      iconCompetition: "community" as RewardCompetition,
      seasons: seasonsFor(["community"], ["most_valuable"]),
    },
  ];
  const earnedRewardStats = rewardStatCards.filter((item) => item.value > 0);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80"
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
          aria-label={t("modal.closeAriaLabel")}
          className="absolute end-3 top-3 z-10 flex h-11 w-11 items-center justify-center rounded-[2px] border border-[color:var(--isl-hairline)] bg-paper text-xl text-ink-2 transition-colors hover:border-ink hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--isl-oxblood)]"
        >
          ×
        </button>

        {/* Scrollable content */}
        <div
          ref={setScrollEl}
          className="max-h-[85vh] overflow-y-auto rounded-[2px] border border-[color:var(--isl-hairline)] bg-paper p-6"
        >
          <TooltipPortalContext.Provider
            value={{ container: portalEl, scrollContainer: scrollEl }}
          >
            {/* ---- Header ---- */}
            <div className="grid gap-6 md:grid-cols-[180px_1fr]">
              <div className="relative aspect-[4/5] w-full overflow-hidden rounded-[2px] border border-[color:var(--isl-hairline)] bg-cream">
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
                  <h2 className="font-display font-bold tracking-[0.005em] leading-[1.05] text-2xl text-ink">{localizedDriverName(driver, locale)}</h2>
                  {driver.number && (
                    <span className="num inline-flex items-center rounded-[2px] border border-[color:var(--isl-hairline-strong)] bg-cream px-3 py-0.5 text-sm font-semibold text-ink">
                      #{driver.number}
                    </span>
                  )}
                  <span className="rounded-[2px] border border-[color:var(--isl-hairline)] bg-cream px-3 py-1 text-xs uppercase tracking-[0.2em] text-meta">
                    {driver.role === "reserve" ? t("modal.roleReserve") : t("modal.roleMain")}
                  </span>
                  {/* ---- Achievement icons ---- */}
                  {achievements.length > 0 && (
                    <div className="flex items-center gap-1">
                      {achievements.map((ach, i) => (
                        <Tooltip key={i} text={ach.tooltip}>
                          <span
                            className="flex min-h-[26px] min-w-[26px] cursor-help items-center justify-center rounded-[2px] border border-[color:var(--isl-hairline)] bg-cream px-0.5 transition-colors hover:border-ink"
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
                {localizedAbout(driver, locale) && (
                  <p className="mt-4 text-sm text-ink-2">{localizedAbout(driver, locale)}</p>
                )}

                {/* ---- League Standing (inline under About) ---- */}
                {(driver.league_rank_main || driver.league_rank_wild) && (
                  <div className="mt-4 flex items-center gap-4">
                    <h4 className="font-isl-body text-xs font-semibold uppercase tracking-[0.2em] text-meta">
                      {t("modal.leagueStanding")}
                    </h4>
                    <div className="flex items-center gap-3">
                      <span className="inline-flex items-center gap-1.5 rounded-[2px] border border-[color:var(--isl-hairline)] bg-cream px-3 py-1.5 text-xs">
                        <span className="text-meta">{t("modal.leagueMain")}</span>
                        <span className="num font-semibold text-ink">
                          {driver.league_rank_main ? `#${driver.league_rank_main}` : "—"}
                        </span>
                      </span>
                      <span className="inline-flex items-center gap-1.5 rounded-[2px] border border-[color:var(--isl-hairline)] bg-cream px-3 py-1.5 text-xs">
                        <span className="text-meta">{t("modal.leagueWild")}</span>
                        <span className="num font-semibold text-ink">
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
                <h3 className="font-isl-body text-sm font-semibold uppercase tracking-[0.2em] text-brass-ink">
                  {t("modal.recordsAndAwards")}
                </h3>
                <div className="mt-3 rounded-[2px] border border-[color:var(--isl-hairline)] bg-cream px-4 py-2">
                  <ul className="divide-y divide-[color:var(--isl-hairline)]">
                    {earnedRewardStats.map((item) => (
                      <li key={item.label} className="flex items-center justify-between py-1.5 text-sm">
                        <Tooltip text={item.tooltip}>
                          <span className="inline-flex cursor-help items-center gap-2 text-ink-2">
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
                          <span className="num cursor-help font-display text-sm font-semibold text-brass-ink">
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
                {/* ── Toggles row ── */}
                <div className="flex flex-wrap items-center justify-between gap-3">
                  {/* Left: title + events badge */}
                  <div className="flex items-center gap-4">
                    <h3 className="font-isl-body text-sm font-semibold uppercase tracking-[0.2em] text-meta">
                      {t("modal.quickStats")}
                    </h3>
                    {getEventsCount(driver, statMode, compMode) && (
                      <div className="flex items-center gap-2 rounded-[2px] border border-[color:var(--isl-hairline)] bg-cream px-2.5 py-0.5">
                        <Tooltip text={t("modal.raceEventsTooltip")}>
                          <span className="cursor-help text-xs text-meta">
                            {t("modal.raceEvents")}
                          </span>
                        </Tooltip>
                        <span className="num font-semibold text-ink">
                          {getEventsCount(driver, statMode, compMode) || "—"}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Right: two toggle groups */}
                  <div className="flex flex-wrap items-center gap-2">
                    {/* Time scope */}
                    <div className="flex rounded-[2px] border border-[color:var(--isl-hairline)] bg-sink p-1">
                      {(["alltime", "season"] as StatMode[]).map((m) => (
                        <button
                          key={m}
                          type="button"
                          onClick={() => setStatMode(m)}
                          className={`rounded-[2px] px-3 py-1.5 text-xs font-medium transition-colors ${
                            statMode === m ? "bg-ink text-bone" : "text-ink-2 hover:text-ink"
                          }`}
                        >
                          {m === "alltime" ? t("modal.scopeAllTime") : (currentSeasonLabel || t("modal.scopeSeason"))}
                        </button>
                      ))}
                    </div>
                    {/* Competition scope */}
                    <div className="flex rounded-[2px] border border-[color:var(--isl-hairline)] bg-sink p-1">
                      {compModes.map((c) => (
                        <button
                          key={c}
                          type="button"
                          onClick={() => setCompMode(c)}
                          className={`rounded-[2px] px-3 py-1.5 text-xs font-medium transition-colors ${
                            compMode === c ? "bg-ink text-bone" : "text-ink-2 hover:text-ink"
                          }`}
                        >
                          {c === "all" ? t("modal.compAll") : c === "main" ? t("modal.compMain") : t("modal.compWild")}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {hasAnyStats && (
                  <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                    {statItems.map((stat) => {
                      const value = hasCompStats ? getStatValue(driver, stat.key, statMode, compMode) : undefined;
                      const rank = getStatRank(driver, stat.key, statMode, compMode);
                      return (
                        <Tooltip key={stat.key} text={<><p>{stat.tooltipDesc}</p><p className="mt-1.5 text-meta">{getRankExplanation(statMode, compMode)}</p></>} triggerClassName="block" wide>
                          <div
                            className={`cursor-help rounded-[2px] border border-[color:var(--isl-hairline)] bg-cream px-4 py-3 ${!hasCompStats ? "opacity-40" : ""}`}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <p className="text-xs uppercase tracking-[0.2em] text-meta">
                                {stat.label}
                              </p>
                              {rank && (
                                <span className="num shrink-0 text-xs font-medium text-meta">
                                  #{rank}
                                </span>
                              )}
                            </div>
                            <p className="num font-display text-lg font-semibold text-ink">
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
                <h3 className="font-isl-body text-sm font-semibold uppercase tracking-[0.2em] text-meta">
                  {t("modal.driverRatings")}
                </h3>
                <div className="mt-4 space-y-3">
                  {ratingItems.map((rating) => {
                    const value = getRatingValue(driver, rating.key, statMode, compMode);
                    const rank = getRatingRank(driver, rating.key, statMode, compMode);
                    const parsed = value ? Number(value) : NaN;
                    const numValue = Number.isFinite(parsed) ? parsed : 0;
                    const width = Math.min(100, Math.max(0, numValue));
                    const hasValue = !!value && value !== "0" && Number.isFinite(parsed);

                    return (
                      <div key={rating.key}>
                        <div className="flex items-center justify-between text-sm">
                          <div className="flex items-center gap-2">
                            <Tooltip text={rating.tooltip}>
                              <span className="cursor-help text-ink-2">
                                {t(`ratings.${rating.key}`)}
                              </span>
                            </Tooltip>
                            {rank && (
                              <span className="num text-xs font-medium text-meta">
                                #{rank}
                              </span>
                            )}
                          </div>
                          <span
                            className={`num font-semibold ${
                              hasValue ? "text-ink" : "text-faint"
                            }`}
                          >
                            {hasValue ? numValue : "—"}
                          </span>
                        </div>
                        <div className="mt-2 h-2 overflow-hidden rounded-[2px] border border-[color:var(--isl-hairline)] bg-sink">
                          <div
                            className={`h-full rounded-[2px] transition-all duration-300 ${
                              hasValue ? "bg-oxblood" : "bg-transparent"
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
                className="inline-flex items-center gap-2 rounded-[2px] border border-[color:var(--isl-hairline-strong)] bg-transparent px-5 py-2.5 text-sm font-semibold uppercase tracking-[0.08em] text-ink transition-colors hover:border-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--isl-oxblood)]"
                showLoadingText
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
                {t("modal.fullDriverStats")}
              </LoadingLink>
            </div>
          </TooltipPortalContext.Provider>
        </div>
      </div>
    </div>
  );
}
