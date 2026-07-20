import { test } from "node:test";
import assert from "node:assert/strict";
import { METRIC_CATALOG, formatMetric } from "@/lib/stats/metricCatalog";

test("catalog: every entry's id matches its key", () => {
  for (const [key, def] of Object.entries(METRIC_CATALOG)) {
    assert.equal(def.id, key, `id mismatch for ${key}`);
  }
});

test("formatMetric: null/undefined/NaN render the placeholder", () => {
  assert.equal(formatMetric(null, "int", "en"), "—");
  assert.equal(formatMetric(undefined, "dec", "en"), "—");
  assert.equal(formatMetric(Number.NaN, "pct", "en"), "—");
  assert.equal(formatMetric(null, "int", "en", "N/A"), "N/A");
});

test("formatMetric: integer + position units drop decimals", () => {
  assert.equal(formatMetric(12, "int", "en"), "12");
  assert.equal(formatMetric(3.7, "pos", "en"), "4");
});

test("formatMetric: decimals keep up to two places, trimming zeros", () => {
  assert.equal(formatMetric(9.5, "dec", "en"), "9.5");
  assert.equal(formatMetric(9.0, "dec", "en"), "9");
  assert.equal(formatMetric(9.256, "dec", "en"), "9.26");
});

test("formatMetric: percent appends % and rounds to one decimal", () => {
  assert.equal(formatMetric(50, "pct", "en"), "50%");
  assert.equal(formatMetric(33.33, "pct", "en"), "33.3%");
});

test("formatMetric: seconds append s", () => {
  assert.equal(formatMetric(2.5, "sec", "en"), "2.5s");
  assert.equal(formatMetric(0, "sec", "en"), "0s");
});

test("formatMetric: delta shows an explicit + for positive values", () => {
  assert.equal(formatMetric(3, "delta", "en"), "+3");
  assert.equal(formatMetric(-2, "delta", "en"), "-2");
  assert.equal(formatMetric(0, "delta", "en"), "0");
});

test("formatMetric: Hebrew locale still produces valid strings", () => {
  // Should not throw and should include the numeric value.
  const out = formatMetric(50, "pct", "he");
  assert.ok(out.includes("50"));
  assert.ok(out.includes("%"));
});
