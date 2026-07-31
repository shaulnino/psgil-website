import { test } from "node:test";
import assert from "node:assert/strict";
import {
  slugifyTrack,
  resolveCircuitId,
  buildCircuitIdentities,
  localizedCircuitName,
  localizedCircuitGrandPrix,
} from "@/lib/stats/circuitIdentity";
import { makeEvent } from "@/tests/support/fixtures";

test("slugifyTrack lowercases, strips diacritics and punctuation", () => {
  assert.equal(slugifyTrack("Autódromo José Carlos Pace"), "autodromo-jose-carlos-pace");
  assert.equal(slugifyTrack("Circuit de Spa-Francorchamps"), "circuit-de-spa-francorchamps");
  assert.equal(slugifyTrack("  Monza  "), "monza");
  assert.equal(slugifyTrack(""), "");
});

test("resolveCircuitId folds known aliases onto a stable canonical id", () => {
  assert.equal(resolveCircuitId("Circuit de Spa-Francorchamps"), "spa");
  assert.equal(resolveCircuitId("Spa"), "spa");
  assert.equal(resolveCircuitId("Autodromo Nazionale Monza"), "monza");
  assert.equal(resolveCircuitId("Autódromo José Carlos Pace"), "interlagos");
});

test("resolveCircuitId falls back to the slug for unknown venues", () => {
  assert.equal(resolveCircuitId("Some New Ring"), "some-new-ring");
  assert.equal(resolveCircuitId(undefined), "");
});

test("buildCircuitIdentities folds variants and the latest event wins for names", () => {
  const events = [
    makeEvent({
      event_id: "e1",
      date: "01.01.2024",
      track: "Circuit de Spa-Francorchamps",
      track_he: "מסלול ספא",
      country_code: "BE",
      race_name: "Belgian Grand Prix",
      race_name_he: "גראן פרי בלגיה",
    }),
    makeEvent({
      event_id: "e2",
      date: "08.01.2024",
      track: "Spa",
      track_he: "ספא",
      country_code: "BE",
      race_name: "Belgian GP",
    }),
  ];
  const map = buildCircuitIdentities(events);
  assert.equal(map.size, 1);
  const spa = map.get("spa")!;
  assert.ok(spa);
  // Latest event (e2) wins.
  assert.equal(spa.name, "Spa");
  assert.equal(spa.nameHe, "ספא");
  assert.equal(spa.countryCode, "BE");
  assert.equal(spa.grandPrix, "Belgian GP");
});

test("localized helpers prefer Hebrew on the he locale, fall back otherwise", () => {
  const idn = {
    id: "spa",
    name: "Spa",
    nameHe: "ספא",
    grandPrix: "Belgian GP",
    grandPrixHe: "גראן פרי בלגיה",
  };
  assert.equal(localizedCircuitName(idn, "he"), "ספא");
  assert.equal(localizedCircuitName(idn, "en"), "Spa");
  assert.equal(localizedCircuitName({ name: "Monza" }, "he"), "Monza");
  assert.equal(localizedCircuitGrandPrix(idn, "he"), "גראן פרי בלגיה");
  assert.equal(localizedCircuitGrandPrix(idn, "en"), "Belgian GP");
});
