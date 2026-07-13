/**
 * Next-race attendance resolver (PW-3).
 *
 * Attendance targets exactly ONE race at a time — the next race-day of the
 * current season — and is only editable inside a window:
 *   - OPENS  3h after the previous race-day's start (or immediately if there is
 *     no previous race, e.g. the season opener);
 *   - CLOSES the day before the next race at 12:00 Israel time.
 *
 * This single resolver is the one place that decides the target race and the
 * window, shared by the driver surface (/account), the admin roster, and the
 * server actions, so the rule is enforced in exactly one spot. All times are
 * Israel-local (Asia/Jerusalem) via `toIsraelTimestamp`.
 */
import { fetchCsv, parseCsv } from "@/lib/csv";
import {
  getNextRaceGroup,
  getPreviousRaceGroup,
  groupTimestamp,
  mapRaceEvents,
  parseDateDDMMYYYY,
  raceGroupAnchorId,
  toIsraelTimestamp,
  type RaceGroup,
} from "@/lib/scheduleData";
import {
  GLOBAL_CSV_URLS,
  fetchSeasonsConfig,
  matchesSeason,
  resolveCurrentSeason,
} from "@/lib/seasonConfig";

/** Attendance opens this long after the previous race-day's start. */
const OPEN_DELAY_MS = 3 * 60 * 60 * 1000;
/** Attendance closes at this Israel-local time the day before the race. */
const CLOSE_TIME = "12:00";

/** A serializable summary of the race-day a driver can RSVP to. */
export type UpcomingRace = {
  /** Anchor event_id of the race-day group (the RSVP key). */
  raceId: string;
  season: string;
  league: string;
  /** DD.MM.YYYY as stored in the schedule CSV. */
  date: string;
  /** Start time (HH:MM Israel local), if known. */
  startTime?: string;
  /** UTC ms of the race-day start (for cutoff / ordering). */
  startTs: number;
  /** English GP name. */
  name: string;
  /** Hebrew GP name (falls back to English if absent). */
  nameHe: string;
  /** Number of races that night (2 = double-header). */
  raceCount: number;
};

export type AttendanceWindowState = "open" | "before" | "closed" | "none";

export type NextRaceWindow = {
  race: UpcomingRace | null;
  /** UTC ms when RSVP opens; null = open immediately (no previous race). */
  opensTs: number | null;
  /** UTC ms when RSVP closes; null if the close time could not be computed. */
  closesTs: number | null;
  state: AttendanceWindowState;
  /** Server "now" so callers render a consistent view. */
  nowTs: number;
};

function toUpcomingRace(g: RaceGroup): UpcomingRace {
  const first = g.events[0];
  return {
    raceId: raceGroupAnchorId(g),
    season: g.season,
    league: g.league,
    date: g.date,
    startTime: first?.start_time,
    startTs: groupTimestamp(g),
    name: first?.race_name ?? "",
    nameHe: (first?.race_name_he || first?.race_name) ?? "",
    raceCount: g.events.length,
  };
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

/** UTC ms for 12:00 Israel time on the calendar day before `dateStr` (DD.MM.YYYY). */
function closeTimestampFor(dateStr: string): number | null {
  const d = parseDateDDMMYYYY(dateStr);
  if (!d) return null;
  const dayBefore = new Date(d.getTime() - 24 * 60 * 60 * 1000);
  const ds = `${pad2(dayBefore.getUTCDate())}.${pad2(dayBefore.getUTCMonth() + 1)}.${dayBefore.getUTCFullYear()}`;
  return toIsraelTimestamp(ds, CLOSE_TIME);
}

/**
 * Resolve the next race-day of the current season and its RSVP window.
 * Returns `state: "none"` when there is no upcoming current-season race.
 */
export async function fetchNextRaceWindow(): Promise<NextRaceWindow> {
  const nowTs = Date.now();
  const empty: NextRaceWindow = { race: null, opensTs: null, closesTs: null, state: "none", nowTs };

  const [scheduleCsv, seasonsConfig] = await Promise.all([
    fetchCsv(GLOBAL_CSV_URLS.schedule).catch(() => ""),
    fetchSeasonsConfig(),
  ]);
  if (!scheduleCsv) return empty;

  const currentSeasonKey = resolveCurrentSeason(seasonsConfig).season_key;
  const events = mapRaceEvents(parseCsv<Record<string, string>>(scheduleCsv));

  const next = getNextRaceGroup(events);
  if (!next || !matchesSeason(next.season, currentSeasonKey)) return empty;

  const nextStart = groupTimestamp(next);
  const prev = getPreviousRaceGroup(events, nextStart);
  const opensTs = prev ? groupTimestamp(prev) + OPEN_DELAY_MS : null;
  const closesTs = closeTimestampFor(next.date);

  let state: AttendanceWindowState;
  if (closesTs != null && nowTs >= closesTs) state = "closed";
  else if (opensTs != null && nowTs < opensTs) state = "before";
  else state = "open";

  return { race: toUpcomingRace(next), opensTs, closesTs, state, nowTs };
}
