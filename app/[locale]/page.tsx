export const dynamic = "force-dynamic";

import { getLocale, getTranslations } from "next-intl/server";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import HomeRaceCards from "@/components/HomeRaceCards";
import WatchLastRaceButton from "@/components/WatchLastRaceButton";
import Section from "@/components/Section";
import SnapshotStrip from "@/components/SnapshotStrip";
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
} from "@/lib/scheduleData";
import type { RaceGroup, RaceEvent } from "@/lib/scheduleData";
import { fetchAllRaceResults, fetchStandings } from "@/lib/resultsData";
import {
  mapDrivers,
  mapTeams,
  applyLeagueStandings,
  leagueStandingsFromTables,
  mergeComputedRatings,
  computeAllScopeRanks,
} from "@/lib/driversData";
import { computeDriverRatings, computeHomePageSnapshot } from "@/lib/statsComputed";
import { attachRewardsToDrivers, fetchRewards } from "@/lib/rewardsData";
import { fetchLatestArticles, formatNewsDate } from "@/lib/newsData";
import { getYouTubeVideoId } from "@/lib/youtube";
import {
  fetchSeasonsConfig,
  resolveCurrentSeason,
  resolveTemplate,
  matchesSeason,
  GLOBAL_CSV_URLS,
} from "@/lib/seasonConfig";

const newsFallbackImage = "/isl-banner.png";

function isRemote(src?: string) {
  return !!src && src.startsWith("http");
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
  const [scheduleCsv, raceResultsByEvent, driversCsv, teamsCsv, mainStandings, wildStandings, rewards, latestNews] =
    await Promise.all([
      fetchCsv(GLOBAL_CSV_URLS.schedule).catch(() => ""),
      fetchAllRaceResults(GLOBAL_CSV_URLS.raceResults),
      fetchCsv(GLOBAL_CSV_URLS.drivers).catch(() => ""),
      fetchCsv(GLOBAL_CSV_URLS.teams).catch(() => ""),
      fetchStandings(GLOBAL_CSV_URLS.driversStandingsMain),
      fetchStandings(GLOBAL_CSV_URLS.driversStandingsWild),
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

  /* ---- Resolve template tokens in siteConfig values ---- */
  const trustChips = (tHome.raw("trustChips") as string[]).map(t);
  const snapshotStats = siteConfig.snapshotStats.map((stat) => ({
    label: tHome(`snapshotStats.${stat.id}`),
    value: t(stat.value),
  }));
  const featuredNews = latestNews[0] ?? null;

  return (
    <main className="bg-bone text-ink-2">
      {/* ── Hero: editorial masthead — framed (desaturated) race image + ink headline on bone ── */}
      <section className="isl-speed-lines border-b border-[color:var(--isl-hairline)]">
        <div className="mx-auto w-full max-w-[1240px] px-5 pb-8 pt-10">
          <div className="relative w-full overflow-hidden rounded-[2px] border border-[color:var(--isl-hairline)] bg-ink">
            <Image
              src="/hero-new-era.png"
              alt={tHome("hero.imageAlt")}
              width={1264}
              height={848}
              priority
              sizes="(max-width: 1240px) 100vw, 1240px"
              className="h-auto w-full"
            />
          </div>

          <div className="mt-8 max-w-3xl">
            <h1 className="sr-only">{tHome("hero.title")}</h1>
            <p className="max-w-xl text-lg text-ink-2 md:text-xl">
              {tHome("hero.subtitle")}
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button href="#contact-us">{tHome("hero.joinNow")}</Button>
              <WatchLastRaceButton
                links={lastRaceYoutubeLinks}
                label={tHome("hero.watchLastRace")}
              />
            </div>
            <div className="mt-6 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] leading-relaxed">
              <span className="me-1 font-isl-body font-semibold uppercase tracking-[0.18em] text-brass-ink">
                {tHome("hero.keyFacts")}
              </span>
              {trustChips.map((chip, i) => (
                <span key={chip} className="inline-flex items-center gap-2 select-none">
                  {i > 0 && (
                    <span className="h-[3px] w-[3px] shrink-0 rounded-full bg-oxblood/60" />
                  )}
                  <span className="font-medium text-ink-2">{chip}</span>
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>

      <div className="mx-auto mt-4 flex w-full max-w-[1240px] items-center gap-3 px-5">
        <span className="font-isl-body text-xs font-semibold uppercase tracking-[0.2em] text-meta">{tHome("hero.followUs")}</span>
        <SocialLinks items={siteConfig.socials} variant="compact" />
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
            <div className="overflow-hidden rounded-[2px] border border-[color:var(--isl-hairline)] bg-cream">
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
                    <span className="num text-[11px] font-semibold uppercase tracking-[0.13em] text-meta">
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

      <Section
        title={tHome("leagueFormat.title")}
        description={tHome("leagueFormat.description")}
        brandTitle
      >
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {(tHome.raw("leagueFormatItems") as { title: string; description: string }[]).map((item) => (
            <div
              key={item.title}
              className="rounded-[2px] border border-[color:var(--isl-hairline)] bg-cream p-5 text-sm text-ink-2"
            >
              <h3 className="font-display text-lg font-bold tracking-[0.005em] text-ink">
                {item.title}
              </h3>
              <p className="mt-2 text-ink-2">{item.description}</p>
            </div>
          ))}
        </div>
      </Section>

      <Section
        title={tHome("races.title")}
        description={tHome("races.description")}
        brandTitle
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
        />
      </Section>

      <Section
        title={tHome("latestNews.title")}
        description={tHome("latestNews.description")}
        brandTitle
        headerRight={
          <Button href="/news" size="sm" variant="secondary">
            {tHome("latestNews.allNews")}
          </Button>
        }
      >
        <NewsCarousel articles={latestNews} />
      </Section>

      <Section title={tHome("about.title")} brandTitle>
        <div className="rounded-[2px] border border-[color:var(--isl-hairline)] bg-cream p-6 md:p-8">
          <p className="text-base text-ink-2 md:text-lg">
            {tHome("about.body", { season: currentSeasonLabel.toLowerCase() })}
          </p>
        </div>
      </Section>



      <Section
        id="contact-us"
        title={tHome("contact.title")}
        description={tHome("contact.description")}
        brandTitle
      >
        <ContactSection />
      </Section>
    </main>
  );
}
