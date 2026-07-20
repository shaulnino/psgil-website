"use client";

import { ChevronRight, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import WatchLastRaceButton from "@/components/WatchLastRaceButton";

export type HeroState = "live" | "upcoming" | "replay" | "default";

type RaceLink = { label: string; url: string };

type HeroActionsProps = {
  state: HeroState;
  /** Watch links for the live/replay states (from the schedule CSV). */
  links: RaceLink[];
  labels: {
    viewNextRace: string;
    watchLive: string;
    watchReplay: string;
    joinLeague: string;
    viewSchedule: string;
  };
};

const full = "w-full sm:w-auto";
const Arrow = () => <ChevronRight className="h-4 w-4 shrink-0 rtl:-scale-x-100" aria-hidden />;

/**
 * State-aware hero CTAs (max two). The most relevant current action gets the
 * gold primary (red when live); "Join the league" stays the outline secondary.
 * Live/replay open the existing on-site YouTube modal; "View next race" scrolls
 * to the on-page Races section. No watch button is shown when no video exists.
 */
export default function HeroActions({ state, links, labels }: HeroActionsProps) {
  const join = (variant: "primary" | "secondary") => (
    <Button href="#contact-us" variant={variant} size="lg" className={full}>
      <UserPlus className="h-4 w-4 shrink-0" aria-hidden />
      {labels.joinLeague}
    </Button>
  );

  let primary: React.ReactNode;
  let secondary: React.ReactNode;

  if (state === "live") {
    primary = (
      <WatchLastRaceButton links={links} label={labels.watchLive} variant="live" className={full} />
    );
    secondary = join("secondary");
  } else if (state === "replay") {
    primary = (
      <WatchLastRaceButton
        links={links}
        label={labels.watchReplay}
        variant="primary"
        className={full}
      />
    );
    secondary = join("secondary");
  } else if (state === "upcoming") {
    primary = (
      <Button href="#races" size="lg" className={full}>
        {labels.viewNextRace}
        <Arrow />
      </Button>
    );
    secondary = join("secondary");
  } else {
    primary = join("primary");
    secondary = (
      <Button href="/schedule" variant="secondary" size="lg" className={full}>
        {labels.viewSchedule}
        <Arrow />
      </Button>
    );
  }

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
      {primary}
      {secondary}
    </div>
  );
}
