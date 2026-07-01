import { fetchArticles } from "@/lib/newsData";

export const revalidate = 300;

const FALLBACK_SITE_URL = "https://psgil.com";
const DEFAULT_SOCIAL_IMAGE = "/psgil-logo.png";

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

function inferMimeTypeFromUrl(url: string): string {
  const value = url.toLowerCase();
  if (value.endsWith(".png")) return "image/png";
  if (value.endsWith(".webp")) return "image/webp";
  if (value.endsWith(".gif")) return "image/gif";
  if (value.endsWith(".jpg") || value.endsWith(".jpeg")) return "image/jpeg";
  return "image/jpeg";
}

export async function GET() {
  const baseUrl = resolveSiteBaseUrl();
  const articles = await fetchArticles();
  const now = new Date().toUTCString();

  const itemsXml = articles
    .map((article) => {
      const articleUrl = `${baseUrl}/news/${encodeURIComponent(article.slug)}`;
      const imageUrl = resolveAbsoluteUrl(
        baseUrl,
        article.coverImageUrl || DEFAULT_SOCIAL_IMAGE,
      );
      const caption = `New on ISL News: ${article.title}\nRead more on our website.\n${articleUrl}`;
      const pubDate = new Date(`${article.date}T00:00:00Z`).toUTCString();
      const tags = article.tags.length ? `Tags: ${article.tags.join(", ")}` : "";
      const description = [article.excerpt, tags].filter(Boolean).join(" | ");

      const mediaTag = imageUrl
        ? `\n      <media:content url="${xmlEscape(imageUrl)}" medium="image" />`
        : "";
      const enclosureTag = imageUrl
        ? `\n      <enclosure url="${xmlEscape(imageUrl)}" type="${inferMimeTypeFromUrl(imageUrl)}" />`
        : "";

      return `  <item>
      <title>${xmlEscape(article.title)}</title>
      <link>${xmlEscape(articleUrl)}</link>
      <guid isPermaLink="true">${xmlEscape(articleUrl)}</guid>
      <description>${xmlEscape(description)}</description>
      <pubDate>${pubDate}</pubDate>${mediaTag}${enclosureTag}
      <category>${xmlEscape(article.category)}</category>
      <social_type>article</social_type>
      <social_caption>${xmlEscape(caption)}</social_caption>
      <social_image_url>${xmlEscape(imageUrl)}</social_image_url>
    </item>`;
    })
    .join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:media="http://search.yahoo.com/mrss/">
<channel>
  <title>ISL News (Instagram)</title>
  <link>${xmlEscape(`${baseUrl}/news`)}</link>
  <description>Instagram-ready ISL news feed.</description>
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

