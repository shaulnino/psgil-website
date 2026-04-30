import type { MetricInfo } from "@/lib/statsData";

/** Driver stats sub-tabs (replaces accordion-only grouping). */
export type DriverStatTabId =
  | "championship"
  | "qualifying"
  | "pace"
  | "consistency"
  | "racecraft"
  | "records";

export const DRIVER_STAT_TAB_ORDER: { id: DriverStatTabId; label: string }[] = [
  { id: "championship", label: "Championship" },
  { id: "qualifying", label: "Qualifying" },
  { id: "pace", label: "Race pace" },
  { id: "consistency", label: "Consistency" },
  { id: "racecraft", label: "Racecraft" },
  { id: "records", label: "Records & awards" },
];

/** Hero KPIs shown above sub-tabs (labels are matched against available column keys). */
export const DRIVER_HERO_LABELS = [
  "Events Participation",
  "Total Points",
  "Event Wins",
  "Event Podiums",
  "Avg. Final Position",
  "Driver Rating",
] as const;

export function findMetricKey(wanted: string, availableKeys: Set<string>): string | null {
  if (availableKeys.has(wanted)) return wanted;
  const stripped = wanted.replace(/^Event\s+/i, "");
  if (availableKeys.has(stripped)) return stripped;
  const prefixed = `Event ${wanted}`;
  if (availableKeys.has(prefixed)) return prefixed;
  for (const k of availableKeys) {
    if (k.endsWith(wanted) || wanted.endsWith(k)) return k;
  }
  return null;
}

export function resolveHeroMetrics(
  metrics: MetricInfo[],
  availableKeys: Set<string>,
): { info: MetricInfo; key: string }[] {
  const out: { info: MetricInfo; key: string }[] = [];
  for (const label of DRIVER_HERO_LABELS) {
    const key = findMetricKey(label, availableKeys);
    if (!key) continue;
    const info = metrics.find((m) => m.key === key);
    if (info) out.push({ info, key });
  }
  return out;
}

function buildHeroKeySet(availableKeys: Set<string>): Set<string> {
  const s = new Set<string>();
  for (const label of DRIVER_HERO_LABELS) {
    const k = findMetricKey(label, availableKeys);
    if (k) s.add(k);
  }
  return s;
}

/**
 * Assign each metric to exactly one sub-tab (first matching rule wins).
 * Uses cleaned label + raw key for matching.
 */
export function tabForDriverMetric(m: MetricInfo): DriverStatTabId {
  const label = m.label.toLowerCase();
  const key = m.key.toLowerCase();
  const hay = `${label} ${key}`;

  if (/^(speed|consistency|performance|agility|driver rating)$/i.test(m.label.trim())) {
    return "records";
  }
  if (
    /championship|champion titles|reward podiums|driver of the season|cleanest|grid climber|most improved|most valuable|best of the rest|dotd|driver of the day|fastest lap/i.test(
      hay,
    )
  ) {
    return "records";
  }
  if (/pole|front row|wins from pole|pole to win|best grid/i.test(hay)) {
    return "qualifying";
  }
  if (/dnf|dns|dsq|streak|finish rate|over-performance|dnf-free/i.test(hay)) {
    return "consistency";
  }
  if (/position changes|positions gained|laps led|pit stop|penalt|overtakes/i.test(hay)) {
    return "racecraft";
  }
  if (
    /participation|points|wins|podium|top\s*5|top\s*10|seasons competed|avg\. points|winning/i.test(hay)
  ) {
    return "championship";
  }
  if (/finish|dry|rain|changing weather|grid position|lowest final|best final/i.test(hay)) {
    return "pace";
  }
  return "championship";
}

export function groupMetricsByDriverTab(
  metrics: MetricInfo[],
  availableKeys: Set<string>,
): Record<DriverStatTabId, MetricInfo[]> {
  const heroKeys = buildHeroKeySet(availableKeys);
  const buckets: Record<DriverStatTabId, MetricInfo[]> = {
    championship: [],
    qualifying: [],
    pace: [],
    consistency: [],
    racecraft: [],
    records: [],
  };

  for (const m of metrics) {
    if (heroKeys.has(m.key)) continue;
    const tab = tabForDriverMetric(m);
    buckets[tab].push(m);
  }

  for (const id of Object.keys(buckets) as DriverStatTabId[]) {
    buckets[id].sort((a, b) => a.label.localeCompare(b.label));
  }
  return buckets;
}

/** Quick stat presets for Rankings tab (label substrings → first matching metric key). */
export const RANKINGS_QUICK_PRESETS: { id: string; label: string; patterns: RegExp[] }[] = [
  { id: "points", label: "Points", patterns: [/total points/i] },
  { id: "wins", label: "Wins", patterns: [/^event wins$/i, /^event wins/i] },
  { id: "pace", label: "Avg finish", patterns: [/^avg\. final position$/i] },
  { id: "qualifying", label: "Avg grid", patterns: [/^avg\. grid position$/i] },
  { id: "rating", label: "Rating", patterns: [/driver rating/i] },
  { id: "consistency", label: "Consistency", patterns: [/^consistency$/i] },
];

export function pickMetricKeyForPreset(
  metrics: MetricInfo[],
  presetId: string,
): string | null {
  const preset = RANKINGS_QUICK_PRESETS.find((p) => p.id === presetId);
  if (!preset) return null;
  for (const re of preset.patterns) {
    const hit = metrics.find((m) => re.test(m.label) || re.test(m.key));
    if (hit) return hit.key;
  }
  return null;
}
