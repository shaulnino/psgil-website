"use client";

import { useState } from "react";
import Image from "next/image";
import type { Driver, Team } from "@/lib/driversData";
import { getTeamColor } from "@/lib/driversData";

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
      <div className="relative aspect-[4/5] w-full overflow-hidden bg-[#0B0B0E]">
        <Image
          src={photoSrc}
          alt={driver.name || "Driver"}
          fill
          sizes="(max-width: 768px) 100vw, 240px"
          className="object-cover transition duration-200 group-hover:scale-[1.02]"
          unoptimized={isRemote(photoSrc)}
        />
      </div>
      <div className="flex flex-1 flex-col gap-2 px-4 py-4">
        <div className="flex items-center justify-between gap-3">
          <p className="font-display text-base font-semibold text-white">{driver.name}</p>
          {driver.number && (
            <span className="inline-flex items-center rounded-full border border-[#D4AF37]/30 bg-[#D4AF37]/10 px-2.5 py-0.5 text-xs font-semibold text-[#D4AF37]">
              #{driver.number}
            </span>
          )}
        </div>
      </div>
    </button>
  );
}
