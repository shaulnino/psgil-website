export const dynamic = "force-dynamic";

import { getLocale, getTranslations } from "next-intl/server";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
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
  const tCommon = await getTranslations("common");
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
    <main className="text-ink-2">
      {/* ── Hero: "League Command Center" — broadcast-framed race image + ink headline on charcoal ── */}
      <section className="relative isl-speed-lines overflow-hidden border-b border-[color:var(--isl-hairline)]">
        <div className="mx-auto w-full max-w-[1240px] px-5 pb-10 pt-6">
          {/* Race-control status strip */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[color:var(--isl-hairline)] pb-4">
            <span className="inline-flex items-center gap-2 font-isl-body text-[0.7rem] font-semibold uppercase tracking-[0.22em] text-oxblood">
              <span
                className="h-1.5 w-1.5 rounded-full bg-oxblood"
                style={{ animation: "f1-tick 1.6s steps(1) infinite" }}
              />
              {tCommon("leagueFullName")}
            </span>
            <span className="num text-[0.7rem] uppercase tracking-[0.2em] text-meta">
              {currentSeasonLabel} · GMT+3
            </span>
          </div>

          {/* Broadcast-framed hero image */}
          <div className="isl-corner-ticks relative mt-6 w-full overflow-hidden rounded-[2px] border border-brass bg-ink">
            <Image
              src="/hero-new-era.png"
              alt={tHome("hero.imageAlt")}
              width={1264}
              height={848}
              priority
              sizes="(max-width: 1240px) 100vw, 1240px"
              className="h-auto w-full"
            />
            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-[color:var(--isl-bone)] to-transparent" />
          </div>

          <div className="mt-8 max-w-5xl">
            <p className="font-isl-body text-[0.75rem] font-semibold uppercase tracking-[0.24em] text-brass-ink">
              {tHome("hero.keyFacts")}
            </p>
            <h1 className="mt-3 font-display text-4xl font-bold leading-[1.02] tracking-[0.005em] text-ink md:text-5xl lg:text-6xl [text-wrap:balance]">
              {tHome("hero.title")}
            </h1>
            <div className="isl-gold-rule mt-5 max-w-[260px]" />
            <p className="mt-5 max-w-xl text-lg text-ink-2 md:text-xl">
              {tHome("hero.subtitle")}
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button href="#contact-us">{tHome("hero.joinNow")}</Button>
              <WatchLastRaceButton
                links={lastRaceYoutubeLinks}
                label={tHome("hero.watchLastRace")}
              />
            </div>
            <div className="mt-7 flex flex-wrap items-center gap-x-4 gap-y-2 text-[11px] leading-relaxed">
              {trustChips.map((chip) => (
                <span key={chip} className="inline-flex items-center gap-2 select-none">
                  <span className="h-3 w-[2px] shrink-0 bg-oxblood/70" />
                  <span className="font-isl-body font-medium uppercase tracking-[0.1em] text-ink-2">
                    {chip}
                  </span>
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
            <div className="relative isl-corner-ticks overflow-hidden rounded-[2px] border border-brass bg-cream">
              <div className="grid gap-0 md:grid-cols-[240px_1fr]">
                <LoadingLink
                  href={`/news/${encodeURIComponent(featuredNews.slug)}`}
                  className="group relative block h-44 border-b border-brass md:h-full md:border-b-0 md:border-e"
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

      <Section
        title={tHome("leagueFormat.title")}
        description={tHome("leagueFormat.description")}
        brandTitle
        index="01" compact
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
        title={tHome("races.title")}
        description={tHome("races.description")}
        brandTitle
        index="02" compact
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
        index="03" compact
        headerRight={
          <Button href="/news" size="sm" variant="secondary">
            {tHome("latestNews.allNews")}
          </Button>
        }
      >
        <NewsCarousel articles={latestNews} />
      </Section>

      <Section title={tHome("about.title")} brandTitle index="04" compact>
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
        index="05" compact
      >
        <ContactSection />
      </Section>
    </main>
  );
}
