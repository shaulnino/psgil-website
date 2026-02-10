"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import type { Driver } from "@/lib/driversData";

/* ------------------------------------------------------------------ */
/*  Medal colours & types                                              */
/* ------------------------------------------------------------------ */

export const MEDAL_COLORS = {
  gold: "#D4AF37",
  silver: "#C0C0C0",
  bronze: "#CD7F32",
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

/* ------------------------------------------------------------------ */
/*  Achievement definitions & builder                                  */
/* ------------------------------------------------------------------ */

export type AchievementDef = {
  icon: React.ReactNode;
  tooltip: string;
  ariaLabel: string;
};

export function buildAchievements(driver: Driver, iconSize = 18): AchievementDef[] {
  const achievements: AchievementDef[] = [];

  const defs: {
    field: keyof Driver;
    tier: MedalTier;
    Icon: typeof TrophyIcon;
    label: string;
    tooltip: string;
  }[] = [
    // League Championship
    { field: "titles_league_1st", tier: "gold", Icon: TrophyIcon, label: "League champion", tooltip: "League champion – Gold trophy" },
    { field: "titles_league_2nd", tier: "silver", Icon: TrophyIcon, label: "2nd place in league championship", tooltip: "2nd place in league championship – Silver trophy" },
    { field: "titles_league_3rd", tier: "bronze", Icon: TrophyIcon, label: "3rd place in league championship", tooltip: "3rd place in league championship – Bronze trophy" },
    // Lower Bracket Championship
    { field: "titles_lower_1st", tier: "gold", Icon: PlateIcon, label: "Lower Bracket champion", tooltip: "Lower Bracket champion – Gold plate" },
    { field: "titles_lower_2nd", tier: "silver", Icon: PlateIcon, label: "2nd place in lower bracket championship", tooltip: "2nd place in lower bracket championship – Silver plate" },
    { field: "titles_lower_3rd", tier: "bronze", Icon: PlateIcon, label: "3rd place in lower bracket championship", tooltip: "3rd place in lower bracket championship – Bronze plate" },
    // Wild League Championship
    { field: "titles_wild_1st", tier: "gold", Icon: LionIcon, label: "Wild League champion", tooltip: "Wild League champion – Gold lion" },
    { field: "titles_wild_2nd", tier: "silver", Icon: LionIcon, label: "2nd place in Wild League championship", tooltip: "2nd place in Wild League championship – Silver lion" },
    { field: "titles_wild_3rd", tier: "bronze", Icon: LionIcon, label: "3rd place in Wild League championship", tooltip: "3rd place in Wild League championship – Bronze lion" },
  ];

  for (const def of defs) {
    const raw = driver[def.field];
    const count = raw ? parseInt(raw, 10) : 0;
    if (!count || count <= 0) continue;
    for (let i = 0; i < count; i++) {
      achievements.push({
        icon: <def.Icon tier={def.tier} size={iconSize} />,
        tooltip: def.tooltip,
        ariaLabel: def.label,
      });
    }
  }

  return achievements;
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
    >
      {children}
      {visible && (
        <span
          className={`pointer-events-none absolute left-1/2 z-50 w-max max-w-[200px] -translate-x-1/2 rounded-lg border border-white/10 bg-[#1a1a1f] px-2.5 py-1.5 text-[10px] leading-relaxed text-white/80 shadow-lg ${
            above ? "bottom-full mb-1.5" : "top-full mt-1.5"
          }`}
        >
          {text}
          <span
            className={`absolute left-1/2 -translate-x-1/2 border-[4px] border-transparent ${
              above
                ? "top-full border-t-[#1a1a1f]"
                : "bottom-full border-b-[#1a1a1f]"
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
  const achievements = buildAchievements(driver, iconSize);
  if (achievements.length === 0) return null;

  return (
    <span className="inline-flex shrink-0 items-center gap-0.5">
      {achievements.map((ach, i) => (
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
    </span>
  );
}
