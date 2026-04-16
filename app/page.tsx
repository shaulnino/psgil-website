export const revalidate = 300;

import Image from "next/image";
import path from "node:path";
import { existsSync } from "node:fs";
import Button from "@/components/Button";
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
import { computeDriverRatings } from "@/lib/statsComputed";
import { attachRewardsToDrivers, fetchRewards } from "@/lib/rewardsData";
import { fetchUniqueWinnersCount, fetchLeagueTotals } from "@/lib/statsData";
import { fetchLatestArticles, formatNewsDate } from "@/lib/newsData";
import { getYouTubeVideoId } from "@/lib/youtube";
import {
  fetchSeasonsConfig,
  resolveCurrentSeason,
  resolveTemplate,
  matchesSeason,
  GLOBAL_CSV_URLS,
} from "@/lib/seasonConfig";

const heroImagePath = "/hero.jpg";
const resolvePublic = (filePath: string) =>
  path.join(process.cwd(), "public", filePath.replace(/^\/+/, ""));
const newsFallbackImage = "/psgil-banner.png";

function isRemote(src?: string) {
  return !!src && src.startsWith("http");
}

export default async function Home() {
  const heroImageExists = existsSync(resolvePublic(heroImagePath));

  /* ---- Seasons config ---- */
  const seasonsConfig = await fetchSeasonsConfig();
  const currentSeason = resolveCurrentSeason(seasonsConfig);
  const currentSeasonLabel = currentSeason.season_label;
  const seasonCount = seasonsConfig.length;

  /* ---- Template resolver (extras filled after parallel fetch below) ---- */
  let templateExtras: Record<string, string | number> = {};
  const t = (text: string) =>
    resolveTemplate(text, currentSeasonLabel, seasonCount, templateExtras);

  /* ---- Fetch schedule + race results + drivers/teams + standings + winners count in parallel ---- */
  const [scheduleCsv, raceResultsByEvent, driversCsv, teamsCsv, mainStandings, wildStandings, rewards, uniqueWinners, leagueTotals, latestNews] =
    await Promise.all([
      fetchCsv(GLOBAL_CSV_URLS.schedule).catch(() => ""),
      fetchAllRaceResults(GLOBAL_CSV_URLS.raceResults),
      fetchCsv(GLOBAL_CSV_URLS.drivers).catch(() => ""),
      fetchCsv(GLOBAL_CSV_URLS.teams).catch(() => ""),
      fetchStandings(GLOBAL_CSV_URLS.driversStandingsMain),
      fetchStandings(GLOBAL_CSV_URLS.driversStandingsWild),
      fetchRewards(GLOBAL_CSV_URLS.rewards),
      fetchUniqueWinnersCount(),
      fetchLeagueTotals(),
      fetchLatestArticles(3),
    ]);

  templateExtras = {
    uniqueWinners: uniqueWinners || 0,
    totalRaces: leagueTotals.totalRaces || "0",
    totalDrivers: leagueTotals.totalDrivers || "0",
  };

  let lastGroup: RaceGroup | null = null;
  let nextGroup: RaceGroup | null = null;
  let liveGroup: RaceGroup | null = null;
  let seasonEvents: RaceEvent[] = [];
  try {
    if (scheduleCsv) {
      const raw = parseCsv<Record<string, string>>(scheduleCsv);
      const allEvents = mapRaceEvents(raw);
      // Filter to current season only
      const events = allEvents.filter((e) =>
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
    if (scheduleCsv) {
      const allResultsFlat = Object.values(raceResultsByEvent).flat();
      const allEvents = mapRaceEvents(parseCsv<Record<string, string>>(scheduleCsv));
      if (allResultsFlat.length > 0 && allEvents.length > 0) {
        const allTimeRatings = computeDriverRatings(allResultsFlat, allEvents);
        allDrivers = mergeComputedRatings(allDrivers, allTimeRatings, "alltime");
      }
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
          label: `Watch Race #${e.race_number} – ${e.race_name}`,
          url: youtubeUrl,
        });
      }
    }
    // If all races share the same URL, simplify the label
    if (lastRaceYoutubeLinks.length === 1) {
      lastRaceYoutubeLinks[0].label = siteConfig.hero.secondaryCtaLabel;
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
        label: siteConfig.hero.secondaryCtaLabel,
        url: (latestWithYoutube.youtube_url ?? "").trim(),
      });
    }
  }

  /* ---- Resolve template tokens in siteConfig values ---- */
  const trustChips = siteConfig.trustChips.map(t);
  const snapshotStats = siteConfig.snapshotStats.map((stat) => ({
    ...stat,
    value: t(stat.value),
  }));
  const featuredNews = latestNews[0] ?? null;

  return (
    <main className="bg-[#0B0B0E] text-white">
      <section className="group/hero relative min-h-[65vh] overflow-hidden">
        {/* Background image with slow zoom */}
        <div className="absolute inset-0">
          {heroImageExists ? (
            <Image
              src={heroImagePath}
              alt="PSGiL racing atmosphere"
              fill
              priority
              className="object-cover object-center animate-[hero-zoom_14s_ease-out_forwards] group-hover/hero:brightness-110 transition-[filter] duration-700"
            />
          ) : (
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(112,32,176,0.35),_transparent_55%),linear-gradient(160deg,_#151120,_#0B0B0E_55%)]" />
          )}

          {/* Purple tint overlay */}
          <div className="absolute inset-0 bg-[#7020B0]/[0.06] mix-blend-overlay" />

          {/* Bottom gradient for text contrast */}
          <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-black/50 to-[#0B0B0E]" />

          {/* Vignette edges */}
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_transparent_50%,_rgba(11,11,14,0.7)_100%)]" />

          {/* Diagonal carbon-fibre texture */}
          <div className="absolute inset-0 opacity-[0.06] [background-image:repeating-linear-gradient(135deg,_rgba(255,255,255,0.35)_0,_rgba(255,255,255,0.35)_1px,_transparent_1px,_transparent_8px)]" />

          {/* Gliding purple streak */}
          <div className="absolute left-1/2 top-28 h-px w-[80%] -translate-x-1/2 -rotate-6 bg-gradient-to-r from-transparent via-[#7020B0]/70 to-transparent animate-[hero-glide_10s_linear_infinite]" />

          {/* Watermark league name */}
          <div className="absolute right-6 top-16 text-[140px] font-display font-semibold tracking-[0.2em] text-white/[0.03] md:text-[220px]">
            {siteConfig.leagueName}
          </div>
        </div>

        {/* Content */}
        <div className="relative flex min-h-[65vh] flex-col justify-end pb-10 pt-24 md:pt-28">
          <div className="mx-auto w-full max-w-6xl px-6">
            {/* Banner with ambient glow */}
            <div className="relative w-full max-w-4xl">
              <div className="absolute -inset-6 rounded-3xl bg-[#7020B0]/10 blur-2xl" />
              <Image
                src="/psgil-banner.png"
                alt={`PSGiL ${currentSeasonLabel} banner`}
                width={2000}
                height={600}
                priority
                className="relative h-auto w-full drop-shadow-[0_0_40px_rgba(112,32,176,0.2)]"
                sizes="(max-width: 768px) 100vw, 70vw"
              />
            </div>

            <div className="mt-8 max-w-3xl">
              <p className="text-sm uppercase tracking-[0.3em] text-white/60">
                {currentSeasonLabel}
              </p>
              <h1 className="mt-4 font-display text-4xl font-semibold tracking-tight md:text-5xl lg:text-6xl">
                {siteConfig.hero.title}
              </h1>
              <p className="mt-4 max-w-xl text-lg text-white/70 md:text-xl">
                {siteConfig.hero.subtitle}
              </p>
              <div className="mt-8 flex flex-wrap gap-4">
                <Button href="#contact-us">
                  {siteConfig.hero.primaryCtaLabel}
                </Button>
                <WatchLastRaceButton
                  links={lastRaceYoutubeLinks}
                  label={siteConfig.hero.secondaryCtaLabel}
                />
              </div>
              <div className="mt-5 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[11px] leading-relaxed tracking-wide">
                <span className="mr-1 font-semibold uppercase tracking-[0.15em] text-[#D4AF37]/60">
                  Key facts
                </span>
                {trustChips.map((chip, i) => (
                  <span key={chip} className="inline-flex items-center gap-1.5 select-none">
                    {i > 0 && (
                      <span className="h-[3px] w-[3px] shrink-0 rounded-full bg-[#D4AF37]/50" />
                    )}
                    <span className="font-medium text-white/70">{chip}</span>
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="mx-auto mt-4 flex w-full max-w-6xl items-center gap-2 px-6">
        <span className="text-xs font-semibold uppercase tracking-wider text-[#D4AF37]/60">Follow us</span>
        <SocialLinks items={siteConfig.socials} variant="compact" />
        <a
          href="#contact-us"
          className="group/social relative inline-flex h-8 w-8 items-center justify-center rounded-lg border border-white/[0.06] bg-white/[0.03] transition-all duration-200 hover:border-white/15 hover:bg-white/[0.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7020B0]/60 focus-visible:ring-offset-1 focus-visible:ring-offset-[#0B0B0E]"
          aria-label="Contact Us"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-[18px] w-[18px] text-[#D4AF37] transition-all duration-200 group-hover/social:drop-shadow-[0_0_6px_rgba(212,175,55,0.4)]">
            <path d="M3 4a2 2 0 00-2 2v1.161l8.441 4.221a1.25 1.25 0 001.118 0L19 7.162V6a2 2 0 00-2-2H3z" />
            <path d="M19 8.839l-7.77 3.885a2.75 2.75 0 01-2.46 0L1 8.839V14a2 2 0 002 2h14a2 2 0 002-2V8.839z" />
          </svg>
          <span className="pointer-events-none absolute -top-9 left-1/2 z-50 -translate-x-1/2 whitespace-nowrap rounded-md bg-[#1a1a2e] px-2.5 py-1 text-[11px] font-medium text-white/90 opacity-0 shadow-lg ring-1 ring-white/10 transition-opacity group-hover/social:opacity-100" role="tooltip">
            Contact Us
          </span>
        </a>
      </div>

      {featuredNews && (
        <section className="py-4">
          <div className="mx-auto w-full max-w-6xl px-6">
            <div className="overflow-hidden rounded-2xl border border-[#7020B0]/35 bg-[linear-gradient(135deg,rgba(112,32,176,0.16),rgba(11,11,14,0.98))] shadow-[0_0_32px_rgba(112,32,176,0.16)]">
              <div className="grid gap-0 md:grid-cols-[240px_1fr]">
                <LoadingLink
                  href={`/news/${encodeURIComponent(featuredNews.slug)}`}
                  className="group relative block h-44 md:h-full"
                >
                  <Image
                    src={featuredNews.coverImageUrl || newsFallbackImage}
                    alt={featuredNews.title}
                    fill
                    className="object-cover transition duration-300 group-hover:scale-[1.02]"
                    sizes="(max-width: 768px) 100vw, 240px"
                    unoptimized={isRemote(featuredNews.coverImageUrl)}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
                  <span className="absolute left-3 top-3 inline-flex items-center rounded-full border border-[#D4AF37]/50 bg-[#D4AF37]/12 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#D4AF37]">
                    Featured Story
                  </span>
                </LoadingLink>

                <div className="p-4 md:p-5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center rounded-full border border-[#7020B0]/45 bg-[#7020B0]/18 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#d9bcff]">
                      News Flash
                    </span>
                    <span className="text-[11px] font-semibold uppercase tracking-[0.13em] text-white/55">
                      {formatNewsDate(featuredNews.date)}
                    </span>
                  </div>

                  <LoadingLink
                    href={`/news/${encodeURIComponent(featuredNews.slug)}`}
                    className="mt-3 block text-base font-semibold leading-tight text-white transition hover:text-[#d7b3ff] md:text-xl"
                  >
                    <span className="line-clamp-2">{featuredNews.title}</span>
                  </LoadingLink>

                  <p className="mt-2 line-clamp-2 text-sm text-white/65 md:text-[15px]">
                    {featuredNews.excerpt}
                  </p>

                  <div className="mt-4 flex items-center gap-2">
                    <LoadingLink
                      href={`/news/${encodeURIComponent(featuredNews.slug)}`}
                      className="inline-flex items-center rounded-full bg-[#7020B0] px-3.5 py-1.5 text-xs font-semibold text-white transition hover:bg-[#7f2fc0]"
                    >
                      Read
                    </LoadingLink>
                    <LoadingLink
                      href="/news"
                      className="inline-flex items-center rounded-full border border-white/20 px-3.5 py-1.5 text-xs font-semibold text-white/85 transition hover:border-white/35 hover:text-white"
                    >
                      All News
                    </LoadingLink>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      <SnapshotStrip stats={snapshotStats} />

      <Section
        title="League Format"
        description="Structured racing built for consistency and clean results."
        brandTitle
      >
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {siteConfig.leagueFormat.map((item) => (
            <div
              key={item.title}
              className="rounded-2xl border border-white/10 bg-white/5 p-5 text-sm text-white/70"
            >
              <h3 className="font-display text-lg font-semibold text-[#D4AF37]">
                {item.title}
              </h3>
              <p className="mt-2 text-white/60">{item.description}</p>
            </div>
          ))}
        </div>
      </Section>

      <Section
        title="Races"
        description="Latest action and what is coming up next."
        brandTitle
        headerRight={
          <Button href="/schedule" size="sm">
            Full Schedule
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
        title="Latest News"
        description="Fresh updates, race stories, and league highlights."
        brandTitle
        headerRight={
          <Button href="/news" size="sm">
            All News
          </Button>
        }
      >
        <NewsCarousel articles={latestNews} />
      </Section>

      <Section title="About Us" brandTitle>
        <div className="rounded-2xl border border-white/10 bg-white/5 p-6 md:p-8">
          <p className="text-base text-white/70 md:text-lg">
            PSGiL is Israel&apos;s largest F1 sim racing league, competing
            primarily on the EA Sports F1 series, running continuously for
            over three years and currently in its{" "}
            {currentSeasonLabel.toLowerCase()}. Built by drivers, for
            drivers, the league is centered around a strong and supportive
            community, highly competitive grids, and a deep commitment to
            clean, respectful racing—both on and off the track. With
            structured seasons, consistent stewarding, and a culture that
            values fairness and sportsmanship, PSGiL has grown into a home
            for drivers who are looking for serious competition without
            losing the human side of racing.
          </p>
        </div>
      </Section>



      <Section
        id="contact-us"
        title="Contact Us"
        description="Get in touch with the league."
        brandTitle
      >
        <ContactSection />
      </Section>
    </main>
  );
}
