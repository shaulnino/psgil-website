"use client";

import { useEffect, useRef, useState } from "react";
import type { Driver, Team, TeamWithDrivers } from "@/lib/driversData";
import { getTeamColor } from "@/lib/driversData";
import DriverCard from "@/components/DriverCard";
import DriverModal from "@/components/DriverModal";
import Image from "next/image";

type DriversGridProps = {
  teams: TeamWithDrivers[];
  reserves: Driver[];
  placeholderSrc: string;
};

function isRemote(src?: string) {
  return !!src && src.startsWith("http");
}

export default function DriversGrid({ teams, reserves, placeholderSrc }: DriversGridProps) {
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

      {selected && (
        <DriverModal
          driver={selected.driver}
          team={selected.team}
          placeholderSrc={placeholderSrc}
          onClose={() => setSelected(null)}
        />
      )}
    </>
  );
}
