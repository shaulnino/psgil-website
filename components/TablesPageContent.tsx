"use client";

import { Suspense, useMemo } from "react";
import { useTranslations, useLocale } from "next-intl";
import { useSearchParams } from "next/navigation";
import SeasonSelector from "@/components/SeasonSelector";
import StandingsSection from "@/components/StandingsSection";
import DriverLookupProvider, { useDriverLookup } from "@/components/DriverLookupProvider";
import { getAwardIcon } from "@/components/AchievementBadges";
import { localizedDriverName, type Driver, type Team } from "@/lib/driversData";
import { localizedTeamName, makeTeamNameLookup } from "@/lib/stats/teamIdentity";
import {
  filterBySeason,
  groupByBracket,
  getTableImage,
  type StandingsRow,
} from "@/lib/resultsData";
import {
  DEFAULT_AWARD_RANK,
  type Reward,
} from "@/lib/rewardsData";
import type { SeasonConfig } from "@/lib/seasonConfig";
import { getSeasonsForDropdown, seasonHasWild } from "@/lib/seasonConfig";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

type AllStandings = {
  driversMain: StandingsRow[];
  constructorsMain: StandingsRow[];
  driversWild: StandingsRow[];
  constructorsWild: StandingsRow[];
};

export type TablesPageContentProps = {
  seasonsConfig: SeasonConfig[];
  defaultSeasonKey: string;
  /** ALL standings (every season) – filtered on the client by season key. */
  allStandings: AllStandings;
  /** Driver card data for clickable driver names */
  drivers: Driver[];
  teams: Team[];
  rewards: Reward[];
  placeholderSrc: string;
};

/* ------------------------------------------------------------------ */
/*  Bracket label helper                                               */
/* ------------------------------------------------------------------ */

type Translator = (key: string) => string;

function bracketTitle(bracket: string, t: Translator): string {
  switch (bracket) {
    case "upper":
      return t("tablesContent.upperBracket");
    case "lower":
      return t("tablesContent.lowerBracket");
    default:
      return t("tablesContent.overall");
  }
}

function normalizeTeamName(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function canonicalTeamName(value: string): string {
  return normalizeTeamName(value)
    .replace(/\batlassian\b/g, "")
    .replace(/\bf1 team\b/g, "")
    .replace(/\bteam\b/g, "")
    .replace(/[^\w\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

const COMPETITION_LABEL_KEYS: Record<string, string> = {
  main: "tablesContent.mainLeague",
  lower: "tablesContent.lowerLeague",
  wild: "tablesContent.wildLeague",
  constructors: "tablesContent.constructors",
  community: "tablesContent.community",
};

/* ------------------------------------------------------------------ */
/*  Inner component (reads ?season= via useSearchParams)               */
/* ------------------------------------------------------------------ */

function TablesInner({
  seasonsConfig,
  defaultSeasonKey,
  allStandings,
  drivers,
  teams,
  rewards,
  placeholderSrc,
}: TablesPageContentProps) {
  const t = useTranslations("schedule");
  const locale = useLocale();
  const searchParams = useSearchParams();
  const selectedSeasonKey =
    searchParams.get("season") || defaultSeasonKey;

  const seasonConfig = seasonsConfig.find(
    (s) => s.season_key === selectedSeasonKey,
  );
  const seasonsList = getSeasonsForDropdown(seasonsConfig);

  /* ---------- Filter standings by selected season ---------- */
  const data = useMemo(() => {
    return {
      driversMain: filterBySeason(allStandings.driversMain, selectedSeasonKey),
      constructorsMain: filterBySeason(allStandings.constructorsMain, selectedSeasonKey),
      driversWild: filterBySeason(allStandings.driversWild, selectedSeasonKey),
      constructorsWild: filterBySeason(allStandings.constructorsWild, selectedSeasonKey),
    };
  }, [allStandings, selectedSeasonKey]);

  /* ---------- Config flags ---------- */
  const showWild = seasonConfig?.has_wild ?? false;
  const showConstructors = seasonConfig?.has_constructors ?? true;
  const hasPlayoffs =
    seasonConfig?.has_playoffs &&
    seasonConfig?.playoffs_mode === "upper_lower";
  const notes = seasonConfig?.notes ?? "";
  const seasonNumber = Number.parseInt(selectedSeasonKey.replace(/^S/i, ""), 10);

  /* ---------- Fallback images from config ---------- */
  const dMainImg =
    getTableImage(data.driversMain) ||
    (seasonConfig?.fallback_image_drivers_main ?? "");
  const cMainImg =
    getTableImage(data.constructorsMain) ||
    (seasonConfig?.fallback_image_constructors_main ?? "");
  const dWildImg =
    getTableImage(data.driversWild) ||
    (seasonConfig?.fallback_image_drivers_wild ?? "");
  const cWildImg =
    getTableImage(data.constructorsWild) ||
    (seasonConfig?.fallback_image_constructors_wild ?? "");

  const seasonRewards = useMemo(() => {
    if (!Number.isFinite(seasonNumber)) return [];
    return rewards
      .filter((r) => r.season_id === seasonNumber)
      .slice()
      .sort((a, b) => (a.rank ?? DEFAULT_AWARD_RANK[a.award_code] ?? 999) - (b.rank ?? DEFAULT_AWARD_RANK[b.award_code] ?? 999));
  }, [rewards, seasonNumber]);

  /* Does this season have anything to show (rows, fallback images, awards, notes)?
     When it doesn't, we render a single premium "Standings Locked" board instead
     of a stack of empty section placeholders. */
  const hasContent =
    data.driversMain.length > 0 ||
    data.constructorsMain.length > 0 ||
    data.driversWild.length > 0 ||
    data.constructorsWild.length > 0 ||
    !!dMainImg ||
    !!cMainImg ||
    !!dWildImg ||
    !!cWildImg ||
    seasonRewards.length > 0 ||
    !!notes;

  const driverNameById = useMemo(
    () => new Map(drivers.map((d) => [d.driver_id, localizedDriverName(d, locale)])),
    [drivers, locale],
  );
  const teamNameById = useMemo(() => {
    const lookup = makeTeamNameLookup(teams);
    return new Map(
      teams.map((t) => [t.team_key, localizedTeamName(t.team_key, locale, t.team_name, lookup)]),
    );
  }, [teams, locale]);
  const seasonDriversByTeamName = useMemo(() => {
    const map = new Map<string, string[]>();
    const allSeasonDriverRows = [...data.driversMain, ...data.driversWild];
    const append = (key: string, driverName: string) => {
      if (!key) return;
      const current = map.get(key) ?? [];
      if (!current.includes(driverName)) current.push(driverName);
      map.set(key, current);
    };

    for (const row of allSeasonDriverRows) {
      const teamNorm = normalizeTeamName(row.team);
      const teamCanonical = canonicalTeamName(row.team);
      if (!teamNorm || !row.driver_name) continue;
      append(teamNorm, row.driver_name);
      append(teamCanonical, row.driver_name);
    }
    return map;
  }, [data.driversMain, data.driversWild]);

  return (
    <DriverLookupProvider
      drivers={drivers}
      teams={teams}
      placeholderSrc={placeholderSrc}
      hasWild={seasonHasWild(seasonsConfig)}
    >
      {/* Title row + season selector */}
      <div className="mb-12 flex flex-wrap items-center justify-between gap-4">
        <div className="max-w-2xl">
          <h1 className="font-display text-4xl font-bold tracking-[0.005em] leading-[1.05] text-ink md:text-5xl">
            {t("tables.title")}
          </h1>
          <div className="isl-gold-rule mt-4 max-w-[220px]" />
          <p className="mt-4 text-base text-ink-2 md:text-lg">
            {t("tables.description")}
          </p>
        </div>
        <SeasonSelector
          seasons={seasonsList}
          selected={selectedSeasonKey}
        />
      </div>

      {!hasContent ? (
        <div className="relative isl-corner-ticks isl-speed-lines flex flex-col items-center justify-center gap-3 rounded-[2px] border border-[color:var(--isl-hairline-strong)] bg-cream px-6 py-20 text-center">
          <span className="inline-flex h-11 w-11 items-center justify-center rounded-[2px] border border-brass text-brass-ink">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
              <path fillRule="evenodd" d="M10 1a4.5 4.5 0 00-4.5 4.5V9H5a2 2 0 00-2 2v6a2 2 0 002 2h10a2 2 0 002-2v-6a2 2 0 00-2-2h-.5V5.5A4.5 4.5 0 0010 1zm3 8V5.5a3 3 0 10-6 0V9h6z" clipRule="evenodd" />
            </svg>
          </span>
          <h3 className="font-display text-2xl font-bold tracking-[0.005em] text-ink">
            {t("tablesContent.standingsLockedTitle")}
          </h3>
          <p className="max-w-md text-sm leading-relaxed text-meta">
            {t("tablesContent.standingsLockedBody")}
          </p>
        </div>
      ) : (
      <div className="flex flex-col gap-12">
        {/* ============ SEASON NOTES BANNER ============ */}
        {notes && (
          <div className="rounded-[2px] border border-[color:var(--isl-hairline)] border-s-2 border-s-oxblood bg-cream px-5 py-4">
            {notes.split("\n").map((line, i) => (
              <p
                key={i}
                className="text-sm font-medium leading-relaxed text-ink-2"
              >
                {line}
              </p>
            ))}
          </div>
        )}

        {/* ============ DRIVERS MAIN ============ */}
        <div id="drivers-standings" className="scroll-mt-24">
        {hasPlayoffs ? (
          /* Playoff bracket groups (e.g. S2/S3 upper / lower) */
          groupByBracket(data.driversMain).map(({ bracket, rows }) => (
            <StandingsSection
              key={bracket}
              title={t("tablesContent.driversMainBracketTitle", { bracket: bracketTitle(bracket, t) })}
              subtitle={
                bracket === "upper"
                  ? t("tablesContent.driversMainSubtitleUpper")
                  : bracket === "lower"
                    ? t("tablesContent.driversMainSubtitleLower")
                    : t("tablesContent.driversMainSubtitleOverall")
              }
              image={{
                src:
                  getTableImage(
                    data.driversMain,
                    undefined,
                    bracket,
                  ) ||
                  (seasonConfig?.fallback_image_drivers_main ?? ""),
                alt: t("tablesContent.driversMainBracketTitle", { bracket: bracketTitle(bracket, t) }),
              }}
              standingsData={rows}
              type="drivers"
            />
          ))
        ) : (
          <StandingsSection
            title={t("tablesContent.driversMainTitle")}
            subtitle={t("tablesContent.driversMainSubtitle")}
            image={{
              src: dMainImg,
              alt: t("tablesContent.driversMainImageAlt"),
            }}
            standingsData={data.driversMain}
            type="drivers"
          />
        )}
        </div>

        {/* ============ CONSTRUCTORS MAIN ============ */}
        {showConstructors && (
          <div id="constructors-standings" className="scroll-mt-24">
            <StandingsSection
              title={t("tablesContent.constructorsMainTitle")}
              subtitle={t("tablesContent.constructorsMainSubtitle")}
              image={{
                src: cMainImg,
                alt: t("tablesContent.constructorsMainImageAlt"),
              }}
              standingsData={data.constructorsMain}
              type="constructors"
            />
          </div>
        )}

        {/* ============ WILD ============ */}
        {showWild && (
          <>
            <StandingsSection
              title={t("tablesContent.driversWildTitle")}
              subtitle={t("tablesContent.driversWildSubtitle")}
              image={{
                src: dWildImg,
                alt: t("tablesContent.driversWildImageAlt"),
              }}
              standingsData={data.driversWild}
              type="drivers"
            />
            {showConstructors && (
              <StandingsSection
                title={t("tablesContent.constructorsWildTitle")}
                subtitle={t("tablesContent.constructorsWildSubtitle")}
                image={{
                  src: cWildImg,
                  alt: t("tablesContent.constructorsWildImageAlt"),
                }}
                standingsData={data.constructorsWild}
                type="constructors"
              />
            )}
          </>
        )}

        {/* ============ SEASON REWARDS ============ */}
        {seasonRewards.length > 0 && (
          <div className="rounded-[2px] border border-[color:var(--isl-hairline)] bg-paper p-5">
            <h3 className="font-display text-2xl font-bold tracking-[0.005em] leading-[1.05] text-ink">
              {t("tablesContent.seasonAwardsPrefix")} <span className="num">{seasonNumber}</span> {t("tablesContent.seasonAwards")}
            </h3>
            <div className="mt-4 space-y-4">
              {["main", "lower", "wild", "constructors", "community"].map((competition) => {
                const rows = seasonRewards.filter((reward) => reward.competition === competition);
                if (rows.length === 0) return null;

                return (
                  <div key={competition}>
                    <p className="mb-2 font-isl-body text-[0.75rem] font-semibold uppercase tracking-[0.2em] text-brass-ink">
                      {t(COMPETITION_LABEL_KEYS[competition])}
                    </p>
                    <div className="overflow-hidden rounded-[2px] border border-[color:var(--isl-hairline)]">
                      {rows.map((reward, idx) => {
                        const winner =
                          reward.recipient_type === "driver"
                            ? driverNameById.get(reward.recipient_id) || reward.recipient_id
                            : teamNameById.get(reward.recipient_id) || reward.recipient_id;
                        const teamDrivers =
                          reward.recipient_type === "team"
                            ? seasonDriversByTeamName.get(normalizeTeamName(winner)) ??
                              seasonDriversByTeamName.get(canonicalTeamName(winner)) ??
                              []
                            : [];
                        const teamDriversLabel =
                          teamDrivers.length > 0 ? teamDrivers.join(", ") : "";

                        return (
                          <RewardRow
                            key={`${reward.season_id}-${reward.award_code}-${reward.recipient_id}-${idx}`}
                            reward={reward}
                            winner={winner}
                            isDriver={reward.recipient_type === "driver"}
                            teamDriversLabel={teamDriversLabel}
                            isLast={idx === rows.length - 1}
                          />
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
      )}
    </DriverLookupProvider>
  );
}

function RewardRow({
  reward,
  winner,
  isDriver,
  teamDriversLabel,
  isLast,
}: {
  reward: Reward;
  winner: string;
  isDriver: boolean;
  teamDriversLabel?: string;
  isLast: boolean;
}) {
  const { openDriverModal } = useDriverLookup();
  const tr = useTranslations("rewards");
  const label = reward.award_label || tr(`awards.${reward.award_code}.label`);
  const tooltip = reward.tooltip || tr(`awards.${reward.award_code}.tooltip`);
  const onClickWinner = () => {
    if (!isDriver) return;
    openDriverModal(reward.recipient_id);
  };

  return (
    <div className={`flex items-center gap-3 bg-paper px-4 py-3 ${!isLast ? "border-b border-[color:var(--isl-hairline)]" : ""}`}>
      <span className="inline-flex h-8 w-8 items-center justify-center rounded-[2px] border border-brass bg-cream">
        {getAwardIcon(reward.award_code, 18, reward.competition)}
      </span>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-semibold text-ink">{label}</div>
        <div className="text-xs text-meta">{tooltip}</div>
      </div>
      {isDriver ? (
        <button
          type="button"
          onClick={onClickWinner}
          className="text-sm font-semibold text-brass-ink transition-colors hover:text-oxblood-deep"
        >
          {winner}
        </button>
      ) : (
        <span className="text-end">
          <span className="block text-sm font-semibold text-brass-ink">{winner}</span>
          {teamDriversLabel ? (
            <span className="block text-xs text-meta">{teamDriversLabel}</span>
          ) : null}
        </span>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Exported wrapper (Suspense required for useSearchParams)            */
/* ------------------------------------------------------------------ */

function TablesFallback() {
  const t = useTranslations("schedule");
  return (
    <div className="flex items-center justify-center py-24">
      <p className="text-sm text-meta">{t("tablesContent.loading")}</p>
    </div>
  );
}

export default function TablesPageContent(props: TablesPageContentProps) {
  return (
    <Suspense fallback={<TablesFallback />}>
      <TablesInner {...props} />
    </Suspense>
  );
}
