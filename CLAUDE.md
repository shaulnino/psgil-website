# CLAUDE.md — PSGiL Website

> **Read this before touching any file.**
> This document is the canonical reference for Claude Code operating on this repository.

> **Canonical companion docs (root):**
> - [PROJECT_VISION.md](./PROJECT_VISION.md) — **stable** product vision. Do not edit unless the product vision itself changes.
> - [ARCHITECTURE.md](./ARCHITECTURE.md) — **living** technical reference. Update it in the same change whenever architecture, routing, backend, APIs, auth, permissions, PWA behavior, deployment, or a major implementation decision changes.
> - [DESIGN_SYSTEM.md](./DESIGN_SYSTEM.md) — **living** visual reference. Update it in the same change whenever reusable UI, styling, components, layouts, responsive behavior, or accessibility decisions change.
>
> The `docs/*` migration files are **historical** (they describe an earlier light-editorial theme that was superseded by the shipped dark "Race Control" theme). Treat ARCHITECTURE.md / DESIGN_SYSTEM.md as current truth.

---

## 1. Project Overview

**PSGiL** (Premiere Sim Gaming Israeli League) is the official website for an F1 sim racing league based in Israel. It is a Next.js 16 application deployed on Netlify.

The site is **data-driven**: all race results, standings, schedules, and driver data come from a single public Google Spreadsheet exposed as CSV endpoints. There is no traditional database for public content — the Google Sheet *is* the CMS.

The only exception is the **steward module**, which has its own structured data store backed by Netlify Blobs in production and a local JSON file in development.

---

## 2. Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router, React 19) |
| Styling | Tailwind CSS v4 |
| Charts | Recharts |
| Auth (stewards) | `jose` (JWT, HS256) |
| Email | `nodemailer` via Gmail SMTP |
| Storage (stewards) | Netlify Blobs (prod) / local JSON file (dev) |
| Deployment | Netlify |
| Type-check | TypeScript strict mode |
| Linting | ESLint (Next.js config) |

---

## 3. Commands

```bash
npm install          # Install dependencies
npm run dev          # Start local dev server at http://localhost:3000
npm run build        # Production build (runs Next.js build)
npm run start        # Start production server (after build)
npm run lint         # Run ESLint
npx tsc --noEmit     # Type-check without compiling (always run after editing)
```

> **Never run `npm run build` unless explicitly asked.** The build takes time and is only needed for deployment verification. Use `npx tsc --noEmit` for type-checking during development.

---

## 4. Environment Variables

Create `.env.local` in the repo root. This file is gitignored.

| Variable | Required | Where used | Description |
|---|---|---|---|
| `GMAIL_APP_PASSWORD` | **Yes** | `app/api/contact/route.ts`, `lib/stewards/notifications.ts` | Gmail App Password for `islf1league@gmail.com` |
| `NEWS_SHEET_URL` | **Yes** | `lib/newsData.ts` | Public Google Sheets CSV URL for the `articles` tab |
| `REWARDS_SHEET_URL` | No | `lib/seasonConfig.ts` | Override URL for rewards CSV (has default in code) |
| `STEWARD_SESSION_SECRET` | **Yes (prod)** | `lib/stewards/auth.ts` | JWT signing secret. Falls back to `"dev-steward-secret-change-me"` locally — **must be set in Netlify** |
| `NEXT_PUBLIC_SITE_URL` | No | `lib/stewards/notifications.ts` | Public base URL for steward email links. Defaults to `https://f1isl.com` |
| `NEXT_PUBLIC_GA_ID` | No | `components/GoogleAnalytics.tsx` | Google Analytics 4 Measurement ID |

> **Important:** `STEWARD_SESSION_SECRET` is not listed in README.md but is critical for production. If unset in production, a hardcoded dev secret is used and the code logs a critical error.

---

## 5. Folder Structure

```
psgil-website/
├── app/                        # Next.js App Router pages and API routes
│   ├── api/                    # API route handlers
│   │   ├── contact/            # Contact form (email via nodemailer)
│   │   ├── debug-csv/          # Debug: raw CSV fetch inspector (dev only)
│   │   ├── stats-export/       # CSV export of stats data
│   │   └── stewards/           # Steward attachment uploads, notification triggers
│   ├── drivers/                # /drivers — driver roster page with modals
│   ├── news/                   # /news — article list + [slug] detail pages
│   ├── schedule/               # /schedule — race calendar + results
│   ├── statistics/             # /statistics — championship standings + constructors
│   ├── stats/                  # /stats — driver statistics intelligence module
│   ├── stewards/               # /stewards — full protected steward portal
│   │   ├── (protected)/        # Route group requiring steward auth
│   │   │   ├── cases/          # Case list + individual case view
│   │   │   ├── appeals/        # Appeals workflow
│   │   │   ├── penalties/      # Historical penalties management
│   │   │   ├── penalties-to-serve/ # Penalty tracking + assignment
│   │   │   └── admin/          # User management, admin tools
│   │   ├── actions.ts          # Server Actions for all steward mutations
│   │   ├── change-password/    # Forced password change flow
│   │   └── login/              # Login page
│   ├── articles/               # Redirects (legacy)
│   ├── rss/                    # RSS feeds for social automation
│   ├── layout.tsx              # Root layout (fonts, GA, header, footer)
│   └── page.tsx                # Homepage
│
├── components/                 # Shared React components
│   ├── stats/                  # Sub-components for the stats module
│   ├── StatsPageContent.tsx    # Main stats page client component (large)
│   ├── ResultsTable.tsx        # Race results table
│   ├── StandingsTable.tsx      # Championship standings table
│   ├── DriverModal.tsx         # Driver detail modal (used on /drivers)
│   └── ...                     # Other UI components
│
├── lib/                        # Data layer and business logic
│   ├── csv.ts                  # fetchCsv() + parseCsv() — CSV I/O primitives
│   ├── seasonConfig.ts         # SINGLE SOURCE OF TRUTH: all CSV URLs + GIDs + season logic
│   ├── siteConfig.ts           # Static site content (navigation, hero, footer)
│   ├── resultsData.ts          # Race result types + mappers + fetchers
│   ├── driversData.ts          # Driver roster types + mappers + fetchers
│   ├── scheduleData.ts         # Schedule types + mappers + fetchers
│   ├── statsComputed.ts        # Core stats computation from raw race results
│   ├── statsMetricRegistry.ts  # Metric definitions, tab groupings, display config
│   ├── statsData.ts            # LEGACY: old CSV-based stats fetchers (mostly unused)
│   ├── h2h.ts                  # Head-to-head comparison engine + rivalry detection
│   ├── rewardsData.ts          # Season awards fetcher/mapper
│   ├── newsData.ts             # News article fetcher/mapper
│   ├── scheduleData.ts         # Schedule/calendar fetcher/mapper
│   ├── raceAlertState.ts       # Race countdown alert persistence
│   ├── ga.ts                   # Google Analytics helper
│   ├── youtube.ts              # YouTube data helpers
│   └── stewards/               # Steward module data layer
│       ├── types.ts            # All steward TypeScript types
│       ├── store.ts            # readStore() / writeStore() — Blobs vs local file
│       ├── repository.ts       # CRUD operations on the store
│       ├── auth.ts             # JWT auth, session cookies, role/permission matrix
│       ├── crypto.ts           # Password hashing (PBKDF2)
│       ├── notifications.ts    # Email notifications for steward events
│       ├── penaltyRules.ts     # Threshold penalty rules from Google Sheets
│       └── seed.ts             # Default store structure for fresh installs
│
├── data/
│   ├── stewards/               # GITIGNORED — live steward store (store.json)
│   └── rewards.template.csv   # Template showing the rewards CSV schema
│
├── public/                     # Static assets
│   ├── drivers/                # Driver profile images ({driver_id}.webp)
│   ├── events/                 # Race event images
│   ├── teams/                  # Team logo images
│   ├── statistics/             # Championship winner screenshots
│   └── uploads/stewards/       # GITIGNORED — uploaded case attachments
│
├── scripts/                    # Standalone utility scripts (NOT part of the app)
│   ├── png-to-csv.ts          # OCR tool: screenshot → CSV (uses Tesseract)
│   └── standings/
│       ├── psgil-standings.gs  # Google Apps Script for auto-computing standings
│       └── README.md           # Setup guide for the Apps Script
│
├── docs/                       # Non-code documentation
│   ├── manual-smoke-checklist.md
│   ├── race-alert-rss-zapier.md
│   └── instagram-rss-zapier.md
│
├── proxy.ts                    # ⚠️ See note below — Next.js middleware (MISNAMED)
├── netlify.toml                # Netlify build config (build command + publish dir)
├── next.config.ts              # Next.js config (server actions body limit, image sizes)
├── tsconfig.json               # TypeScript config (strict, @/* alias → ./)
└── eslint.config.mjs           # ESLint config
```

---

## 6. CSV Data Flow

All public content flows from a single Google Spreadsheet via its "Publish to web" CSV export URLs.

### The single source of truth: `lib/seasonConfig.ts`

This file contains:
- The full Google Sheet ID (split across 3 strings to avoid Netlify bundler truncation)
- Every tab's GID (numeric ID)
- `sheetUrl(gid)` helper to build full CSV URLs
- `GLOBAL_CSV_URLS` — the named map of all CSV endpoints used by the app
- `SeasonConfig` type and `fetchSeasonsConfig()` — the seasons config CSV

**Never hardcode a Google Sheets URL anywhere else.** Always use `GLOBAL_CSV_URLS.*` or `sheetUrl(GID.*)`.

### How a page fetches data

```
Page (Server Component)
  └─ fetchCsv(url, revalidate?)      ← lib/csv.ts: fetch + ISR cache (default: 5 min)
       └─ parseCsv<T>(csvString)     ← lib/csv.ts: CSV string → Record<string,string>[]
            └─ mapXxx(rawRows)       ← lib/xxxData.ts: typed mapper function
```

All pages use `export const revalidate = 300` (5-minute ISR) unless they need fresh data.

### CSV tab inventory

| `GLOBAL_CSV_URLS` key | Sheet tab | Purpose |
|---|---|---|
| `drivers` | `csv_drivers` | Driver roster (id, name, team, nationality, image, etc.) |
| `teams` | `csv_teams` | Team roster |
| `leagueStandings` | `csv_league_standings` | (legacy — not actively used) |
| `driversStandingsMain` | `csv_drivers_standings_main` | Main league driver standings |
| `driversStandingsWild` | `csv_drivers_standings_wild` | Wild league driver standings |
| `constructorsStandingsMain` | `csv_constructors_standings_main` | Main constructors standings |
| `constructorsStandingsWild` | `csv_constructors_standings_wild` | Wild constructors standings |
| `schedule` | `csv_schedule` | Race calendar + event metadata |
| `raceResults` | `csv_race_results` | All race results, all seasons |
| `rewards` | `rewards` tab | Season award winners |
| `penaltyRules` | `penalty_rules` | Steward license-point threshold rules |
| `seasonsConfig` | `csv_seasons_config` | Season metadata + feature flags |
| `NEWS_SHEET_URL` (env) | `articles` | News/articles content |

### Season key formats (IMPORTANT)

CSV data uses inconsistent season formats across tabs:
- Standings tabs use `"S6"` (with prefix)
- Schedule tab uses `"6"` (number only)
- `season_key` in config is always `"S6"`

Always use `matchesSeason(dataValue, seasonKey)` from `lib/seasonConfig.ts` when filtering by season. Never do `row.season === "S6"` directly.

---

## 7. Statistics Engine

The statistics system lives in `lib/statsComputed.ts` (with head-to-head in `lib/h2h.ts`).

> **Note:** an earlier "intelligence layer" (`lib/statsInsights.ts` — driver DNA, archetypes, tiers, auto-generated narrative sentences) was documented here but **does not exist in the codebase** (verified: no such file, and none of its functions are referenced anywhere). Do not plan around it. If narrative/insight generation is built for the new brand, build it i18n-aware from day one (see `docs/i18n-architecture.md`).

### Architecture

```
Raw CSV race results (all seasons, all events)
  └─ computeDriverStats(results, events, rewards, seasons, filters?)
       └─ buildIntermediates()      ← per-driver aggregates
       └─ computeRatings()          ← Speed, Consistency, Performance, Agility, Driver Rating
       └─ computeAllScopeRanks()    ← rank_* and season_rank_* columns
       └─ Returns: { rows: DriverStatRow[], headers: string[] }
```

### Key functions

| Function | File | Description |
|---|---|---|
| `computeDriverStats` | `statsComputed.ts` | Full stats pipeline for a set of race results |
| `filterResults` | `statsComputed.ts` | Filter race results by season, format, competition, roundType |
| `buildEventMap` | `statsComputed.ts` | Build event metadata lookup Map |
| `computeCircuitStats` | `statsComputed.ts` | Per-circuit aggregates |
| `computeLeagueStats` | `statsComputed.ts` | League-wide aggregate metrics |
| `computeHomePageSnapshot` | `statsComputed.ts` | Homepage hero numbers |
| `computeH2H` | `h2h.ts` | Head-to-head record between two drivers |

### Legacy stats (`lib/statsData.ts`)

`statsData.ts` still exists but most of its Google Sheets–based fetchers have been removed. It now primarily defines shared types (`MetricInfo`, `DriverStatRow`, etc.). Do not add new CSV fetchers here.

### Ratings explanation

Ratings are computed on a 0–100 percentile scale relative to all eligible drivers:
- **Speed Rating**: based on average finish position
- **Consistency Rating**: based on finish position variance
- **Performance Rating**: composite of speed + consistency
- **Agility Rating**: adaptability across formats/conditions
- **Driver Rating**: composite of all four above

---

## 8. Standings System

Championship standings are **computed by a Google Apps Script** (`scripts/standings/psgil-standings.gs`) running inside the Google Spreadsheet itself. The website only reads the output CSV tabs — it does not compute standings.

**To update standings after a race:**
1. Enter results in the `csv_race_results` tab
2. Run **PSGiL → Refresh Standings** in the spreadsheet
3. The website picks up changes on the next ISR cycle (within 5 minutes)

**To add a new season:**
1. Add a row to `csv_seasons_config` tab with `is_current = TRUE`
2. Add rows to `standings_season_rules` in the spreadsheet for the new season
3. No code changes needed

---

## 9. Steward Module

The steward system is a full-featured case management portal at `/stewards`.

### Storage

| Environment | Backend |
|---|---|
| Production / Netlify Preview | **Netlify Blobs** (object storage, key: `stewards/store`) |
| Local dev (`npm run dev`) | **Local JSON file** at `data/stewards/store.json` (gitignored) |

Detection logic: `isNetlifyEnv()` in `lib/stewards/store.ts` checks for `NETLIFY_BLOBS_CONTEXT` or `NETLIFY_DEV` env vars.

On first local run, `data/stewards/store.json` is auto-created with three seed users:
- `admin@psgil.local` / `change-me-admin`
- `steward@psgil.local` / `change-me-steward`
- `member@psgil.local` / `change-me-member`

All three have `mustChangePassword: true` and will be forced to set a new password on first login.

### Auth

- JWT sessions stored as `steward_session` HTTP-only cookie
- Signed with `STEWARD_SESSION_SECRET` env var (required in production)
- Roles: `admin`, `steward`, `member`
- Permission matrix defined in `lib/stewards/auth.ts` → `PERMISSION_MATRIX`

### Route protection

Next.js 16 uses `proxy.ts` (not `middleware.ts`) as the edge middleware convention. The file exports a `proxy` function that redirects unauthenticated users away from `/stewards/*` routes at the edge, before any server component runs. The steward pages also call `requireStewardUser()` server-side as a second layer of protection.

### Key files

| File | Purpose |
|---|---|
| `lib/stewards/types.ts` | All TypeScript types |
| `lib/stewards/store.ts` | `readStore()` / `writeStore()` |
| `lib/stewards/repository.ts` | CRUD helpers (getCaseById, etc.) |
| `lib/stewards/auth.ts` | Session management, role/permission helpers |
| `lib/stewards/crypto.ts` | PBKDF2 password hashing |
| `lib/stewards/notifications.ts` | Email notifications |
| `lib/stewards/penaltyRules.ts` | License-point threshold rules from CSV |
| `app/stewards/actions.ts` | All Server Actions (mutations go through here) |

---

## 10. Netlify Deployment

```toml
# netlify.toml
[build]
  command = "npm run build"
  publish = ".next"
```

The site deploys as a Next.js application on Netlify. Netlify's Next.js runtime adapter handles SSR and ISR automatically.

### Required Netlify environment variables (set in Netlify UI)

```
GMAIL_APP_PASSWORD         → Gmail App Password for islf1league@gmail.com
NEWS_SHEET_URL             → Public Google Sheets CSV for articles tab
STEWARD_SESSION_SECRET     → Random secret string (e.g. openssl rand -hex 32)
NEXT_PUBLIC_SITE_URL       → https://f1isl.com
NEXT_PUBLIC_GA_ID          → G-SB7HKT6VSK (or new ID)
REWARDS_SHEET_URL          → Optional: override for rewards CSV
```

### Netlify Blobs

The steward module uses `@netlify/blobs` for persistent storage. This works automatically in Netlify production and preview deployments. It does **not** work with plain `npm run dev` (falls back to local file).

To test Netlify Blobs locally, use `netlify dev` (requires Netlify CLI), which injects `NETLIFY_DEV=true` and the blobs context.

---

## 11. Rules Claude Code Must Follow

### Never modify automatically
- `lib/seasonConfig.ts` → GIDs or SHEET_ID (breaks all CSV fetching)
- `data/stewards/store.json` → live steward database in dev
- `scripts/standings/psgil-standings.gs` → Google Apps Script (not part of the web app)
- `public/drivers/*.webp`, `public/events/*`, `public/teams/*` → manually managed media assets
- `.env.local` → secrets file, never read or display its contents

### CSV schema contract
Column names in CSV data are the source of truth for metric keys throughout the stats engine. Metric keys like `"Avg. Final Position"` or `"Driver Rating"` flow through as raw strings from the CSV headers. Renaming a CSV column will break metric lookups throughout `statsComputed.ts` and `StatsPageContent.tsx`.

### Season key convention
Always use `"S6"` format (capital S + number) for `season_key`. Use `matchesSeason()` for comparisons — never `===` directly on raw CSV values.

### Stats computation pipeline
The stats page (`app/stats/page.tsx`) pre-computes all driver intelligence server-side and passes it as props to `StatsPageContent`. The client component recomputes only when filters are active (`clientIntelMap` useMemo). Do not move computation to the client by default — it is expensive.

### React hooks
All `useState`, `useMemo`, `useEffect` hooks must be declared before any conditional `return` statements in a component. Violating this causes "Rendered fewer hooks than expected" runtime errors.

### TypeScript
Always run `npx tsc --noEmit` after any substantive edit. The project uses strict mode. Fix all type errors before considering a task done.

### Tailwind CSS v4
This project uses Tailwind v4 with `@tailwindcss/postcss`. There is no `tailwind.config.js` — configuration is in `globals.css` using the `@theme` directive if needed. Use standard utility classes; do not add a `tailwind.config.js`.

---

## 12. Development Workflow

```bash
# 1. Install
npm install

# 2. Set up environment
# Copy the variables from this document into .env.local

# 3. Start dev server
npm run dev
# → http://localhost:3000

# 4. After editing TypeScript
npx tsc --noEmit

# 5. Check lints on edited files (do not run globally — too slow)
# Use ReadLints tool in Cursor / npx eslint path/to/file.ts
```

The steward module local store is auto-created at `data/stewards/store.json` on first request to any steward route.

---

## 13. Files That Are Dev/Debug Only

These files exist for development and debugging purposes. Do not expose or enable in production without review:

| File | Purpose | Risk |
|---|---|---|
| `app/api/debug-csv/route.ts` | Fetches and displays raw CSV content | Exposes internal URLs |
| `app/api/stats-export/route.ts` | Exports computed stats as CSV | Low — computed data only |

---

## 14. Known Issues and Flags

| Issue | Location | Severity | Notes |
|---|---|---|---|
| `STEWARD_SESSION_SECRET` undocumented in README | `lib/stewards/auth.ts` | High | Must be set in Netlify or JWT is signed with a public default — now added to README |
| `NEXT_PUBLIC_SITE_URL` undocumented in README | `lib/stewards/notifications.ts` | Low | Defaults to `https://f1isl.com` |
| `lib/statsData.ts` legacy file still imported | Multiple | Low | Types still used; fetch functions removed; safe to keep |
| `driver_stats_gid` field deprecated | `lib/seasonConfig.ts` | Low | Marked `@deprecated`; can be removed when fully migrated |
| `scripts/png-to-csv.ts` uses `tsx` and Tesseract | `scripts/` | Low | Not part of the app; standalone OCR utility; `tsx` not in devDependencies |

---

## 15. Image Asset Convention

Driver photos come from the **`photo_url` column of the `csv_drivers` tab** (any local `/…` path or external URL), with an optional `photo_position` column for CSS `object-position`. `mapDrivers()` in `lib/driversData.ts` reads `photo_url`; components render `driver.photo_url || placeholder` (`/placeholders/driver.png`). There is **no** `/public/drivers/{driver_id}.webp` filename convention in the code — that earlier note was inaccurate (corrected 2026-07-05). The `driver_id` is the stable snake_case identifier from `csv_drivers` (e.g., `shaul_ezra`).

> **Uploaded photos (PW-2e, live):** a linked driver can upload a photo from `/account`. It's stored dynamically (per-driver Netlify Blob in prod, `public/uploads/drivers/` in dev, served via `/api/driver-photo/[driverId]`) and **overrides `photo_url`** for that driver via `applyUploadedDriverPhotos()`, with the CSV value as fallback. See [docs/pw-2-identity-design.md](./docs/pw-2-identity-design.md) §13.

Event poster images live at `/public/events/{event_id}.webp` or `.jpg`.

### Team logos (code-only)

Team logos live in `/public/teams/` and are resolved **entirely from code** via the `TEAM_LOGOS` map in `lib/driversData.ts` (see `getTeamLogo(teamKey)`). The `logo_url` column in the `csv_teams` sheet is **intentionally not consulted** — do not re-wire logo rendering to read it.

To add or change a team logo:
1. Add the file to `public/teams/` (SVG preferred; PNG fine for raster-only marks).
2. Add or update the team's entry in `TEAM_LOGOS`, keyed by `team_key`.

Logos render against a white box on `/drivers`, so monochrome/dark marks are fine. Unmapped teams fall back to `/isl-mark.png`.

---

## 16. Adding a New Season (Checklist)

1. Add a new row to `csv_seasons_config` in the Google Sheet with `is_current = TRUE` (set previous season to `FALSE`)
2. Add rows to `standings_season_rules` in the Apps Script config tab
3. Add driver and team updates to `csv_drivers` and `csv_teams`
4. Add schedule events to `csv_schedule`
5. No code changes required unless new feature flags are needed

---

## 17. Quick Reference — Where Things Live

| Question | Answer |
|---|---|
| Where are all CSV URLs? | `lib/seasonConfig.ts` → `GLOBAL_CSV_URLS` |
| Where is the current season defined? | `csv_seasons_config` tab → `is_current = TRUE` |
| Where is steward data stored locally? | `data/stewards/store.json` (gitignored) |
| Where are permissions defined? | `lib/stewards/auth.ts` → `PERMISSION_MATRIX` |
| Where does stats computation happen? | `lib/statsComputed.ts` (H2H in `lib/h2h.ts`) |
| Where are H2H and rivalries computed? | `lib/h2h.ts` |
| Where is the standings calculation? | Google Apps Script in `scripts/standings/psgil-standings.gs` |
| Where are metric display names defined? | `lib/statsMetricRegistry.ts` |
| Where is site copy (nav, hero text)? | `lib/siteConfig.ts` |
| Where do emails get sent from? | `islf1league@gmail.com` via nodemailer |
