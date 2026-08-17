export const dynamic = "force-dynamic";

import { getLocale, getTranslations } from "next-intl/server";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import HomeHero from "@/components/home/HomeHero";
import HomeRaceCards from "@/components/HomeRaceCards";
import Section from "@/components/Section";
import SnapshotStrip from "@/components/SnapshotStrip";
import StandingsPreview, { type StandingsPreviewRow } from "@/components/StandingsPreview";
import SocialLinks from "@/components/SocialLinks";
import ContactSection from "@/components/ContactSection";
import NewsCarousel from "@/components/NewsCarousel";
import LoadingLink from "@/components/LoadingLink";
import { siteConfig } from "@/lib/siteConfig";
import { fetchCsv, parseCsv } from "@/lib/csv";
import {
  mapRaceEvents,
  getLastRaceGroup,
  getNextRaceGroup,
  getLiveRaceGroup,
  groupTimestamp,
  groupEndTimestamp,
  toIsraelTimestamp,
  localizedRaceName,
  localizedTrack,
  youtubeWatchLinksForGroup,
} from "@/lib/scheduleData";
import type { RaceGroup, RaceEvent } from "@/lib/scheduleData";
import { fetchAllRaceResults, fetchStandings, filterBySeason } from "@/lib/resultsData";
import type { StandingsRow } from "@/lib/resultsData";
import {
  mapDrivers,
  mapTeams,
  applyLeagueStandings,
  leagueStandingsFromTables,
  mergeComputedRatings,
  computeAllScopeRanks,
  getTeamLogo,
  localizedDriverName,
} from "@/lib/driversData";
import type { Driver, Team } from "@/lib/driversData";
import {
  resolveTeamKey as resolveTeamKeyFromText,
  localizedTeamName,
  makeTeamNameLookup,
} from "@/lib/stats/teamIdentity";
import { computeDriverRatings, computeHomePageSnapshot } from "@/lib/statsComputed";
import { attachRewardsToDrivers, fetchRewards } from "@/lib/rewardsData";
import { applyUploadedDriverPhotos } from "@/lib/drivers/photoOverride";
import { fetchLatestArticles, formatNewsDate } from "@/lib/newsData";
import { getYouTubeVideoId } from "@/lib/youtube";
import {
  fetchSeasonsConfig,
  resolveCurrentSeason,
  resolveTemplate,
  seasonHasWild,
  matchesSeason,
  GLOBAL_CSV_URLS,
} from "@/lib/seasonConfig";

const newsFallbackImage = "/isl-banner.png";

// Fixed cinematic hero image (a real photo, not a per-race poster) — cropping it
// never loses race info, and it doesn't need clean art maintained per event.
// Swap this file/path to change the hero backdrop.
const HERO_IMAGE = "/hero-lineup.png";

function isRemote(src?: string) {
  return !!src && src.startsWith("http");
}

/** Normalise a team name for logo lookup (lowercase, collapsed whitespace). */
function normalizeTeamName(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

/** Sort standings rows by numeric position (blanks last). */
function byPosition(a: StandingsRow, b: StandingsRow): number {
  return (parseInt(a.position, 10) || 9999) - (parseInt(b.position, 10) || 9999);
}

/**
 * Build the top-5 preview rows for the homepage from the SAME computed standings
 * CSVs used by the full /statistics page — no separate data, no re-ordering, no
 * hardcoding. Ties/penalties/DNFs/reserves are already baked into the CSV order.
 */
function buildStandingsPreview(
  driversMain: StandingsRow[],
  constructorsMain: StandingsRow[],
  seasonKey: string,
  hasConstructors: boolean,
  drivers: Driver[],
  teams: Team[],
  locale: string,
): {
  driversPreviewRows: StandingsPreviewRow[];
  constructorsPreviewRows: StandingsPreviewRow[];
} {
  // driver_id → team_key (for driver-row logos) and localized display name
  const teamKeyByDriverId = new Map(drivers.map((d) => [d.driver_id, d.team_key]));
  const nameByDriverId = new Map(
    drivers.map((d) => [d.driver_id, localizedDriverName(d, locale)]),
  );
  // normalized team name → team_key (for constructor-row logos)
  const teamKeyByName = new Map(
    teams.map((t) => [normalizeTeamName(t.team_name), t.team_key]),
  );
  // Sheet-sourced display names (team_name / team_name_he), code map as fallback.
  const teamNames = makeTeamNameLookup(teams);

  // Prefer the explicit team_id from the standings CSV, then fall back to
  // driver→team, fuzzy full-name matching against the teams CSV, and finally
  // the canonical short-name/sponsor resolver (constructors rows carry short
  // names like "McLaren" that don't match the teams CSV's full names).
  const resolveTeamKey = (row: StandingsRow): string =>
    row.team_key ||
    teamKeyByDriverId.get(row.driver_id) ||
    teamKeyByName.get(normalizeTeamName(row.team)) ||
    resolveTeamKeyFromText(row.team) ||
    "";

  // Drivers main: exclude the lower playoff bracket (when present) so the preview
  // reflects the primary championship, then sort by position and take the top 5.
  const driversPreviewRows: StandingsPreviewRow[] = filterBySeason(driversMain, seasonKey)
    .filter((r) => r.bracket !== "lower")
    .sort(byPosition)
    .slice(0, 5)
    .map((row) => {
      const teamKey = resolveTeamKey(row);
      return {
        position: row.position,
        name: nameByDriverId.get(row.driver_id) || row.driver_name,
        points: row.points,
        logo: getTeamLogo(teamKey),
        teamName: localizedTeamName(teamKey, locale, row.team, teamNames),
      };
    });

  const constructorsPreviewRows: StandingsPreviewRow[] = hasConstructors
    ? filterBySeason(constructorsMain, seasonKey)
        .sort(byPosition)
        .slice(0, 5)
        .map((row) => {
          const teamKey = resolveTeamKey(row);
          return {
            position: row.position,
            name: localizedTeamName(teamKey, locale, row.team, teamNames),
            points: row.points,
            logo: getTeamLogo(teamKey),
            teamName: localizedTeamName(teamKey, locale, row.team, teamNames),
          };
        })
    : [];

  return { driversPreviewRows, constructorsPreviewRows };
}

export default async function Home() {
  const tHome = await getTranslations("home");
  const locale = await getLocale();

  /* ---- Seasons config ---- */
  const seasonsConfig = await fetchSeasonsConfig();
  const currentSeason = resolveCurrentSeason(seasonsConfig);
  const currentSeasonLabel = currentSeason.season_label;
  const seasonCount = seasonsConfig.length;

  /* ---- Template resolver (extras filled after parallel fetch below) ---- */
  let templateExtras: Record<string, string | number> = {};
  const t = (text: string) =>
    resolveTemplate(text, currentSeasonLabel, seasonCount, templateExtras);

  /* ---- Fetch schedule + race results + drivers/teams + standings in parallel ---- */
  const [scheduleCsv, raceResultsByEvent, driversCsv, teamsCsv, mainStandings, wildStandings, constructorsMainStandings, rewards, latestNews] =
    await Promise.all([
      fetchCsv(GLOBAL_CSV_URLS.schedule).catch(() => ""),
      fetchAllRaceResults(GLOBAL_CSV_URLS.raceResults),
      fetchCsv(GLOBAL_CSV_URLS.drivers).catch(() => ""),
      fetchCsv(GLOBAL_CSV_URLS.teams).catch(() => ""),
      fetchStandings(GLOBAL_CSV_URLS.driversStandingsMain),
      fetchStandings(GLOBAL_CSV_URLS.driversStandingsWild),
      fetchStandings(GLOBAL_CSV_URLS.constructorsStandingsMain),
      fetchRewards(GLOBAL_CSV_URLS.rewards),
      fetchLatestArticles(3, locale),
    ]);

  const allResultsFlat = Object.values(raceResultsByEvent).flat();
  const allEventsGlob = scheduleCsv
    ? mapRaceEvents(parseCsv<Record<string, string>>(scheduleCsv))
    : [];
  const homeSnapshot =
    allResultsFlat.length > 0 && allEventsGlob.length > 0
      ? computeHomePageSnapshot(allResultsFlat, allEventsGlob)
      : { totalRaces: "0", totalDrivers: "0", uniqueWinners: 0 };

  templateExtras = {
    uniqueWinners: homeSnapshot.uniqueWinners,
    totalRaces: homeSnapshot.totalRaces,
    totalDrivers: homeSnapshot.totalDrivers,
  };

  let lastGroup: RaceGroup | null = null;
  let nextGroup: RaceGroup | null = null;
  let liveGroup: RaceGroup | null = null;
  let seasonEvents: RaceEvent[] = [];
  try {
    if (allEventsGlob.length > 0) {
      // Filter to current season only
      const events = allEventsGlob.filter((e) =>
        matchesSeason(e.season, currentSeason.season_key),
      );
      seasonEvents = events;
      lastGroup = getLastRaceGroup(events);
      nextGroup = getNextRaceGroup(events);
      liveGroup = getLiveRaceGroup(events);
    }
  } catch {
    // CSV not available — cards will show fallback
  }

  let allDrivers = driversCsv
    ? mapDrivers(parseCsv<Record<string, string>>(driversCsv))
    : [];
  // Override CSV photo_url with account-uploaded driver photos (PW-2e) so the
  // shared driver modal opened from the home race cards shows it too.
  allDrivers = await applyUploadedDriverPhotos(allDrivers);

  // Derive league ranks from the computed standings tables (current season only)
  allDrivers = applyLeagueStandings(
    allDrivers,
    leagueStandingsFromTables(mainStandings, wildStandings, currentSeason.season_key),
  );
  allDrivers = attachRewardsToDrivers(allDrivers, rewards);

  // Merge live-computed all-time ratings (home page only needs all-time)
  try {
    if (allResultsFlat.length > 0 && allEventsGlob.length > 0) {
      const allTimeRatings = computeDriverRatings(allResultsFlat, allEventsGlob);
      allDrivers = mergeComputedRatings(allDrivers, allTimeRatings, "alltime");
    }
    allDrivers = computeAllScopeRanks(allDrivers);
  } catch {
    // Rating merge is non-critical; drivers still display without computed ratings
  }

  const allTeams = teamsCsv
    ? mapTeams(parseCsv<Record<string, string>>(teamsCsv))
    : [];

  /* ---- Championship Standings Preview (current season, main league, top 5) ---- */
  const { driversPreviewRows, constructorsPreviewRows } = buildStandingsPreview(
    mainStandings,
    constructorsMainStandings,
    currentSeason.season_key,
    currentSeason.has_constructors,
    allDrivers,
    allTeams,
    locale,
  );

  // Strip non-serialisable _dateObj before sending to client component
  const stripDate = (g: RaceGroup | null) =>
    g
      ? {
          events: g.events,
          date: g.date,
          league: g.league,
          season: g.season,
        }
      : null;
  const lastGroupSafe = stripDate(lastGroup);
  const nextGroupSafe = stripDate(nextGroup);
  const liveGroupSafe = liveGroup
    ? {
        ...stripDate(liveGroup)!,
        startTimestamp: groupTimestamp(liveGroup),
        endTimestamp: groupEndTimestamp(liveGroup),
      }
    : null;
  // Also attach timestamps to nextGroup for client-side live transition
  const nextGroupTimestamps = nextGroup
    ? {
        startTimestamp: groupTimestamp(nextGroup),
        endTimestamp: groupEndTimestamp(nextGroup),
      }
    : null;

  // Compute unique YouTube links for the "Watch Last Race" hero button
  const lastRaceYoutubeLinks: { label: string; url: string }[] = [];
  if (lastGroup) {
    const seen = new Set<string>();
    for (const e of lastGroup.events) {
      const youtubeUrl = (e.youtube_url ?? "").trim();
      const hasValidYoutube = !!getYouTubeVideoId(youtubeUrl);
      if (hasValidYoutube && !seen.has(youtubeUrl)) {
        seen.add(youtubeUrl);
        lastRaceYoutubeLinks.push({
          label: `Watch Race #${e.race_number} – ${localizedRaceName(e, locale)}`,
          url: youtubeUrl,
        });
      }
    }
    // If all races share the same URL, simplify the label
    if (lastRaceYoutubeLinks.length === 1) {
      lastRaceYoutubeLinks[0].label = tHome("hero.watchLastRace");
    }
  }

  // Fallback for the hero button:
  // if the latest race group has no valid YouTube URL, use the newest
  // available URL from this season so "Watch Last Race" still works.
  if (lastRaceYoutubeLinks.length === 0 && seasonEvents.length > 0) {
    const completedEvents = seasonEvents.filter(
      (e) => e.status.toLowerCase() === "completed",
    );
    const pool = completedEvents.length > 0 ? completedEvents : seasonEvents;

    const latestWithYoutube = [...pool]
      .sort((a, b) => {
        const aTs = toIsraelTimestamp(a.date, a.start_time) ?? 0;
        const bTs = toIsraelTimestamp(b.date, b.start_time) ?? 0;
        if (bTs !== aTs) return bTs - aTs;
        const aRace = parseInt(a.race_number, 10) || 0;
        const bRace = parseInt(b.race_number, 10) || 0;
        return bRace - aRace;
      })
      .find((e) => !!getYouTubeVideoId((e.youtube_url ?? "").trim()));

    if (latestWithYoutube) {
      lastRaceYoutubeLinks.push({
        label: tHome("hero.watchLastRace"),
        url: (latestWithYoutube.youtube_url ?? "").trim(),
      });
    }
  }

  /* ---- Hero state (league-first, state-aware): live → upcoming → replay → default ---- */
  const heroLiveLinks = liveGroup ? youtubeWatchLinksForGroup(liveGroup) : [];
  const heroHasReplay = lastRaceYoutubeLinks.length > 0;
  const heroState: "live" | "upcoming" | "replay" | "default" = liveGroup
    ? "live"
    : nextGroup
      ? "upcoming"
      : heroHasReplay
        ? "replay"
        : "default";

  const heroStateGroup =
    heroState === "live"
      ? liveGroup
      : heroState === "upcoming"
        ? nextGroup
        : heroState === "replay"
          ? lastGroup
          : null;

  // Race meta overlaid on the hero image (crop-safe + accessible).
  const heroRace = heroStateGroup
    ? (() => {
        const ev = heroStateGroup.events.find((e) => !!e.poster_image) ?? heroStateGroup.events[0];
        const time = heroStateGroup.events
          .map((e) => e.start_time)
          .filter((tm): tm is string => !!tm)
          .sort()[0];
        return {
          name: localizedRaceName(ev, locale),
          date: heroStateGroup.date,
          time,
          track: localizedTrack(ev, locale),
          countryCode: ev.country_code,
        };
      })()
    : null;

  const heroWatchLinks =
    heroState === "live" ? heroLiveLinks : heroState === "replay" ? lastRaceYoutubeLinks : [];

  // League attributes: 3 static (localized) + a data-driven season race count.
  const heroAttributes = [...(tHome.raw("hero.attributes") as string[])];
  const heroRaceCount =
    seasonEvents.filter((e) => e.league.toLowerCase() === "main").length || seasonEvents.length;
  if (heroRaceCount > 0) {
    heroAttributes.push(tHome("hero.raceCountAttr", { count: heroRaceCount }));
  }

  /* ---- Resolve template tokens in siteConfig values ---- */
  const snapshotStats = siteConfig.snapshotStats.map((stat) => ({
    label: tHome(`snapshotStats.${stat.id}`),
    value: t(stat.value),
    hint: tHome(`snapshotHints.${stat.id}`),
  }));
  const featuredNews = latestNews[0] ?? null;

  return (
    <main className="text-ink-2">
      {/* ── Unified league-first hero — see components/home/HomeHero.tsx ── */}
      <HomeHero
        state={heroState}
        seasonLabel={currentSeasonLabel}
        image={HERO_IMAGE}
        imageIsRemote={isRemote(HERO_IMAGE)}
        race={heroRace}
        watchLinks={heroWatchLinks}
        attributes={heroAttributes}
      />

      <div className="mx-auto mt-4 flex w-full max-w-[1240px] items-center gap-3 px-5">
        {siteConfig.socials.length > 0 && (
          <>
            <span className="font-isl-body text-xs font-semibold uppercase tracking-[0.2em] text-meta">{tHome("hero.followUs")}</span>
            <SocialLinks items={siteConfig.socials} variant="compact" />
          </>
        )}
        <a
          href="#contact-us"
          className="group/social relative inline-flex h-9 w-9 items-center justify-center rounded-[2px] border border-[color:var(--isl-hairline)] text-meta transition-colors hover:border-ink hover:text-ink"
          aria-label={tHome("hero.contactUs")}
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-[18px] w-[18px]">
            <path d="M3 4a2 2 0 00-2 2v1.161l8.441 4.221a1.25 1.25 0 001.118 0L19 7.162V6a2 2 0 00-2-2H3z" />
            <path d="M19 8.839l-7.77 3.885a2.75 2.75 0 01-2.46 0L1 8.839V14a2 2 0 002 2h14a2 2 0 002-2V8.839z" />
          </svg>
          <span className="pointer-events-none absolute -top-9 left-1/2 z-50 -translate-x-1/2 whitespace-nowrap rounded-[2px] bg-ink px-2.5 py-1 text-[11px] font-medium text-bone opacity-0 transition-opacity group-hover/social:opacity-100" role="tooltip">
            {tHome("hero.contactUs")}
          </span>
        </a>
      </div>

      {featuredNews && (
        <section className="py-4">
          <div className="mx-auto w-full max-w-6xl px-6">
            <div className="relative isl-corner-ticks overflow-hidden rounded-[2px] border border-t-2 border-[color:var(--isl-hairline)] border-t-oxblood bg-cream">
              <div className="grid gap-0 md:grid-cols-[240px_1fr]">
                <LoadingLink
                  href={`/news/${encodeURIComponent(featuredNews.slug)}`}
                  className="group relative block h-44 border-b border-[color:var(--isl-hairline)] md:h-full md:border-b-0 md:border-e"
                >
                  <Image
                    src={featuredNews.coverImageUrl || newsFallbackImage}
                    alt={featuredNews.title}
                    fill
                    className="object-cover transition duration-300 group-hover:scale-[1.02]"
                    sizes="(max-width: 768px) 100vw, 240px"
                    unoptimized={isRemote(featuredNews.coverImageUrl)}
                  />
                  <span className="absolute start-3 top-3 inline-flex items-center rounded-[2px] border border-brass bg-bone/85 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-brass-ink">
                    {tHome("featured.featuredStory")}
                  </span>
                </LoadingLink>

                <div className="p-4 md:p-5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center rounded-[2px] border border-oxblood px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-oxblood">
                      {tHome("featured.newsFlash")}
                    </span>
                    <span className="num-date text-[11px] font-semibold uppercase tracking-[0.13em] text-meta">
                      {formatNewsDate(featuredNews.date, locale)}
                    </span>
                  </div>

                  <LoadingLink
                    href={`/news/${encodeURIComponent(featuredNews.slug)}`}
                    className="mt-3 block font-display text-base font-bold leading-[1.1] tracking-[0.005em] text-ink transition-colors hover:text-oxblood md:text-xl"
                  >
                    <span className="line-clamp-2">{featuredNews.title}</span>
                  </LoadingLink>

                  <p className="mt-2 line-clamp-2 text-sm text-ink-2 md:text-[15px]">
                    {featuredNews.excerpt}
                  </p>

                  <div className="mt-4 flex items-center gap-2">
                    <Button href={`/news/${encodeURIComponent(featuredNews.slug)}`} size="sm">
                      {tHome("featured.read")}
                    </Button>
                    <Button href="/news" size="sm" variant="secondary">
                      {tHome("featured.allNews")}
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      <SnapshotStrip stats={snapshotStats} />

      {driversPreviewRows.length > 0 && (
        <Section
          title={tHome("standingsPreview.title")}
          description={tHome("standingsPreview.description")}
          brandTitle
          index="01" compact
          headerRight={
            <Button href="/statistics" size="sm" variant="secondary">
              {tHome("standingsPreview.viewFull")}
            </Button>
          }
        >
          <StandingsPreview
            drivers={driversPreviewRows}
            constructors={constructorsPreviewRows}
          />
        </Section>
      )}

      <Section
        title={tHome("leagueFormat.title")}
        description={tHome("leagueFormat.description")}
        brandTitle
        index="02" compact
      >
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {(tHome.raw("leagueFormatItems") as { title: string; description: string }[]).map((item, i) => (
            <div
              key={item.title}
              className="group isl-chamfer bg-hairline-strong p-px transition-colors hover:bg-oxblood"
            >
              <div className="isl-chamfer flex h-full flex-col bg-cream p-5">
                <div className="flex items-center justify-between">
                  <span className="num text-sm font-semibold text-oxblood">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span className="h-px w-8 bg-[color:var(--isl-hairline-strong)] transition-colors group-hover:bg-oxblood" />
                </div>
                <h3 className="mt-3 font-display text-lg font-bold tracking-[0.005em] text-ink">
                  {item.title}
                </h3>
                <p className="mt-2 text-sm text-ink-2">{item.description}</p>
              </div>
            </div>
          ))}
        </div>
      </Section>

      <Section
        id="races"
        title={tHome("races.title")}
        description={tHome("races.description")}
        brandTitle
        index="03" compact
        headerRight={
          <Button href="/schedule" size="sm" variant="secondary">
            {tHome("races.fullSchedule")}
          </Button>
        }
      >
        <HomeRaceCards
          lastGroup={lastGroupSafe}
          nextGroup={nextGroupSafe}
          liveGroup={liveGroupSafe}
          nextGroupTimestamps={nextGroupTimestamps}
          raceResultsByEvent={raceResultsByEvent}
          allDrivers={allDrivers}
          allTeams={allTeams}
          hasWild={seasonHasWild(seasonsConfig)}
        />
      </Section>

      <Section
        title={tHome("latestNews.title")}
        description={tHome("latestNews.description")}
        brandTitle
        index="04" compact
        headerRight={
          <Button href="/news" size="sm" variant="secondary">
            {tHome("latestNews.allNews")}
          </Button>
        }
      >
        <NewsCarousel articles={latestNews} />
      </Section>

      <Section title={tHome("about.title")} brandTitle index="05" compact>
        <Card chamfer cornerTicks className="p-6 md:p-8">
          <div className="isl-gold-rule mb-5 max-w-[120px]" />
          <p className="text-base leading-relaxed text-ink-2 md:text-lg">
            {tHome("about.body", { season: currentSeasonLabel.toLowerCase() })}
          </p>
        </Card>
      </Section>



      <Section
        id="contact-us"
        title={tHome("contact.title")}
        description={tHome("contact.description")}
        brandTitle
        index="06" compact
      >
        <ContactSection />
      </Section>
    </main>
  );
}
