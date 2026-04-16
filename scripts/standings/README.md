# PSGiL Automatic Standings — Setup Guide

This Google Apps Script replaces the four manually-maintained standings tabs
(`csv_drivers_standings_main`, `csv_drivers_standings_wild`,
`csv_constructors_standings_main`, `csv_constructors_standings_wild`)
with an automatically computed system.

Seasons S1–S5 are **never touched**. Season 6 and above are computed automatically.

---

## One-time Installation

1. Open your PSGiL Google Spreadsheet.
2. Go to **Extensions → Apps Script**.
3. Delete any existing code in the editor.
4. Copy the full contents of `psgil-standings.gs` and paste it in.
5. Click **Save** (Ctrl+S or the disk icon).
6. Close the Apps Script editor and **reload the spreadsheet**.
7. A **PSGiL** menu will appear in the toolbar.

---

## First-time Config Tab Setup

1. In the spreadsheet, click **PSGiL → Setup Config Tabs (run once)**.
2. Three new tabs will be created:
   - `standings_season_rules`
   - `standings_bans`
   - `standings_brackets`
3. Open `standings_season_rules` and update the `counted_races` column to match
   your actual S6 rules. The script pre-fills example values — verify them.

---

## Config Tab Reference

### `standings_season_rules`

One row per season + league. **Required** for any season to be computed.

| Column | Example | Meaning |
|---|---|---|
| `season` | `S6` | Season key (S6, S7, …) |
| `league` | `Main` | `Main` or `Wild` |
| `counted_races` | `7` | Best N results count toward the championship |
| `playoff_cutoff` | `4` | Top N drivers auto-assigned to upper playoff bracket once playoff events begin. Leave blank for no playoffs. |
| `notes` | `Best 7 of 9` | Free text for your reference |

Add a new row for each new season. Existing rows are never deleted by the script.

### `standings_bans`

One row per race ban issued. Leave empty if no bans have been given.

| Column | Example | Meaning |
|---|---|---|
| `season` | `S6` | Season key |
| `driver_id` | `shaul_ezra` | Driver's stable ID (must match csv_drivers) |
| `league` | `Main` | `Main`, `Wild`, or `All` |
| `ban_count` | `1` | Each ban reduces effective counted races by 1 |
| `notes` | `Race ban — incident X` | Free text |

**Effect:** a driver with 1 ban in a `counted_races = 7` season has their score
calculated as best 6 results instead of best 7.
Multiple rows for the same driver are summed.

### `standings_brackets` (optional — playoff seasons only)

| Column | Example | Meaning |
|---|---|---|
| `season` | `S6` | Season key |
| `driver_id` | `shaul_ezra` | Driver ID |
| `bracket` | `upper` | `upper` or `lower` |

- If this tab has entries for a season, they take priority.
- If empty, the script auto-assigns brackets by rank once any playoff event
  is completed (based on `playoff_cutoff` in `standings_season_rules`).
- If no playoffs at all, leave this tab empty and remove `playoff_cutoff` values.

---

## Daily Workflow

After updating race results in the spreadsheet:

1. **PSGiL → Preview Standings** — writes computed output to `PREVIEW_*` tabs.
   Compare them to your expectations. No live data is changed.
2. **PSGiL → Refresh Standings** — writes the final output to the real standings tabs.
   The website will pick up the new data on the next page load.

---

## Auto-Trigger (optional)

To have standings refresh automatically every hour without manual intervention:

- **PSGiL → Install Auto-Trigger** — installs a hourly background trigger.
- **PSGiL → Remove Auto-Trigger** — removes it.

With the trigger installed, standings will refresh automatically whenever new
race results are added, with up to a 1-hour delay.

---

## Adding a New Season (S7, S8, …)

1. Open `standings_season_rules`.
2. Add one row for `S7 / Main` and one for `S7 / Wild` (if Wild runs).
3. Set `counted_races` to the new season's rule.
4. Run **PSGiL → Refresh Standings**.

No code changes are needed.

---

## Debug tab (`DEBUG_standings`)

**PSGiL → Debug Standings** writes one column of log lines. Google Sheets treats
any cell that starts with `=`, `+`, `-`, or `@` as a formula, which used to
show `#ERROR!` on section headers like `=== S6|Main ===`. The script now escapes
those lines and sets the column format to plain text. If you still see
`#ERROR!`, update to the latest `psgil-standings.gs` and run Debug again.

---

## How Championship Points Are Calculated

```
effective_counted = max(0, counted_races − driver_ban_count)
all_scores        = all points from completed races for this driver
championship_pts  = sum of the top effective_counted scores (sorted descending)
```

- Points come directly from the `points` column in `csv_race_results`.
  No hardcoded points scale; whatever is in the sheet is used.
- Only events with `status = "Completed"` in `csv_schedule` are counted.
- Reverse-grid events are excluded from Poles and Best Grid calculations.
- Position changes, intervals, and gaps are derived by computing standings
  a second time without the most recent race, then comparing.

---

## Constructors championship

**Points:** Sum of the `points` column from **every** race result row for both
cars of that team. The driver **best N of Y** rule does **not** apply to
constructors — all completed races count.

**Other columns** (wins, podiums, top 5/10, best finish, best grid, fastest laps,
poles, DOTD, penalty points, DNFs, races): Combined from the same raw race
results, grouped by the `team` text on each row (same per-race rules as
drivers, e.g. reverse-grid events excluded from poles / best grid).

Team grouping uses the `team` column in `csv_race_results` (the name stored
per event, not the roster `team_key` from the drivers tab).

---

## Website Impact

**None.** The website reads from the same four published CSV tab GIDs as before.
`lib/seasonConfig.ts` is unchanged. `fetchStandings()` and all rendering code
are untouched.
