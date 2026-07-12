"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import type { Driver, Team, TeamWithDrivers } from "@/lib/driversData";
import { getTeamColor, getTeamLogo, localizedDriverName } from "@/lib/driversData";
import DriverCard from "@/components/DriverCard";
import DriverModal from "@/components/DriverModal";
import { AchievementBadgeList } from "@/components/AchievementBadges";
import Image from "next/image";
import { gaOpenDriverCard } from "@/lib/ga";

type DriversGridProps = {
  teams: TeamWithDrivers[];
  reserves: Driver[];
  historicDrivers: Driver[];
  placeholderSrc: string;
  currentSeasonLabel?: string;
  hasWild?: boolean;
};

function isRemote(src?: string) {
  return !!src && src.startsWith("http");
}

export default function DriversGrid({ teams, reserves, historicDrivers, placeholderSrc, currentSeasonLabel, hasWild }: DriversGridProps) {
  const t = useTranslations("drivers");
  const locale = useLocale();
  const [selected, setSelected] = useState<{ driver: Driver; team: Team } | null>(null);
  const lastFocused = useRef<HTMLElement | null>(null);

  const selectDriver = (driver: Driver, team: Team) => {
    gaOpenDriverCard(driver.name);
    setSelected({ driver, team });
  };

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
      <div className="space-y-6">
        {teams.map((team) => {
          const teamColor = getTeamColor(team.team_key);
          return (
          <section
            key={team.team_key}
            className="relative overflow-hidden rounded-[2px] border border-[color:var(--isl-hairline)] bg-cream/40"
          >
            {/* Subtle team-colour accent pinned to the inline-start edge */}
            <span aria-hidden className="absolute inset-y-0 start-0 w-1" style={{ backgroundColor: teamColor }} />
            <div className="p-5 md:p-6">
              {/* Team header */}
              <div className="flex flex-wrap items-center gap-4">
                <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-[2px] border border-[color:var(--isl-hairline)] bg-cream p-1.5">
                  <div className="flex h-full w-full items-center justify-center rounded-[2px] bg-white p-1">
                    <Image
                      src={getTeamLogo(team.team_key)}
                      alt={`${team.team_name} logo`}
                      width={64}
                      height={64}
                      className="h-11 w-11 object-contain"
                      unoptimized={!isRemote(getTeamLogo(team.team_key))}
                    />
                  </div>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-isl-body text-[0.7rem] font-semibold uppercase tracking-[0.24em] text-brass-ink">
                    {t("grid.mainDrivers")}
                  </p>
                  <h2 className="mt-0.5 flex items-center gap-2 font-display text-2xl font-bold tracking-[0.005em] leading-[1.05] text-ink">
                    <span aria-hidden className="inline-block h-4 w-1 shrink-0 rounded-[1px]" style={{ backgroundColor: teamColor }} />
                    {team.team_name}
                  </h2>
                </div>
              </div>

              <div className="isl-gold-rule my-5" />

              {/* Two driver seats — filled or "To Be Revealed" */}
              <div className="grid gap-4 sm:grid-cols-2">
                {[0, 1].map((i) => {
                  const driver = team.drivers[i];
                  const seatNo = String(i + 1).padStart(2, "0");
                  if (driver) {
                    return (
                      <DriverCard
                        key={driver.driver_id || driver.name}
                        driver={driver}
                        team={team}
                        placeholderSrc={placeholderSrc}
                        onSelect={(selectedDriver, selectedTeam) =>
                          selectDriver(selectedDriver, selectedTeam)
                        }
                      />
                    );
                  }
                  return (
                    <div
                      key={`seat-${i}`}
                      className="isl-speed-lines flex min-h-[240px] flex-col items-center justify-center gap-2 rounded-[2px] border border-dashed border-[color:var(--isl-hairline-strong)] bg-cream/30 p-6 text-center"
                    >
                      <span className="font-isl-body text-[0.65rem] font-semibold uppercase tracking-[0.24em] text-brass-ink">
                        {t("grid.seat")} {seatNo}
                      </span>
                      <span className="num font-display text-4xl font-bold leading-none text-faint">
                        {seatNo}
                      </span>
                      <span className="font-isl-body text-xs font-semibold uppercase tracking-[0.2em] text-meta">
                        {t("grid.toBeRevealed")}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </section>
          );
        })}
      </div>

      <section className="mt-12 space-y-6">
        <div>
          <h2 className="font-display text-2xl font-bold tracking-[0.005em] leading-[1.05] text-ink">{t("grid.reserveDrivers")}</h2>
          <p className="mt-1 text-sm text-ink-2">{t("grid.reserveDescription")}</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {reserves.map((driver) => {
            const team = teams.find((teamItem) => teamItem.team_key === driver.team_key) ?? {
              team_key: driver.team_key,
              team_name: "Independent",
              logo_url: "/isl-mark.png",
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
            <div className="isl-speed-lines flex items-center justify-center rounded-[2px] border border-dashed border-[color:var(--isl-hairline-strong)] bg-cream p-6 sm:col-span-2 lg:col-span-4">
              <p className="font-isl-body text-xs font-semibold uppercase tracking-[0.2em] text-meta">{t("grid.reserveComingSoon")}</p>
            </div>
          )}
        </div>
      </section>

      {/* ---- Historical Drivers (name list) ---- */}
      {historicDrivers.length > 0 && (
        <section className="mt-12 space-y-4">
          <div>
            <h2 className="font-display text-2xl font-bold tracking-[0.005em] leading-[1.05] text-ink">{t("grid.historicalDrivers")}</h2>
            <p className="mt-1 text-sm text-ink-2">
              {t("grid.historicalDescription")}
            </p>
          </div>

          <div className="overflow-hidden rounded-[2px] border border-[color:var(--isl-hairline)] bg-paper">
            {historicDrivers.map((driver, idx) => {
              const team = teams.find((t) => t.team_key === driver.team_key) ?? {
                team_key: driver.team_key,
                team_name: "Independent",
                logo_url: "/isl-mark.png",
              };
              return (
                <button
                  key={driver.driver_id || driver.name}
                  type="button"
                  onClick={() => setSelected({ driver, team })}
                  className={`group flex w-full items-center gap-2 px-5 py-3 text-start transition-colors hover:bg-cream ${
                    idx !== 0 ? "border-t border-[color:var(--isl-hairline)]" : ""
                  }`}
                >
                  <span className="font-display text-base font-semibold text-ink transition-colors group-hover:text-oxblood">
                    {localizedDriverName(driver, locale)}
                  </span>
                  <AchievementBadgeList driver={driver} iconSize={14} />
                  <span className="flex-1" />
                  {driver.number && (
                    <span className="num inline-flex shrink-0 items-center rounded-[2px] border border-[color:var(--isl-hairline)] bg-cream px-2.5 py-0.5 text-xs font-semibold text-ink-2">
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
          placeholderSrc={placeholderSrc}
          onClose={() => setSelected(null)}
          currentSeasonLabel={currentSeasonLabel}
          hasWild={hasWild}
        />
      )}
    </>
  );
}
