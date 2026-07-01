import type { Metadata } from "next";
import Section from "@/components/Section";
import LoadingLink from "@/components/LoadingLink";
import NewsCategoryTag from "@/components/NewsCategoryTag";
import NewsImage from "@/components/NewsImage";
import NewsArticleActions from "@/components/NewsArticleActions";
import { fetchCsv, parseCsv } from "@/lib/csv";
import {
  mapRaceEvents,
  parseSeasonDigitFromArticleText,
  parseWildEventDayNumberFromText,
  resolveRecapRaceGroupForNewsArticle,
  scheduleWatchLinksForArticleEventIds,
  youtubeWatchLinksForGroup,
  type RaceGroup,
} from "@/lib/scheduleData";
import { GLOBAL_CSV_URLS } from "@/lib/seasonConfig";
import {
  fetchAllRaceResults,
  fetchStandings,
  filterBySeason,
  type RaceResultRow,
  type StandingsRow,
} from "@/lib/resultsData";
import { mapDrivers, mapTeams, type Driver, type Team } from "@/lib/driversData";
import { attachRewardsToDrivers, fetchRewards } from "@/lib/rewardsData";
import {
  fetchArticleBySlug,
  fetchArticlesWithStatus,
  extractYouTubeVideoId,
  formatNewsDate,
  renderArticleBody,
} from "@/lib/newsData";
export const revalidate = 300;

type NewsArticlePageProps = {
  params: Promise<{ slug: string }>;
};

/** All event_id tokens in the article id (same calendar day + league may list multiple rounds). */
function parseEventIdsFromArticleId(articleId: string): string[] {
  const re = /s\d+_r\d+_(?:main|wild)/gi;
  const seen = new Set<string>();
  const out: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(articleId)) !== null) {
    const id = m[0].toLowerCase();
    if (!seen.has(id)) {
      seen.add(id);
      out.push(id);
    }
  }
  return out;
}

function resolveSiteBaseUrl(): string {
  const envBase =
    process.env.SITE_BASE_URL ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "");
  return String(envBase || "").trim().replace(/\/+$/, "") || "https://psgil.com";
}

function resolveAbsoluteUrl(baseUrl: string, value: string): string {
  const raw = String(value || "").trim();
  if (!raw) return `${baseUrl}/psgil-banner.png`;
  if (/^https?:\/\//i.test(raw)) return raw;
  return `${baseUrl}${raw.startsWith("/") ? "" : "/"}${raw}`;
}

export async function generateMetadata({
  params,
}: NewsArticlePageProps): Promise<Metadata> {
  const baseUrl = resolveSiteBaseUrl();
  const { slug } = await params;
  const article = await fetchArticleBySlug(slug);
  const url = `${baseUrl}/news/${encodeURIComponent(slug)}`;

  if (!article) {
    return {
      title: "News Article | ISL",
      description: "ISL news article.",
      openGraph: {
        title: "News Article | ISL",
        description: "ISL news article.",
        url,
        type: "article",
        siteName: "ISL - F1 Israeli Super League",
      },
      twitter: {
        card: "summary_large_image",
        title: "News Article | ISL",
        description: "ISL news article.",
      },
    };
  }

  const imageUrl = resolveAbsoluteUrl(baseUrl, article.coverImageUrl);

  return {
    title: `${article.title} | ISL News`,
    description: article.excerpt,
    alternates: {
      canonical: url,
    },
    openGraph: {
      title: article.title,
      description: article.excerpt,
      url,
      type: "article",
      siteName: "ISL - F1 Israeli Super League",
      publishedTime: new Date(`${article.date}T00:00:00Z`).toISOString(),
      images: [{ url: imageUrl }],
    },
    twitter: {
      card: "summary_large_image",
      title: article.title,
      description: article.excerpt,
      images: [imageUrl],
    },
  };
}

export default async function NewsArticlePage({ params }: NewsArticlePageProps) {
  const { slug } = await params;
  const { articles, error } = await fetchArticlesWithStatus();
  const article = articles.find((item) => item.slug === slug) ?? null;

  if (!article) {
    return (
      <main className="bg-[#0B0B0E] text-white">
        <Section title="Article Unavailable" description="We could not find this article." pageHeader>
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 text-sm text-white/70">
            {error
              ? "The news source is temporarily unavailable. Please try again soon."
              : "This article may be unpublished or the URL is incorrect."}
            <div className="mt-5">
              <LoadingLink
                href="/news"
                className="inline-flex items-center rounded-full bg-[#7020B0] px-4 py-2 text-sm font-semibold text-white"
              >
                Back to news
              </LoadingLink>
            </div>
          </div>
        </Section>
      </main>
    );
  }

  const bodyHtml = await renderArticleBody(article.content);
  const embeddedVideoId = extractYouTubeVideoId(article.youtubeUrl);
  const articleId = article.id.toLowerCase();
  const isRecap = articleId.includes("recap");
  const isPreview = articleId.includes("preview");
  const eventIdsFromArticle = parseEventIdsFromArticleId(article.id);
  const primaryEventId = eventIdsFromArticle[0] ?? null;
  const articleCopyBlob = `${article.id} ${article.title}`;
  const seasonDigitHint =
    primaryEventId?.match(/^s(\d+)_/i)?.[1] ?? parseSeasonDigitFromArticleText(articleCopyBlob);
  const seasonKey = seasonDigitHint ? `S${seasonDigitHint}` : null;
  const wildEventDayHint = parseWildEventDayNumberFromText(articleCopyBlob);

  let watchLinks: { label: string; url: string }[] = [];
  let resultsSections: { raceName: string; rows: RaceResultRow[] }[] = [];
  let seasonStandingsRows: StandingsRow[] = [];
  let constructorsStandingsRows: StandingsRow[] = [];
  let modalDrivers: Driver[] = [];
  let modalTeams: Team[] = [];
  let recapRaceGroup: RaceGroup | null = null;

  const shouldLoadSchedule =
    eventIdsFromArticle.length > 0 ||
    (isRecap &&
      (primaryEventId !== null || (wildEventDayHint !== null && seasonDigitHint !== null))) ||
    (isPreview && seasonKey !== null);

  if (shouldLoadSchedule) {
    try {
      const scheduleCsv = await fetchCsv(GLOBAL_CSV_URLS.schedule).catch(() => "");
      const events = scheduleCsv
        ? mapRaceEvents(parseCsv<Record<string, string>>(scheduleCsv))
        : [];

      recapRaceGroup = resolveRecapRaceGroupForNewsArticle(events, {
        articleId: article.id,
        articleTitle: article.title,
        parsedEventIds: eventIdsFromArticle,
      });

      watchLinks = recapRaceGroup
        ? youtubeWatchLinksForGroup(recapRaceGroup)
        : scheduleWatchLinksForArticleEventIds(events, eventIdsFromArticle);

      if (isRecap && (recapRaceGroup !== null || primaryEventId !== null)) {
        const raceGroup = recapRaceGroup;

        const isWildRecap = articleId.includes("wild");
        const driversStandingsUrl = isWildRecap
          ? GLOBAL_CSV_URLS.driversStandingsWild
          : GLOBAL_CSV_URLS.driversStandingsMain;
        const constructorsStandingsUrl = isWildRecap
          ? GLOBAL_CSV_URLS.constructorsStandingsWild
          : GLOBAL_CSV_URLS.constructorsStandingsMain;

        const [allResults, driversCsv, teamsCsv, rewards, allDriversStandings, allConstructorsStandings] =
          await Promise.all([
            fetchAllRaceResults(GLOBAL_CSV_URLS.raceResults),
            fetchCsv(GLOBAL_CSV_URLS.drivers).catch(() => ""),
            fetchCsv(GLOBAL_CSV_URLS.teams).catch(() => ""),
            fetchRewards(GLOBAL_CSV_URLS.rewards),
            seasonKey ? fetchStandings(driversStandingsUrl) : Promise.resolve([] as StandingsRow[]),
            seasonKey ? fetchStandings(constructorsStandingsUrl) : Promise.resolve([] as StandingsRow[]),
          ]);

        if (raceGroup) {
          resultsSections = raceGroup.events.map((e) => ({
            raceName: e.race_name || `Race #${e.race_number}`,
            rows: allResults[e.event_id] ?? [],
          }));
        } else if (primaryEventId) {
          resultsSections = [
            {
              raceName: "Race",
              rows: allResults[primaryEventId] ?? [],
            },
          ];
        }

        if (seasonKey) {
          seasonStandingsRows = filterBySeason(allDriversStandings, seasonKey);
          constructorsStandingsRows = filterBySeason(allConstructorsStandings, seasonKey);
        }
        modalDrivers = driversCsv
          ? mapDrivers(parseCsv<Record<string, string>>(driversCsv))
          : [];
        modalDrivers = attachRewardsToDrivers(modalDrivers, rewards);
        modalTeams = teamsCsv
          ? mapTeams(parseCsv<Record<string, string>>(teamsCsv))
          : [];
      }
    } catch {
      // Best-effort: schedule, results, or standings may be unavailable.
    }
  }

  if (isPreview && seasonKey) {
    try {
      const isWildPreview = articleId.includes("wild");
      const previewStandingsUrl = isWildPreview
        ? GLOBAL_CSV_URLS.driversStandingsWild
        : GLOBAL_CSV_URLS.driversStandingsMain;
      seasonStandingsRows = filterBySeason(
        await fetchStandings(previewStandingsUrl),
        seasonKey,
      );
    } catch {
      // Keep empty state if standings are temporarily unavailable.
    }
  }

  const standingsLeagueLabel = articleId.includes("wild") ? "Wild" : "Main";

  return (
    <main className="bg-[#0B0B0E] text-white">
      <Section className="pt-8 md:pt-12">
        <LoadingLink
          href="/news"
          className="mb-6 inline-flex items-center gap-2 text-sm font-semibold text-[#D4AF37] transition hover:text-[#f0d27a]"
        >
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 18l-6-6 6-6" />
          </svg>
          Back to news
        </LoadingLink>

        <article className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03]">
          <div className="relative h-64 md:h-80">
            <NewsImage
              src={article.coverImageUrl}
              alt={article.title}
              loading="eager"
              className="h-full w-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/45 to-transparent" />
            <div className="absolute inset-x-0 bottom-0 p-6 md:p-8">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#D4AF37]/80">
                {formatNewsDate(article.date)}
                <span className="mx-2 text-white/45">•</span>
                {article.author}
              </p>
              <div className="mt-3">
                <NewsCategoryTag category={article.category} />
              </div>
              <h1 className="mt-3 font-display text-3xl font-bold tracking-wide text-white md:text-5xl">
                {article.title}
              </h1>
              {article.tags.length > 0 && (
                <div className="mt-4 flex flex-wrap gap-2">
                  {article.tags.map((tag) => (
                    <span
                      key={`${article.id}-${tag}`}
                      className="rounded-full border border-white/20 bg-black/35 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-white/85"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="p-6 md:p-8">
            {embeddedVideoId && (
              <div className="mb-6 overflow-hidden rounded-2xl border border-white/10 bg-black">
                <div className="aspect-video w-full">
                  <iframe
                    src={`https://www.youtube.com/embed/${embeddedVideoId}`}
                    title={`${article.title} video`}
                    className="h-full w-full"
                    loading="lazy"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                    referrerPolicy="strict-origin-when-cross-origin"
                    allowFullScreen
                  />
                </div>
              </div>
            )}

            <NewsArticleActions
              isRecap={isRecap}
              isPreview={isPreview}
              watchLinks={watchLinks}
              resultsSections={resultsSections}
              articleTitle={article.title}
              seasonStandingsRows={seasonStandingsRows}
              seasonTableCaption={
                seasonKey
                  ? `Season ${seasonKey.replace(/^S/i, "")} — ${standingsLeagueLabel} Drivers Standings`
                  : `Season — ${standingsLeagueLabel} Drivers Standings`
              }
              constructorsStandingsRows={constructorsStandingsRows}
              constructorsTableCaption={
                seasonKey
                  ? `Season ${seasonKey.replace(/^S/i, "")} — ${standingsLeagueLabel} Constructors Standings`
                  : `Season — ${standingsLeagueLabel} Constructors Standings`
              }
              drivers={modalDrivers}
              teams={modalTeams}
            />

            <div
              className="news-prose"
              dangerouslySetInnerHTML={{ __html: bodyHtml }}
            />
          </div>
        </article>
      </Section>
    </main>
  );
}

