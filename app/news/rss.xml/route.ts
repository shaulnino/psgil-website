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
      const title = xmlEscape(article.title);
      const description = xmlEscape(article.excerpt);
      const pubDate = new Date(`${article.date}T00:00:00Z`).toUTCString();
      const imageUrl = resolveAbsoluteUrl(
        baseUrl,
        article.coverImageUrl || DEFAULT_SOCIAL_IMAGE,
      );
      const caption = `New on ISL News: ${article.title}\nRead more on our website.\n${articleUrl}`;
      const mediaTag = imageUrl
        ? `\n      <media:content url="${xmlEscape(imageUrl)}" medium="image" />`
        : "";
      const enclosureTag = imageUrl
        ? `\n      <enclosure url="${xmlEscape(imageUrl)}" type="${inferMimeTypeFromUrl(imageUrl)}" />`
        : "";
      const socialFields = `\n      <social_type>article</social_type>\n      <social_caption>${xmlEscape(caption)}</social_caption>\n      <social_image_url>${xmlEscape(imageUrl)}</social_image_url>`;
      const tagsXml = article.tags
        .map((tag) => `\n      <category>${xmlEscape(tag)}</category>`)
        .join("");
      const categoryXml = `\n      <category>${xmlEscape(article.category)}</category>`;

      return `  <item>
      <title>${title}</title>
      <link>${xmlEscape(articleUrl)}</link>
      <guid isPermaLink="true">${xmlEscape(articleUrl)}</guid>
      <description>${description}</description>
      <pubDate>${pubDate}</pubDate>${mediaTag}${enclosureTag}${categoryXml}${tagsXml}${socialFields}
    </item>`;
    })
    .join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:media="http://search.yahoo.com/mrss/">
<channel>
  <title>ISL News</title>
  <link>${xmlEscape(`${baseUrl}/news`)}</link>
  <description>Latest ISL news articles and race updates.</description>
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

