/* ------------------------------------------------------------------ */
/*  Schedule / Race Events data layer                                  */
/* ------------------------------------------------------------------ */

export type RaceEvent = {
  /** Unique ID matching the race_results CSV, e.g. "s6_r01_main". */
  event_id: string;
  season: string;
  race_number: string;
  race_name: string;
  date: string;
  league: string; // "Main" | "Wild"
  status: string; // "Completed" | "Scheduled"
  country_code: string;
  poster_image?: string;
  results_image?: string;
  youtube_url?: string;
  /** Track / circuit name */
  track?: string;
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
};

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

/** Map raw CSV rows to typed RaceEvent objects. */
export function mapRaceEvents(raw: Record<string, string>[]): RaceEvent[] {
  return raw.map((row) => {
    const season = row.season ?? "";
    const raceNumber = row.race_number ?? "";
    const league = row.league ?? "Main";
    // Use explicit event_id from CSV if present, otherwise construct it
    const eventId = (row.event_id ?? "").trim() || buildEventId(season, raceNumber, league);
    const scRaw = (row.safety_cars ?? "").trim();
    const scNum = scRaw ? parseInt(scRaw, 10) : 0;

    return {
      event_id: eventId,
      season,
      race_number: raceNumber,
      race_name: row.race_name ?? "",
      date: row.date ?? "",
      league,
      status: row.status ?? "Scheduled",
      country_code: row.country_code ?? "",
      poster_image: sanitizeImagePath(row.poster_image),
      results_image: sanitizeImagePath(row.results_image),
      youtube_url: row.youtube_url?.trim() || undefined,
      track: (row.track ?? "").trim() || undefined,
      start_time: (row.start_time ?? "").trim() || undefined,
      weather: (row.weather ?? "").trim().toLowerCase() || undefined,
      safety_cars: isNaN(scNum) ? 0 : scNum,
      reverse_grid: (row.reverse_grid ?? "").trim().toLowerCase() || undefined,
      end_time: (row.end_time ?? "").trim() || undefined,
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

/** Group events by season for rendering. */
export function groupBySeason(events: RaceEvent[]): { season: string; events: RaceEvent[] }[] {
  const map = new Map<string, RaceEvent[]>();
  for (const event of events) {
    const key = event.season || "Unknown";
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(event);
  }
  // Return sorted: latest season first
  return Array.from(map.entries())
    .sort(([a], [b]) => (parseInt(b, 10) || 0) - (parseInt(a, 10) || 0))
    .map(([season, events]) => ({ season, events }));
}

/**
 * Convert a 2-letter country code to a flag emoji.
 * Falls back to 🏁 when the code is missing or invalid.
 */
export function countryFlag(code: string): string {
  if (!code || code.length !== 2) return "🏁";
  const upper = code.toUpperCase();
  const offset = 0x1f1e6 - 65; // 'A' = 65
  return String.fromCodePoint(upper.charCodeAt(0) + offset, upper.charCodeAt(1) + offset);
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
/*  Last Race / Next Race selectors                                     */
/* ------------------------------------------------------------------ */

/**
 * Return the most recent event whose date is <= today.
 * Among ties on the same date, prefer status=Completed.
 */
export function getLastRace(events: RaceEvent[]): RaceEvent | null {
  const now = new Date();
  const todayUTC = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());

  const past = events
    .map((e) => ({ event: e, date: parseDateDDMMYYYY(e.date) }))
    .filter((x): x is { event: RaceEvent; date: Date } => x.date !== null && x.date.getTime() <= todayUTC);

  if (past.length === 0) return null;

  // Sort descending by date, then prefer Completed
  past.sort((a, b) => {
    const diff = b.date.getTime() - a.date.getTime();
    if (diff !== 0) return diff;
    // Prefer completed
    const aComp = a.event.status.toLowerCase() === "completed" ? 1 : 0;
    const bComp = b.event.status.toLowerCase() === "completed" ? 1 : 0;
    return bComp - aComp;
  });

  return past[0].event;
}

/**
 * Return the next upcoming event whose date is > today.
 * Among ties on the same date, prefer status=Scheduled.
 */
export function getNextRace(events: RaceEvent[]): RaceEvent | null {
  const now = new Date();
  const todayUTC = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());

  const future = events
    .map((e) => ({ event: e, date: parseDateDDMMYYYY(e.date) }))
    .filter((x): x is { event: RaceEvent; date: Date } => x.date !== null && x.date.getTime() > todayUTC);

  if (future.length === 0) return null;

  // Sort ascending by date, then prefer Scheduled
  future.sort((a, b) => {
    const diff = a.date.getTime() - b.date.getTime();
    if (diff !== 0) return diff;
    const aSched = a.event.status.toLowerCase() === "scheduled" ? 1 : 0;
    const bSched = b.event.status.toLowerCase() === "scheduled" ? 1 : 0;
    return bSched - aSched;
  });

  return future[0].event;
}

/** Build a description string for a single race event. */
export function raceDescription(event: RaceEvent): string {
  const parts = [`Season ${event.season}`, `Race #${event.race_number}`, event.race_name];
  if (event.league.toLowerCase() === "wild") parts.push("Wild Event");
  return parts.filter(Boolean).join(", ");
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
    // If already marked completed in CSV, it's not live
    if (g.events.some((e) => e.status.toLowerCase() === "completed")) return false;
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
    const completed = g.events.some((e) => e.status.toLowerCase() === "completed");
    if (completed) return true;
    // Only count as "last" if the end time has passed
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
 * Return the next upcoming race-day group that hasn't started yet.
 * Uses start_time for time-aware comparison.
 * Among ties, prefer groups with Scheduled events.
 */
export function getNextRaceGroup(events: RaceEvent[]): RaceGroup | null {
  const nowUTC = Date.now();

  const future = buildGroups(events).filter((g) => groupTimestamp(g) > nowUTC);
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
