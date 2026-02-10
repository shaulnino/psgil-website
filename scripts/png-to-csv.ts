#!/usr/bin/env tsx
/* ------------------------------------------------------------------ */
/*  PNG → CSV migration tool                                           */
/*  Converts PSGiL results/standings PNG tables to CSV via OCR         */
/*                                                                      */
/*  Usage:                                                              */
/*    npx tsx scripts/png-to-csv.ts --type race --event_id s6_r01_main \*/
/*      --input public/events/results/s6_r01_mainR.png                 \*/
/*      --output scripts/output/s6_r01_main.csv --debug                */
/* ------------------------------------------------------------------ */

import * as fs from "fs";
import * as path from "path";
import sharp from "sharp";

/* ------------------------------------------------------------------ */
/*  CLI argument parsing                                                */
/* ------------------------------------------------------------------ */

type TableType = "race" | "drivers-standings" | "constructors-standings";

interface CliArgs {
  type: TableType;
  event_id: string;
  input: string;
  output: string;
  debug: boolean;
}

function parseArgs(): CliArgs {
  const args = process.argv.slice(2);
  const map: Record<string, string> = {};
  let debug = false;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--debug") {
      debug = true;
      continue;
    }
    if (args[i].startsWith("--") && i + 1 < args.length) {
      map[args[i].replace(/^--/, "")] = args[i + 1];
      i++;
    }
  }

  const type = map.type as TableType;
  if (!["race", "drivers-standings", "constructors-standings"].includes(type)) {
    console.error(
      "❌ --type must be one of: race, drivers-standings, constructors-standings",
    );
    process.exit(1);
  }

  if (!map.input) {
    console.error("❌ --input is required (path to PNG)");
    process.exit(1);
  }

  if (!map.output) {
    console.error("❌ --output is required (path for CSV output)");
    process.exit(1);
  }

  if (type === "race" && !map.event_id) {
    console.error("❌ --event_id is required for --type race");
    process.exit(1);
  }

  return {
    type,
    event_id: map.event_id ?? "",
    input: path.resolve(map.input),
    output: path.resolve(map.output),
    debug,
  };
}

/* ------------------------------------------------------------------ */
/*  CSV Headers                                                         */
/* ------------------------------------------------------------------ */

const RACE_HEADERS = [
  "event_id",
  "position",
  "position_change",
  "driver_name",
  "team",
  "time_or_gap",
  "best_lap",
  "laps",
  "grid",
  "stops",
  "kph",
  "overtakes",
  "laps_led",
  "distance_led",
  "steward_penalty",
  "game_penalty",
  "points",
  "status",
  "fastest_lap",
  "dotd",
];

const DRIVERS_STANDINGS_HEADERS = [
  "position",
  "position_change",
  "driver_name",
  "team",
  "points",
  "gain",
  "interval",
  "gap",
  "p1",
  "p2",
  "p3",
  "top5",
  "top10",
  "best_finish",
  "best_quali",
  "fastest_laps",
  "poles",
  "dotd",
  "penalty_points",
  "dnfs",
  "races",
];

const CONSTRUCTORS_STANDINGS_HEADERS = [
  "position",
  "position_change",
  "team",
  "points",
  "gain",
  "interval",
  "gap",
  "p1",
  "p2",
  "p3",
  "top5",
  "top10",
  "best_finish",
  "best_quali",
  "fastest_laps",
  "poles",
  "dotd",
  "penalty_points",
  "dnfs",
  "races",
];

/* ------------------------------------------------------------------ */
/*  Known teams for fuzzy matching                                      */
/* ------------------------------------------------------------------ */

const KNOWN_TEAMS = [
  "ALPINE",
  "ASTON MARTIN",
  "FERRARI",
  "HAAS FERRARI",
  "KICK SAUBER",
  "MCLAREN",
  "MERCEDES",
  "RACING BULLS",
  "RED BULL",
  "WILLIAMS",
];

// Sort longest first so "HAAS FERRARI" matches before "FERRARI"
const TEAMS_BY_LENGTH = [...KNOWN_TEAMS].sort((a, b) => b.length - a.length);

function matchTeam(raw: string): string {
  const upper = raw.toUpperCase().replace(/[^A-Z ]/g, " ").replace(/\s+/g, " ").trim();

  // Try fuzzy-contains (longest match first)
  for (const t of TEAMS_BY_LENGTH) {
    const compressed = t.replace(/\s/g, "");
    if (upper.replace(/\s/g, "").includes(compressed)) return t;
  }

  // Substring check
  for (const t of TEAMS_BY_LENGTH) {
    if (upper.includes(t)) return t;
  }

  return raw.trim();
}

/* ------------------------------------------------------------------ */
/*  Image preprocessing                                                 */
/* ------------------------------------------------------------------ */

async function preprocessImage(inputPath: string): Promise<Buffer> {
  return sharp(inputPath)
    .greyscale()
    .normalize()
    .sharpen()
    .resize({ width: 3000, withoutEnlargement: false })
    .png()
    .toBuffer();
}

/* ------------------------------------------------------------------ */
/*  OCR via tesseract.js                                                */
/* ------------------------------------------------------------------ */

async function runOcr(imageBuffer: Buffer): Promise<string> {
  // Dynamic import to avoid top-level issues
  const Tesseract = await import("tesseract.js");
  const worker = await Tesseract.createWorker("eng");
  await worker.setParameters({
    tessedit_pageseg_mode: "6" as unknown as Tesseract.PSM, // Assume uniform block of text
  });

  const {
    data: { text },
  } = await worker.recognize(imageBuffer);
  await worker.terminate();
  return text;
}

/* ------------------------------------------------------------------ */
/*  Position normalization (common OCR misreads)                        */
/* ------------------------------------------------------------------ */

function normalizePosition(raw: string): string {
  let p = raw
    .replace(/[oO]/g, "0")
    .replace(/[lI|]/g, "1")
    .replace(/é/g, "6")
    .replace(/®/g, "9")
    .replace(/[@]/g, "0")
    .replace(/\s/g, "")
    .replace(/[^0-9]/g, "");

  const n = parseInt(p, 10);
  if (!isNaN(n) && n >= 1 && n <= 30) return String(n);
  return "";
}

/* ------------------------------------------------------------------ */
/*  Driver name cleaning                                                */
/* ------------------------------------------------------------------ */

function cleanDriverName(raw: string): string {
  let name = raw
    .replace(/[\u{1F1E6}-\u{1F1FF}]/gu, "") // flag regional chars
    .replace(/[\u{1F300}-\u{1FAFF}]/gu, "") // misc emojis
    .replace(/[™©®]/g, "")
    .replace(/\d+$/g, "") // trailing numbers
    .replace(/[^a-zA-ZÀ-ÿ\s'.,-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  // Fix concatenated names: "JohnDoe" → "John Doe"
  name = name.replace(/([a-z])([A-Z])/g, "$1 $2");

  return name;
}

/* ------------------------------------------------------------------ */
/*  Parse race results from OCR text                                    */
/* ------------------------------------------------------------------ */

function parseRaceResults(
  text: string,
  eventId: string,
): Record<string, string>[] {
  const lines = text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  const results: Record<string, string>[] = [];

  for (const line of lines) {
    // Skip header-like lines
    if (/^(pos|position|#|driver|team|result)/i.test(line)) continue;

    // Try to match a line starting with a position number
    const posMatch = line.match(/^(\d{1,2})\b/);
    if (!posMatch) continue;

    const pos = normalizePosition(posMatch[1]);
    if (!pos) continue;

    const rest = line.slice(posMatch[0].length).trim();

    // Extract time/gap (e.g. "+1.234", "1:23.456", "DNF", "DSQ")
    const timeMatch = rest.match(
      /(\+\d+[.:]\d+|\d{1,2}:\d{2}[.:]\d{2,3}|DNF|DSQ|DNS)/i,
    );
    const timeOrGap = timeMatch ? timeMatch[1].replace(/,/g, ".") : "";

    // Extract best lap time
    const bestLapMatch = rest.match(/\b(\d{1}:\d{2}\.\d{2,3})\b/);

    // Extract points (last standalone number)
    const numbers = rest.match(/\b(\d{1,3})\b/g);
    const points =
      numbers && numbers.length > 0 ? numbers[numbers.length - 1] : "";

    // Extract driver name (heuristic: alphabetic words before the time/team)
    const nameSegment = rest
      .replace(
        /(\+\d+[.:]\d+|\d{1,2}:\d{2}[.:]\d{2,3}|DNF|DSQ|DNS)/gi,
        " ",
      )
      .replace(/\b\d{1,3}\b/g, " ");

    // Try to extract team
    const teamRaw = matchTeam(nameSegment);
    const driverRaw = nameSegment
      .replace(new RegExp(teamRaw.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi"), "")
      .trim();

    const row: Record<string, string> = {};
    for (const h of RACE_HEADERS) row[h] = "";

    row.event_id = eventId;
    row.position = pos;
    row.driver_name = cleanDriverName(driverRaw);
    row.team = teamRaw !== driverRaw ? teamRaw : "";
    row.time_or_gap = timeOrGap;
    row.best_lap = bestLapMatch ? bestLapMatch[1] : "";
    row.points = points;

    // Detect status
    if (/DNF/i.test(line)) row.status = "DNF";
    else if (/DSQ/i.test(line)) row.status = "DSQ";
    else if (/DNS/i.test(line)) row.status = "DNS";
    else row.status = "Finished";

    results.push(row);
  }

  return results;
}

/* ------------------------------------------------------------------ */
/*  Parse standings from OCR text                                       */
/* ------------------------------------------------------------------ */

function parseStandings(
  text: string,
  type: "drivers-standings" | "constructors-standings",
): Record<string, string>[] {
  const headers =
    type === "drivers-standings"
      ? DRIVERS_STANDINGS_HEADERS
      : CONSTRUCTORS_STANDINGS_HEADERS;

  const lines = text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  const results: Record<string, string>[] = [];

  for (const line of lines) {
    // Skip header-like lines
    if (/^(pos|position|#|driver|team|constructor|name)/i.test(line)) continue;

    // Must start with a position number
    const posMatch = line.match(/^(\d{1,2})\b/);
    if (!posMatch) continue;

    const pos = normalizePosition(posMatch[1]);
    if (!pos) continue;

    const rest = line.slice(posMatch[0].length).trim();

    // Extract all numbers from the line
    const allNumbers = rest.match(/\b(\d+)\b/g) || [];

    // First big number is likely points
    const pointsIdx = allNumbers.findIndex(
      (n, i) => parseInt(n, 10) > 5 || i > 2,
    );
    const points = pointsIdx >= 0 ? allNumbers[pointsIdx] : "";

    // Team matching
    const teamName = matchTeam(rest);

    // Driver name (for drivers standings)
    let driverName = "";
    if (type === "drivers-standings") {
      const nameSegment = rest
        .replace(/\b\d+\b/g, " ")
        .replace(
          new RegExp(
            teamName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
            "gi",
          ),
          " ",
        );
      driverName = cleanDriverName(nameSegment);
    }

    const row: Record<string, string> = {};
    for (const h of headers) row[h] = "";

    row.position = pos;
    if (type === "drivers-standings") {
      row.driver_name = driverName;
    }
    row.team = teamName;
    row.points = points;

    // Try to populate numeric fields from remaining numbers
    const remaining = allNumbers.filter((n) => n !== points);
    // Best-effort: assign sequentially to known numeric columns
    const numericCols =
      type === "drivers-standings"
        ? [
            "gain",
            "interval",
            "gap",
            "p1",
            "p2",
            "p3",
            "top5",
            "top10",
            "best_finish",
            "best_quali",
            "fastest_laps",
            "poles",
            "dotd",
            "penalty_points",
            "dnfs",
            "races",
          ]
        : [
            "gain",
            "interval",
            "gap",
            "p1",
            "p2",
            "p3",
            "top5",
            "top10",
            "best_finish",
            "best_quali",
            "fastest_laps",
            "poles",
            "dotd",
            "penalty_points",
            "dnfs",
            "races",
          ];

    for (let i = 0; i < Math.min(remaining.length, numericCols.length); i++) {
      row[numericCols[i]] = remaining[i];
    }

    results.push(row);
  }

  return results;
}

/* ------------------------------------------------------------------ */
/*  CSV generation                                                      */
/* ------------------------------------------------------------------ */

function toCsv(headers: string[], rows: Record<string, string>[]): string {
  const lines = [headers.join(",")];
  for (const row of rows) {
    const values = headers.map((h) => {
      const v = row[h] ?? "";
      // Escape commas / quotes
      if (v.includes(",") || v.includes('"') || v.includes("\n")) {
        return `"${v.replace(/"/g, '""')}"`;
      }
      return v;
    });
    lines.push(values.join(","));
  }
  return lines.join("\n") + "\n";
}

/* ------------------------------------------------------------------ */
/*  Main                                                                */
/* ------------------------------------------------------------------ */

async function main() {
  const args = parseArgs();

  console.log(`\n🔧 PNG → CSV Migration Tool`);
  console.log(`   Type:     ${args.type}`);
  console.log(`   Input:    ${args.input}`);
  console.log(`   Output:   ${args.output}`);
  if (args.event_id) console.log(`   Event ID: ${args.event_id}`);
  console.log(`   Debug:    ${args.debug}\n`);

  // Check input exists
  if (!fs.existsSync(args.input)) {
    console.error(`❌ Input file not found: ${args.input}`);
    process.exit(1);
  }

  // Step 1: Preprocess image
  console.log("📸 Preprocessing image...");
  const imageBuffer = await preprocessImage(args.input);

  // Step 2: Run OCR
  console.log("🔍 Running OCR (this may take a moment)...");
  const ocrText = await runOcr(imageBuffer);
  console.log(`   OCR extracted ${ocrText.split("\n").length} lines`);

  // Step 3: Parse based on type
  console.log("📋 Parsing table data...");
  let rows: Record<string, string>[];
  let headers: string[];

  switch (args.type) {
    case "race":
      rows = parseRaceResults(ocrText, args.event_id);
      headers = RACE_HEADERS;
      break;
    case "drivers-standings":
      rows = parseStandings(ocrText, "drivers-standings");
      headers = DRIVERS_STANDINGS_HEADERS;
      break;
    case "constructors-standings":
      rows = parseStandings(ocrText, "constructors-standings");
      headers = CONSTRUCTORS_STANDINGS_HEADERS;
      break;
    default:
      console.error("❌ Unknown type");
      process.exit(1);
  }

  console.log(`   Parsed ${rows.length} rows`);

  // Step 4: Write CSV
  const csv = toCsv(headers, rows);
  const outputDir = path.dirname(args.output);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  fs.writeFileSync(args.output, csv, "utf-8");
  console.log(`✅ CSV written to: ${args.output}`);

  // Step 5: Debug output
  if (args.debug) {
    const basename = path.basename(args.input, path.extname(args.input));
    const debugDir = path.resolve(__dirname, "output");
    if (!fs.existsSync(debugDir)) fs.mkdirSync(debugDir, { recursive: true });

    const ocrPath = path.join(debugDir, `${basename}.ocr.txt`);
    const jsonPath = path.join(debugDir, `${basename}.parsed.json`);

    fs.writeFileSync(ocrPath, ocrText, "utf-8");
    fs.writeFileSync(jsonPath, JSON.stringify(rows, null, 2), "utf-8");

    console.log(`\n🐛 Debug files written:`);
    console.log(`   OCR text:    ${ocrPath}`);
    console.log(`   Parsed JSON: ${jsonPath}`);

    // Preview first 5 rows
    console.log(`\n📊 Preview (first 5 rows):`);
    const preview = rows.slice(0, 5);
    for (const row of preview) {
      const pos = row.position || "?";
      const name = row.driver_name || row.team || "?";
      const pts = row.points || "—";
      console.log(`   P${pos} | ${name} | ${pts} pts`);
    }
  }

  console.log("\n✨ Done!\n");
}

main().catch((err) => {
  console.error("❌ Fatal error:", err);
  process.exit(1);
});
