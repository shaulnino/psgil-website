import { fetchArticles } from "@/lib/newsData";

export const revalidate = 300;

const FALLBACK_SITE_URL = "https://psgil.com";

function xmlEscape(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function resolveSiteBaseUrl(): string {
  const envBase =
    process.env.SITE_BASE_URL ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "");

  const normalized = String(envBase || "").trim().replace(/\/+$/, "");
  return normalized || FALLBACK_SITE_URL;
}

function resolveAbsoluteUrl(baseUrl: string, value: string): string {
  const raw = String(value || "").trim();
  if (!raw) return "";
  if (/^https?:\/\//i.test(raw)) return raw;
  return `${baseUrl}${raw.startsWith("/") ? "" : "/"}${raw}`;
}

export async function GET() {
  const baseUrl = resolveSiteBaseUrl();
  const articles = await fetchArticles();
  const now = new Date().toUTCString();

  const itemsXml = articles
    .map((article) => {
      const articleUrl = `${baseUrl}/news/${encodeURIComponent(article.slug)}`;
      const title = xmlEscape(article.title);
      const description = xmlEscape(article.excerpt);
      const pubDate = new Date(`${article.date}T00:00:00Z`).toUTCString();
      const imageUrl = resolveAbsoluteUrl(baseUrl, article.coverImageUrl);
      const mediaTag = imageUrl
        ? `\n      <media:content url="${xmlEscape(imageUrl)}" medium="image" />`
        : "";

      return `  <item>
      <title>${title}</title>
      <link>${xmlEscape(articleUrl)}</link>
      <guid isPermaLink="true">${xmlEscape(articleUrl)}</guid>
      <description>${description}</description>
      <pubDate>${pubDate}</pubDate>${mediaTag}
    </item>`;
    })
    .join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:media="http://search.yahoo.com/mrss/">
<channel>
  <title>PSGiL News</title>
  <link>${xmlEscape(`${baseUrl}/news`)}</link>
  <description>Latest PSGiL news articles and race updates.</description>
  <language>en</language>
  <lastBuildDate>${now}</lastBuildDate>
${itemsXml}
</channel>
</rss>`;

  return new Response(xml, {
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8",
      "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
    },
  });
}

