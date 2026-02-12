"use client";

import { useEffect, useRef, useState } from "react";
import type { Driver, Team, TeamWithDrivers } from "@/lib/driversData";
import { getTeamColor } from "@/lib/driversData";
import DriverCard from "@/components/DriverCard";
import DriverModal from "@/components/DriverModal";
import { AchievementBadgeList } from "@/components/AchievementBadges";
import Image from "next/image";

type DriversGridProps = {
  teams: TeamWithDrivers[];
  reserves: Driver[];
  historicDrivers: Driver[];
  placeholderSrc: string;
  currentSeasonLabel?: string;
};

function isRemote(src?: string) {
  return !!src && src.startsWith("http");
}

export default function DriversGrid({ teams, reserves, historicDrivers, placeholderSrc, currentSeasonLabel }: DriversGridProps) {
  const [selected, setSelected] = useState<{ driver: Driver; team: Team } | null>(null);
  const lastFocused = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!selected) {
      return;
    }

    lastFocused.current = document.activeElement as HTMLElement;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setSelected(null);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      lastFocused.current?.focus?.();
    };
  }, [selected]);

  return (
    <>
      <div className="space-y-12">
        {teams.map((team) => (
          <section key={team.team_key} className="space-y-6">
            <div className="flex flex-wrap items-center gap-6">
              <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white p-0.5">
                <Image
                  src={team.logo_url || "/psgil-logo.png"}
                  alt={`${team.team_name} logo`}
                  width={64}
                  height={64}
                  className="h-16 w-16 object-contain"
                  unoptimized={isRemote(team.logo_url)}
                />
              </div>
              <div className="flex-1 min-w-0">
                <h2 className="font-display text-2xl font-semibold" style={{ color: getTeamColor(team.team_key) }}>{team.team_name}</h2>
                <p className="mt-1 text-sm text-white/50">Main drivers</p>
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {team.drivers.slice(0, 2).map((driver) => (
                <DriverCard
                  key={driver.driver_id || driver.name}
                  driver={driver}
                  team={team}
                  placeholderSrc={placeholderSrc}
                  onSelect={(selectedDriver, selectedTeam) =>
                    setSelected({ driver: selectedDriver, team: selectedTeam })
                  }
                />
              ))}
              {team.drivers.length === 0 && (
                <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-sm text-white/60">
                  Driver lineup coming soon.
                </div>
              )}
            </div>
          </section>
        ))}
      </div>

      <section className="mt-12 space-y-6">
        <div>
          <h2 className="font-display text-2xl font-semibold text-white">Reserve Drivers</h2>
          <p className="text-sm text-white/50">Additional drivers available for substitution.</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {reserves.map((driver) => {
            const team = teams.find((teamItem) => teamItem.team_key === driver.team_key) ?? {
              team_key: driver.team_key,
              team_name: "Independent",
              logo_url: "/psgil-logo.png",
            };
            return (
              <DriverCard
                key={driver.driver_id || driver.name}
                driver={driver}
                team={team}
                placeholderSrc={placeholderSrc}
                onSelect={(selectedDriver, selectedTeam) =>
                  setSelected({ driver: selectedDriver, team: selectedTeam })
                }
              />
            );
          })}
          {reserves.length === 0 && (
            <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-sm text-white/60">
              Reserve roster coming soon.
            </div>
          )}
        </div>
      </section>

      {/* ---- Historical Drivers (name list) ---- */}
      {historicDrivers.length > 0 && (
        <section className="mt-12 space-y-4">
          <div>
            <h2 className="font-display text-2xl font-semibold text-white">Historical Drivers</h2>
            <p className="text-sm text-white/50">
              Drivers who competed in previous PSGiL seasons.
            </p>
          </div>

          <div className="overflow-hidden rounded-2xl border border-white/10">
            {historicDrivers.map((driver, idx) => {
              const team = teams.find((t) => t.team_key === driver.team_key) ?? {
                team_key: driver.team_key,
                team_name: "Independent",
                logo_url: "/psgil-logo.png",
              };
              return (
                <button
                  key={driver.driver_id || driver.name}
                  type="button"
                  onClick={() => setSelected({ driver, team })}
                  className={`group flex w-full items-center gap-2 px-5 py-3 text-left transition-colors hover:bg-white/5 ${
                    idx !== 0 ? "border-t border-white/5" : ""
                  }`}
                >
                  <span className="font-display text-base font-semibold text-white/90 transition-colors group-hover:text-[#D4AF37]">
                    {driver.name}
                  </span>
                  <AchievementBadgeList driver={driver} iconSize={14} />
                  <span className="flex-1" />
                  {driver.number && (
                    <span className="inline-flex shrink-0 items-center rounded-full border border-[#D4AF37]/30 bg-[#D4AF37]/10 px-2.5 py-0.5 text-xs font-semibold text-[#D4AF37]">
                      #{driver.number}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </section>
      )}

      {selected && (
        <DriverModal
          driver={selected.driver}
          team={selected.team}
          placeholderSrc={placeholderSrc}
          onClose={() => setSelected(null)}
          currentSeasonLabel={currentSeasonLabel}
        />
      )}
    </>
  );
}
