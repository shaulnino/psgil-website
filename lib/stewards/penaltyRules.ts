/**
 * Penalty threshold rules — loaded dynamically from the PSGiL Google Sheet
 * (penalty_rules tab, GID 696729647).
 *
 * Sheet columns: id | active | threshold_license_points | penalty_type |
 *                penalty_label | penalty_description | applies_to | notes
 */

import { fetchCsv, parseCsv } from "@/lib/csv";
import { GLOBAL_CSV_URLS } from "@/lib/seasonConfig";

export type ThresholdRule = {
  id: string;
  active: boolean;
  thresholdLicensePoints: number;
  penaltyType: string;
  penaltyLabel: string;
  penaltyDescription: string;
  appliesTo: string;
  notes: string;
  /**
   * How many individual penalties this rule generates when triggered.
   * Defaults to 1. Set to 2 in the sheet if the rule should produce two
   * consecutive penalties (e.g. two race bans) each on separate races.
   * Column name: quantity
   */
  quantity: number;
};

function mapRow(row: Record<string, string>): ThresholdRule | null {
  const id = (row.id ?? "").trim();
  if (!id) return null;
  const pts = parseInt((row.threshold_license_points ?? "").trim(), 10);
  if (isNaN(pts) || pts <= 0) return null;
  const qty = parseInt((row.quantity ?? "1").trim(), 10);
  return {
    id,
    active: (row.active ?? "").trim().toLowerCase() === "true",
    thresholdLicensePoints: pts,
    penaltyType:        (row.penalty_type        ?? "").trim(),
    penaltyLabel:       (row.penalty_label       ?? "").trim() || "Penalty",
    penaltyDescription: (row.penalty_description ?? "").trim(),
    appliesTo:          (row.applies_to          ?? "").trim() || "main_league",
    notes:              (row.notes               ?? "").trim(),
    quantity:           isNaN(qty) || qty < 1 ? 1 : qty,
  };
}

let _cache: ThresholdRule[] | null = null;
let _cacheTime = 0;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5-minute cache

/**
 * Fetch active threshold rules from Google Sheets.
 * Returns rules sorted by threshold ascending.
 * Falls back to empty array if env var is not configured.
 */
export async function fetchThresholdRules(): Promise<ThresholdRule[]> {
  const url = GLOBAL_CSV_URLS.penaltyRules;

  const now = Date.now();
  if (_cache && now - _cacheTime < CACHE_TTL_MS) return _cache;

  try {
    const csv = await fetchCsv(url);
    const rows = parseCsv<Record<string, string>>(csv);
    const rules = rows
      .map(mapRow)
      .filter((r): r is ThresholdRule => r !== null && r.active)
      .sort((a, b) => a.thresholdLicensePoints - b.thresholdLicensePoints);
    _cache = rules;
    _cacheTime = now;
    return rules;
  } catch {
    return _cache ?? [];
  }
}
