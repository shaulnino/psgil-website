import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizeRaces, type NormalizedRace } from "@/lib/stats/normalizeRace";
import { computeDriverProfile } from "@/lib/stats/driverProfile";
import {
  computeLeaderboard,
  rankLeaderboard,
  MIN_SAMPLE,
  type LeaderboardRow,
} from "@/lib/stats/leaderboard";
import { makeEvent, makeResult } from "@/tests/support/fixtures";

const ALL = { scope: "all-time" } as const;
const collator = new Intl.Collator("en", { sensitivity: "base" });

/**
 * alice: 4 starts (2 wins), bob: 4 starts (1 win), cara: 2 starts (low sample).
 * points totals: alice 83, bob 68, cara 20.
 */
function dataset(): NormalizedRace[] {
  const events = [1, 2, 3, 4].map((n) =>
    makeEvent({ event_id: `e${n}`, race_number: String(n), date: `0${n}.01.2024` }),
  );
  const results = [
    makeResult({ event_id: "e1", driver_id: "alice", position: "1", points: "25", grid: "1" }),
    makeResult({ event_id: "e2", driver_id: "alice", position: "1", points: "25", grid: "2" }),
    makeResult({ event_id: "e3", driver_id: "alice", position: "2", points: "18", grid: "1" }),
    makeResult({ event_id: "e4", driver_id: "alice", position: "3", points: "15", grid: "3" }),
    makeResult({ event_id: "e1", driver_id: "bob", position: "2", points: "18", grid: "2" }),
    makeResult({ event_id: "e2", driver_id: "bob", position: "3", points: "15", grid: "1" }),
    makeResult({ event_id: "e3", driver_id: "bob", position: "1", points: "25", grid: "2" }),
    makeResult({ event_id: "e4", driver_id: "bob", position: "5", points: "10", grid: "4" }),
    makeResult({ event_id: "e1", driver_id: "cara", position: "4", points: "12", grid: "5" }),
    makeResult({ event_id: "e2", driver_id: "cara", position: "6", points: "8", grid: "6" }),
  ];
  return normalizeRaces(results, events);
}

test("alignment: leaderboard values equal the driver's own profile", () => {
  const races = dataset();
  const lb = computeLeaderboard(races, ALL);
  const p = computeDriverProfile(races, "alice", ALL)!;
  const row = lb.find((r) => r.driverId === "alice")!;

  assert.equal(row.starts, p.starts);
  assert.equal(row.entries, p.entries);
  assert.equal(row.values.points, p.points);
  assert.equal(row.values.wins, p.results.wins);
  assert.equal(row.values.winRate, p.results.winRate);
  assert.equal(row.values.avgFinish, p.avgFinish);
  assert.equal(row.values.finishRate, p.consistency.finishRate);
  assert.equal(row.values.avgGrid, p.racecraft.avgGrid);
  assert.equal(row.values.cleanRacePct, p.discipline.cleanRacePct);
});

test("leaderboard omits drivers with no entries in scope", () => {
  const races = dataset();
  const lb = computeLeaderboard(races, { scope: "all-time", weather: "wet" });
  // No wet races in the dataset -> every driver has zero entries.
  assert.equal(lb.length, 0);
});

test("ranking (ungated): all drivers ranked by points, desc", () => {
  const races = dataset();
  const lb = computeLeaderboard(races, ALL);
  const ranked = rankLeaderboard(lb, "points", true, false, collator);
  assert.equal(ranked.insufficient.length, 0);
  assert.deepEqual(
    ranked.qualified.map((e) => [e.row.driverId, e.rank]),
    [
      ["alice", 1],
      ["bob", 2],
      ["cara", 3],
    ],
  );
});

test("ranking (gated): low-sample drivers move to insufficient", () => {
  const races = dataset();
  const lb = computeLeaderboard(races, ALL);
  const ranked = rankLeaderboard(lb, "winRate", true, true, collator);
  assert.deepEqual(
    ranked.qualified.map((e) => e.row.driverId),
    ["alice", "bob"],
  );
  assert.equal(ranked.insufficient.length, 1);
  assert.equal(ranked.insufficient[0].row.driverId, "cara");
  assert.ok(ranked.insufficient[0].row.starts < MIN_SAMPLE);
});

test("competition ranking: equal values share a rank and skip the next", () => {
  const rows: LeaderboardRow[] = [
    { driverId: "a", driverName: "a", team: null, starts: 5, entries: 5, values: { m: 10 } },
    { driverId: "b", driverName: "b", team: null, starts: 5, entries: 5, values: { m: 10 } },
    { driverId: "c", driverName: "c", team: null, starts: 5, entries: 5, values: { m: 5 } },
    { driverId: "d", driverName: "d", team: null, starts: 2, entries: 2, values: { m: 99 } },
    { driverId: "e", driverName: "e", team: null, starts: 5, entries: 5, values: { m: null } },
  ];
  const ranked = rankLeaderboard(rows, "m", true, true, collator);
  assert.deepEqual(
    ranked.qualified.map((e) => [e.row.driverId, e.rank]),
    [
      ["a", 1],
      ["b", 1],
      ["c", 3],
    ],
  );
  // d is low-sample -> insufficient; e has no value -> excluded entirely.
  assert.deepEqual(ranked.insufficient.map((e) => e.row.driverId), ["d"]);
});

test("ranking direction: lower-is-better sorts ascending", () => {
  const rows: LeaderboardRow[] = [
    { driverId: "a", driverName: "a", team: null, starts: 5, entries: 5, values: { m: 3 } },
    { driverId: "b", driverName: "b", team: null, starts: 5, entries: 5, values: { m: 1 } },
    { driverId: "c", driverName: "c", team: null, starts: 5, entries: 5, values: { m: 2 } },
  ];
  const ranked = rankLeaderboard(rows, "m", false, false, collator);
  assert.deepEqual(ranked.qualified.map((e) => e.row.driverId), ["b", "c", "a"]);
});
