import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizeRaces, type NormalizedRace } from "@/lib/stats/normalizeRace";
import { computeH2HProfile, listH2HDrivers } from "@/lib/stats/h2hProfile";
import { makeEvent, makeResult } from "@/tests/support/fixtures";

const ALL = { scope: "all-time" } as const;

/**
 * alice vs bob — four shared S6 events plus one shared S7 event.
 *   e1  alice P1 grid1   bob P2 grid2   -> a wins, grid a
 *   e2  alice P2 grid2   bob P1 grid1   -> b wins, grid b
 *   e3  alice DNF grid3  bob P4 grid4   -> b wins (classified beats DNF), grid a
 *   e4  alice P3 grid5   bob DNS        -> excluded (bob did not start)
 *   e5 (S7) both P1/P2                  -> only visible without a season filter
 */
function pair(): NormalizedRace[] {
  const events = [
    makeEvent({ event_id: "e1", season: "6", race_number: "1", date: "01.01.2024" }),
    makeEvent({ event_id: "e2", season: "6", race_number: "2", date: "08.01.2024" }),
    makeEvent({ event_id: "e3", season: "6", race_number: "3", date: "15.01.2024" }),
    makeEvent({ event_id: "e4", season: "6", race_number: "4", date: "22.01.2024" }),
    makeEvent({ event_id: "e5", season: "7", race_number: "1", date: "01.06.2024" }),
  ];
  const results = [
    makeResult({ event_id: "e1", driver_id: "alice", position: "1", points: "25", grid: "1" }),
    makeResult({ event_id: "e2", driver_id: "alice", position: "2", points: "18", grid: "2" }),
    makeResult({ event_id: "e3", driver_id: "alice", position: "-", points: "0", grid: "3", status: "DNF" }),
    makeResult({ event_id: "e4", driver_id: "alice", position: "3", points: "15", grid: "5" }),
    makeResult({ event_id: "e5", driver_id: "alice", position: "1", points: "25", grid: "1" }),

    makeResult({ event_id: "e1", driver_id: "bob", position: "2", points: "18", grid: "2" }),
    makeResult({ event_id: "e2", driver_id: "bob", position: "1", points: "25", grid: "1" }),
    makeResult({ event_id: "e3", driver_id: "bob", position: "4", points: "12", grid: "4" }),
    makeResult({ event_id: "e4", driver_id: "bob", position: "-", points: "0", grid: "", status: "DNS" }),
    makeResult({ event_id: "e5", driver_id: "bob", position: "2", points: "18", grid: "2" }),
  ];
  return normalizeRaces(results, events);
}

test("returns null when the two drivers are missing or identical", () => {
  const races = pair();
  assert.equal(computeH2HProfile(races, "alice", "alice", ALL), null);
  assert.equal(computeH2HProfile(races, "", "bob", ALL), null);
});

test("shared-event accounting: DNS excludes an event from win/lose", () => {
  const p = computeH2HProfile(pair(), "alice", "bob", ALL)!;
  assert.equal(p.sharedEvents, 5); // e1..e4 + e5
  assert.equal(p.sharedStarts, 4); // e4 excluded (bob DNS); e5 counts
  assert.equal(p.excludedDns, 1);
});

test("head-to-head wins: classified beats DNF; ties tracked", () => {
  const p = computeH2HProfile(pair(), "alice", "bob", ALL)!;
  // Counting: e1 a, e2 b, e3 b (bob classified beats alice DNF), e5 a.
  assert.equal(p.winsA, 2);
  assert.equal(p.winsB, 2);
  assert.equal(p.ties, 0);
  assert.equal(p.summary.h2hWins.a, 2);
  assert.equal(p.summary.h2hWins.b, 2);
});

test("qualifying head-to-head excludes DNS grids", () => {
  const p = computeH2HProfile(pair(), "alice", "bob", ALL)!;
  // grid winners: e1 a, e2 b, e3 a, e5 a. (e4 -> bob grid null, no winner)
  assert.equal(p.summary.gridWins.a, 3);
  assert.equal(p.summary.gridWins.b, 1);
});

test("summary metrics computed over the shared-start sample only", () => {
  // Restrict to S6 so e5 drops out and the sample is e1,e2,e3.
  const p = computeH2HProfile(pair(), "alice", "bob", { scope: "season", season: "S6" })!;
  assert.equal(p.sharedStarts, 3);
  // alice: P1(25)+P2(18)+DNF(0) = 43 ; bob: 18+25+12 = 55
  assert.equal(p.summary.points.a, 43);
  assert.equal(p.summary.points.b, 55);
  // avg finish (classified only): alice mean(1,2)=1.5 ; bob mean(2,1,4)=2.33
  assert.equal(p.summary.avgFinish.a, 1.5);
  assert.equal(p.summary.avgFinish.b, 2.33);
  // reliability: alice 1 DNF, bob 0
  assert.equal(p.summary.dnf.a, 1);
  assert.equal(p.summary.dnf.b, 0);
  // finish rate: alice 2/3 -> 66.67, bob 3/3 -> 100
  assert.equal(p.summary.finishRate.a, 66.67);
  assert.equal(p.summary.finishRate.b, 100);
});

test("season filter narrows the shared set", () => {
  const s7 = computeH2HProfile(pair(), "alice", "bob", { scope: "season", season: "S7" })!;
  assert.equal(s7.sharedEvents, 1);
  assert.equal(s7.sharedStarts, 1);
  assert.equal(s7.winsA, 1); // e5 alice P1 beats bob P2
});

test("race lines are chronological and flag excluded events", () => {
  const p = computeH2HProfile(pair(), "alice", "bob", ALL)!;
  assert.equal(p.races.length, 5);
  assert.deepEqual(p.races.map((r) => r.eventId), ["e1", "e2", "e3", "e4", "e5"]);
  const e4 = p.races.find((r) => r.eventId === "e4")!;
  assert.equal(e4.counts, false);
  assert.equal(e4.winner, null);
});

test("listH2HDrivers returns unique drivers sorted by name", () => {
  const drivers = listH2HDrivers(pair());
  assert.deepEqual(drivers.map((d) => d.id).sort(), ["alice", "bob"]);
});
