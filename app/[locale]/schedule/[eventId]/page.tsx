import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import Section from "@/components/Section";
import LoadingLink from "@/components/LoadingLink";
import RaceResultsTable from "@/components/RaceResultsTable";
import DriverLookupProvider from "@/components/DriverLookupProvider";
import ShareButton from "@/components/share/ShareButton";
import { fetchCsv, parseCsv } from "@/lib/csv";
import {
  mapRaceEvents,
  localizedRaceName,
  localizedTrack,
  type RaceEvent,
} from "@/lib/scheduleData";
import { fetchAllRaceResults } from "@/lib/resultsData";
import {
  mapDrivers,
  mapTeams,
  mapLeagueStandings,
  applyLeagueStandings,
  mergeComputedRatings,
  computeAllScopeRanks,
  computeCompetitionRanks,
} from "@/lib/driversData";
import { attachRewardsToDrivers, fetchRewards } from "@/lib/rewardsData";
import { applyUploadedDriverPhotos } from "@/lib/drivers/photoOverride";
import {
  fetchSeasonsConfig,
  resolveCurrentSeason,
  seasonHasWild,
  GLOBAL_CSV_URLS,
} from "@/lib/seasonConfig";
import { computeDriverRatingsAll } from "@/lib/statsComputed";
import { buildRaceResultShare } from "@/lib/share/builders";
import { absoluteUrl, getSiteBaseUrl } from "@/lib/share/shareUrls";
import type { ShareTranslator } from "@/lib/share/types";

export const revalidate = 300;

type RacePageProps = {
  params: Promise<{ locale: string; eventId: string }>;
};

/** Find a race event by its (case-insensitive) event_id. */
function findEvent(events: RaceEvent[], eventId: string): RaceEvent | null {
  const id = eventId.trim().toLowerCase();
  return events.find((e) => e.event_id.trim().toLowerCase() === id) ?? null;
}

/** Season key ("S6") from a schedule season value ("6" or "S6"). */
function seasonKeyOf(season: string): string {
  return `S${(season ?? "").trim().replace(/^s/i, "")}`;
}

/** Absolute URL for a poster/results image path (relative → prefixed). */
function resolveImageUrl(baseUrl: string, value: string | undefined): string {
  const raw = String(value || "").trim();
  if (!raw) return `${baseUrl}/isl-social.png`;
  if (/^https?:\/\//i.test(raw)) return raw;
  return `${baseUrl}${raw.startsWith("/") ? "" : "/"}${raw}`;
}

export async function generateMetadata({ params }: RacePageProps): Promise<Metadata> {
  const { locale, eventId } = await params;
  const t = await getTranslations("share");
  const tNews = await getTranslations("news");
  const baseUrl = getSiteBaseUrl();

  const scheduleCsv = await fetchCsv(GLOBAL_CSV_URLS.schedule).catch(() => "");
  const events = scheduleCsv
    ? mapRaceEvents(parseCsv<Record<string, string>>(scheduleCsv))
    : [];
  const event = findEvent(events, eventId);

  const canonical = absoluteUrl(locale, `/schedule/${eventId}`);
  const languages = {
    he: absoluteUrl("he", `/schedule/${eventId}`),
    en: absoluteUrl("en", `/schedule/${eventId}`),
  };

  if (!event) {
    return { alternates: { canonical, languages } };
  }

  const resultsByEvent = await fetchAllRaceResults(GLOBAL_CSV_URLS.raceResults);
  const results = resultsByEvent[event.event_id] ?? [];
  const payload = buildRaceResultShare({
    event,
    results,
    locale,
    t: t as unknown as ShareTranslator,
  });
  const image = resolveImageUrl(baseUrl, event.poster_image || event.results_image);
  const ogLocale = locale === "he" ? "he_IL" : "en_US";
  // payload.text keeps newlines for the shareable message (WhatsApp/native),
  // but meta descriptions should be a single line for link-preview crawlers.
  const metaDescription = payload.text.replace(/\s*\n\s*/g, " · ").trim();

  return {
    title: payload.title,
    description: metaDescription,
    alternates: { canonical, languages },
    openGraph: {
      title: payload.title,
      description: metaDescription,
      url: canonical,
      type: "website",
      siteName: tNews("article.metaSiteName"),
      locale: ogLocale,
      images: [{ url: image }],
    },
    twitter: {
      card: "summary_large_image",
      title: payload.title,
      description: metaDescription,
      images: [image],
    },
  };
}

export default async function RaceResultPage({ params }: RacePageProps) {
  const { eventId } = await params;
  const locale = await getLocale();
  const t = await getTranslations("share");

  const seasonsConfig = await fetchSeasonsConfig();
  const currentSeason = resolveCurrentSeason(seasonsConfig);

  const [scheduleCsv, raceResultsByEvent, driversCsv, teamsCsv, standingsCsv, rewards] =
    await Promise.all([
      fetchCsv(GLOBAL_CSV_URLS.schedule).catch(() => ""),
      fetchAllRaceResults(GLOBAL_CSV_URLS.raceResults),
      fetchCsv(GLOBAL_CSV_URLS.drivers).catch(() => ""),
      fetchCsv(GLOBAL_CSV_URLS.teams).catch(() => ""),
      fetchCsv(GLOBAL_CSV_URLS.leagueStandings).catch(() => ""),
      fetchRewards(GLOBAL_CSV_URLS.rewards),
    ]);

  const allEvents = scheduleCsv
    ? mapRaceEvents(parseCsv<Record<string, string>>(scheduleCsv))
    : [];
  const event = findEvent(allEvents, eventId);
  if (!event) notFound();

  // Prepare drivers/teams so the shared page's driver modals match the schedule
  // (Hebrew names, photos, rewards, computed ratings). Best-effort throughout.
  let allDrivers = driversCsv
    ? mapDrivers(parseCsv<Record<string, string>>(driversCsv))
    : [];
  allDrivers = await applyUploadedDriverPhotos(allDrivers);
  if (standingsCsv) {
    allDrivers = applyLeagueStandings(
      allDrivers,
      mapLeagueStandings(parseCsv<Record<string, string>>(standingsCsv)),
    );
  }
  allDrivers = attachRewardsToDrivers(allDrivers, rewards);

  try {
    const allResultsFlat = Object.values(raceResultsByEvent).flat();
    if (allResultsFlat.length > 0 && allEvents.length > 0) {
      const { allTime, season, allTimeMain, allTimeWild, seasonMain, seasonWild } =
        computeDriverRatingsAll(allResultsFlat, allEvents, currentSeason.season_key);
      allDrivers = mergeComputedRatings(allDrivers, allTime, "alltime");
      allDrivers = mergeComputedRatings(allDrivers, season, "season");
      allDrivers = mergeComputedRatings(allDrivers, allTimeMain, "main");
      allDrivers = mergeComputedRatings(allDrivers, allTimeWild, "wild");
      allDrivers = mergeComputedRatings(allDrivers, seasonMain, "season_main");
      allDrivers = mergeComputedRatings(allDrivers, seasonWild, "season_wild");
      allDrivers = computeAllScopeRanks(allDrivers);
      allDrivers = computeCompetitionRanks(allDrivers);
    }
  } catch {
    // Ratings are non-critical; modals still render without them.
  }

  const allTeams = teamsCsv
    ? mapTeams(parseCsv<Record<string, string>>(teamsCsv))
    : [];

  const results = raceResultsByEvent[event.event_id] ?? [];
  const raceName = localizedRaceName(event, locale);
  const circuit = localizedTrack(event, locale);
  const round = String(event.race_number ?? "").trim();
  const season = seasonKeyOf(event.season).replace(/^S/i, "");
  const subtitle =
    circuit && round && season
      ? t("race.meta", { circuit, round, season })
      : t("race.metaNoCircuit", { round, season });

  const payload = buildRaceResultShare({
    event,
    results,
    locale,
    t: t as unknown as ShareTranslator,
  });

  const seasonKey = seasonKeyOf(event.season);
  const scheduleHref = `/schedule?season=${seasonKey}&event=${event.event_id}`;

  return (
    <main className="text-ink-2">
      <Section
        title={raceName}
        description={subtitle}
        pageHeader
        headerRight={<ShareButton payload={payload} variant="labeled" />}
      >
        <div className="mb-6">
          <LoadingLink
            href={scheduleHref}
            className="inline-flex items-center gap-2 border-b border-transparent text-sm font-medium uppercase tracking-[0.08em] text-oxblood transition-colors hover:border-oxblood hover:text-oxblood-deep"
          >
            <svg className="h-4 w-4 rtl:scale-x-[-1]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 18l-6-6 6-6" />
            </svg>
            {t("racePage.backToSchedule")}
          </LoadingLink>
        </div>

        {results.length > 0 ? (
          <DriverLookupProvider
            drivers={allDrivers}
            teams={allTeams}
            placeholderSrc="/placeholders/driver.png"
            hasWild={seasonHasWild(seasonsConfig, seasonKey)}
          >
            <div className="overflow-hidden rounded-[2px] border border-[color:var(--isl-hairline)] bg-paper p-3">
              <RaceResultsTable
                results={results}
                caption={`${raceName} ${t("racePage.resultsCaptionSuffix")}`}
              />
            </div>
          </DriverLookupProvider>
        ) : event.results_image ? (
          <div className="overflow-hidden rounded-[2px] border border-[color:var(--isl-hairline)] bg-paper p-3">
            <Image
              src={event.results_image}
              alt={`${raceName} ${t("racePage.resultsCaptionSuffix")}`}
              width={2000}
              height={1200}
              sizes="100vw"
              quality={100}
              className="h-auto w-full object-contain"
            />
          </div>
        ) : (
          <div className="isl-speed-lines flex items-center justify-center rounded-[2px] border border-dashed border-[color:var(--isl-hairline-strong)] bg-paper py-16">
            <p className="font-isl-body text-xs font-semibold uppercase tracking-[0.2em] text-meta">
              {t("racePage.resultsPending")}
            </p>
          </div>
        )}
      </Section>
    </main>
  );
}
