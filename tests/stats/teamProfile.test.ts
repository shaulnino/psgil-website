import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizeRaces } from "@/lib/stats/normalizeRace";
import {
  computeTeamsOverview,
  computeTeamProfile,
  listTeamsWithHistory,
} from "@/lib/stats/teamProfile";
import { makeEvent, makeResult } from "@/tests/support/fixtures";

/**
 * Season 6, three Main races. A mid-season team switch and a reserve sub are
 * baked in to prove team attribution is purely results-driven:
 *
 *  e1 (Track A): alice MCL g1 P1 | bob MCL g2 P3 | cara FER g3 P2 | dave FER g4 P4
 *  e2 (Track B): alice MCL g2 P2 | bob MCL g1 P1 | cara FER g3 P3 | dave FER g4 DNF
 *  e3 (Track A): alice MCL g1 P1 | eve MCL g5 P5 | bob FER g2 P2 | cara FER g3 P3
 *                              ^reserve sub          ^switched McLaren→Ferrari
 *
 * dave's e1 row uses NO team_id and the free-text "Ferrari" to exercise the
 * name→team_key fallback.
 */
function dataset() {
  const events = [
    makeEvent({ event_id: "e1", season: "6", race_number: "1", date: "01.01.2024", track: "Track A" }),
    makeEvent({ event_id: "e2", season: "6", race_number: "2", date: "08.01.2024", track: "Track B" }),
    makeEvent({ event_id: "e3", season: "6", race_number: "3", date: "15.01.2024", track: "Track A" }),
  ];
  const results = [
    makeResult({ event_id: "e1", driver_id: "alice", team_id: "psgil-mclaren", grid: "1", position: "1", points: "25", position_change: "0" }),
    makeResult({ event_id: "e1", driver_id: "bob", team_id: "psgil-mclaren", grid: "2", position: "3", points: "15", position_change: "-1" }),
    makeResult({ event_id: "e1", driver_id: "cara", team_id: "psgil-ferrari", grid: "3", position: "2", points: "18" }),
    makeResult({ event_id: "e1", driver_id: "dave", team_id: "", team: "Ferrari", grid: "4", position: "4", points: "12" }),

    makeResult({ event_id: "e2", driver_id: "alice", team_id: "psgil-mclaren", grid: "2", position: "2", points: "18", position_change: "0" }),
    makeResult({ event_id: "e2", driver_id: "bob", team_id: "psgil-mclaren", grid: "1", position: "1", points: "25", position_change: "0" }),
    makeResult({ event_id: "e2", driver_id: "cara", team_id: "psgil-ferrari", grid: "3", position: "3", points: "15" }),
    makeResult({ event_id: "e2", driver_id: "dave", team_id: "psgil-ferrari", grid: "4", position: "-", points: "0", status: "DNF" }),

    makeResult({ event_id: "e3", driver_id: "alice", team_id: "psgil-mclaren", grid: "1", position: "1", points: "25", position_change: "0" }),
    makeResult({ event_id: "e3", driver_id: "eve", team_id: "psgil-mclaren", grid: "5", position: "5", points: "10", position_change: "0" }),
    makeResult({ event_id: "e3", driver_id: "bob", team_id: "psgil-ferrari", grid: "2", position: "2", points: "18" }),
    makeResult({ event_id: "e3", driver_id: "cara", team_id: "psgil-ferrari", grid: "3", position: "3", points: "15" }),
  ];
  return { races: normalizeRaces(results, events), events };
}

const ALL = { scope: "all-time" } as const;

test("normalizeRaces resolves teamKey from team_id and the free-text fallback", () => {
  const { races } = dataset();
  const daveE1 = races.find((r) => r.eventId === "e1" && r.driverId === "dave")!;
  assert.equal(daveE1.teamKey, "psgil-ferrari"); // resolved from free-text "Ferrari"
  const aliceE1 = races.find((r) => r.eventId === "e1" && r.driverId === "alice")!;
  assert.equal(aliceE1.teamKey, "psgil-mclaren");
});

test("overview: leaderboard order, points, championship position", () => {
  const { races, events } = dataset();
  const o = computeTeamsOverview(races, events, [], ALL);
  assert.equal(o.races, 3);
  assert.deepEqual(o.teams.map((t) => t.teamKey), ["psgil-mclaren", "psgil-ferrari"]);
  const mcl = o.teams[0];
  const fer = o.teams[1];
  assert.equal(mcl.points, 118); // 25+15+18+25+25+10
  assert.equal(fer.points, 78); // 18+12+15+0+18+15
  assert.equal(mcl.championshipPosition, 1);
  assert.equal(fer.championshipPosition, 2);
  assert.equal(mcl.wins, 3);
  assert.equal(mcl.name, "McLaren");
  assert.equal(fer.name, "Ferrari");
});

test("listTeamsWithHistory returns all teams ordered by all-time points", () => {
  const { races, events } = dataset();
  const list = listTeamsWithHistory(races, events);
  assert.deepEqual(list.map((t) => t.teamKey), ["psgil-mclaren", "psgil-ferrari"]);
});

test("profile: McLaren headline aggregates (results-derived, switch-aware)", () => {
  const { races, events } = dataset();
  const p = computeTeamProfile(races, events, [], ALL, "psgil-mclaren")!;
  assert.equal(p.races, 3);
  assert.equal(p.entries, 6);
  assert.equal(p.performance.points, 118);
  assert.equal(p.performance.wins, 3);
  assert.equal(p.performance.poles, 3);
  assert.equal(p.performance.podiums, 5);
  assert.equal(p.performance.oneTwoFinishes, 1); // only e2 (P1+P2)
  assert.equal(p.performance.doublePodiums, 2); // e1, e2
  assert.equal(p.performance.avgFinish, 2.17); // (1+3+2+1+1+5)/6
  assert.equal(p.qualifying.avgGrid, 2); // (1+2+2+1+1+5)/6
  assert.equal(p.qualifying.frontRowStarts, 5); // all but eve's P5
  assert.equal(p.qualifying.avgNetMovement, -0.17); // (0,-1,0,0,0,0)/6
  assert.equal(p.snapshot.bestChampPosition, 1);
  assert.deepEqual(p.snapshot.recentDriverIds, ["alice", "eve"]); // latest event e3
});

test("profile: lineup contribution + per-driver teammate duels", () => {
  const { races, events } = dataset();
  const p = computeTeamProfile(races, events, [], ALL, "psgil-mclaren")!;
  assert.deepEqual(p.lineup.map((l) => l.driverId), ["alice", "bob", "eve"]);

  const alice = p.lineup.find((l) => l.driverId === "alice")!;
  assert.equal(alice.entries, 3);
  assert.equal(alice.points, 68); // 25+18+25
  assert.equal(alice.wins, 2);
  assert.equal(alice.qualiWins, 2); // beat teammate in e1, e3
  assert.equal(alice.qualiLosses, 1); // lost to bob in e2
  assert.equal(alice.raceWins, 2);
  assert.equal(alice.raceLosses, 1);

  const bob = p.lineup.find((l) => l.driverId === "bob")!;
  assert.equal(bob.entries, 2); // only e1,e2 for McLaren (e3 he's Ferrari)
  assert.equal(bob.points, 40);
  assert.equal(bob.qualiWins, 1);
  assert.equal(bob.raceWins, 1);

  const eve = p.lineup.find((l) => l.driverId === "eve")!;
  assert.equal(eve.entries, 1);
  assert.equal(eve.qualiLosses, 1);
  assert.equal(eve.raceLosses, 1);

  // Points share sums to ~100 across the lineup.
  const share = p.lineup.reduce((s, l) => s + (l.pointsShare ?? 0), 0);
  assert.ok(Math.abs(share - 100) < 0.05, `share=${share}`);
});

test("profile: per-circuit + form timeline", () => {
  const { races, events } = dataset();
  const p = computeTeamProfile(races, events, [], ALL, "psgil-mclaren")!;

  const trackA = p.perCircuit.find((c) => c.circuitId === "Track A")!;
  assert.equal(trackA.races, 2); // e1 + e3
  assert.equal(trackA.wins, 2);
  const trackB = p.perCircuit.find((c) => c.circuitId === "Track B")!;
  assert.equal(trackB.races, 1);

  assert.deepEqual(p.form.map((f) => f.points), [40, 43, 35]); // e1, e2, e3
  assert.deepEqual(p.form.map((f) => f.cumulative), [40, 83, 118]);
});

test("profile: Ferrari picks up dave via fallback and bob via mid-season switch", () => {
  const { races, events } = dataset();
  const fer = computeTeamProfile(races, events, [], ALL, "psgil-ferrari")!;
  const ids = fer.lineup.map((l) => l.driverId).sort();
  assert.deepEqual(ids, ["bob", "cara", "dave"]);
  assert.equal(fer.performance.points, 78);
  const bob = fer.lineup.find((l) => l.driverId === "bob")!;
  assert.equal(bob.entries, 1); // only e3 for Ferrari
  assert.equal(bob.points, 18);
});

test("returns null for an unknown team", () => {
  const { races, events } = dataset();
  assert.equal(computeTeamProfile(races, events, [], ALL, "psgil-nope"), null);
  assert.equal(computeTeamProfile(races, events, [], ALL, ""), null);
});
