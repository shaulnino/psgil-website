"use client";

import Image from "next/image";
import { useLocale } from "next-intl";
import type { Driver, Team } from "@/lib/driversData";
import { getTeamColor, localizedDriverName } from "@/lib/driversData";
import { AchievementBadgeList } from "@/components/AchievementBadges";

type DriverCardProps = {
  driver: Driver;
  team: Team;
  placeholderSrc: string;
  onSelect: (driver: Driver, team: Team) => void;
};

// Bypass next/image optimization for remote photos and for dynamic uploaded
// driver photos (PW-2e), which carry a ?v= cache-buster that next/image would
// otherwise reject for local images.
function isRemote(src?: string) {
  return !!src && (src.startsWith("http") || src.includes("?"));
}

export default function DriverCard({ driver, team, placeholderSrc, onSelect }: DriverCardProps) {
  const locale = useLocale();
  const displayName = localizedDriverName(driver, locale);
  const photoSrc = driver.photo_url || placeholderSrc;
  const teamColor = getTeamColor(team.team_key);

  return (
    <button
      type="button"
      onClick={() => onSelect(driver, team)}
      className="group flex w-full flex-col overflow-hidden rounded-[2px] border border-[color:var(--isl-hairline)] bg-cream text-start transition-colors duration-200 hover:border-[color:var(--isl-oxblood)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-oxblood/60"
    >
      {/* Image area — shorter aspect ratio so the card is more compact */}
      <div className="relative aspect-[5/5] w-full overflow-hidden border-b border-[color:var(--isl-hairline)] bg-sink">
        {/* Team-color accent: a short bar pinned to the start edge */}
        <span
          aria-hidden
          className="absolute inset-y-0 start-0 z-10 w-[3px]"
          style={{ backgroundColor: teamColor }}
        />
        <Image
          src={photoSrc}
          alt={displayName || "Driver"}
          fill
          sizes="(max-width: 768px) 100vw, 240px"
          className="object-cover transition duration-200 group-hover:scale-[1.02]"
          style={{ objectPosition: driver.photo_position || "top" }}
          unoptimized={isRemote(photoSrc)}
        />
      </div>
      {/* Name bar — more prominent */}
      <div className="flex items-center gap-2 px-4 py-3">
        <p className="font-display text-lg font-bold leading-tight text-ink truncate">
          {displayName}
        </p>
        <AchievementBadgeList driver={driver} iconSize={14} />
        <span className="flex-1" />
        {driver.number && (
          <span className="num inline-flex shrink-0 items-center rounded-[2px] border border-[color:var(--isl-hairline-strong)] bg-paper px-2.5 py-0.5 text-xs font-bold text-ink">
            #{driver.number}
          </span>
        )}
      </div>
    </button>
  );
}
