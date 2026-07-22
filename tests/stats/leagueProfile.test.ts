import { test } from "node:test";
import assert from "node:assert/strict";
import type { RaceEvent } from "@/lib/scheduleData";
import { normalizeRaces, type NormalizedRace } from "@/lib/stats/normalizeRace";
import { computeLeagueProfile } from "@/lib/stats/leagueProfile";
import { makeEvent, makeResult } from "@/tests/support/fixtures";

/**
 * A compact 3-race S6 season with 3 drivers. Hand-computed below.
 *
 *  r1 (dry)            r2 (wet)             r3 (dry, PLAYOFF)
 *  ─────────────────   ─────────────────    ──────────────────
 *  alice P1 g1 25 +0   bob   P1 g3 25 +2    carol P1 g5 25 +4  (game pen 3)
 *  bob   P2 g2 18 +0   alice P2 g1 18 -1    bob   P2 g1 18 -1
 *  carol DNF g3  0     carol P3 g2 15 -1    alice DNS  -  0
 *        (pen 5)
 *
 *  Teams: alice=TeamA, bob=TeamB, carol=TeamA
 *  Facts: r1 has 2 safety cars; r2 is broadcast (youtube_url).
 */
function season(): { races: NormalizedRace[]; events: RaceEvent[] } {
  const events = [
    makeEvent({ event_id: "s6_r1", season: "6", race_number: "1", date: "01.01.2024", weather: "dry", safety_cars: 2 }),
    makeEvent({ event_id: "s6_r2", season: "6", race_number: "2", date: "08.01.2024", weather: "wet", youtube_url: "https://youtu.be/x" }),
    makeEvent({ event_id: "s6_r3", season: "6", race_number: "3", date: "15.01.2024", weather: "dry", is_playoff: true }),
  ];
  const results = [
    // r1
    makeResult({ event_id: "s6_r1", driver_id: "alice", team: "TeamA", position: "1", points: "25", grid: "1", position_change: "0" }),
    makeResult({ event_id: "s6_r1", driver_id: "bob", team: "TeamB", position: "2", points: "18", grid: "2", position_change: "0" }),
    makeResult({ event_id: "s6_r1", driver_id: "carol", team: "TeamA", position: "-", points: "0", grid: "3", status: "DNF", steward_penalty: "5" }),
    // r2
    makeResult({ event_id: "s6_r2", driver_id: "bob", team: "TeamB", position: "1", points: "25", grid: "3", position_change: "+2" }),
    makeResult({ event_id: "s6_r2", driver_id: "alice", team: "TeamA", position: "2", points: "18", grid: "1", position_change: "-1" }),
    makeResult({ event_id: "s6_r2", driver_id: "carol", team: "TeamA", position: "3", points: "15", grid: "2", position_change: "-1" }),
    // r3 (playoff)
    makeResult({ event_id: "s6_r3", driver_id: "carol", team: "TeamA", position: "1", points: "25", grid: "5", position_change: "+4", game_penalty: "3" }),
    makeResult({ event_id: "s6_r3", driver_id: "bob", team: "TeamB", position: "2", points: "18", grid: "1", position_change: "-1" }),
    makeResult({ event_id: "s6_r3", driver_id: "alice", team: "TeamA", position: "5", points: "0", grid: "", status: "DNS" }),
  ];
  return { races: normalizeRaces(results, events), events };
}

const ALL = { scope: "all-time" } as const;

test("pulse denominators: races, entries, starts, classified", () => {
  const { races, events } = season();
  const p = computeLeagueProfile(races, events, [], ALL);
  assert.equal(p.races, 3);
  assert.equal(p.entries, 9);
  assert.equal(p.starts, 8); // one DNS excluded
  assert.equal(p.classified, 7); // one DNF excluded
});

test("pulse counts: seasons, drivers, teams, winners, points, avg grid", () => {
  const { races, events } = season();
  const p = computeLeagueProfile(races, events, [], ALL);
  assert.equal(p.seasons, 1);
  assert.equal(p.uniqueDrivers, 3);
  assert.equal(p.uniqueTeams, 2);
  assert.equal(p.differentWinners, 3);
  assert.equal(p.totalPoints, 144);
  assert.equal(p.avgStarters, 2.67); // mean(3,3,2)
});

test("competitive balance", () => {
  const { races, events } = season();
  const c = computeLeagueProfile(races, events, [], ALL).competitive;
  assert.equal(c.differentWinners, 3);
  assert.equal(c.differentPodium, 3);
  assert.equal(c.differentPoles, 2); // alice (r1,r2), bob (r3)
  assert.equal(c.topDriverWinShare, 33.33); // 1 win / 3 races
  assert.equal(c.topWinnerWins, 1);
  assert.equal(c.leadChanges, 1); // alice leads until r3, then bob
});

test("movement: winning grid, pole conversion, wins from the back, position change", () => {
  const { races, events } = season();
  const m = computeLeagueProfile(races, events, [], ALL).movement;
  assert.equal(m.avgWinningGrid, 3); // mean(1,3,5)
  assert.equal(m.winningGridSample, 3);
  assert.equal(m.poleToWinRate, 33.33); // only r1 pole converted
  assert.equal(m.poleSample, 3);
  assert.equal(m.winsFromOutsideTop3, 1); // carol from grid 5
  assert.equal(m.avgAbsPositionChange, 1.29); // mean(|0,0,2,1,1,4,1|)=9/7
  assert.equal(m.changeSample, 7);
});

test("grid health & reliability", () => {
  const { races, events } = season();
  const p = computeLeagueProfile(races, events, [], ALL);
  assert.equal(p.gridHealth.completionRate, 87.5); // 7/8
  assert.equal(p.gridHealth.avgClassified, 2.33); // mean(2,3,2)
  assert.equal(p.gridHealth.maxGrid?.value, 3);
  assert.equal(p.gridHealth.minGrid?.value, 2);
  assert.equal(p.reliability.dnfRate, 12.5); // 1/8
  assert.equal(p.reliability.dnsRate, 11.11); // 1/9
  assert.equal(p.reliability.classificationRate, 87.5);
});

test("discipline: penalty + clean-race rates (clean = zero time penalties)", () => {
  const { races, events } = season();
  const d = computeLeagueProfile(races, events, [], ALL).discipline;
  assert.equal(d.racesWithPenalty, 2); // r1 and r3
  assert.equal(d.penaltyRate, 66.67);
  assert.equal(d.cleanRaceRate, 33.33);
  assert.equal(d.penaltySecondsPerRace, 2.67); // (5+3)/3
  // Split by source: steward 5s (r1 carol), in-game 3s (r3 carol), over 3 races.
  assert.equal(d.stewardSecondsPerRace, 1.67); // 5/3
  assert.equal(d.gameSecondsPerRace, 1); // 3/3
  // The two components sum to the combined total.
  assert.equal(
    round(d.stewardSecondsPerRace! + d.gameSecondsPerRace!),
    d.penaltySecondsPerRace,
  );
});

function round(n: number): number {
  return Math.round(n * 100) / 100;
}

test("records are all-time and independent of filters", () => {
  const { races, events } = season();
  // Filter to playoff only; records must still reflect the whole history.
  const p = computeLeagueProfile(races, events, [], { scope: "all-time", roundType: "playoff" });
  assert.equal(p.races, 1); // filtered view
  assert.equal(p.records.firstRace?.seasonKey, "S6");
  assert.equal(p.records.firstRace?.date, "01.01.2024");
  assert.equal(p.records.mostStarters?.value, 3);
  assert.equal(p.records.mostFinishers?.value, 3);
  assert.equal(p.records.mostDifferentWinnersSeason?.value, 3);
  assert.equal(p.records.mostPenalizedRace?.value, 1);
});

test("playoff filter narrows the analytical scope", () => {
  const { races, events } = season();
  const p = computeLeagueProfile(races, events, [], { scope: "all-time", roundType: "playoff" });
  assert.equal(p.races, 1);
  assert.equal(p.differentWinners, 1);
  assert.equal(p.movement.avgWinningGrid, 5);
  assert.equal(p.movement.winsFromOutsideTop3, 1);
  assert.equal(p.movement.poleToWinRate, 0); // pole (bob) did not win
});

test("weather filter selects the wet race only", () => {
  const { races, events } = season();
  const p = computeLeagueProfile(races, events, [], { scope: "all-time", weather: "wet" });
  assert.equal(p.races, 1);
  assert.equal(p.differentWinners, 1);
});

test("availability & facts", () => {
  const { races, events } = season();
  const p = computeLeagueProfile(races, events, [], ALL);
  assert.equal(p.availability.hasWild, false);
  assert.deepEqual(p.availability.formats, ["50%"]);
  assert.deepEqual(p.availability.weathers, ["dry", "wet"]);
  assert.equal(p.availability.hasRegular, true);
  assert.equal(p.availability.hasPlayoffs, true);
  assert.equal(p.availability.weatherCoverage, 1);
  assert.equal(p.facts.safetyCars, 2);
  assert.equal(p.facts.broadcastedEvents, 1);
  assert.equal(p.facts.reverseGridEvents, 0);
});

test("only completed events are counted", () => {
  const { events } = season();
  const scheduled = [
    ...events,
    makeEvent({ event_id: "s6_r4", season: "6", race_number: "4", date: "22.01.2024", status: "Scheduled" }),
  ];
  const results = [
    makeResult({ event_id: "s6_r4", driver_id: "alice", position: "1", points: "25", grid: "1" }),
  ];
  const races = normalizeRaces(results, scheduled);
  // Only the scheduled r4 has a result here; it must be ignored.
  const p = computeLeagueProfile(races, scheduled, [], ALL);
  assert.equal(p.races, 0);
});

test("empty dataset yields a safe empty profile", () => {
  const p = computeLeagueProfile([], [], [], ALL);
  assert.equal(p.races, 0);
  assert.equal(p.differentWinners, 0);
  assert.equal(p.avgStarters, null);
  assert.equal(p.records.firstRace, null);
});
