import { fetchCsv, parseCsv } from "@/lib/csv";
import { GLOBAL_CSV_URLS } from "@/lib/seasonConfig";
import {
  mapRaceEvents,
  toIsraelTimestamp,
  type RaceEvent,
} from "@/lib/scheduleData";
import {
  hasRaceAlertBeenPosted,
  markRaceAlertPosted,
} from "@/lib/raceAlertState";

export const dynamic = "force-dynamic";

const ALERT_WINDOW_MINUTES = 15;
// TODO(rebrand): swap to the new ISL domain when finalized — kept as psgil.com for now.
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

function resolveAbsoluteUrl(baseUrl: string, value?: string): string {
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

function normalizeSeasonKey(raw: string): string {
  const value = String(raw || "").trim();
  if (!value) return "";
  return value.startsWith("S") ? value : `S${value}`;
}

function buildWatchLink(baseUrl: string, event: RaceEvent): string {
  const season = normalizeSeasonKey(event.season);
  const params = new URLSearchParams();
  if (season) params.set("season", season);
  params.set("event", event.event_id);
  params.set("watch", "1");
  return `${baseUrl}/schedule?${params.toString()}#watch`;
}

function buildAlertGuid(event: RaceEvent): string {
  return `race-alert-${event.event_id}-${normalizeSeasonKey(event.season)}-${event.race_number}`;
}

function buildAlertKey(event: RaceEvent): string {
  return `${event.event_id}|${event.date}|${event.start_time || ""}`;
}

function getEventStartTimestamp(event: RaceEvent): number | null {
  if (!event.date || !event.start_time) return null;
  return toIsraelTimestamp(event.date, event.start_time);
}

function getNextScheduledEvent(events: RaceEvent[], nowMs: number): RaceEvent | null {
  const scheduled = events
    .filter((event) => event.status.trim().toLowerCase() === "scheduled")
    .map((event) => ({ event, ts: getEventStartTimestamp(event) }))
    .filter((entry): entry is { event: RaceEvent; ts: number } => entry.ts !== null)
    .filter((entry) => entry.ts > nowMs)
    .sort((a, b) => a.ts - b.ts);

  return scheduled[0]?.event ?? null;
}

function parseBooleanParam(value: string | null): boolean {
  const v = String(value || "").trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes";
}

function parseRaceIdParam(value: string | null): string {
  return String(value || "").trim().toLowerCase();
}

function createRssXml(baseUrl: string, itemXml: string): string {
  const now = new Date().toUTCString();
  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:media="http://search.yahoo.com/mrss/">
<channel>
  <title>ISL Race Alerts</title>
  <link>${xmlEscape(`${baseUrl}/schedule`)}</link>
  <description>Automated countdown alerts before ISL race start.</description>
  <language>en</language>
  <lastBuildDate>${now}</lastBuildDate>
${itemXml}
</channel>
</rss>`;
}

function createAlertItemXml(baseUrl: string, event: RaceEvent): string {
  const title = `ISL Race Starting Soon — ${event.race_name}`;
  const description = "The race will begin shortly. Watch it live here:";
  const link = buildWatchLink(baseUrl, event);
  const guid = buildAlertGuid(event);
  const caption = `ISL goes live in 15 minutes! ${event.race_name}\nWatch on our website:\n${link}`;
  const pubDate = new Date().toUTCString();
  const posterUrl = resolveAbsoluteUrl(
    baseUrl,
    event.poster_image || DEFAULT_SOCIAL_IMAGE,
  );
  const posterMimeType = posterUrl ? inferMimeTypeFromUrl(posterUrl) : "";
  const mediaTag = posterUrl
    ? `\n    <media:content url="${xmlEscape(posterUrl)}" medium="image" />`
    : "";
  const enclosureTag = posterUrl
    ? `\n    <enclosure url="${xmlEscape(posterUrl)}" type="${posterMimeType}" />`
    : "";

  return `  <item>
    <title>${xmlEscape(title)}</title>
    <link>${xmlEscape(link)}</link>
    <guid isPermaLink="false">${xmlEscape(guid)}</guid>
    <description>${xmlEscape(description)}</description>
    <pubDate>${pubDate}</pubDate>${mediaTag}${enclosureTag}
    <social_type>race_alert</social_type>
    <social_caption>${xmlEscape(caption)}</social_caption>
    <social_image_url>${xmlEscape(posterUrl)}</social_image_url>
  </item>`;
}

export async function GET(request: Request) {
  const baseUrl = resolveSiteBaseUrl();
  const url = new URL(request.url);
  const force = parseBooleanParam(url.searchParams.get("force"));
  const commit = parseBooleanParam(url.searchParams.get("commit"));
  const requestedRaceId = parseRaceIdParam(url.searchParams.get("race_id"));
  const nowMs = Date.now();

  let events: RaceEvent[] = [];
  try {
    const scheduleCsv = await fetchCsv(GLOBAL_CSV_URLS.schedule);
    events = mapRaceEvents(parseCsv<Record<string, string>>(scheduleCsv));
  } catch {
    const xml = createRssXml(baseUrl, "");
    return new Response(xml, {
      headers: {
        "Content-Type": "application/rss+xml; charset=utf-8",
        "Cache-Control": "no-store",
      },
    });
  }

  let targetEvent: RaceEvent | null = null;
  if (requestedRaceId) {
    targetEvent =
      events.find((event) => event.event_id.trim().toLowerCase() === requestedRaceId) ??
      null;
  } else {
    targetEvent = getNextScheduledEvent(events, nowMs);
  }

  if (!targetEvent) {
    const xml = createRssXml(baseUrl, "");
    return new Response(xml, {
      headers: {
        "Content-Type": "application/rss+xml; charset=utf-8",
        "Cache-Control": "no-store",
      },
    });
  }

  const startTs = getEventStartTimestamp(targetEvent);
  if (!startTs && !force) {
    const xml = createRssXml(baseUrl, "");
    return new Response(xml, {
      headers: {
        "Content-Type": "application/rss+xml; charset=utf-8",
        "Cache-Control": "no-store",
      },
    });
  }

  const inWindow = Boolean(
    startTs &&
      nowMs >= startTs - ALERT_WINDOW_MINUTES * 60_000 &&
      nowMs < startTs,
  );
  const alertKey = buildAlertKey(targetEvent);
  const alreadyPosted = await hasRaceAlertBeenPosted(alertKey);
  const shouldEmit = force || (inWindow && !alreadyPosted);

  if (!shouldEmit) {
    const xml = createRssXml(baseUrl, "");
    return new Response(xml, {
      headers: {
        "Content-Type": "application/rss+xml; charset=utf-8",
        "Cache-Control": "no-store",
      },
    });
  }

  if (!force || commit) {
    await markRaceAlertPosted(alertKey);
  }

  const itemXml = createAlertItemXml(baseUrl, targetEvent);
  const xml = createRssXml(baseUrl, itemXml);

  return new Response(xml, {
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

