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

const ALERT_WINDOW_MINUTES = 5;
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
<rss version="2.0">
<channel>
  <title>PSGiL Race Alerts</title>
  <link>${xmlEscape(`${baseUrl}/schedule`)}</link>
  <description>Automated countdown alerts before PSGiL race start.</description>
  <language>en</language>
  <lastBuildDate>${now}</lastBuildDate>
${itemXml}
</channel>
</rss>`;
}

function createAlertItemXml(baseUrl: string, event: RaceEvent): string {
  const title = `PSGiL starts in 5 minutes — ${event.race_name}`;
  const description = `The ${event.race_name} broadcast is about to begin. Jump in now and watch the race live on PSGiL.`;
  const link = buildWatchLink(baseUrl, event);
  const guid = buildAlertGuid(event);
  const pubDate = new Date().toUTCString();

  return `  <item>
    <title>${xmlEscape(title)}</title>
    <link>${xmlEscape(link)}</link>
    <guid isPermaLink="false">${xmlEscape(guid)}</guid>
    <description>${xmlEscape(description)}</description>
    <pubDate>${pubDate}</pubDate>
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

