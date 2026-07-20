import type { RaceResultRow } from "@/lib/resultsData";
import type { RaceEvent, RaceFormat } from "@/lib/scheduleData";

/** Build a RaceEvent with sensible defaults; override any field. */
export function makeEvent(
  over: Partial<RaceEvent> & { event_id: string },
): RaceEvent {
  return {
    season: over.season ?? "6",
    race_number: over.race_number ?? "1",
    race_name: over.race_name ?? over.event_id,
    date: over.date ?? "01.01.2024",
    league: over.league ?? "Main",
    status: over.status ?? "Completed",
    country_code: over.country_code ?? "",
    race_format: (over.race_format ?? "50%") as RaceFormat,
    is_playoff: over.is_playoff ?? false,
    is_hero: over.is_hero ?? false,
    ...over,
  };
}

/** Build a RaceResultRow (all CSV columns are strings) with defaults. */
export function makeResult(
  over: Partial<RaceResultRow> & { event_id: string; driver_id: string },
): RaceResultRow {
  return {
    position: over.position ?? "1",
    position_change: over.position_change ?? "",
    driver_name: over.driver_name ?? over.driver_id,
    team: over.team ?? "Team A",
    time_or_gap: over.time_or_gap ?? "",
    best_lap: over.best_lap ?? "",
    laps: over.laps ?? "",
    grid: over.grid ?? "1",
    stops: over.stops ?? "",
    kph: over.kph ?? "",
    overtakes: over.overtakes ?? "",
    laps_led: over.laps_led ?? "",
    distance_led: over.distance_led ?? "",
    steward_penalty: over.steward_penalty ?? "",
    game_penalty: over.game_penalty ?? "",
    points: over.points ?? "0",
    status: over.status ?? "Finished",
    fastest_lap: over.fastest_lap ?? "",
    dotd: over.dotd ?? "",
    ...over,
  };
}
