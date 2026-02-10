"use client";

import { useState } from "react";
import Image from "next/image";
import type { Driver, Team } from "@/lib/driversData";
import { getTeamColor } from "@/lib/driversData";
import { AchievementBadgeList } from "@/components/AchievementBadges";

type DriverCardProps = {
  driver: Driver;
  team: Team;
  placeholderSrc: string;
  onSelect: (driver: Driver, team: Team) => void;
};

function isRemote(src?: string) {
  return !!src && src.startsWith("http");
}

const GOLD_ACCENT = "#D4AF37";

export default function DriverCard({ driver, team, placeholderSrc, onSelect }: DriverCardProps) {
  const photoSrc = driver.photo_url || placeholderSrc;
  const teamColor = getTeamColor(team.team_key);
  const [hovered, setHovered] = useState(false);

  return (
    <button
      type="button"
      onClick={() => onSelect(driver, team)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{ borderColor: hovered ? GOLD_ACCENT : teamColor }}
      className="group flex w-full flex-col overflow-hidden rounded-2xl border-2 bg-white/5 text-left transition-colors duration-200 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7020B0]/60"
    >
      {/* Image area — shorter aspect ratio so the card is more compact */}
      <div className="relative aspect-[5/5] w-full overflow-hidden bg-[#0B0B0E]">
        <Image
          src={photoSrc}
          alt={driver.name || "Driver"}
          fill
          sizes="(max-width: 768px) 100vw, 240px"
          className="object-cover transition duration-200 group-hover:scale-[1.02]"
          style={{ objectPosition: driver.photo_position || "top" }}
          unoptimized={isRemote(photoSrc)}
        />
      </div>
      {/* Name bar — more prominent */}
      <div className="flex items-center gap-2 px-4 py-3">
        <p className="font-display text-lg font-bold leading-tight text-white truncate">
          {driver.name}
        </p>
        <AchievementBadgeList driver={driver} iconSize={14} />
        <span className="flex-1" />
        {driver.number && (
          <span className="inline-flex shrink-0 items-center rounded-full border border-[#D4AF37]/40 bg-[#D4AF37]/15 px-3 py-1 text-sm font-bold text-[#D4AF37]">
            #{driver.number}
          </span>
        )}
      </div>
    </button>
  );
}
