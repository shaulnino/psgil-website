import type { Metadata } from "next";
import Section from "@/components/Section";
import LoadingLink from "@/components/LoadingLink";
import NewsCategoryTag from "@/components/NewsCategoryTag";
import NewsImage from "@/components/NewsImage";
import NewsArticleActions from "@/components/NewsArticleActions";
import { fetchCsv, parseCsv } from "@/lib/csv";
import { mapRaceEvents } from "@/lib/scheduleData";
import { GLOBAL_CSV_URLS } from "@/lib/seasonConfig";
import {
  fetchAllRaceResults,
  fetchStandings,
  filterBySeason,
  type RaceResultRow,
  type StandingsRow,
} from "@/lib/resultsData";
import { mapDrivers, mapTeams, type Driver, type Team } from "@/lib/driversData";
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

function parseEventIdFromArticleId(articleId: string): string | null {
  const m = articleId.toLowerCase().match(/(s\d+_r\d+_(?:main|wild))/);
  return m ? m[1] : null;
}

function toSeasonKeyFromEventId(eventId: string): string | null {
  const m = eventId.match(/^s(\d+)_/i);
  return m ? `S${m[1]}` : null;
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
      title: "News Article | PSGiL",
      description: "PSGiL news article.",
      openGraph: {
        title: "News Article | PSGiL",
        description: "PSGiL news article.",
        url,
        type: "article",
        siteName: "PSGiL - Premier Sim Gaming Israeli League",
      },
      twitter: {
        card: "summary_large_image",
        title: "News Article | PSGiL",
        description: "PSGiL news article.",
      },
    };
  }

  const imageUrl = resolveAbsoluteUrl(baseUrl, article.coverImageUrl);

  return {
    title: `${article.title} | PSGiL News`,
    description: article.excerpt,
    alternates: {
      canonical: url,
    },
    openGraph: {
      title: article.title,
      description: article.excerpt,
      url,
      type: "article",
      siteName: "PSGiL - Premier Sim Gaming Israeli League",
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
  const eventId = parseEventIdFromArticleId(article.id);
  const seasonKey = eventId ? toSeasonKeyFromEventId(eventId) : null;

  let watchUrl: string | null = null;
  let resultsRows: RaceResultRow[] = [];
  let seasonStandingsRows: StandingsRow[] = [];
  let modalDrivers: Driver[] = [];
  let modalTeams: Team[] = [];
  if (eventId) {
    try {
      const scheduleCsv = await fetchCsv(GLOBAL_CSV_URLS.schedule).catch(() => "");
      const events = scheduleCsv
        ? mapRaceEvents(parseCsv<Record<string, string>>(scheduleCsv))
        : [];
      const matchedEvent = events.find((e) => e.event_id.toLowerCase() === eventId.toLowerCase());
      if (matchedEvent?.youtube_url) watchUrl = matchedEvent.youtube_url;
    } catch {
      // Best-effort only; CTAs below still work with schedule fallback links.
    }
  }

  if (isRecap && eventId) {
    try {
      const [allResults, driversCsv, teamsCsv] = await Promise.all([
        fetchAllRaceResults(GLOBAL_CSV_URLS.raceResults),
        fetchCsv(GLOBAL_CSV_URLS.drivers).catch(() => ""),
        fetchCsv(GLOBAL_CSV_URLS.teams).catch(() => ""),
      ]);
      resultsRows = allResults[eventId] ?? [];
      modalDrivers = driversCsv
        ? mapDrivers(parseCsv<Record<string, string>>(driversCsv))
        : [];
      modalTeams = teamsCsv
        ? mapTeams(parseCsv<Record<string, string>>(teamsCsv))
        : [];
    } catch {
      // Keep no-results fallback state if the data source is temporarily unavailable.
    }
  }

  if (isPreview && seasonKey) {
    try {
      seasonStandingsRows = filterBySeason(
        await fetchStandings(GLOBAL_CSV_URLS.driversStandingsMain),
        seasonKey,
      );
    } catch {
      // Keep empty state if standings are temporarily unavailable.
    }
  }

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
              watchUrl={watchUrl}
              resultsRows={resultsRows}
              resultsCaption={`${article.title} — Race Results`}
              seasonStandingsRows={seasonStandingsRows}
              seasonTableCaption={
                seasonKey
                  ? `Season ${seasonKey.replace(/^S/i, "")} — Main Drivers Standings`
                  : "Season — Main Drivers Standings"
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

