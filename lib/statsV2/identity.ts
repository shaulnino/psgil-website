/* ------------------------------------------------------------------ */
/*  Stats V2 — Driver identity (tier + archetypes)                     */
/* ------------------------------------------------------------------ */

import type { DriverMetrics } from "./metrics";
import { dnaAverage, type DriverDna } from "./dna";

export type DriverTier =
  | "Champion"
  | "Elite"
  | "Frontrunner"
  | "Midfield Anchor"
  | "Developing"
  | "Wildcard"
  | "Insufficient Sample";

export type Archetype =
  | "Qualifier"
  | "Racer"
  | "Wet Master"
  | "Tyre Whisperer"
  | "Clutch Closer"
  | "Chaos Magnet"
  | "Ironman"
  | "Format Specialist"
  | "Banker"
  | "Giant Slayer";

export const ARCHETYPE_DESCRIPTIONS: Record<Archetype, string> = {
  Qualifier: "Top-tier one-lap pace; consistently starts at the sharp end.",
  Racer: "Wins races on Sundays — outscores their qualifying position.",
  "Wet Master": "Significantly stronger in wet/mixed conditions than in the dry.",
  "Tyre Whisperer": "Long stints, high laps led — rarely punishes the rubber.",
  "Clutch Closer": "Gains positions in the closing stages of races.",
  "Chaos Magnet": "Magnet for steward attention.",
  Ironman: "Iron-clad finishing record across many races.",
  "Format Specialist": "Performance varies sharply by race format.",
  Banker: "Reliable points scorer — converts grid into points.",
  "Giant Slayer": "Frequently finishes ahead of higher-grid starters.",
};

const MIN_SAMPLE_FOR_TIER = 5;

/* ------------------------------------------------------------------ */
/*  Tier                                                                */
/* ------------------------------------------------------------------ */

export function computeDriverTier(
  m: DriverMetrics,
  dna: DriverDna,
  championshipsWon: number = 0,
): DriverTier {
  if (m.events < MIN_SAMPLE_FOR_TIER) return "Insufficient Sample";
  if (championshipsWon > 0) return "Champion";

  const avg = dnaAverage(dna);
  if (avg === null) return "Insufficient Sample";

  if (avg >= 80) return "Elite";
  if (avg >= 65) return "Frontrunner";
  if (avg >= 45) return "Midfield Anchor";

  // Wildcard = high variance (some axes very high, some very low)
  const vals = Object.values(dna).filter((v): v is number => v !== null);
  if (vals.length >= 3) {
    const mean = vals.reduce((s, n) => s + n, 0) / vals.length;
    const variance = vals.reduce((s, n) => s + (n - mean) ** 2, 0) / vals.length;
    const sd = Math.sqrt(variance);
    if (sd > 25) return "Wildcard";
  }

  return "Developing";
}

/* ------------------------------------------------------------------ */
/*  Archetypes                                                          */
/* ------------------------------------------------------------------ */

export function computeArchetypes(
  m: DriverMetrics,
  dna: DriverDna,
): Archetype[] {
  const tags: Archetype[] = [];

  if ((dna.one_lap_pace ?? 0) >= 75) tags.push("Qualifier");

  // Racer: race pace beats one-lap pace by a meaningful margin
  if (
    dna.race_pace !== null &&
    dna.one_lap_pace !== null &&
    dna.race_pace - dna.one_lap_pace >= 12
  ) {
    tags.push("Racer");
  }

  if ((dna.wet_conditions ?? 0) >= 75 && m.events_wet + m.events_mixed >= 3) {
    tags.push("Wet Master");
  }

  if ((dna.tyre_management ?? 0) >= 75) tags.push("Tyre Whisperer");

  if ((dna.clutch ?? 0) >= 75) tags.push("Clutch Closer");

  if (m.events > 0 && m.steward_penalty_points / m.events >= 2) {
    tags.push("Chaos Magnet");
  }

  if (m.events >= 20 && m.finish_rate >= 0.9) tags.push("Ironman");

  // Format specialist: weak format adaptability + significant sample
  if (m.format_adaptability !== null && m.format_adaptability < 50 && m.events >= 10) {
    tags.push("Format Specialist");
  }

  // Banker: pole→win or front-row→win conversion ≥ 50%
  if (
    (m.pole_to_win !== null && m.pole_to_win >= 0.5) ||
    (m.front_row_to_win !== null && m.front_row_to_win >= 0.4)
  ) {
    tags.push("Banker");
  }

  // Giant Slayer: race craft top-quartile + meaningful sample
  if ((dna.race_craft ?? 0) >= 75 && m.events >= 5) {
    tags.push("Giant Slayer");
  }

  return tags;
}
