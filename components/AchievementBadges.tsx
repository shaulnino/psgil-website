"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import type { Driver } from "@/lib/driversData";
import {
  DEFAULT_AWARD_RANK,
  type AwardCode,
  type RewardCompetition,
} from "@/lib/rewardsData";

/** Rewards-namespace translator (subset of next-intl's t we use here). */
type RewardsT = (key: string) => string;

/* ------------------------------------------------------------------ */
/*  Medal colours & types                                              */
/* ------------------------------------------------------------------ */

export const MEDAL_COLORS = {
  gold: "#9c7a3c",
  silver: "#5e5a52",
  bronze: "#7a4b28",
} as const;

export type MedalTier = keyof typeof MEDAL_COLORS;

/* ------------------------------------------------------------------ */
/*  Icon components                                                    */
/* ------------------------------------------------------------------ */

/** Classic trophy silhouette */
export function TrophyIcon({ tier, size = 18 }: { tier: MedalTier; size?: number }) {
  const c = MEDAL_COLORS[tier];
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path
        d="M7 4h10v6a5 5 0 0 1-10 0V4Z"
        fill={c}
        fillOpacity={0.25}
        stroke={c}
        strokeWidth={1.5}
        strokeLinejoin="round"
      />
      <path
        d="M7 6H4a1 1 0 0 0-1 1v1a3 3 0 0 0 3 3h1"
        stroke={c}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M17 6h3a1 1 0 0 1 1 1v1a3 3 0 0 1-3 3h-1"
        stroke={c}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M12 15v3" stroke={c} strokeWidth={1.5} strokeLinecap="round" />
      <path
        d="M8 21h8M9 18h6"
        stroke={c}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Shield / plate icon */
export function PlateIcon({ tier, size = 18 }: { tier: MedalTier; size?: number }) {
  const c = MEDAL_COLORS[tier];
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path
        d="M12 3 4 7v4c0 5.25 3.4 10.2 8 11.5 4.6-1.3 8-6.25 8-11.5V7l-8-4Z"
        fill={c}
        fillOpacity={0.25}
        stroke={c}
        strokeWidth={1.5}
        strokeLinejoin="round"
      />
      <path
        d="m9 12 2 2 4-4"
        stroke={c}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Lion head silhouette */
export function LionIcon({ tier, size = 18 }: { tier: MedalTier; size?: number }) {
  const c = MEDAL_COLORS[tier];
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      {/* Mane */}
      <ellipse
        cx="12"
        cy="11"
        rx="9"
        ry="9.5"
        fill={c}
        fillOpacity={0.15}
        stroke={c}
        strokeWidth={1.2}
      />
      {/* Face */}
      <ellipse cx="12" cy="12" rx="5.5" ry="6" fill={c} fillOpacity={0.25} />
      {/* Eyes */}
      <circle cx="10" cy="10.5" r="0.9" fill={c} />
      <circle cx="14" cy="10.5" r="0.9" fill={c} />
      {/* Nose + mouth */}
      <path d="M11 13.5h2l-1 1-1-1Z" fill={c} />
      <path
        d="M12 14.5v1"
        stroke={c}
        strokeWidth={0.8}
        strokeLinecap="round"
      />
    </svg>
  );
}

function RibbonIcon({ color, size = 18 }: { color: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="9" r="5" fill={color} fillOpacity={0.2} stroke={color} strokeWidth={1.5} />
      <path d="M9 13.5 7 21l5-2 5 2-2-7.5" fill={color} fillOpacity={0.2} stroke={color} strokeWidth={1.5} strokeLinejoin="round" />
    </svg>
  );
}

function SparkIcon({ color, size = 18 }: { color: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 3 14.4 8.6 20 11l-5.6 2.4L12 19l-2.4-5.6L4 11l5.6-2.4L12 3Z" fill={color} fillOpacity={0.2} stroke={color} strokeWidth={1.5} />
    </svg>
  );
}

function UpArrowIcon({ color, size = 18 }: { color: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 20V6M12 6 7 11M12 6l5 5" stroke={color} strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" />
      <rect x="5" y="19" width="14" height="2" rx="1" fill={color} fillOpacity={0.25} />
    </svg>
  );
}

function ShieldCheckIcon({ color, size = 18 }: { color: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 3 4 7v5c0 4.8 2.9 8.8 8 10 5.1-1.2 8-5.2 8-10V7l-8-4Z" fill={color} fillOpacity={0.2} stroke={color} strokeWidth={1.5} />
      <path d="m9.5 12.5 1.8 1.8 3.4-3.4" stroke={color} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function TargetIcon({ color, size = 18 }: { color: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="8" stroke={color} strokeWidth={1.6} />
      <circle cx="12" cy="12" r="4.5" stroke={color} strokeWidth={1.5} strokeOpacity={0.85} />
      <circle cx="12" cy="12" r="1.4" fill={color} />
      <path d="M17.5 6.5 14.8 9.2" stroke={color} strokeWidth={1.4} strokeLinecap="round" />
    </svg>
  );
}

function CrownIcon({ color, size = 18 }: { color: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M4 8.5 8.2 12l3.8-5 3.8 5L20 8.5 18.2 18H5.8L4 8.5Z"
        fill={color}
        fillOpacity={0.2}
        stroke={color}
        strokeWidth={1.5}
        strokeLinejoin="round"
      />
      <path
        d="M8.5 20h7"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
      />
      <circle cx="4.8" cy="8.2" r="1.1" fill={color} />
      <circle cx="12" cy="6.5" r="1.1" fill={color} />
      <circle cx="19.2" cy="8.2" r="1.1" fill={color} />
    </svg>
  );
}

function TeamCupIcon({ color, size = 18 }: { color: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M6 5h12v4a6 6 0 0 1-12 0V5Z" fill={color} fillOpacity={0.2} stroke={color} strokeWidth={1.5} />
      <path d="M9 20h6M10 16h4" stroke={color} strokeWidth={1.5} strokeLinecap="round" />
      <circle cx="8" cy="8.5" r="1.2" fill={color} />
      <circle cx="16" cy="8.5" r="1.2" fill={color} />
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/*  Achievement definitions & builder                                  */
/* ------------------------------------------------------------------ */

export type AchievementDef = {
  icon: React.ReactNode;
  tooltip: string;
  ariaLabel: string;
  count: number;
};

function competitionLabel(competition: RewardCompetition, t: RewardsT): string {
  switch (competition) {
    case "main":
      return t("competitions.main");
    case "lower":
      return t("competitions.lower");
    case "wild":
      return t("competitions.wild");
    case "constructors":
      return t("competitions.constructors");
    case "community":
      return t("competitions.community");
    default:
      return "";
  }
}

function placementLabel(
  awardCode: AwardCode,
  competition: RewardCompetition,
  t: RewardsT,
): string {
  const comp = competitionLabel(competition, t);
  switch (awardCode) {
    case "champion":
      return `${comp} ${t("placements.champion")}`;
    case "runner_up":
      return `${comp} ${t("placements.runner_up")}`;
    case "third_place":
      return `${comp} ${t("placements.third_place")}`;
    default:
      return t(`awards.${awardCode}.label`);
  }
}

export function getAwardIcon(
  awardCode: AwardCode,
  size = 18,
  competition: RewardCompetition = "main",
): React.ReactNode {
  const colorGold = MEDAL_COLORS.gold;
  const colorSilver = MEDAL_COLORS.silver;
  const colorBronze = MEDAL_COLORS.bronze;
  const purple = "#1c1712";
  const blue = "#1c1712";
  const green = "#1c1712";
  let baseIcon: React.ReactNode;
  switch (awardCode) {
    case "champion":
      baseIcon =
        competition === "lower" ? (
          <PlateIcon tier="gold" size={size} />
        ) : competition === "wild" ? (
          <LionIcon tier="gold" size={size} />
        ) : (
          <TrophyIcon tier="gold" size={size} />
        );
      break;
    case "runner_up":
      baseIcon =
        competition === "lower" ? (
          <PlateIcon tier="silver" size={size} />
        ) : competition === "wild" ? (
          <LionIcon tier="silver" size={size} />
        ) : (
          <TrophyIcon tier="silver" size={size} />
        );
      break;
    case "third_place":
      baseIcon =
        competition === "lower" ? (
          <PlateIcon tier="bronze" size={size} />
        ) : competition === "wild" ? (
          <LionIcon tier="bronze" size={size} />
        ) : (
          <TrophyIcon tier="bronze" size={size} />
        );
      break;
    case "constructors_champion":
      baseIcon = <TeamCupIcon color={colorGold} size={size} />;
      break;
    case "constructors_runner_up":
      baseIcon = <TeamCupIcon color={colorSilver} size={size} />;
      break;
    case "constructors_third_place":
      baseIcon = <TeamCupIcon color={colorBronze} size={size} />;
      break;
    case "best_of_rest":
      baseIcon = <RibbonIcon color={purple} size={size} />;
      break;
    case "cleanest_driver":
      baseIcon = <ShieldCheckIcon color={green} size={size} />;
      break;
    case "driver_of_season":
      baseIcon = <SparkIcon color={colorGold} size={size} />;
      break;
    case "grid_climber":
      baseIcon = <UpArrowIcon color={blue} size={size} />;
      break;
    case "mr_consistent":
      baseIcon = <TargetIcon color={colorSilver} size={size} />;
      break;
    case "most_improved":
      baseIcon = <UpArrowIcon color={purple} size={size} />;
      break;
    case "most_valuable":
      baseIcon = <CrownIcon color={colorGold} size={size} />;
      break;
    default:
      baseIcon = <TrophyIcon tier="gold" size={size} />;
  }

  return baseIcon;
}

export function buildAchievements(
  driver: Driver,
  t: RewardsT,
  iconSize = 18,
): AchievementDef[] {
  const rewards = driver.rewards ?? [];
  if (rewards.length === 0) return [];

  const grouped = new Map<
    string,
    {
      awardCode: AwardCode;
      competition: RewardCompetition;
      count: number;
      seasons: number[];
      notes: string[];
      tooltip?: string;
    }
  >();

  for (const reward of rewards) {
    const groupKey = `${reward.competition}:${reward.award_code}`;
    const curr = grouped.get(groupKey) ?? {
      awardCode: reward.award_code,
      competition: reward.competition,
      count: 0,
      seasons: [],
      notes: [],
      tooltip: reward.tooltip,
    };
    curr.count += 1;
    curr.seasons.push(reward.season_id);
    if (reward.notes) curr.notes.push(reward.notes);
    if (reward.tooltip) curr.tooltip = reward.tooltip;
    grouped.set(groupKey, curr);
  }

  return Array.from(grouped.entries())
    .sort(([, a], [, b]) => {
      const rankA = DEFAULT_AWARD_RANK[a.awardCode] ?? 999;
      const rankB = DEFAULT_AWARD_RANK[b.awardCode] ?? 999;
      if (rankA !== rankB) return rankA - rankB;
      return a.competition.localeCompare(b.competition);
    })
    .map(([, info]) => {
    const label = placementLabel(info.awardCode, info.competition, t);
    const seasonList = Array.from(new Set(info.seasons)).sort((a, b) => a - b);
    const defaultTooltip = t(`awards.${info.awardCode}.tooltip`);
    const tipParts = [
      label,
      info.tooltip || defaultTooltip,
      `${t("badge.seasons")}: ${seasonList.map((s) => `S${s}`).join(", ")}`,
      info.notes.length > 0
        ? `${t("badge.notes")}: ${Array.from(new Set(info.notes)).join(" | ")}`
        : "",
    ].filter(Boolean);

      return {
        icon: getAwardIcon(info.awardCode, iconSize, info.competition),
        tooltip: tipParts.join(" — "),
        ariaLabel: `${label} (${info.count})`,
        count: info.count,
      };
    });
}

/* ------------------------------------------------------------------ */
/*  Lightweight inline tooltip (no portal – works outside modals)      */
/* ------------------------------------------------------------------ */

function InlineTooltip({
  text,
  children,
}: {
  text: string;
  children: React.ReactNode;
}) {
  const [visible, setVisible] = useState(false);
  const [above, setAbove] = useState(true);
  const triggerRef = useRef<HTMLSpanElement>(null);

  const show = useCallback(() => {
    // Determine if we have room above
    if (triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      setAbove(rect.top > 60);
    }
    setVisible(true);
  }, []);

  const hide = useCallback(() => setVisible(false), []);

  // Close on outside tap (mobile)
  useEffect(() => {
    if (!visible) return;
    const handler = (e: PointerEvent) => {
      if (triggerRef.current && !triggerRef.current.contains(e.target as Node)) {
        hide();
      }
    };
    document.addEventListener("pointerdown", handler, true);
    return () => document.removeEventListener("pointerdown", handler, true);
  }, [visible, hide]);

  return (
    <span
      ref={triggerRef}
      className="relative inline-flex items-center"
      onMouseEnter={show}
      onMouseLeave={hide}
      onClick={() => (visible ? hide() : show())}
      onFocus={show}
      onBlur={hide}
      tabIndex={0}
    >
      {children}
      {visible && (
        <span
          className={`pointer-events-none absolute start-1/2 z-50 w-max max-w-[200px] -translate-x-1/2 rounded-[2px] border border-[color:var(--isl-hairline)] bg-paper px-2.5 py-1.5 text-[10px] leading-relaxed text-ink ${
            above ? "bottom-full mb-1.5" : "top-full mt-1.5"
          }`}
        >
          {text}
          <span
            className={`absolute start-1/2 -translate-x-1/2 border-[4px] border-transparent ${
              above
                ? "top-full border-t-paper"
                : "bottom-full border-b-paper"
            }`}
          />
        </span>
      )}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/*  Reusable badge list for thumbnails / list items                    */
/* ------------------------------------------------------------------ */

/**
 * Renders a compact row of achievement badges with hover tooltips.
 * Designed for use in thumbnail cards and name lists (NOT the modal).
 * Pass `iconSize` to control badge dimensions (default 14).
 */
export function AchievementBadgeList({
  driver,
  iconSize = 14,
}: {
  driver: Driver;
  iconSize?: number;
}) {
  const t = useTranslations("rewards");
  const achievements = buildAchievements(driver, t, iconSize);
  if (achievements.length === 0) return null;
  const maxVisible = 6;
  const visible = achievements.slice(0, maxVisible);
  const hiddenCount = Math.max(0, achievements.length - maxVisible);
  const hiddenTooltip =
    hiddenCount > 0
      ? achievements
          .slice(maxVisible)
          .map((a) => a.ariaLabel.replace(/\s*\(\d+\)$/, ""))
          .join(", ")
      : "";

  return (
    <span className="inline-flex shrink-0 items-center gap-0.5">
      {visible.map((ach, i) => (
        <InlineTooltip key={i} text={ach.tooltip}>
          <span
            className="inline-flex cursor-help items-center justify-center"
            aria-label={ach.ariaLabel}
            role="img"
          >
            {ach.icon}
          </span>
        </InlineTooltip>
      ))}
      {hiddenCount > 0 && (
        <InlineTooltip text={`${t("badge.moreAwards")}: ${hiddenTooltip}`}>
          <span className="num inline-flex cursor-help items-center justify-center rounded-[2px] border border-[color:var(--isl-hairline)] bg-cream px-1.5 text-[10px] font-semibold text-meta">
            +{hiddenCount}
          </span>
        </InlineTooltip>
      )}
    </span>
  );
}
