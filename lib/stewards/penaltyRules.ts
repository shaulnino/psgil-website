/**
 * Penalty threshold rules — loaded dynamically from Google Sheets.
 *
 * HOW TO SET UP:
 * 1. Add a new tab to the PSGiL Google Sheet named "penalty_rules"
 * 2. Add these columns (exact header names):
 *      id | active | threshold_license_points | penalty_type | penalty_label | penalty_description | applies_to | notes
 * 3. Example rows:
 *      rule_3pts | TRUE | 3 | qualifying_ban | Qualifying Ban | Driver must start from the pit lane | main_league |
 *      rule_6pts | TRUE | 6 | race_ban       | Race Ban        | Driver is excluded from the race    | main_league |
 * 4. Publish the sheet tab as CSV and copy the URL
 * 5. Set environment variable PENALTY_RULES_CSV_URL to that URL
 *    (In Netlify: Site settings → Environment variables)
 */

import { fetchCsv, parseCsv } from "@/lib/csv";

export type ThresholdRule = {
  id: string;
  active: boolean;
  thresholdLicensePoints: number;
  penaltyType: string;
  penaltyLabel: string;
  penaltyDescription: string;
  appliesTo: string;
  notes: string;
};

function mapRow(row: Record<string, string>): ThresholdRule | null {
  const id = (row.id ?? "").trim();
  if (!id) return null;
  const pts = parseInt((row.threshold_license_points ?? "").trim(), 10);
  if (isNaN(pts) || pts <= 0) return null;
  return {
    id,
    active: (row.active ?? "").trim().toLowerCase() === "true",
    thresholdLicensePoints: pts,
    penaltyType:        (row.penalty_type        ?? "").trim(),
    penaltyLabel:       (row.penalty_label       ?? "").trim() || "Penalty",
    penaltyDescription: (row.penalty_description ?? "").trim(),
    appliesTo:          (row.applies_to          ?? "").trim() || "main_league",
    notes:              (row.notes               ?? "").trim(),
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
  const url = process.env.PENALTY_RULES_CSV_URL;
  if (!url) return [];

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
