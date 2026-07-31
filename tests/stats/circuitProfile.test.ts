import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizeRaces, type NormalizedRace } from "@/lib/stats/normalizeRace";
import {
  computeCircuitProfile,
  listCircuitsWithHistory,
} from "@/lib/stats/circuitProfile";
import { makeEvent, makeResult } from "@/tests/support/fixtures";

/**
 * Two Spa events (written with two different track spellings to exercise
 * alias folding) plus one Monza event. Hand-computed expectations below.
 *
 * spaA (01.01, dry):  alice P1 grid2 +1 | bob P2 grid1 -1 (pole) | cara DNF grid3
 * spaB (08.01, wet):  alice P1 grid1 0 (pole) | bob P3 grid2 -1 | cara P2 grid3 +1
 * monza (15.01, dry): alice P2 grid1 | bob P1 grid2
 */
function dataset(): { races: NormalizedRace[]; events: ReturnType<typeof makeEvent>[] } {
  const events = [
    makeEvent({ event_id: "spaA", season: "6", race_number: "1", date: "01.01.2024", weather: "dry", track: "Circuit de Spa-Francorchamps", country_code: "BE", race_name: "Belgian GP" }),
    makeEvent({ event_id: "spaB", season: "6", race_number: "2", date: "08.01.2024", weather: "wet", track: "Spa", country_code: "BE", race_name: "Belgian GP" }),
    makeEvent({ event_id: "monza", season: "6", race_number: "3", date: "15.01.2024", weather: "dry", track: "Autodromo Nazionale Monza", country_code: "IT", race_name: "Italian GP" }),
  ];
  const results = [
    makeResult({ event_id: "spaA", driver_id: "alice", position: "1", points: "25", grid: "2", position_change: "+1" }),
    makeResult({ event_id: "spaA", driver_id: "bob", position: "2", points: "18", grid: "1", position_change: "-1" }),
    makeResult({ event_id: "spaA", driver_id: "cara", position: "-", points: "0", grid: "3", status: "DNF" }),

    makeResult({ event_id: "spaB", driver_id: "alice", position: "1", points: "25", grid: "1", position_change: "0" }),
    makeResult({ event_id: "spaB", driver_id: "bob", position: "3", points: "15", grid: "2", position_change: "-1" }),
    makeResult({ event_id: "spaB", driver_id: "cara", position: "2", points: "18", grid: "3", position_change: "+1" }),

    makeResult({ event_id: "monza", driver_id: "alice", position: "2", points: "18", grid: "1" }),
    makeResult({ event_id: "monza", driver_id: "bob", position: "1", points: "25", grid: "2" }),
  ];
  return { races: normalizeRaces(results, events), events };
}

const ALL = { scope: "all-time" } as const;

test("listCircuitsWithHistory folds aliases and orders by most recent", () => {
  const { races } = dataset();
  const list = listCircuitsWithHistory(races);
  assert.deepEqual(
    list.map((c) => c.id),
    ["monza", "spa"],
  );
  assert.equal(list.find((c) => c.id === "spa")!.races, 2);
  assert.equal(list.find((c) => c.id === "monza")!.races, 1);
});

test("returns null for an unknown circuit id", () => {
  const { races, events } = dataset();
  assert.equal(computeCircuitProfile(races, events, "nurburgring", ALL), null);
  assert.equal(computeCircuitProfile(races, events, "", ALL), null);
});

test("snapshot: events, winners, field size, classification split", () => {
  const { races, events } = dataset();
  const p = computeCircuitProfile(races, events, "spa", ALL)!;
  assert.equal(p.islRaces, 2);
  assert.equal(p.totalStarts, 6);
  assert.equal(p.snapshot.uniqueWinners, 1); // alice both times
  assert.equal(p.snapshot.uniquePoleSitters, 2); // bob + alice
  assert.equal(p.snapshot.avgFieldSize, 3);
  assert.equal(p.snapshot.classificationRate, 83.33); // 5 / 6
  assert.equal(p.snapshot.dnfRate, 16.67); // 1 / 6
});

test("qualifying: pole conversion, winning grid, front-row rates, distribution", () => {
  const { races, events } = dataset();
  const q = computeCircuitProfile(races, events, "spa", ALL)!.qualifying;
  assert.equal(q.poleToWinRate, 50); // spaB pole==winner, spaA not
  assert.equal(q.poleToWinSample, 2);
  assert.equal(q.avgWinningGrid, 1.5); // grids 2 and 1
  assert.equal(q.frontRowToWinRate, 100); // both winners started top-2
  assert.equal(q.avgPodiumGrid, 1.8); // [2,1,1,2,3]
  assert.equal(q.frontRowToPodiumRate, 80); // 4 of 5 podium starts top-2
  assert.deepEqual(q.winnerGridDistribution, [
    { grid: 1, count: 1 },
    { grid: 2, count: 1 },
  ]);
});

test("characteristics: movement excludes DNF/DNS/DSQ", () => {
  const { races, events } = dataset();
  const c = computeCircuitProfile(races, events, "spa", ALL)!.characteristics;
  assert.equal(c.movementSample, 5); // cara's DNF excluded
  assert.equal(c.avgAbsMovement, 0.8); // |+1|,|-1|,0,|-1|,|+1|
  assert.equal(c.avgNetMovement, 0); // +1 -1 0 -1 +1
  assert.equal(c.racesGained, 2);
  assert.equal(c.racesLost, 2);
  assert.equal(c.pctImproved, 40); // 2 / 5
  assert.equal(c.bestRecovery?.value, 1);
  assert.equal(c.worstLoss?.value, -1);
});

test("conditions: weather coverage/splits; safety car suppressed when unrecorded", () => {
  const { races, events } = dataset();
  const cond = computeCircuitProfile(races, events, "spa", ALL)!.conditions;
  assert.equal(cond.weatherCoverage, 1);
  assert.equal(cond.wetRate, 50); // 1 wet of 2
  assert.equal(cond.cleanRaceRate, 100); // no penalties in fixture
  assert.equal(cond.penaltiesPerRace, 0);
  assert.equal(cond.safetyCarRate, null); // no SC data recorded
  const dry = cond.weatherSplits.find((w) => w.key === "dry")!;
  assert.equal(dry.races, 1);
  assert.equal(dry.starts, 3);
  assert.equal(dry.dnfRate, 33.33); // cara DNF of 3 dry starts
});

test("specialists: rate-based, positive ordering, thin flags", () => {
  const { races, events } = dataset();
  const spec = computeCircuitProfile(races, events, "spa", ALL)!.specialists;
  assert.deepEqual(spec.map((s) => s.driverId), ["alice", "bob", "cara"]);
  const alice = spec[0];
  assert.equal(alice.starts, 2);
  assert.equal(alice.wins, 2);
  assert.equal(alice.podiums, 2);
  assert.equal(alice.poles, 1); // spaB pole
  assert.equal(alice.pointsPerStart, 25);
  assert.equal(alice.avgFinish, 1);
  assert.equal(alice.podiumRate, 100);
  assert.equal(alice.thin, true); // < 3 starts
  const cara = spec[2];
  assert.equal(cara.starts, 2);
  assert.equal(cara.podiums, 1);
  assert.equal(cara.podiumRate, 50); // 1 podium / 2 starts
});

test("records are all-time for the circuit and ignore active filters", () => {
  const { races, events } = dataset();
  // Filter to dry only -> only spaA remains in the filtered scope.
  const dryOnly = { scope: "all-time", weather: "dry" } as const;
  const p = computeCircuitProfile(races, events, "spa", dryOnly)!;
  assert.equal(p.islRaces, 1); // filtered snapshot shrinks
  // ...but records still reflect both Spa races.
  assert.equal(p.records.firstWinner?.holder, "alice");
  assert.equal(p.records.firstWinner?.race.eventId, "spaA");
  assert.equal(p.records.mostWins?.holder, "alice");
  assert.equal(p.records.mostWins?.value, 2);
  assert.equal(p.records.mostPodiums?.value, 2);
  assert.equal(p.records.biggestGrid?.value, 3);
});

test("edge: a single-race circuit produces a valid profile", () => {
  const { races, events } = dataset();
  const p = computeCircuitProfile(races, events, "monza", ALL)!;
  assert.equal(p.islRaces, 1);
  assert.equal(p.totalStarts, 2);
  assert.equal(p.snapshot.uniqueWinners, 1); // bob
  assert.equal(p.history.length, 1);
  assert.equal(p.history[0].winnerName, "bob");
});
