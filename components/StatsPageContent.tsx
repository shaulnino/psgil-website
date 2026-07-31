"use client";

import { useState, useCallback } from "react";
import { useTranslations } from "next-intl";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import DriversSection from "@/components/stats/drivers/DriversSection";
import LeagueSection from "@/components/stats/league/LeagueSection";
import CircuitsSection from "@/components/stats/circuits/CircuitsSection";
import RankingsSection from "@/components/stats/rankings/RankingsSection";
import H2HSection from "@/components/stats/h2h/H2HSection";
import { EmptyState } from "@/components/stats/shared";
import type { DriverStatRow, LeagueStatRow } from "@/lib/statsData";
import type { RaceResultRow } from "@/lib/resultsData";
import type { RaceEvent } from "@/lib/scheduleData";
import type { Reward } from "@/lib/rewardsData";
import type { SeasonConfig } from "@/lib/seasonConfig";

/* ------------------------------------------------------------------ */
/*  Props                                                              */
/* ------------------------------------------------------------------ */

type StatsData = {
  driversAllTime: { rows: DriverStatRow[]; headers: string[] };
  driversBySeason: Record<string, { rows: DriverStatRow[]; headers: string[] }>;
  league: LeagueStatRow[];
};

type Props = {
  data: StatsData;
  raceResults?: Record<string, RaceResultRow[]>;
  events?: RaceEvent[];
  seasons?: SeasonConfig[];
  rewards?: Reward[];
  /** Hebrew driver display names keyed by driver_id (label-only). */
  driverNamesHe?: Record<string, string>;
};

/* ------------------------------------------------------------------ */
/*  Tabs                                                               */
/* ------------------------------------------------------------------ */

const TABS = ["Drivers", "League", "Circuits", "Head-to-Head", "Rankings"] as const;
type Tab = (typeof TABS)[number];

const MAIN_TAB_LABEL_KEYS: Record<string, string> = {
  Drivers: "tabs.drivers",
  League: "tabs.league",
  Circuits: "tabs.circuits",
  "Head-to-Head": "tabs.headToHead",
  Rankings: "tabs.rankings",
};

function TabBar({
  tabs,
  active,
  onChange,
}: {
  tabs: readonly string[];
  active: string;
  onChange: (t: string) => void;
}) {
  const t = useTranslations("stats");
  return (
    <div className="overflow-x-auto pb-1 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
      <div className="inline-flex min-w-max snap-x snap-mandatory gap-1 rounded-[2px] border border-[color:var(--isl-hairline)] bg-cream p-1">
        {tabs.map((tabId) => (
          <button
            key={tabId}
            onClick={() => onChange(tabId)}
            className={`shrink-0 snap-start rounded-[2px] px-3 py-2 text-xs font-semibold uppercase tracking-[0.08em] transition sm:px-4 sm:text-sm ${
              active === tabId
                ? "bg-oxblood text-bone"
                : "text-meta hover:bg-sink hover:text-ink"
            }`}
          >
            {MAIN_TAB_LABEL_KEYS[tabId] ? t(MAIN_TAB_LABEL_KEYS[tabId]) : tabId}
          </button>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main component                                                     */
/* ------------------------------------------------------------------ */

export default function StatsPageContent({
  data,
  raceResults,
  events,
  seasons,
  rewards,
  driverNamesHe,
}: Props) {
  const t = useTranslations("stats");
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const initialDriver = searchParams.get("driver") ?? undefined;
  const initialTab = searchParams.get("tab") ?? undefined;
  const initialDa = searchParams.get("da") ?? undefined;
  const initialDb = searchParams.get("db") ?? undefined;

  const [tab, setTab] = useState<Tab>(() => {
    if (initialTab && TABS.includes(initialTab as Tab)) return initialTab as Tab;
    return "Drivers";
  });

  // Driver selected by clicking a name in Rankings / Circuits drill-downs.
  const [overrideDriver, setOverrideDriver] = useState<string | undefined>(undefined);
  // Pair pre-selected when jumping to Head-to-Head from the Drivers tab.
  const [h2hPair, setH2hPair] = useState<{ a: string; b: string } | null>(null);

  const handleSelectDriverFromRanking = useCallback(
    (driverName: string) => {
      setOverrideDriver(driverName);
      setTab("Drivers");
      const p = new URLSearchParams(searchParams.toString());
      p.set("tab", "Drivers");
      p.set("driver", driverName);
      router.replace(`${pathname}?${p.toString()}`, { scroll: false });
    },
    [pathname, router, searchParams],
  );

  const setTabWithUrl = useCallback(
    (next: Tab) => {
      setTab(next);
      if (next !== "Drivers") setOverrideDriver(undefined);
      const p = new URLSearchParams(searchParams.toString());
      p.set("tab", next);
      if (next !== "Drivers") p.delete("driver");
      router.replace(`${pathname}?${p.toString()}`, { scroll: false });
    },
    [pathname, router, searchParams],
  );

  const openHeadToHead = useCallback(
    (driverA?: string, driverB?: string) => {
      if (driverA && driverB) setH2hPair({ a: driverA, b: driverB });
      setTabWithUrl("Head-to-Head");
    },
    [setTabWithUrl],
  );

  const effectiveDriver = overrideDriver ?? initialDriver;

  return (
    <div className="space-y-8">
      <div className="flex justify-center">
        <TabBar tabs={TABS} active={tab} onChange={(t) => setTabWithUrl(t as Tab)} />
      </div>

      {tab === "Drivers" && (
        <DriversSection
          key={effectiveDriver ?? "default"}
          allTime={data.driversAllTime}
          bySeason={data.driversBySeason}
          raceResults={raceResults ?? {}}
          events={events ?? []}
          initialDriver={effectiveDriver}
          seasons={seasons}
          rewards={rewards}
          driverNamesHe={driverNamesHe}
          onOpenHeadToHead={openHeadToHead}
        />
      )}

      {tab === "League" && (
        <LeagueSection
          raceResults={raceResults ?? {}}
          events={events ?? []}
          seasons={seasons}
        />
      )}

      {tab === "Circuits" && (
        <CircuitsSection
          raceResults={raceResults ?? {}}
          events={events ?? []}
          seasons={seasons}
          driverNamesHe={driverNamesHe}
          onSelectDriver={handleSelectDriverFromRanking}
        />
      )}

      {tab === "Head-to-Head" && raceResults && events && (
        <H2HSection
          raceResults={raceResults}
          events={events}
          seasons={seasons}
          driverNamesHe={driverNamesHe}
          initialDriverA={h2hPair?.a ?? initialDa}
          initialDriverB={h2hPair?.b ?? initialDb}
        />
      )}
      {tab === "Head-to-Head" && (!raceResults || !events) && (
        <EmptyState message={t("empty.raceDataUnavailable")} />
      )}

      {tab === "Rankings" && (
        <RankingsSection
          allTime={data.driversAllTime}
          bySeason={data.driversBySeason}
          raceResults={raceResults}
          events={events}
          seasons={seasons}
          driverNamesHe={driverNamesHe}
          onSelectDriver={handleSelectDriverFromRanking}
        />
      )}
    </div>
  );
}
