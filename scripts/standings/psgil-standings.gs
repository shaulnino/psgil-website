/**
 * PSGiL Automatic Standings Calculator
 * ======================================
 * Google Apps Script — paste into Extensions > Apps Script in the PSGiL spreadsheet.
 *
 * First-time setup:
 *   1. Paste this file into the Apps Script editor and save (Ctrl+S).
 *   2. Reload the spreadsheet. A "PSGiL" menu will appear.
 *   3. Run PSGiL → Setup Config Tabs (once) to create the three admin tabs.
 *   4. Fill in standings_season_rules with the correct counted_races for each season.
 *   5. Run PSGiL → Preview Standings to verify output before going live.
 *   6. Run PSGiL → Refresh Standings to write computed standings to the real tabs.
 *
 * How it works:
 *   - Seasons S1–S5 rows in the output tabs are NEVER touched (static).
 *   - S6+ rows are fully computed from csv_race_results + csv_schedule.
 *   - Drivers: championship points = sum of best N results (standings_season_rules);
 *     bans reduce N (standings_bans).
 *   - Constructors: championship points = sum of ALL per-race points for both cars
 *     (no best-N); wins/poles/etc. are aggregated from the same raw results by team.
 *   - Playoff brackets are assigned via standings_brackets or auto-assigned once
 *     playoff events start running (based on playoff_cutoff rank).
 */
'use strict';

// ═══════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Sheet GIDs — mirrors the GID map in lib/seasonConfig.ts.
 * Do NOT change these without also updating the website code.
 */
const GID = {
  raceResults:      1960669750,
  schedule:         2105913561,
  drivers:          353282807,
  teams:            1933328661,
  driversMain:      174729634,
  driversWild:      1010201825,
  constructorsMain: 1965693345,
  constructorsWild: 769074374,
};

/** Names of the admin config tabs created by setupConfigTabs(). */
const CONFIG_TAB = {
  seasonRules: 'standings_season_rules',
  bans:        'standings_bans',
  brackets:    'standings_brackets',
};

/** Seasons strictly below this number are treated as static and never overwritten. */
const MIN_AUTO_SEASON = 6;

/**
 * Output column order — must match StandingsRow in lib/resultsData.ts.
 * The website reads these columns by name; changing order is safe but
 * changing names requires a matching website code update.
 */
const OUTPUT_HEADERS = [
  'position', 'position_change', 'driver_id', 'driver_name', 'team',
  'points', 'gain', 'interval', 'gap',
  'p1', 'p2', 'p3', 'top5', 'top10',
  'best_finish', 'best_quali', 'fastest_laps', 'poles', 'dotd',
  'penalty_points', 'dnfs', 'races',
  'season', 'bracket', 'table_image', 'competition_status', 'competition_note',
];

// ═══════════════════════════════════════════════════════════════════════════
// MENU
// ═══════════════════════════════════════════════════════════════════════════

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('PSGiL')
    .addItem('Refresh Standings',            'computeStandings')
    .addItem('Preview Standings (safe)',     'previewStandings')
    .addSeparator()
    .addItem('Setup Config Tabs (run once)', 'setupConfigTabs')
    .addItem('Install Auto-Trigger',         'installTrigger')
    .addItem('Remove Auto-Trigger',          'removeTrigger')
    .addSeparator()
    .addItem('Debug Standings (diagnose)',   'debugStandings')
    .addToUi();
}

// ═══════════════════════════════════════════════════════════════════════════
// SETUP: CREATE CONFIG TABS
// ═══════════════════════════════════════════════════════════════════════════

function setupConfigTabs() {
  const ss      = SpreadsheetApp.getActiveSpreadsheet();
  const ui      = SpreadsheetApp.getUi();
  const created = [];

  // standings_season_rules ─────────────────────────────────────────────────
  if (!ss.getSheetByName(CONFIG_TAB.seasonRules)) {
    const sh = ss.insertSheet(CONFIG_TAB.seasonRules);
    sh.getRange(1, 1, 1, 5).setValues([
      ['season', 'league', 'counted_races', 'playoff_cutoff', 'notes'],
    ]);
    sh.getRange(2, 1, 2, 5).setValues([
      ['S6', 'Main', 7, 4,  'Best 7 of 9 — top 4 advance to upper playoff bracket'],
      ['S6', 'Wild', 7, '', 'Best 7 of 9 — leave playoff_cutoff blank if no playoffs'],
    ]);
    sh.setFrozenRows(1);
    sh.autoResizeColumns(1, 5);
    created.push(CONFIG_TAB.seasonRules);
  }

  // standings_bans ─────────────────────────────────────────────────────────
  if (!ss.getSheetByName(CONFIG_TAB.bans)) {
    const sh = ss.insertSheet(CONFIG_TAB.bans);
    sh.getRange(1, 1, 1, 5).setValues([
      ['season', 'driver_id', 'league', 'ban_count', 'notes'],
    ]);
    sh.setFrozenRows(1);
    sh.autoResizeColumns(1, 5);
    created.push(CONFIG_TAB.bans);
  }

  // standings_brackets ─────────────────────────────────────────────────────
  if (!ss.getSheetByName(CONFIG_TAB.brackets)) {
    const sh = ss.insertSheet(CONFIG_TAB.brackets);
    sh.getRange(1, 1, 1, 3).setValues([
      ['season', 'driver_id', 'bracket'],
    ]);
    sh.setFrozenRows(1);
    sh.autoResizeColumns(1, 3);
    created.push(CONFIG_TAB.brackets);
  }

  const msg = created.length > 0
    ? 'Created config tabs:\n  ' + created.join('\n  ') +
      '\n\nNext steps:\n' +
      '1. Update standings_season_rules → set the correct counted_races for S6 Main + Wild.\n' +
      '2. standings_bans starts empty — add rows here when a race ban is issued.\n' +
      '3. standings_brackets starts empty — add driver → upper/lower here for playoff seasons,\n' +
      '   or leave empty to auto-assign by rank once playoff events begin.\n' +
      '4. Run PSGiL → Preview Standings to verify output before going live.'
    : 'All config tabs already exist. No changes made.';

  ui.alert(msg);
}

// ═══════════════════════════════════════════════════════════════════════════
// PUBLIC ENTRY POINTS
// ═══════════════════════════════════════════════════════════════════════════

/** Compute standings and write directly to the live output tabs. */
function computeStandings() {
  _run(/* preview= */ false);
}

/**
 * Compute standings and write to PREVIEW_* tabs without touching live data.
 * Use this to validate output before going live.
 */
function previewStandings() {
  _run(/* preview= */ true);
}

// ═══════════════════════════════════════════════════════════════════════════
// CORE COMPUTATION
// ═══════════════════════════════════════════════════════════════════════════

function _run(preview) {
  const ui = SpreadsheetApp.getUi();

  try {
    log('Starting standings computation (preview=' + preview + ')…');

    // ── Load source data ───────────────────────────────────────────────
    const allResults   = readSheetById(GID.raceResults);
    const allEvents    = readSheetById(GID.schedule);
    const allDrivers   = readSheetById(GID.drivers);
    const seasonRules  = readSheetByName(CONFIG_TAB.seasonRules);
    const bansData     = readSheetByName(CONFIG_TAB.bans);
    const bracketsData = readSheetByName(CONFIG_TAB.brackets);

    if (seasonRules.length === 0) {
      ui.alert(
        'standings_season_rules tab is missing or empty.\n' +
        'Run PSGiL → Setup Config Tabs first, then fill in your season rules.'
      );
      return;
    }

    log('Loaded: ' + allResults.length + ' results, ' + allEvents.length + ' events');

    // ── Build lookup maps ──────────────────────────────────────────────

    const driverNames   = buildMap(allDrivers, 'driver_id', r => r.driver_name || r.name || r.driver_id);
    const driverTeamKey = buildMap(allDrivers, 'driver_id', r => r.team_key || r.team || '');

    // "S6|Main" → { counted_races, playoff_cutoff }
    const rules = {};
    seasonRules.forEach(r => {
      const sk  = normSeason(r.season);
      const lg  = titleCase(norm(r.league));
      const key = sk + '|' + lg;
      if (sk && lg) {
        rules[key] = {
          counted_races:  toNum(r.counted_races),
          playoff_cutoff: r.playoff_cutoff ? toNum(r.playoff_cutoff) : null,
        };
      }
    });

    // "S6|driver_id|Main" → total ban count
    const bans = {};
    bansData.forEach(b => {
      const sk  = normSeason(b.season);
      const did = (b.driver_id || '').trim();
      const lg  = norm(b.league);
      if (!sk || !did) return;
      const leagues = lg === 'all' ? ['Main', 'Wild'] : [titleCase(lg)];
      leagues.forEach(l => {
        const k = sk + '|' + did + '|' + l;
        bans[k] = (bans[k] || 0) + toNum(b.ban_count);
      });
    });

    // "S6|driver_id" → 'upper' | 'lower'
    const manualBrackets = {};
    bracketsData.forEach(b => {
      const k = normSeason(b.season) + '|' + (b.driver_id || '').trim();
      if (k !== '|') manualBrackets[k] = norm(b.bracket);
    });

    // event_id → [RaceResultRow]
    const resultsByEvent = {};
    allResults.forEach(r => {
      if (!r.event_id) return;
      (resultsByEvent[r.event_id] = resultsByEvent[r.event_id] || []).push(r);
    });

    // ── Identify (season, league) pairs to auto-compute ────────────────
    const autoKeys = new Set();
    allEvents.forEach(ev => {
      const n = parseSeasonNum(ev.season);
      if (!isNaN(n) && n >= MIN_AUTO_SEASON) {
        const sk = normSeason(ev.season);
        const lg = titleCase(norm(ev.league));
        if (sk && lg) autoKeys.add(sk + '|' + lg);
      }
    });

    log('Auto-compute pairs: ' + Array.from(autoKeys).join(', '));

    // ── Compute per season+league ──────────────────────────────────────
    const out = { driversMain: [], driversWild: [], constructorsMain: [], constructorsWild: [] };

    autoKeys.forEach(key => {
      const [seasonKey, league] = key.split('|');
      const rule = rules[key];
      if (!rule) {
        log('SKIP ' + key + ': no entry in standings_season_rules');
        return;
      }

      log('Computing ' + key + ' (counted_races=' + rule.counted_races + ')');

      // Completed events for this season+league, sorted chronologically
      const done = allEvents
        .filter(ev =>
          normSeason(ev.season) === seasonKey &&
          titleCase(norm(ev.league)) === league &&
          norm(ev.status) === 'completed'
        )
        .sort((a, b) => parseDate(a.date) - parseDate(b.date));

      if (done.length === 0) {
        log('SKIP ' + key + ': 0 completed events');
        return;
      }

      const doneIds = new Set(done.map(e => e.event_id));

      // "Previous" = all completed events for this league BEFORE the last race day.
      // Grouping by day ensures that if Main race 8 and Main race 9 both ran on the
      // same calendar day, position_change shows the swing across both races together,
      // not just the second one.  Wild races never bleed into Main calculations here
      // because `done` is already filtered to this league only.
      const lastDayTs = parseDate(done[done.length - 1].date);
      let   prevDone  = done.filter(e => parseDate(e.date) < lastDayTs);

      // Safety fallback: if date parsing produced no separation (all events return
      // the same/zero timestamp), fall back to slicing off the single last event.
      if (prevDone.length === 0 && done.length > 1) {
        prevDone = done.slice(0, -1);
        log('NOTE ' + key + ': date grouping gave empty prevDone — falling back to slice(0,-1)');
      }

      const prevIds = new Set(prevDone.map(e => e.event_id));

      // Are there any completed playoff events yet? (used for bracket auto-assignment)
      const hasPlayoffDone = done.some(e => isFlagSet(e.is_playoff));

      // Collect result rows for each subset
      const curResults  = collectResults(doneIds, resultsByEvent);
      const prevResults = collectResults(prevIds, resultsByEvent);

      // Build driver standings rows (prevDone used as events list so reverse-grid
      // detection is consistent with the results being aggregated)
      const driverRows     = buildDriverRows(curResults,  done,     seasonKey, league, rule, bans, driverNames, driverTeamKey);
      const prevDriverRows = buildDriverRows(prevResults, prevDone, seasonKey, league, rule, bans, driverNames, driverTeamKey);

      // Enrich driver rows with delta fields and bracket
      const prevByDriver  = indexBy(prevDriverRows, 'driver_id');
      const leaderPts     = driverRows.length ? toNum(driverRows[0].points) : 0;
      const hasPrevData   = prevDriverRows.length > 0;

      driverRows.forEach((d, i) => {
        const prev    = prevByDriver[d.driver_id];

        if (!hasPrevData || !prev) {
          // No previous standings available (first race of the season, or driver is new)
          d.position_change = '0';
          d.gain            = String(toNum(d.points));
        } else {
          d.position_change = String(toNum(prev.position) - (i + 1));
          d.gain            = String(toNum(d.points) - toNum(prev.points));
        }

        d.interval = i > 0 ? String(toNum(driverRows[i - 1].points) - toNum(d.points)) : '0';
        d.gap      = String(leaderPts - toNum(d.points));

        // Bracket: manual override > auto by playoff_cutoff rank > none
        const bk = d.driver_id ? manualBrackets[seasonKey + '|' + d.driver_id] : null;
        if (bk) {
          d.bracket = bk;
        } else if (rule.playoff_cutoff && hasPlayoffDone) {
          d.bracket = (i + 1) <= rule.playoff_cutoff ? 'upper' : 'lower';
        } else {
          d.bracket = '';
        }
      });

      // Constructors: points = sum of ALL per-race points for both cars (no best-N).
      // Stats are aggregated from raw results by team name (same logic as drivers).
      const constrRows     = buildConstructorRowsFromResults(curResults,  done,     seasonKey);
      const prevConstrRows = buildConstructorRowsFromResults(prevResults, prevDone, seasonKey);

      const prevByTeam         = indexBy(prevConstrRows, 'team');
      const constrLeadPts      = constrRows.length ? toNum(constrRows[0].points) : 0;
      const hasPrevConstrData  = prevConstrRows.length > 0;

      constrRows.forEach((c, i) => {
        const prev = prevByTeam[c.team];

        if (!hasPrevConstrData || !prev) {
          c.position_change = '0';
          c.gain            = String(toNum(c.points));
        } else {
          c.position_change = String(toNum(prev.position) - (i + 1));
          c.gain            = String(toNum(c.points) - toNum(prev.points));
        }

        c.interval = i > 0 ? String(toNum(constrRows[i - 1].points) - toNum(c.points)) : '0';
        c.gap      = String(constrLeadPts - toNum(c.points));
      });

      // Bucket into output arrays
      if (league === 'Main') {
        out.driversMain.push(...driverRows);
        out.constructorsMain.push(...constrRows);
      } else if (league === 'Wild') {
        out.driversWild.push(...driverRows);
        out.constructorsWild.push(...constrRows);
      }
    });

    // ── Write output ───────────────────────────────────────────────────
    if (preview) {
      writePreviewTab('PREVIEW_drivers_main',      out.driversMain);
      writePreviewTab('PREVIEW_drivers_wild',      out.driversWild);
      writePreviewTab('PREVIEW_constructors_main', out.constructorsMain);
      writePreviewTab('PREVIEW_constructors_wild', out.constructorsWild);
    } else {
      writeToTab(GID.driversMain,      out.driversMain);
      writeToTab(GID.driversWild,      out.driversWild);
      writeToTab(GID.constructorsMain, out.constructorsMain);
      writeToTab(GID.constructorsWild, out.constructorsWild);
    }

    log('Done.');
    const dest = preview ? 'PREVIEW_* tabs (live tabs untouched)' : 'live standings tabs';
    ui.alert(
      (preview ? '[PREVIEW] ' : '') + 'Standings computed → ' + dest + '\n\n' +
      'Drivers Main:       ' + out.driversMain.length      + ' row(s)\n' +
      'Drivers Wild:       ' + out.driversWild.length      + ' row(s)\n' +
      'Constructors Main:  ' + out.constructorsMain.length + ' row(s)\n' +
      'Constructors Wild:  ' + out.constructorsWild.length + ' row(s)'
    );

  } catch (err) {
    log('ERROR: ' + err.message + '\n' + (err.stack || ''));
    ui.alert('Error computing standings:\n\n' + err.message + '\n\nOpen Extensions > Apps Script > Executions for the full log.');
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// DRIVER STANDINGS BUILDER
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Aggregate per-driver stats from a set of result rows, apply the
 * "best N of Y" rule (with ban adjustment), then return a sorted standings array.
 *
 * @param {Object[]} results      - RaceResultRow objects for the events of interest.
 * @param {Object[]} events       - RaceEvent objects for the same events (used for reverse_grid flag).
 * @param {string}   seasonKey    - e.g. "S6"
 * @param {string}   league       - "Main" or "Wild"
 * @param {Object}   rule         - { counted_races, playoff_cutoff }
 * @param {Object}   bans         - Map of "season|driver_id|league" → ban count
 * @param {Object}   driverNames  - Map of driver_id → display name (fallback)
 * @param {Object}   driverTeamKey - Map of driver_id → team_key (fallback)
 */
function buildDriverRows(results, events, seasonKey, league, rule, bans, driverNames, driverTeamKey) {
  // Events that used a reverse grid — excluded from pole/grid stat accumulation
  const reverseGridIds = new Set(
    events.filter(e => norm(e.reverse_grid) === 'yes').map(e => e.event_id)
  );

  const acc = {};

  results.forEach(r => {
    const did = (r.driver_id || '').trim();
    if (!did) return;

    if (!acc[did]) {
      acc[did] = {
        driver_id:    did,
        driver_name:  r.driver_name || driverNames[did] || did,
        team:         r.team || driverTeamKey[did] || '',
        allPts:       [],        // every race's points — used for best-N selection
        positions:    [],        // numeric finish positions — used for tie-breaking
        p1: 0, p2: 0, p3: 0, top5: 0, top10: 0,
        bestFinish:   Infinity,
        bestGrid:     Infinity,
        fastestLaps:  0,
        poles:        0,
        dotd:         0,
        dnfs:         0,
        races:        0,
        penaltyPoints: 0,
      };
    }

    const d   = acc[did];
    const pts = toNum(r.points);
    const pos = parsePos(r.position);
    const dnf = isDnf(r);
    const rg  = reverseGridIds.has(r.event_id);

    d.allPts.push(pts);
    d.races++;
    if (r.team) d.team = r.team; // keep the team from the most recent race

    if (!dnf && isFinite(pos)) {
      d.positions.push(pos);
      if (pos < d.bestFinish) d.bestFinish = pos;
      if (pos === 1)  { d.p1++; }
      if (pos === 2)  { d.p2++; }
      if (pos === 3)  { d.p3++; }
      if (pos <= 5)   { d.top5++; }
      if (pos <= 10)  { d.top10++; }
    }

    if (dnf) d.dnfs++;

    // Grid / qualifying stats (skip reverse-grid events)
    if (!rg) {
      const grid = parsePos(r.grid);
      if (isFinite(grid) && grid > 0) {
        if (grid < d.bestGrid) d.bestGrid = grid;
        if (grid === 1) d.poles++;
      }
    }

    if (isFlagSet(r.fastest_lap)) d.fastestLaps++;
    if (isFlagSet(r.dotd))        d.dotd++;
  });

  // Apply best-N rule with ban adjustment
  Object.values(acc).forEach(d => {
    const banKey     = seasonKey + '|' + d.driver_id + '|' + league;
    const banCount   = bans[banKey] || 0;
    const effectiveN = Math.max(0, rule.counted_races - banCount);
    const sorted     = [...d.allPts].sort((a, b) => b - a);
    d.champPts       = sorted.slice(0, effectiveN).reduce((s, p) => s + p, 0);
  });

  // Sort: championship points desc, then F1 tie-break cascade (P1 count → P2 → …)
  const sorted = Object.values(acc).sort((a, b) => {
    if (b.champPts !== a.champPts) return b.champPts - a.champPts;
    return tieBreak(a.positions, b.positions);
  });

  return sorted.map((d, i) => ({
    position:          String(i + 1),
    position_change:   '0',  // filled in by caller
    driver_id:         d.driver_id,
    driver_name:       d.driver_name,
    team:              d.team,
    points:            String(d.champPts),
    gain:              '0',  // filled in by caller
    interval:          '0',  // filled in by caller
    gap:               '0',  // filled in by caller
    p1:                String(d.p1),
    p2:                String(d.p2),
    p3:                String(d.p3),
    top5:              String(d.top5),
    top10:             String(d.top10),
    best_finish:       isFinite(d.bestFinish) ? String(d.bestFinish) : '',
    best_quali:        isFinite(d.bestGrid)   ? String(d.bestGrid)   : '',
    fastest_laps:      String(d.fastestLaps),
    poles:             String(d.poles),
    dotd:              String(d.dotd),
    penalty_points:    String(d.penaltyPoints),
    dnfs:              String(d.dnfs),
    races:             String(d.races),
    season:            seasonKey,
    bracket:           '',   // filled in by caller
    table_image:       '',
    competition_status: 'active',
    competition_note:  '',
  }));
}

// ═══════════════════════════════════════════════════════════════════════════
// CONSTRUCTOR STANDINGS BUILDER
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Constructors championship:
 *   - Points = sum of every race's `points` for all cars of that team (both drivers).
 *     The driver "best N of Y" rule does NOT apply here — all races count.
 *   - All other columns aggregate the same per-race stats as drivers, combined by team.
 *
 * @param {Object[]} results - Race result rows for the events window (current or "prev").
 * @param {Object[]} events  - Schedule rows for that same window (reverse_grid lookup).
 * @param {string}   seasonKey - e.g. "S6"
 */
function buildConstructorRowsFromResults(results, events, seasonKey) {
  const reverseGridIds = new Set(
    events.filter(e => norm(e.reverse_grid) === 'yes').map(e => e.event_id),
  );

  const acc = {};

  results.forEach(r => {
    const team = (r.team || 'Unknown').trim();
    if (!team) return;

    if (!acc[team]) {
      acc[team] = {
        team,
        pts:           0,
        p1: 0, p2: 0, p3: 0, top5: 0, top10: 0,
        bestFinish:    Infinity,
        bestGrid:      Infinity,
        fastestLaps:   0,
        poles:         0,
        dotd:          0,
        dnfs:          0,
        races:         0,
        penaltyPoints: 0,
        positions:     [],
      };
    }

    const t   = acc[team];
    const pts = toNum(r.points);
    const pos = parsePos(r.position);
    const dnf = isDnf(r);
    const rg  = reverseGridIds.has(r.event_id);

    t.pts   += pts;
    t.races++;

    if (!dnf && isFinite(pos)) {
      t.positions.push(pos);
      if (pos < t.bestFinish) t.bestFinish = pos;
      if (pos === 1)  t.p1++;
      if (pos === 2)  t.p2++;
      if (pos === 3)  t.p3++;
      if (pos <= 5)   t.top5++;
      if (pos <= 10)  t.top10++;
    }

    if (dnf) t.dnfs++;

    if (!rg) {
      const grid = parsePos(r.grid);
      if (isFinite(grid) && grid > 0) {
        if (grid < t.bestGrid) t.bestGrid = grid;
        if (grid === 1) t.poles++;
      }
    }

    if (isFlagSet(r.fastest_lap)) t.fastestLaps++;
    if (isFlagSet(r.dotd))        t.dotd++;
    t.penaltyPoints += toNum(r.penalty_points);
  });

  const sorted = Object.values(acc).sort((a, b) => {
    if (b.pts !== a.pts) return b.pts - a.pts;
    return tieBreak(a.positions, b.positions);
  });

  return sorted.map((t, i) => ({
    position:           String(i + 1),
    position_change:    '0',
    driver_id:          '',
    driver_name:        '',
    team:               t.team,
    points:             String(t.pts),
    gain:               '0',
    interval:           '0',
    gap:                '0',
    p1:                 String(t.p1),
    p2:                 String(t.p2),
    p3:                 String(t.p3),
    top5:               String(t.top5),
    top10:              String(t.top10),
    best_finish:        isFinite(t.bestFinish) ? String(t.bestFinish) : '',
    best_quali:         isFinite(t.bestGrid)   ? String(t.bestGrid)   : '',
    fastest_laps:       String(t.fastestLaps),
    poles:              String(t.poles),
    dotd:               String(t.dotd),
    penalty_points:     String(t.penaltyPoints),
    dnfs:               String(t.dnfs),
    races:              String(t.races),
    season:             seasonKey,
    bracket:            '',
    table_image:        '',
    competition_status: 'active',
    competition_note:   '',
  }));
}

// ═══════════════════════════════════════════════════════════════════════════
// OUTPUT WRITERS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Write computed standings to a live output tab (identified by GID).
 * Rows for seasons < MIN_AUTO_SEASON are preserved unchanged.
 * Rows for seasons >= MIN_AUTO_SEASON are fully replaced with computedRows.
 */
function writeToTab(sheetId, computedRows) {
  const sheet = getSheetById(sheetId);
  if (!sheet) {
    log('WARNING: Sheet GID ' + sheetId + ' not found — skipping write');
    return;
  }

  const existing   = readSheetById(sheetId);
  const staticRows = existing.filter(r => {
    const n = parseSeasonNum(r.season);
    return !isNaN(n) && n < MIN_AUTO_SEASON;
  });

  _writeRows(sheet, [...staticRows, ...computedRows]);
  log('Wrote GID ' + sheetId + ': ' + staticRows.length + ' static + ' + computedRows.length + ' computed row(s)');
}

/**
 * Write computed standings to a PREVIEW_* tab for validation.
 * Creates or replaces the preview tab; never touches the real output tabs.
 */
function writePreviewTab(tabName, rows) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(tabName);
  if (sheet) {
    sheet.clearContents();
  } else {
    sheet = ss.insertSheet(tabName);
  }
  _writeRows(sheet, rows);
  log('Preview written to tab: ' + tabName + ' (' + rows.length + ' row(s))');
}

function _writeRows(sheet, rows) {
  const data = [OUTPUT_HEADERS, ...rows.map(r => OUTPUT_HEADERS.map(h => r[h] !== undefined ? r[h] : ''))];
  sheet.clearContents();
  if (data.length > 1) {
    sheet.getRange(1, 1, data.length, OUTPUT_HEADERS.length).setValues(data);
    sheet.setFrozenRows(1);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// AUTO-TRIGGER (TIME-BASED)
// ═══════════════════════════════════════════════════════════════════════════

/** Install a time-based trigger to refresh standings every hour. */
function installTrigger() {
  // Remove any existing standings trigger first to avoid duplicates
  removeTrigger();
  ScriptApp.newTrigger('computeStandings')
    .timeBased()
    .everyHours(1)
    .create();
  SpreadsheetApp.getUi().alert('Auto-trigger installed: standings will refresh every hour.\nUse PSGiL → Remove Auto-Trigger to stop it.');
}

/** Remove the time-based auto-trigger if it exists. */
function removeTrigger() {
  ScriptApp.getProjectTriggers()
    .filter(t => t.getHandlerFunction() === 'computeStandings')
    .forEach(t => ScriptApp.deleteTrigger(t));
}

// ═══════════════════════════════════════════════════════════════════════════
// DIAGNOSTICS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Prefix a string so Google Sheets stores it as plain text, not a formula.
 * Cells starting with =, +, -, or @ are interpreted as formulas and show #ERROR!.
 */
function sheetSafeText_(s) {
  const t = String(s);
  if (t.length > 0 && /^[=+\-@]/.test(t)) return "'" + t;
  return t;
}

/**
 * Writes a DEBUG_standings tab with a human-readable diagnosis of what the
 * script is reading and computing.  Run this from PSGiL → Debug Standings when
 * gain / position_change values look wrong.
 */
function debugStandings() {
  const ui   = SpreadsheetApp.getUi();
  const ss   = SpreadsheetApp.getActiveSpreadsheet();
  const lines = [];

  try {
    const allResults  = readSheetById(GID.raceResults);
    const allEvents   = readSheetById(GID.schedule);
    const seasonRules = readSheetByName(CONFIG_TAB.seasonRules);

    lines.push('=== PSGiL Standings Diagnostics ===');
    lines.push('Race results rows loaded: ' + allResults.length);
    lines.push('Schedule rows loaded: '     + allEvents.length);
    lines.push('Season rules loaded: '      + seasonRules.length);
    lines.push('');

    // Sample first 3 result rows to verify column names
    lines.push('--- First 3 race result rows (column check) ---');
    allResults.slice(0, 3).forEach((r, i) => {
      lines.push('Row ' + (i+1) + ': event_id=' + r.event_id +
        '  driver_id=' + r.driver_id +
        '  points=' + r.points +
        '  position=' + r.position +
        '  team=' + r.team);
    });
    lines.push('');

    // Sample first 3 schedule rows to verify date / league / status
    lines.push('--- First 3 schedule rows (column check) ---');
    allEvents.slice(0, 3).forEach((r, i) => {
      lines.push('Row ' + (i+1) + ': event_id=' + r.event_id +
        '  season=' + r.season +
        '  league=' + r.league +
        '  status=' + r.status +
        '  date=' + r.date +
        '  parsedDate=' + parseDate(r.date));
    });
    lines.push('');

    // Check each auto-compute season+league
    const autoKeys = new Set();
    allEvents.forEach(ev => {
      const n = parseSeasonNum(ev.season);
      if (!isNaN(n) && n >= MIN_AUTO_SEASON) {
        const sk = normSeason(ev.season);
        const lg = titleCase(norm(ev.league));
        if (sk && lg) autoKeys.add(sk + '|' + lg);
      }
    });

    lines.push('Auto-compute pairs found: ' + Array.from(autoKeys).join(', '));
    lines.push('');

    const rules = {};
    seasonRules.forEach(r => {
      const sk  = normSeason(r.season);
      const lg  = titleCase(norm(r.league));
      const key = sk + '|' + lg;
      if (sk && lg) rules[key] = toNum(r.counted_races);
    });

    // Build resultsByEvent index
    const resultsByEvent = {};
    allResults.forEach(r => {
      if (!r.event_id) return;
      (resultsByEvent[r.event_id] = resultsByEvent[r.event_id] || []).push(r);
    });

    autoKeys.forEach(key => {
      const [seasonKey, league] = key.split('|');
      lines.push('=== ' + key + ' (counted_races=' + (rules[key] || 'MISSING') + ') ===');

      const done = allEvents
        .filter(ev =>
          normSeason(ev.season) === seasonKey &&
          titleCase(norm(ev.league)) === league &&
          norm(ev.status) === 'completed'
        )
        .sort((a, b) => parseDate(a.date) - parseDate(b.date));

      lines.push('Completed events: ' + done.length);
      done.forEach(ev => {
        const resultCount = (resultsByEvent[ev.event_id] || []).length;
        const samplePts   = (resultsByEvent[ev.event_id] || []).slice(0, 2)
          .map(r => r.driver_id + ':' + r.points).join(', ');
        lines.push('  ' + ev.event_id + '  date=' + ev.date + '  parsedTs=' + parseDate(ev.date) +
          '  results=' + resultCount + '  sample_pts=[' + samplePts + ']');
      });

      if (done.length > 0) {
        const lastDayTs = parseDate(done[done.length - 1].date);
        const prevDone  = done.filter(e => parseDate(e.date) < lastDayTs);
        lines.push('Last race day timestamp: ' + lastDayTs);
        lines.push('prevDone events (before last day): ' + prevDone.length);
        if (prevDone.length === 0 && done.length > 1) {
          lines.push('  ⚠  prevDone is empty despite ' + done.length +
            ' events — all events share the same date or date parsing failed.');
        }
      }
      lines.push('');
    });

    // Write to debug tab
    let debugSheet = ss.getSheetByName('DEBUG_standings');
    if (!debugSheet) debugSheet = ss.insertSheet('DEBUG_standings');
    debugSheet.clearContents();
    const safeRows = lines.map((l) => [sheetSafeText_(l)]);
    debugSheet.getRange(1, 1, safeRows.length, 1).setValues(safeRows);
    // Plain-text column so future diagnostic lines are never parsed as formulas
    debugSheet.getRange(1, 1, safeRows.length, 1).setNumberFormat('@');
    debugSheet.autoResizeColumns(1, 1);

    ui.alert('Diagnostics written to tab: DEBUG_standings\n\nPlease review that tab for issues.');
  } catch (err) {
    ui.alert('Debug error: ' + err.message + '\n' + (err.stack || ''));
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// SHEET READERS
// ═══════════════════════════════════════════════════════════════════════════

function getSheetById(id) {
  return SpreadsheetApp.getActiveSpreadsheet().getSheets().find(s => s.getSheetId() === id) || null;
}

function readSheetById(id) {
  const sheet = getSheetById(id);
  return sheet ? sheetToObjects(sheet) : [];
}

function readSheetByName(name) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(name);
  return sheet ? sheetToObjects(sheet) : [];
}

/**
 * Convert a Sheet's data range to an array of plain objects.
 * Row 1 headers are normalized to lowercase_snake_case (matching the website's normalizeKey).
 * Empty rows are skipped.
 */
function sheetToObjects(sheet) {
  const data = sheet.getDataRange().getValues();
  if (data.length < 2) return [];

  const headers = data[0].map(h => normalizeKey(String(h)));
  const rows    = [];

  for (let i = 1; i < data.length; i++) {
    const row     = {};
    let   hasData = false;

    for (let j = 0; j < headers.length; j++) {
      if (!headers[j]) continue;
      const raw = data[i][j];
      let   val;
      if (raw instanceof Date) {
        // Convert Google Sheets Date objects to DD.MM.YYYY (schedule tab convention)
        val = pad2(raw.getDate()) + '.' + pad2(raw.getMonth() + 1) + '.' + raw.getFullYear();
      } else {
        val = (raw !== null && raw !== undefined) ? String(raw).trim() : '';
      }
      row[headers[j]] = val;
      if (val) hasData = true;
    }

    if (hasData) rows.push(row);
  }

  return rows;
}

// ═══════════════════════════════════════════════════════════════════════════
// UTILITIES
// ═══════════════════════════════════════════════════════════════════════════

function collectResults(eventIdSet, resultsByEvent) {
  const out = [];
  eventIdSet.forEach(eid => (resultsByEvent[eid] || []).forEach(r => out.push(r)));
  return out;
}

function buildMap(arr, keyField, valueFn) {
  const m = {};
  arr.forEach(r => { if (r[keyField]) m[r[keyField]] = valueFn(r); });
  return m;
}

function indexBy(arr, field) {
  const m = {};
  arr.forEach(r => { if (r[field]) m[r[field]] = r; });
  return m;
}

/** Normalize a header string to lowercase snake_case (matches website's normalizeKey). */
function normalizeKey(k) {
  return k.toLowerCase().replace(/[\s\-]+/g, '_').replace(/[^a-z0-9_]/g, '');
}

/** Lowercase and trim a value. */
function norm(s) {
  return String(s || '').trim().toLowerCase();
}

/** "main" → "Main" */
function titleCase(s) {
  return s ? s.charAt(0).toUpperCase() + s.slice(1).toLowerCase() : s;
}

/** "6" | "S6" | "s6" → "S6". Returns '' for invalid input. */
function normSeason(s) {
  const n = parseSeasonNum(s);
  return isNaN(n) ? '' : 'S' + n;
}

function parseSeasonNum(s) {
  return parseInt(String(s || '').replace(/^s/i, ''), 10);
}

/**
 * Parse a finishing position string to an integer.
 * Non-numeric values (DNF, DNS, DSQ, etc.) return Infinity.
 */
function parsePos(s) {
  const n = parseInt(String(s || ''), 10);
  return isNaN(n) ? Infinity : n;
}

/** Convert a value to a number, defaulting to 0. */
function toNum(s) {
  const n = parseFloat(String(s || '').replace(/,/g, ''));
  return isNaN(n) ? 0 : n;
}

/**
 * Detect DNF/DNS/DSQ/retired from a race result row.
 * Checks both the `status` field and the `position` field.
 */
function isDnf(row) {
  const NON_FINISH = ['DNF', 'DNS', 'DSQ', 'RET', 'EX', 'NC', 'DQ', 'WD'];
  const status     = String(row.status   || '').toUpperCase().trim();
  const pos        = String(row.position || '').toUpperCase().trim();
  return NON_FINISH.some(c => status === c || pos === c);
}

/** Return true if a flag-style column value represents yes/true. */
function isFlagSet(val) {
  const v = String(val || '').toLowerCase().trim();
  return v === '1' || v === 'true' || v === 'yes';
}

/**
 * Parse a date string to a millisecond timestamp for chronological sorting.
 * Handles: DD.MM.YYYY | YYYY-MM-DD | MM/DD/YYYY
 */
function parseDate(s) {
  if (!s) return 0;
  const str = String(s).trim();

  let m = str.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  if (m) return new Date(+m[3], +m[2] - 1, +m[1]).getTime();

  m = str.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) return new Date(+m[1], +m[2] - 1, +m[3]).getTime();

  m = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) return new Date(+m[3], +m[1] - 1, +m[2]).getTime();

  return 0;
}

/**
 * F1-style tie-breaking: compare two drivers by their array of finish positions.
 * Cascades from P1 count → P2 count → P3 count → … → P20.
 * Returns negative if a ranks higher, positive if b ranks higher.
 */
function tieBreak(posA, posB) {
  const cA = countOccurrences(posA);
  const cB = countOccurrences(posB);
  for (let p = 1; p <= 20; p++) {
    const diff = (cB[p] || 0) - (cA[p] || 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

function countOccurrences(arr) {
  const c = {};
  arr.forEach(v => { c[v] = (c[v] || 0) + 1; });
  return c;
}

function pad2(n) {
  return String(n).padStart(2, '0');
}

function log(msg) {
  Logger.log('[PSGiL Standings] ' + msg);
}
