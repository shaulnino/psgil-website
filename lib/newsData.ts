import sanitizeHtml from "sanitize-html";
import { marked } from "marked";
import { fetchCsv, parseCsv } from "@/lib/csv";
import {
  NEWS_CATEGORY,
  type NewsCategory,
  normalizeNewsCategory,
} from "@/lib/newsCategories";

export type NewsArticle = {
  id: string;
  title: string;
  slug: string;
  date: string; // ISO YYYY-MM-DD
  author: string;
  excerpt: string;
  coverImageUrl: string;
  tags: string[];
  category: NewsCategory;
  youtubeUrl: string;
  content: string;
};

type FetchState = {
  articles: NewsArticle[];
  error: string | null;
};

type CacheState = FetchState & {
  expiresAt: number;
};

const CACHE_TTL_MS = 60 * 1000; // 60 seconds — news should appear quickly after sheet edits
const DEFAULT_AUTHOR = "ISL";
const NEWS_SHEET_URL = process.env.NEWS_SHEET_URL ?? "";
const IS_DEV = process.env.NODE_ENV !== "production";

let cache: CacheState | null = null;

const DEV_FALLBACK_ARTICLES: NewsArticle[] = [
  {
    id: "sample-news-1",
    title: "ISL News Sample",
    slug: "psgil-news-sample",
    date: "2026-03-02",
    author: "ISL",
    excerpt:
      "This is a local development fallback article. Connect NEWS_SHEET_URL to show real Google Sheets content.",
    coverImageUrl: "/isl-banner.png",
    tags: ["sample", "local"],
    category: NEWS_CATEGORY.HUB,
    youtubeUrl: "",
    content: `## This is a fallback article

Use this entry to validate the News UI locally:

- News listing cards
- Homepage carousel
- Full article rendering

When \`NEWS_SHEET_URL\` is configured, this fallback is automatically replaced by real published rows from Google Sheets.`,
  },
];

function s(value: string | undefined): string {
  return (value ?? "").trim();
}

function normalizeHeader(value: string): string {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
}

function getField(
  row: Record<string, string>,
  names: string[],
): string {
  for (const name of names) {
    if (name in row) return s(row[name]);
  }

  const expected = new Set(names.map(normalizeHeader));
  for (const [key, val] of Object.entries(row)) {
    if (expected.has(normalizeHeader(key))) return s(val);
  }

  return "";
}

function toSlug(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

function parseTags(raw: string): string[] {
  return raw
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
}

function statusIsPublished(status: string): boolean {
  return status.toLowerCase() === "published";
}

function mapArticleRow(row: Record<string, string>, index: number): NewsArticle | null {
  const title = s(row.title);
  const slug = s(row.slug) || toSlug(title);
  const content = s(row.content);
  const date = s(row.date);

  if (!title || !slug || !date || !content) return null;

  const excerpt =
    s(row.excerpt) ||
    content
      .replace(/\s+/g, " ")
      .slice(0, 180)
      .trim();

  return {
    id: s(row.id) || String(index + 1),
    title,
    slug,
    date,
    author: s(row.author) || DEFAULT_AUTHOR,
    excerpt,
    coverImageUrl: s(row.cover_image_url),
    tags: parseTags(s(row.tags)),
    category: normalizeNewsCategory(
      getField(row, ["category", "news_category", "article_category"]),
    ),
    youtubeUrl: getField(row, ["youtube_url", "youtube", "video_url"]),
    content,
  };
}

function sortByDateDesc(a: NewsArticle, b: NewsArticle): number {
  return b.date.localeCompare(a.date);
}

export function formatNewsDate(isoDate: string, locale: string = "en"): string {
  const parsed = new Date(`${isoDate}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return isoDate;
  const intlLocale = locale === "he" ? "he-IL" : "en-GB";
  return new Intl.DateTimeFormat(intlLocale, {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(parsed);
}

export async function fetchArticlesWithStatus(): Promise<FetchState> {
  const now = Date.now();
  if (cache && cache.expiresAt > now) {
    return { articles: cache.articles, error: cache.error };
  }

  if (!NEWS_SHEET_URL) {
    const error = "NEWS_SHEET_URL is not configured.";
    const fallback = IS_DEV ? DEV_FALLBACK_ARTICLES : [];
    cache = {
      articles: cache?.articles?.length ? cache.articles : fallback,
      error,
      expiresAt: now + CACHE_TTL_MS,
    };
    return { articles: cache.articles, error };
  }

  try {
    // cache:'no-store' guarantees truly fresh data on every render — revalidate:0
    // triggers stale-while-revalidate in Next.js Data Cache which can serve old empty results
    const res = await fetch(NEWS_SHEET_URL, { cache: "no-store" });
    if (!res.ok) throw new Error(`News fetch failed: ${res.status}`);
    const csv = await res.text();
    const rows = parseCsv<Record<string, string>>(csv);

    const articles = rows
      .filter((row) => statusIsPublished(s(row.status)))
      .map(mapArticleRow)
      .filter((row): row is NewsArticle => row !== null)
      .sort(sortByDateDesc);

    cache = {
      articles,
      error: null,
      expiresAt: now + CACHE_TTL_MS,
    };

    return { articles, error: null };
  } catch {
    const error = "Could not load news right now.";
    const staleArticles = cache?.articles?.length
      ? cache.articles
      : IS_DEV
        ? DEV_FALLBACK_ARTICLES
        : [];
    cache = { articles: staleArticles, error, expiresAt: now + CACHE_TTL_MS };
    return { articles: staleArticles, error };
  }
}

export async function fetchArticles(): Promise<NewsArticle[]> {
  const { articles } = await fetchArticlesWithStatus();
  return articles;
}

export async function fetchLatestArticles(limit = 3): Promise<NewsArticle[]> {
  const articles = await fetchArticles();
  return articles.slice(0, limit);
}

export async function fetchArticleBySlug(slug: string): Promise<NewsArticle | null> {
  const normalized = s(slug);
  if (!normalized) return null;
  const articles = await fetchArticles();
  return articles.find((article) => article.slug === normalized) ?? null;
}

export async function renderArticleBody(content: string): Promise<string> {
  const markdown = s(content);
  const parsed = await marked.parse(markdown, {
    gfm: true,
    breaks: true,
  });

  return sanitizeHtml(parsed, {
    allowedTags: sanitizeHtml.defaults.allowedTags.concat([
      "h1",
      "h2",
      "h3",
      "h4",
      "h5",
      "h6",
      "img",
    ]),
    allowedAttributes: {
      a: ["href", "name", "target", "rel"],
      img: ["src", "alt", "title"],
      code: ["class"],
    },
    allowedSchemes: ["http", "https", "mailto"],
    transformTags: {
      a: sanitizeHtml.simpleTransform("a", {
        target: "_blank",
        rel: "noopener noreferrer",
      }),
    },
  });
}

export function extractYouTubeVideoId(rawUrl: string): string | null {
  const value = s(rawUrl);
  if (!value) return null;

  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    return null;
  }

  const host = parsed.hostname.replace(/^www\./i, "").toLowerCase();
  let candidate = "";

  if (host === "youtu.be") {
    candidate = parsed.pathname.split("/").filter(Boolean)[0] || "";
  } else if (host === "youtube.com" || host === "m.youtube.com") {
    if (parsed.pathname === "/watch") {
      candidate = parsed.searchParams.get("v") || "";
    } else if (parsed.pathname.startsWith("/live/")) {
      candidate = parsed.pathname.split("/").filter(Boolean)[1] || "";
    } else if (parsed.pathname.startsWith("/embed/")) {
      candidate = parsed.pathname.split("/").filter(Boolean)[1] || "";
    } else if (parsed.pathname.startsWith("/shorts/")) {
      candidate = parsed.pathname.split("/").filter(Boolean)[1] || "";
    }
  }

  const cleaned = candidate.trim();
  if (!/^[A-Za-z0-9_-]{6,}$/.test(cleaned)) return null;
  return cleaned;
}

