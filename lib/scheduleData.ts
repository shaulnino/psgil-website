/* ------------------------------------------------------------------ */
/*  Schedule / Race Events data layer                                  */
/* ------------------------------------------------------------------ */

import { getYouTubeVideoId } from "@/lib/youtube";

export type RaceFormat = "50%" | "25%" | "sprint";

export type RaceEvent = {
  /** Unique ID matching the race_results CSV, e.g. "s6_r01_main". */
  event_id: string;
  season: string;
  race_number: string;
  race_name: string;
  /** Optional Hebrew Grand Prix name (csv column: race_name_he). Falls back to race_name. */
  race_name_he?: string;
  date: string;
  league: string; // "Main" | "Wild"
  status: string; // "Completed" | "Scheduled"
  country_code: string;
  poster_image?: string;
  results_image?: string;
  youtube_url?: string;
  /** Track / circuit name */
  track?: string;
  /** Optional Hebrew circuit name (csv column: track_he). Falls back to track. */
  track_he?: string;
  /** Start time in HH:MM format (Israel local time, e.g. "21:30") */
  start_time?: string;
  /** "dry" | "wet" | "mixed" or empty */
  weather?: string;
  /** Number of safety cars (0 or empty = none) */
  safety_cars?: number;
  /** "yes" | "no" or empty (treated as "no") */
  reverse_grid?: string;
  /** End time in HH:MM format (Israel local time). If empty, defaults to start_time + 2h. */
  end_time?: string;
  /** "provisional" | "final" or empty — whether race results are pending steward decisions */
  results_status?: string;
  /**
   * Race distance/type format.
   * Populated from the "race_format" column in the schedule CSV.
   * Defaults to "50%" when the column is absent (safe fallback for existing data).
   */
  race_format: RaceFormat;
  /**
   * Whether this event is a playoff round.
   * Populated from the "is_playoff" column (TRUE/FALSE) in the schedule CSV.
   */
  is_playoff: boolean;
};

/** Grand Prix name in the active locale — Hebrew when available, else English. */
export function localizedRaceName(
  event: Pick<RaceEvent, "race_name" | "race_name_he">,
  locale: string,
): string {
  return locale === "he" && event.race_name_he ? event.race_name_he : event.race_name;
}

/** Circuit/track name in the active locale — Hebrew when available, else English. */
export function localizedTrack(
  event: Pick<RaceEvent, "track" | "track_he">,
  locale: string,
): string | undefined {
  return locale === "he" && event.track_he ? event.track_he : event.track;
}

/**
 * Ensure an image path is a valid absolute path or full URL.
 * Returns undefined for empty / whitespace-only values.
 */
function sanitizeImagePath(value: string | undefined): string | undefined {
  const v = (value ?? "").trim();
  if (!v) return undefined;
  // Already a full URL or absolute path
  if (v.startsWith("http://") || v.startsWith("https://") || v.startsWith("/")) return v;
  // Relative path without leading slash – prepend /
  return `/${v}`;
}

/**
 * Build event_id from schedule fields (matches race_results CSV convention).
 * e.g. season="6", race_number="1", league="Main" → "s6_r01_main"
 */
function buildEventId(season: string, raceNumber: string, league: string): string {
  const s = (season ?? "").trim();
  const r = (raceNumber ?? "").trim().padStart(2, "0");
  const l = (league ?? "main").trim().toLowerCase();
  return `s${s}_r${r}_${l}`;
}

/** Normalise CSV header for loose matching (Schedule tab column names vary in Sheets). */
function normalizeScheduleHeader(value: string): string {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
}

/**
 * YouTube / broadcast URL from a Schedule CSV row.
 * Accepts common header variants (e.g. youtube_url, YouTube, video_url).
 */
function pickYoutubeUrlFromScheduleRow(row: Record<string, string>): string | undefined {
  const aliases = new Set([
    "youtube_url",
    "youtube",
    "video_url",
    "watch_url",
    "youtube_link",
    "broadcast_url",
    "stream_url",
  ]);
  for (const [key, val] of Object.entries(row)) {
    if (aliases.has(normalizeScheduleHeader(key))) {
      const v = (val ?? "").trim();
      if (v) return v;
    }
  }
  return undefined;
}

/**
 * Normalize a raw CSV row so column headers are always in snake_case.
 * e.g. "Race Format" → "race_format", "Is Playoff" → "is_playoff"
 * This makes mapRaceEvents resilient to Google Sheets column name variants.
 */
function normalizeRow(row: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(row)) {
    out[normalizeScheduleHeader(k)] = v;
  }
  return out;
}

/** Map raw CSV rows to typed RaceEvent objects. */
export function mapRaceEvents(raw: Record<string, string>[]): RaceEvent[] {
  return raw.map((rawRow) => {
    const row = normalizeRow(rawRow);
    const season = row.season ?? "";
    const raceNumber = row.race_number ?? "";
    const explicitEventId = (row.event_id ?? "").trim();
    // Derive league: prefer the explicit column, fall back to the event_id suffix, then "Main".
    // Use || instead of ?? so empty-string CSV cells are also caught.
    const leagueFromEventId = /_(wild)$/i.test(explicitEventId) ? "Wild"
      : /_(main)$/i.test(explicitEventId) ? "Main"
      : undefined;
    const league = (row.league ?? "").trim() || leagueFromEventId || "Main";
    // Use explicit event_id from CSV if present, otherwise construct it
    const eventId = explicitEventId || buildEventId(season, raceNumber, league);
    const scRaw = (row.safety_cars ?? "").trim();
    const scNum = scRaw ? parseInt(scRaw, 10) : 0;

    const raceFormatRaw = (row.race_format ?? "").trim().toLowerCase();
    // Accept values like "sprint", "sprint race", "25%", "25% race", "50%", "50% race"
    const raceFormat: RaceFormat =
      raceFormatRaw.startsWith("sprint") ? "sprint"
      : raceFormatRaw.startsWith("25%") ? "25%"
      : "50%"; // default — covers "50%", "50% race", and missing column

    return {
      event_id: eventId,
      season,
      race_number: raceNumber,
      race_name: row.race_name ?? "",
      race_name_he: (row.race_name_he ?? "").trim() || undefined,
      date: row.date ?? "",
      league,
      status: row.status ?? "Scheduled",
      country_code: row.country_code ?? "",
      poster_image: sanitizeImagePath(row.poster_image),
      results_image: sanitizeImagePath(row.results_image),
      youtube_url: pickYoutubeUrlFromScheduleRow(row),
      track: (row.track ?? "").trim() || undefined,
      track_he: (row.track_he ?? "").trim() || undefined,
      start_time: (row.start_time ?? "").trim() || undefined,
      weather: (row.weather ?? "").trim().toLowerCase() || undefined,
      safety_cars: isNaN(scNum) ? 0 : scNum,
      reverse_grid: (row.reverse_grid ?? "").trim().toLowerCase() || undefined,
      end_time: (row.end_time ?? "").trim() || undefined,
      results_status: (row.results_status ?? "").trim().toLowerCase() || undefined,
      race_format: raceFormat,
      is_playoff: (row.is_playoff ?? "").trim().toUpperCase() === "TRUE",
    };
  });
}

/** Sort: latest season first, then race_number ascending within each season. */
export function sortRaceEvents(events: RaceEvent[]): RaceEvent[] {
  return [...events].sort((a, b) => {
    // Season descending (parse as number if possible)
    const seasonA = parseInt(a.season, 10) || 0;
    const seasonB = parseInt(b.season, 10) || 0;
    if (seasonB !== seasonA) return seasonB - seasonA;

    // Race number ascending
    const numA = parseInt(a.race_number, 10) || 0;
    const numB = parseInt(b.race_number, 10) || 0;
    return numA - numB;
  });
}

/* ------------------------------------------------------------------ */
/*  Date helpers                                                        */
/* ------------------------------------------------------------------ */

/**
 * Parse a DD.MM.YYYY string into a Date (UTC midnight).
 * Returns null for invalid / empty values.
 */
export function parseDateDDMMYYYY(value: string): Date | null {
  const m = (value ?? "").trim().match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  if (!m) return null;
  const day = parseInt(m[1], 10);
  const month = parseInt(m[2], 10) - 1; // 0-indexed
  const year = parseInt(m[3], 10);
  const d = new Date(Date.UTC(year, month, day));
  // Validate the components survived construction
  if (d.getUTCFullYear() !== year || d.getUTCMonth() !== month || d.getUTCDate() !== day)
    return null;
  return d;
}

/* ------------------------------------------------------------------ */
/*  Israel timezone helpers                                             */
/* ------------------------------------------------------------------ */

/**
 * Convert a DD.MM.YYYY date + HH:MM time (Israel local) to a UTC timestamp (ms).
 * Returns null if parsing fails.
 */
export function toIsraelTimestamp(dateStr: string, timeStr?: string): number | null {
  const m = (dateStr ?? "").trim().match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  if (!m) return null;
  const day = parseInt(m[1], 10);
  const month = parseInt(m[2], 10);
  const year = parseInt(m[3], 10);
  const [h, min] = (timeStr || "21:00").split(":").map(Number);

  // Determine Israel UTC offset for this date (handles DST automatically).
  // We use Intl.DateTimeFormat to get the Israel wall-clock hour at a known
  // UTC reference point (noon UTC).  This avoids the bug where
  // `new Date(localeString)` parses in the browser's local timezone.
  const refUTC = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Jerusalem",
    hour: "numeric",
    hour12: false,
  });
  const israelHourAtRef = parseInt(formatter.format(refUTC), 10);
  const offsetHours = israelHourAtRef - 12; // Israel hour minus the known UTC hour (12)

  // "h:min Israel time" → UTC = h - offset
  return Date.UTC(year, month - 1, day, h - offsetHours, min, 0);
}

/* ------------------------------------------------------------------ */
/*  Race-day groups (double-header support)                             */
/* ------------------------------------------------------------------ */

/** A group of races sharing the same date + league. */
export type RaceGroup = {
  /** All events in this group, sorted by race_number ascending. */
  events: RaceEvent[];
  /** Shared date string (DD.MM.YYYY) */
  date: string;
  /** Shared league */
  league: string;
  /** Shared season */
  season: string;
  /** Parsed Date for comparison (internal, stripped before client serialisation). */
  _dateObj?: Date;
};

/**
 * Build a key for grouping: "date|league" (lowercased league).
 */
function groupKey(e: RaceEvent): string {
  return `${e.date.trim()}|${(e.league ?? "").trim().toLowerCase()}`;
}

/**
 * Group events by date + league, sorting events within each group by race_number asc.
 */
function buildGroups(events: RaceEvent[]): RaceGroup[] {
  const map = new Map<string, RaceEvent[]>();
  for (const e of events) {
    const key = groupKey(e);
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(e);
  }

  const groups: RaceGroup[] = [];
  for (const [, evts] of map) {
    // Sort by race_number ascending
    evts.sort((a, b) => (parseInt(a.race_number, 10) || 0) - (parseInt(b.race_number, 10) || 0));
    const first = evts[0];
    const dateObj = parseDateDDMMYYYY(first.date);
    if (!dateObj) continue; // skip events with unparseable dates
    groups.push({
      events: evts,
      date: first.date,
      league: first.league,
      season: first.season,
      _dateObj: dateObj,
    });
  }
  return groups;
}

/**
 * Find the race-day group (same calendar date + league) that contains this event_id.
 */
export function findRaceGroupContainingEvent(events: RaceEvent[], eventId: string): RaceGroup | null {
  const needle = (eventId ?? "").trim().toLowerCase();
  if (!needle) return null;
  const groups = buildGroups(events);
  return (
    groups.find((g) => g.events.some((e) => e.event_id.trim().toLowerCase() === needle)) ?? null
  );
}

/**
 * Resolve a single race-day group from one or more event_ids embedded in an article.
 * When ids refer to different race days, picks the group that matches the most listed ids.
 */
export function resolveRaceGroupForEventIds(events: RaceEvent[], eventIds: string[]): RaceGroup | null {
  const ids = [...new Set(eventIds.map((id) => id.trim().toLowerCase()).filter(Boolean))];
  if (ids.length === 0) return null;

  const groupsByKey = new Map<string, RaceGroup>();
  for (const id of ids) {
    const g = findRaceGroupContainingEvent(events, id);
    if (!g) continue;
    const key = groupKey(g.events[0]);
    groupsByKey.set(key, g);
  }

  if (groupsByKey.size === 0) return null;
  if (groupsByKey.size === 1) return [...groupsByKey.values()][0];

  let best: RaceGroup | null = null;
  let bestScore = -1;
  for (const g of groupsByKey.values()) {
    const idsInGroup = new Set(g.events.map((e) => e.event_id.trim().toLowerCase()));
    const score = ids.filter((id) => idsInGroup.has(id)).length;
    if (score > bestScore) {
      bestScore = score;
      best = g;
    }
  }
  return best;
}

/**
 * Season digit from copy, e.g. "S6 Wild …" → "6".
 */
export function parseSeasonDigitFromArticleText(text: string): string | null {
  const m = (text ?? "").match(/\bS(\d+)\b/i);
  return m ? m[1] : null;
}

/**
 * "Wild Event 2" / wild_event_2 / slug wild-event-2 = the 2nd **Wild event day** (a calendar day
 * with two Wild races), not "round 2" or the second row on the schedule.
 */
export function parseWildEventDayNumberFromText(text: string): number | null {
  const t = text ?? "";
  const patterns = [
    /wild\s*event\s*#?\s*(\d+)/i,
    /wild_event_(\d+)/i,
    /wild_event_day_(\d+)/i,
    /wild\s*event\s*day\s*#?\s*(\d+)/i,
    /wild-event-(\d+)/i,
    /wild_event(\d+)/i,
  ];
  for (const re of patterns) {
    const m = t.match(re);
    if (m) {
      const n = parseInt(m[1], 10);
      if (!Number.isNaN(n) && n >= 1) return n;
    }
  }
  return null;
}

/**
 * Wild event days with 2+ races the same calendar day (double-headers), in chronological order.
 * Index 0 = Wild Event 1, index 1 = Wild Event 2, …
 */
function normalizeSeasonDigitForMatch(value: string): string {
  return (value ?? "").trim().replace(/^S/i, "");
}

export function listWildDoubleHeaderDaysForSeason(events: RaceEvent[], seasonDigit: string): RaceGroup[] {
  const s = normalizeSeasonDigitForMatch(seasonDigit);
  if (!s) return [];
  const groups = buildGroups(events);
  const wildMulti = groups.filter(
    (g) =>
      normalizeSeasonDigitForMatch(g.season) === s &&
      g.league.trim().toLowerCase() === "wild" &&
      g.events.length >= 2,
  );
  wildMulti.sort((a, b) => groupTimestamp(a) - groupTimestamp(b));
  return wildMulti;
}

/**
 * Resolve which race-day group a recap article refers to.
 * Prefer explicit "Wild Event N" + season in copy over bare event_ids (which may encode round numbers
 * and be confused with "event day" numbering).
 */
export function resolveRecapRaceGroupForNewsArticle(
  events: RaceEvent[],
  opts: { articleId: string; articleTitle: string; parsedEventIds: string[] },
): RaceGroup | null {
  const blob = `${opts.articleId} ${opts.articleTitle}`;
  const wildDay = parseWildEventDayNumberFromText(blob);
  const seasonDigitFromId = opts.parsedEventIds[0]?.match(/^s(\d+)_/i)?.[1] ?? null;
  const seasonDigit = seasonDigitFromId ?? parseSeasonDigitFromArticleText(blob);

  if (wildDay !== null && seasonDigit !== null) {
    const list = listWildDoubleHeaderDaysForSeason(events, seasonDigit);
    const g = list[wildDay - 1];
    if (g) return g;
  }

  if (opts.parsedEventIds.length > 0) {
    return resolveRaceGroupForEventIds(events, opts.parsedEventIds);
  }

  return null;
}

/**
 * YouTube watch links for a race-day group (double-headers: one button per distinct URL).
 */
export function youtubeWatchLinksForGroup(group: RaceGroup): { label: string; url: string }[] {
  const seen = new Set<string>();
  const result: { label: string; url: string }[] = [];
  for (const e of group.events) {
    const youtubeUrl = (e.youtube_url ?? "").trim();
    if (getYouTubeVideoId(youtubeUrl) && !seen.has(youtubeUrl)) {
      seen.add(youtubeUrl);
      result.push({
        label: group.events.length > 1 ? `Watch Race #${e.race_number}` : "Watch the Race",
        url: youtubeUrl,
      });
    }
  }
  if (result.length === 1) result[0].label = "Watch the Race";
  return result;
}

/**
 * "Watch race" URLs for news articles — always taken from the Schedule CSV rows
 * for the resolved event(s), never from the news sheet or article body.
 */
export function scheduleWatchLinksForArticleEventIds(
  events: RaceEvent[],
  eventIds: string[],
): { label: string; url: string }[] {
  const ids = eventIds.map((id) => id.trim().toLowerCase()).filter(Boolean);
  if (ids.length === 0) return [];

  const group = resolveRaceGroupForEventIds(events, ids);
  if (group) return youtubeWatchLinksForGroup(group);

  const primary = ids[0];
  const ev = events.find((e) => e.event_id.trim().toLowerCase() === primary);
  const url = (ev?.youtube_url ?? "").trim();
  if (!getYouTubeVideoId(url)) return [];
  return [{ label: "Watch the Race", url }];
}

/**
 * Get the effective timestamp for a race group.
 * Uses the earliest start_time among events for time-aware comparison.
 * Falls back to midnight Israel time if no start_time is available.
 */
export function groupTimestamp(g: RaceGroup): number {
  // Find the earliest start_time in the group
  const startTime = g.events
    .map((e) => e.start_time)
    .filter((t): t is string => !!t)
    .sort()[0]; // earliest HH:MM

  const ts = toIsraelTimestamp(g.date, startTime || undefined);
  // Fallback to date-only (midnight UTC) if parsing fails
  return ts ?? g._dateObj!.getTime();
}

/* ------------------------------------------------------------------ */
/*  Default race duration (used when end_time is not in the CSV)       */
/* ------------------------------------------------------------------ */

export const DEFAULT_RACE_DURATION_MS = 2 * 3_600_000; // 2 hours

/**
 * Get the effective END timestamp for a race group.
 * Uses the latest end_time among events if available.
 * Falls back to start_time + DEFAULT_RACE_DURATION_MS.
 */
export function groupEndTimestamp(g: RaceGroup): number {
  // Check for explicit end_time values
  const endTimes = g.events
    .map((e) => (e.end_time ? toIsraelTimestamp(e.date, e.end_time) : null))
    .filter((t): t is number => t !== null);

  if (endTimes.length > 0) {
    return Math.max(...endTimes);
  }

  // Default: start + 2 hours
  return groupTimestamp(g) + DEFAULT_RACE_DURATION_MS;
}

/**
 * Return a race-day group that is currently LIVE (started but not ended).
 * A group is live when: start ≤ now < end AND not marked "completed".
 */
export function getLiveRaceGroup(events: RaceEvent[]): RaceGroup | null {
  const nowUTC = Date.now();
  const groups = buildGroups(events);

  const live = groups.filter((g) => {
    const s = (e: RaceEvent) => e.status.toLowerCase();
    if (g.events.some((e) => s(e) === "completed" || s(e) === "cancelled")) return false;
    const start = groupTimestamp(g);
    const end = groupEndTimestamp(g);
    return start <= nowUTC && nowUTC < end;
  });

  if (live.length === 0) return null;
  // If multiple groups are somehow live, pick the one that started most recently
  live.sort((a, b) => groupTimestamp(b) - groupTimestamp(a));
  return live[0];
}

/**
 * Return the most recent race-day group that has ENDED (or is "completed").
 * A race is "last" only after its end time has passed or it's marked completed.
 * Among ties, prefer groups where at least one event is Completed.
 */
export function getLastRaceGroup(events: RaceEvent[]): RaceGroup | null {
  const nowUTC = Date.now();

  const past = buildGroups(events).filter((g) => {
    if (g.events.some((e) => e.status.toLowerCase() === "cancelled")) return false;
    const completed = g.events.some((e) => e.status.toLowerCase() === "completed");
    if (completed) return true;
    return groupEndTimestamp(g) <= nowUTC;
  });
  if (past.length === 0) return null;

  past.sort((a, b) => {
    const diff = groupTimestamp(b) - groupTimestamp(a);
    if (diff !== 0) return diff;
    const aComp = a.events.some((e) => e.status.toLowerCase() === "completed") ? 1 : 0;
    const bComp = b.events.some((e) => e.status.toLowerCase() === "completed") ? 1 : 0;
    return bComp - aComp;
  });

  return past[0];
}

/**
 * A stable identifier for a race-day group: the event_id of its earliest race
 * (events within a group are sorted by race_number ascending). Used as the
 * attendance key so a double-header night is a single RSVP (PW-3).
 */
export function raceGroupAnchorId(group: RaceGroup): string {
  return group.events[0]?.event_id ?? "";
}

/**
 * All upcoming race-day groups that haven't started yet, earliest first.
 * Cancelled groups are excluded. Used by the attendance surfaces (PW-3).
 */
export function getUpcomingRaceGroups(events: RaceEvent[]): RaceGroup[] {
  const nowUTC = Date.now();
  const future = buildGroups(events).filter(
    (g) => groupTimestamp(g) > nowUTC && !g.events.some((e) => e.status.toLowerCase() === "cancelled"),
  );
  return future.sort((a, b) => groupTimestamp(a) - groupTimestamp(b));
}

/**
 * Return the next upcoming race-day group that hasn't started yet.
 * Uses start_time for time-aware comparison.
 * Among ties, prefer groups with Scheduled events.
 */
export function getNextRaceGroup(events: RaceEvent[]): RaceGroup | null {
  const nowUTC = Date.now();

  const future = buildGroups(events).filter(
    (g) => groupTimestamp(g) > nowUTC && !g.events.some((e) => e.status.toLowerCase() === "cancelled")
  );
  if (future.length === 0) return null;

  future.sort((a, b) => {
    const diff = groupTimestamp(a) - groupTimestamp(b);
    if (diff !== 0) return diff;
    const aSched = a.events.some((e) => e.status.toLowerCase() === "scheduled") ? 1 : 0;
    const bSched = b.events.some((e) => e.status.toLowerCase() === "scheduled") ? 1 : 0;
    return bSched - aSched;
  });

  return future[0];
}

/**
 * The race-day group immediately BEFORE a reference timestamp — the latest
 * group whose start is strictly earlier than `beforeTs`, excluding cancelled
 * groups. Used to anchor the attendance open window ("3h after the previous
 * race started"). Returns null when there is no earlier race (e.g. the first
 * race of a season). Deterministic regardless of completion status.
 */
export function getPreviousRaceGroup(events: RaceEvent[], beforeTs: number): RaceGroup | null {
  const past = buildGroups(events).filter(
    (g) =>
      groupTimestamp(g) < beforeTs &&
      !g.events.some((e) => e.status.toLowerCase() === "cancelled"),
  );
  if (past.length === 0) return null;
  past.sort((a, b) => groupTimestamp(b) - groupTimestamp(a));
  return past[0];
}
