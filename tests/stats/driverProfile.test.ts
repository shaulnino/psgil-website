import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizeRaces, type NormalizedRace } from "@/lib/stats/normalizeRace";
import { computeDriverProfile } from "@/lib/stats/driverProfile";
import { makeEvent, makeResult } from "@/tests/support/fixtures";

/**
 * Alice's 6-race S6 career (chronological). Hand-computed expectations below.
 *   r1 P1  25pts grid2  +1   dry   clean
 *   r2 P3  15pts grid1  -2   dry   clean   (pole)
 *   r3 DNF  0pts grid5  --   wet   5s penalty
 *   r4 DNS  0pts grid-  --   dry
 *   r5 P2  18pts grid3  +1   dry   clean
 *   r6 P10  1pt  grid8  -2   dry   2s penalty
 */
function aliceCareer(): NormalizedRace[] {
  const events = [
    makeEvent({ event_id: "s6_r1", season: "6", race_number: "1", date: "01.01.2024", weather: "dry" }),
    makeEvent({ event_id: "s6_r2", season: "6", race_number: "2", date: "08.01.2024", weather: "dry" }),
    makeEvent({ event_id: "s6_r3", season: "6", race_number: "3", date: "15.01.2024", weather: "wet" }),
    makeEvent({ event_id: "s6_r4", season: "6", race_number: "4", date: "22.01.2024", weather: "dry" }),
    makeEvent({ event_id: "s6_r5", season: "6", race_number: "5", date: "29.01.2024", weather: "dry" }),
    makeEvent({ event_id: "s6_r6", season: "6", race_number: "6", date: "05.02.2024", weather: "dry" }),
  ];
  const results = [
    makeResult({ event_id: "s6_r1", driver_id: "alice", position: "1", points: "25", grid: "2", position_change: "+1" }),
    makeResult({ event_id: "s6_r2", driver_id: "alice", position: "3", points: "15", grid: "1", position_change: "-2" }),
    makeResult({ event_id: "s6_r3", driver_id: "alice", position: "-", points: "0", grid: "5", status: "DNF", steward_penalty: "5" }),
    makeResult({ event_id: "s6_r4", driver_id: "alice", position: "5", points: "0", grid: "", status: "DNS" }),
    makeResult({ event_id: "s6_r5", driver_id: "alice", position: "2", points: "18", grid: "3", position_change: "+1" }),
    makeResult({ event_id: "s6_r6", driver_id: "alice", position: "10", points: "1", grid: "8", position_change: "-2", game_penalty: "2" }),
  ];
  return normalizeRaces(results, events);
}

const ALL = { scope: "all-time" } as const;

test("returns null for an unknown driver", () => {
  assert.equal(computeDriverProfile(aliceCareer(), "nobody", ALL), null);
});

test("denominators: entries include DNS, starts exclude DNS, classified excludes DNF/DNS", () => {
  const p = computeDriverProfile(aliceCareer(), "alice", ALL)!;
  assert.equal(p.entries, 6);
  assert.equal(p.starts, 5);
  assert.equal(p.classified, 4);
});

test("average finish excludes DNF/DNS/DSQ; finish rate is classified/starts", () => {
  const p = computeDriverProfile(aliceCareer(), "alice", ALL)!;
  assert.equal(p.avgFinish, 4); // mean(1,3,2,10)
  assert.equal(p.finishRate, 80); // 4/5
});

test("points totals and points-per-start use starts as denominator", () => {
  const p = computeDriverProfile(aliceCareer(), "alice", ALL)!;
  assert.equal(p.points, 59);
  assert.equal(p.pointsPerStart, 11.8); // 59/5
});

test("achievement counts and rates", () => {
  const p = computeDriverProfile(aliceCareer(), "alice", ALL)!;
  assert.equal(p.wins, 1);
  assert.equal(p.podiums, 3);
  assert.equal(p.results.top5, 3);
  assert.equal(p.results.top10, 4);
  assert.equal(p.results.poles, 1);
  assert.equal(p.results.winRate, 20);
  assert.equal(p.results.podiumRate, 60);
  assert.equal(p.results.poleRate, 20); // 1 pole / 5 grid samples
  assert.equal(p.results.bestFinish, 1);
  assert.equal(p.results.bestGrid, 1);
});

test("racecraft uses position_change; gained/lost and extremes are correct", () => {
  const p = computeDriverProfile(aliceCareer(), "alice", ALL)!;
  assert.equal(p.racecraft.netPositions, -2); // +1 -2 +1 -2
  assert.equal(p.racecraft.racesGained, 2);
  assert.equal(p.racecraft.racesLost, 2);
  assert.equal(p.racecraft.avgNetPerRace, -0.5);
  assert.equal(p.racecraft.avgGrid, 3.8); // mean(2,1,5,3,8)
  assert.equal(p.racecraft.medianFinish, 2.5); // median(1,2,3,10)
  assert.equal(p.racecraft.bestRecovery?.value, 1);
  assert.equal(p.racecraft.worstLoss?.value, -2);
});

test("consistency: DNF/DNS/DSQ counts, distribution buckets and stdev", () => {
  const p = computeDriverProfile(aliceCareer(), "alice", ALL)!;
  assert.equal(p.consistency.dnf, 1);
  assert.equal(p.consistency.dns, 1);
  assert.equal(p.consistency.dsq, 0);
  assert.equal(p.consistency.dnfRate, 20);
  assert.equal(p.consistency.stdevFinish, 3.54); // sqrt(12.5)
  const dist = Object.fromEntries(
    p.consistency.distribution.map((d) => [d.bucket, d.count]),
  );
  assert.deepEqual(dist, {
    win: 1,
    podium: 2,
    top5: 0,
    top10: 1,
    outsidePoints: 0,
    dnf: 1,
  });
});

test("streaks: best and trailing streaks treat DNS as neutral", () => {
  const p = computeDriverProfile(aliceCareer(), "alice", ALL)!;
  const s = p.consistency.streaks;
  assert.equal(s.finishBest, 2);
  assert.equal(s.pointsBest, 2);
  assert.equal(s.podiumBest, 2);
  assert.equal(s.winBest, 1);
  assert.equal(s.finishCurrent, 2); // r5 + r6, DNS skipped, stops at r3 DNF
  assert.equal(s.pointsCurrent, 2);
  assert.equal(s.podiumCurrent, 0); // r6 was P10
});

test("discipline: clean race = zero time penalty; penalty rate over starts", () => {
  const p = computeDriverProfile(aliceCareer(), "alice", ALL)!;
  assert.equal(p.discipline.penaltySeconds, 7); // 5 + 2
  assert.equal(p.discipline.cleanRaces, 3); // r1, r2, r5
  assert.equal(p.discipline.racesWithPenalty, 2); // r3, r6
  assert.equal(p.discipline.cleanRacePct, 60);
  assert.equal(p.discipline.penaltyRate, 40);
  assert.equal(p.discipline.penaltiesPerStart, 1.4);
});

test("recent form window covers the last 5 starts", () => {
  const p = computeDriverProfile(aliceCareer(), "alice", ALL)!;
  assert.equal(p.recentForm.window, 5);
  assert.equal(p.recentForm.races.length, 5); // DNS excluded, 5 starts total
  assert.equal(p.recentForm.avgFinish, 4);
  assert.equal(p.recentForm.points, 59);
  assert.equal(p.recentForm.prevAvgFinish, null);
  assert.equal(p.recentForm.deltaPoints, null);
});

test("records are career-wide and ignore active filters", () => {
  // Filter to wet weather only -> a single DNF race remains in `filtered`.
  const wet = { scope: "all-time", weather: "wet" } as const;
  const p = computeDriverProfile(aliceCareer(), "alice", wet)!;
  // Filtered sections collapse...
  assert.equal(p.entries, 1);
  assert.equal(p.classified, 0);
  assert.equal(p.avgFinish, null);
  assert.equal(p.wins, 0);
  // ...but career records still reflect the full history.
  assert.equal(p.records.firstWin?.eventId, "s6_r1");
  assert.equal(p.records.bestFinish?.value, 1);
  assert.equal(p.records.mostPointsRace?.value, 25);
  assert.equal(p.records.longestFinishStreak, 2);
});

test("history is filter-aware and newest-first", () => {
  const p = computeDriverProfile(aliceCareer(), "alice", ALL)!;
  assert.equal(p.history.length, 6);
  assert.equal(p.history[0].eventId, "s6_r6");
  assert.equal(p.history[p.history.length - 1].eventId, "s6_r1");
});

/* ---------------------------------------------------------------- */
/*  Edge cases                                                       */
/* ---------------------------------------------------------------- */

test("edge: a driver with no classified finish has null averages", () => {
  const races = normalizeRaces(
    [makeResult({ event_id: "e1", driver_id: "bob", status: "DNF", position: "-", grid: "4" })],
    [makeEvent({ event_id: "e1" })],
  );
  const p = computeDriverProfile(races, "bob", ALL)!;
  assert.equal(p.starts, 1);
  assert.equal(p.classified, 0);
  assert.equal(p.avgFinish, null);
  assert.equal(p.finishRate, 0);
  assert.equal(p.results.bestFinish, null);
  assert.equal(p.consistency.stdevFinish, null); // needs >= 2 samples
});

test("edge: single-race driver produces a valid profile", () => {
  const races = normalizeRaces(
    [makeResult({ event_id: "e1", driver_id: "cara", position: "1", points: "25", grid: "1" })],
    [makeEvent({ event_id: "e1" })],
  );
  const p = computeDriverProfile(races, "cara", ALL)!;
  assert.equal(p.starts, 1);
  assert.equal(p.wins, 1);
  assert.equal(p.avgFinish, 1);
  assert.equal(p.seasonsCompeted, 1);
});

test("edge: missing grid/weather do not crash and yield null grid stats", () => {
  const races = normalizeRaces(
    [makeResult({ event_id: "e1", driver_id: "dana", position: "4", points: "12", grid: "" })],
    [makeEvent({ event_id: "e1", weather: "" })],
  );
  const p = computeDriverProfile(races, "dana", ALL)!;
  assert.equal(p.racecraft.gridSample, 0);
  assert.equal(p.racecraft.avgGrid, null);
  assert.equal(p.results.bestGrid, null);
});
