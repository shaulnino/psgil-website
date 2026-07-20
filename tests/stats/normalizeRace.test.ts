import { test } from "node:test";
import assert from "node:assert/strict";
import {
  normalizeRaces,
  filterRaces,
  hasAdvancedFilter,
  sortChronological,
  type NormalizedRace,
  type ProfileFilters,
} from "@/lib/stats/normalizeRace";
import { makeEvent, makeResult } from "@/tests/support/fixtures";

test("drops rows whose event is missing from the schedule", () => {
  const races = normalizeRaces(
    [makeResult({ event_id: "ghost", driver_id: "alice" })],
    [makeEvent({ event_id: "real" })],
  );
  assert.equal(races.length, 0);
});

test("drops rows with an empty driver_id", () => {
  const races = normalizeRaces(
    [makeResult({ event_id: "e1", driver_id: "" })],
    [makeEvent({ event_id: "e1" })],
  );
  assert.equal(races.length, 0);
});

test("event lookup is case-insensitive", () => {
  const races = normalizeRaces(
    [makeResult({ event_id: "E1", driver_id: "alice" })],
    [makeEvent({ event_id: "e1" })],
  );
  assert.equal(races.length, 1);
});

test("status normalization covers dnf / dns / dsq / finished", () => {
  const ev = [makeEvent({ event_id: "e1" })];
  const kinds = normalizeRaces(
    [
      makeResult({ event_id: "e1", driver_id: "a", status: "Finished" }),
      makeResult({ event_id: "e1", driver_id: "b", status: "DNF" }),
      makeResult({ event_id: "e1", driver_id: "c", status: "DNS" }),
      makeResult({ event_id: "e1", driver_id: "d", status: "Disqualified" }),
    ],
    ev,
  ).map((r) => r.status);
  assert.deepEqual(kinds, ["finished", "dnf", "dns", "dsq"]);
});

test("DNS has no finishing position, is not a start, and has no net change", () => {
  const [r] = normalizeRaces(
    [makeResult({ event_id: "e1", driver_id: "a", status: "DNS", position: "5", position_change: "-2" })],
    [makeEvent({ event_id: "e1" })],
  );
  assert.equal(r.finish, null);
  assert.equal(r.isStart, false);
  assert.equal(r.isClassified, false);
  // A DNS never started, so a source position_change must be ignored.
  assert.equal(r.netChange, null);
});

test("only a numeric finish on a finished race counts as classified", () => {
  const [ok, bad] = normalizeRaces(
    [
      makeResult({ event_id: "e1", driver_id: "a", status: "Finished", position: "3" }),
      makeResult({ event_id: "e1", driver_id: "b", status: "Finished", position: "-" }),
    ],
    [makeEvent({ event_id: "e1" })],
  );
  assert.equal(ok.isClassified, true);
  assert.equal(bad.isClassified, false);
  assert.equal(bad.finish, null);
});

test("reverse-grid events null out the qualifying grid but keep gridRaw", () => {
  const [r] = normalizeRaces(
    [makeResult({ event_id: "e1", driver_id: "a", grid: "1" })],
    [makeEvent({ event_id: "e1", reverse_grid: "yes" })],
  );
  assert.equal(r.grid, null);
  assert.equal(r.gridRaw, 1);
  assert.equal(r.pole, false, "reverse-grid P1 is not a pole");
});

test("pole is grid 1 on a normal-grid event", () => {
  const [r] = normalizeRaces(
    [makeResult({ event_id: "e1", driver_id: "a", grid: "1" })],
    [makeEvent({ event_id: "e1" })],
  );
  assert.equal(r.pole, true);
});

test("weather keywords map to dry / wet / mixed / unknown", () => {
  const mk = (weather: string) =>
    normalizeRaces(
      [makeResult({ event_id: "e1", driver_id: "a" })],
      [makeEvent({ event_id: "e1", weather })],
    )[0].weather;
  assert.equal(mk("Dry"), "dry");
  assert.equal(mk("clear skies"), "dry");
  assert.equal(mk("Heavy Rain"), "wet");
  assert.equal(mk("wet"), "wet");
  assert.equal(mk("Mixed"), "mixed");
  assert.equal(mk("changing"), "mixed");
  assert.equal(mk(""), "unknown");
  assert.equal(mk("foggy"), "unknown");
});

test("season key normalizes to S-prefixed form and seasonNum", () => {
  const num = normalizeRaces(
    [makeResult({ event_id: "e1", driver_id: "a" })],
    [makeEvent({ event_id: "e1", season: "6" })],
  )[0];
  assert.equal(num.seasonKey, "S6");
  assert.equal(num.seasonNum, 6);
  const withS = normalizeRaces(
    [makeResult({ event_id: "e2", driver_id: "a" })],
    [makeEvent({ event_id: "e2", season: "S7" })],
  )[0];
  assert.equal(withS.seasonKey, "S7");
});

test("net change comes from position_change and penalties are summed", () => {
  const [r] = normalizeRaces(
    [
      makeResult({
        event_id: "e1",
        driver_id: "a",
        position_change: "+4",
        steward_penalty: "5",
        game_penalty: "2",
      }),
    ],
    [makeEvent({ event_id: "e1" })],
  );
  assert.equal(r.netChange, 4);
  assert.equal(r.stewardPenalty, 5);
  assert.equal(r.gamePenalty, 2);
  assert.equal(r.penaltySeconds, 7);
});

/* ---------------------------------------------------------------- */
/*  filterRaces / hasAdvancedFilter / sortChronological             */
/* ---------------------------------------------------------------- */

function dataset(): NormalizedRace[] {
  const events = [
    makeEvent({ event_id: "s6_r1", season: "6", race_number: "1", date: "01.01.2024", race_format: "50%", league: "Main", weather: "dry", track: "Monza" }),
    makeEvent({ event_id: "s6_r2", season: "6", race_number: "2", date: "08.01.2024", race_format: "sprint", league: "Main", weather: "wet", track: "Spa", is_playoff: true }),
    makeEvent({ event_id: "s7_r1", season: "7", race_number: "1", date: "01.06.2024", race_format: "25%", league: "Wild", weather: "mixed", track: "Monza" }),
  ];
  const results = [
    makeResult({ event_id: "s6_r1", driver_id: "a", position: "1", points: "25" }),
    makeResult({ event_id: "s6_r2", driver_id: "a", position: "2", points: "8" }),
    makeResult({ event_id: "s7_r1", driver_id: "a", position: "3", points: "15" }),
  ];
  return normalizeRaces(results, events);
}

test("filterRaces: season scope keeps only the matching season", () => {
  const f: ProfileFilters = { scope: "season", season: "S6" };
  assert.equal(filterRaces(dataset(), f).length, 2);
});

test("filterRaces: all-time scope ignores season", () => {
  const f: ProfileFilters = { scope: "all-time" };
  assert.equal(filterRaces(dataset(), f).length, 3);
});

test("filterRaces: advanced dimensions narrow the set", () => {
  const all = dataset();
  assert.equal(filterRaces(all, { scope: "all-time", format: "sprint" }).length, 1);
  assert.equal(filterRaces(all, { scope: "all-time", competition: "wild" }).length, 1);
  assert.equal(filterRaces(all, { scope: "all-time", roundType: "playoff" }).length, 1);
  assert.equal(filterRaces(all, { scope: "all-time", roundType: "regular" }).length, 2);
  assert.equal(filterRaces(all, { scope: "all-time", weather: "wet" }).length, 1);
  assert.equal(filterRaces(all, { scope: "all-time", circuit: "Monza" }).length, 2);
});

test("hasAdvancedFilter reflects only non-scope filters", () => {
  assert.equal(hasAdvancedFilter({ scope: "season", season: "S6" }), false);
  assert.equal(hasAdvancedFilter({ scope: "all-time", weather: "wet" }), true);
});

test("sortChronological orders by date ascending", () => {
  const shuffled = [...dataset()].reverse();
  const ordered = sortChronological(shuffled).map((r) => r.eventId);
  assert.deepEqual(ordered, ["s6_r1", "s6_r2", "s7_r1"]);
});
