/* ------------------------------------------------------------------ */
/*  Normalized per-race model                                          */
/*                                                                     */
/*  Turns raw RaceResultRow + RaceEvent pairs into a single typed,     */
/*  pre-parsed record so every downstream statistic reads consistent   */
/*  values (no re-parsing of CSV strings scattered across the UI).     */
/*                                                                     */
/*  This is the single source of truth for the redesigned Drivers tab. */
/* ------------------------------------------------------------------ */

import type { RaceResultRow } from "@/lib/resultsData";
import type { RaceEvent, RaceFormat } from "@/lib/scheduleData";
import { parseDateDDMMYYYY } from "@/lib/scheduleData";

export type RaceStatusKind = "finished" | "dnf" | "dns" | "dsq";
export type WeatherKind = "dry" | "wet" | "mixed" | "unknown";
export type LeagueKind = "main" | "wild";

/** One driver's participation in one event, fully parsed. */
export type NormalizedRace = {
  eventId: string;
  driverId: string;
  driverName: string;
  team: string;

  seasonKey: string; // normalized "S6"
  seasonNum: number; // 6
  raceNumber: number;
  raceName: string;
  raceNameHe?: string;
  track?: string;
  trackHe?: string;
  date: string; // DD.MM.YYYY (raw)
  dateMs: number; // sortable epoch, NaN when unparseable

  league: LeagueKind;
  format: RaceFormat; // "50%" | "25%" | "sprint"
  isPlayoff: boolean;
  reverseGrid: boolean;
  weather: WeatherKind;

  /** Valid finishing position (> 0). null for DNF/DNS/DSQ or non-numeric. */
  finish: number | null;
  /** Grid excluding reverse-grid events (true qualifying signal). null otherwise. */
  grid: number | null;
  /** Grid as recorded, even on reverse-grid events (display only). */
  gridRaw: number | null;
  /** Net positions gained/lost, from the CSV position_change column. */
  netChange: number | null;

  points: number;
  status: RaceStatusKind;
  /** Took the start (status !== DNS). */
  isStart: boolean;
  /** Classified finish (status === finished). */
  isClassified: boolean;

  fastestLap: boolean;
  dotd: boolean;
  /** Started from pole (grid 1, non-reverse-grid). */
  pole: boolean;

  stewardPenalty: number; // seconds
  gamePenalty: number; // seconds
  penaltySeconds: number; // steward + game

  overtakes: number | null;
  lapsLed: number | null;
  stops: number | null;
};

/* ------------------------------------------------------------------ */
/*  Parsing helpers                                                     */
/* ------------------------------------------------------------------ */

function parsePos(val: string): number | null {
  const n = parseInt(val, 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function parseNum(val: string | undefined): number | null {
  if (!val || val === "-" || val === "N/A") return null;
  const n = parseFloat(val.replace(/,/g, ""));
  return Number.isFinite(n) ? n : null;
}

function parseBool(val: string | undefined): boolean {
  const v = (val ?? "").trim().toLowerCase();
  return v === "1" || v === "yes" || v === "true";
}

function normalizeStatus(raw: string): RaceStatusKind {
  const s = (raw ?? "").trim().toLowerCase();
  if (s === "dnf") return "dnf";
  if (s === "dns") return "dns";
  if (s === "dsq" || s === "disqualified") return "dsq";
  return "finished";
}

function normalizeWeather(raw: string | undefined): WeatherKind {
  const w = (raw ?? "").trim().toLowerCase();
  if (!w) return "unknown";
  if (w.includes("dry") || w.includes("clear")) return "dry";
  if (w.includes("wet") || w.includes("rain")) return "wet";
  if (w.includes("mix") || w.includes("chang")) return "mixed";
  return "unknown";
}

function normalizeSeasonKey(raw: string): string {
  const s = (raw ?? "").trim();
  if (!s) return "";
  return /^s/i.test(s) ? `S${s.replace(/^s/i, "")}` : `S${s}`;
}

function normalizeLeague(raw: string): LeagueKind {
  return (raw ?? "").trim().toLowerCase() === "wild" ? "wild" : "main";
}

/* ------------------------------------------------------------------ */
/*  Public: normalizeRaces                                              */
/* ------------------------------------------------------------------ */

/**
 * Build the normalized per-race dataset from raw results + schedule.
 * Rows whose event is missing from the schedule are dropped (cannot be
 * placed on a timeline / weather / format axis reliably).
 */
export function normalizeRaces(
  results: RaceResultRow[],
  events: RaceEvent[],
): NormalizedRace[] {
  const eventMap = new Map<string, RaceEvent>();
  for (const e of events) eventMap.set(e.event_id.toLowerCase(), e);

  const out: NormalizedRace[] = [];
  for (const r of results) {
    const driverId = (r.driver_id ?? "").trim();
    if (!driverId) continue;
    const ev = eventMap.get(r.event_id.toLowerCase());
    if (!ev) continue;

    const reverseGrid = (ev.reverse_grid ?? "").trim().toLowerCase() === "yes";
    const gridRaw = parsePos(r.grid);
    const grid = reverseGrid ? null : gridRaw;
    const finish = parsePos(r.position);
    const status = normalizeStatus(r.status);
    const isStart = status !== "dns";
    const stewardPenalty = parseNum(r.steward_penalty) ?? 0;
    const gamePenalty = parseNum(r.game_penalty) ?? 0;
    const d = parseDateDDMMYYYY(ev.date);

    out.push({
      eventId: r.event_id,
      driverId,
      driverName: (r.driver_name ?? "").trim(),
      team: (r.team ?? "").trim(),

      seasonKey: normalizeSeasonKey(ev.season),
      seasonNum: parseInt((ev.season ?? "").replace(/^s/i, ""), 10) || 0,
      raceNumber: parseInt(ev.race_number, 10) || 0,
      raceName: ev.race_name || r.event_id,
      raceNameHe: ev.race_name_he,
      track: ev.track,
      trackHe: ev.track_he,
      date: ev.date || "",
      dateMs: d ? d.getTime() : Number.NaN,

      league: normalizeLeague(ev.league),
      format: ev.race_format,
      isPlayoff: ev.is_playoff,
      reverseGrid,
      weather: normalizeWeather(ev.weather),

      finish: status === "dns" ? null : finish,
      grid,
      gridRaw,
      netChange: parseNum(r.position_change),

      points: parseNum(r.points) ?? 0,
      status,
      isStart,
      isClassified: status === "finished" && finish !== null,

      fastestLap: parseBool(r.fastest_lap),
      dotd: parseBool(r.dotd),
      pole: !reverseGrid && gridRaw === 1,

      stewardPenalty,
      gamePenalty,
      penaltySeconds: stewardPenalty + gamePenalty,

      overtakes: parseNum(r.overtakes),
      lapsLed: parseNum(r.laps_led),
      stops: parseNum(r.stops),
    });
  }

  return out;
}

/* ------------------------------------------------------------------ */
/*  Filtering                                                           */
/* ------------------------------------------------------------------ */

export type ProfileFilters = {
  /** "all-time" ignores season; "season" requires `season`. */
  scope: "all-time" | "season";
  season?: string; // "S6"
  format?: RaceFormat;
  competition?: LeagueKind;
  roundType?: "regular" | "playoff";
  weather?: "dry" | "wet" | "mixed";
  circuit?: string; // track name
};

/** Whether any advanced (non-scope) filter is active. */
export function hasAdvancedFilter(f: ProfileFilters): boolean {
  return !!(f.format || f.competition || f.roundType || f.weather || f.circuit);
}

/** Apply scope + advanced filters to normalized races. */
export function filterRaces(
  races: NormalizedRace[],
  f: ProfileFilters,
): NormalizedRace[] {
  return races.filter((r) => {
    if (f.scope === "season" && f.season) {
      if (r.seasonKey.toUpperCase() !== f.season.toUpperCase()) return false;
    }
    if (f.format && r.format !== f.format) return false;
    if (f.competition && r.league !== f.competition) return false;
    if (f.roundType === "playoff" && !r.isPlayoff) return false;
    if (f.roundType === "regular" && r.isPlayoff) return false;
    if (f.weather && r.weather !== f.weather) return false;
    if (f.circuit && (r.track ?? "") !== f.circuit) return false;
    return true;
  });
}

/** Sort a race list chronologically (ascending) with a stable tiebreak. */
export function sortChronological(races: NormalizedRace[]): NormalizedRace[] {
  return [...races].sort((a, b) => {
    const ta = a.dateMs;
    const tb = b.dateMs;
    if (Number.isFinite(ta) && Number.isFinite(tb) && ta !== tb) return ta - tb;
    if (a.seasonNum !== b.seasonNum) return a.seasonNum - b.seasonNum;
    if (a.raceNumber !== b.raceNumber) return a.raceNumber - b.raceNumber;
    return a.eventId.localeCompare(b.eventId);
  });
}
