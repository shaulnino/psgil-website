# PSGiL → Merged League Rebrand: Migration Plan

> **Status:** Analysis only — no code has been changed. This document is the output of a full repository audit performed ahead of merging PSGiL with another Israeli sim racing league under a new brand.
>
> **Scope of this document:** architecture map, module inventory, risk assessment, and a phased roadmap. It does not implement anything.

---

## 0. Executive Summary

The current codebase is a **content-driven Next.js site**, not a conventional CRUD app. ~90% of what a visitor sees is server-rendered from Google Sheets CSV exports, re-fetched on a 5-minute ISR cycle. The **only** real application-with-a-database is the steward (case management) module, which is cleanly self-contained.

**Scope correction (2026-07-01):** this project is not a merge of two leagues' historical datasets. PSGiL's roster, results, and season history will be **dropped**, and the new brand starts fresh with its own drivers, teams, schedule, and season 1 — on the **same CSV schema and same code**. That's structurally much closer to "add a new season" (already the documented, supported workflow — see CLAUDE.md §16) than to "merge two independent datasets." The data-layer risks originally flagged in this document (season key collisions, driver ID namespacing, one global "current season" flag, etc.) are almost all artifacts of a two-league-coexistence scenario that isn't happening here, and are addressed in the corrected analysis below (§4, §11, §12, §13). The one real leftover: `driversData.ts` hardcodes a team-color map keyed to PSGiL's specific `team_key` values — that just needs to be replaced with the new league's teams, which is a content edit, not an architecture change.

This is good news for the rebrand: the presentation layer (components, design system, copy) can be reworked aggressively without touching the data layer, the steward module can be carried over almost unchanged, and the data layer itself needs only a content reset, not a redesign.

Multilingual support is the main remaining structural workstream. There is currently **zero i18n infrastructure** — no library, no translation files, `lang="en"` is hardcoded, fonts are Latin-only, and roughly 500+ user-facing strings are scattered across config, components, business logic, and email templates. It's tractable, but it touches nearly every file in `app/` and `components/`.

---

## 1. Overall Architecture

```
Google Sheet (single spreadsheet, "publish to web" CSV exports)
        │
        ▼
lib/csv.ts  → fetchCsv() [ISR-cached fetch] → parseCsv() [RFC4180 parser]
        │
        ▼
lib/*Data.ts mappers (typed row → domain object)
        │
        ▼
Server Components (app/**/page.tsx) — fetch in parallel, compute, pass as props
        │
        ▼
Client Components (components/**) — interactivity, filtering, modals
```

Two structurally distinct halves of the app:

1. **Public site** — fully stateless from the app's point of view. No database. Every page re-derives its content from CSV on each ISR revalidation. `lib/seasonConfig.ts` is the single chokepoint: one hardcoded Google Sheet ID, one map of tab GIDs, one global "current season" flag.
2. **Steward module** (`/stewards/**`) — a real stateful app with its own JWT auth, its own storage (Netlify Blobs in prod, local JSON in dev), and its own data model, living almost entirely under `lib/stewards/`. It borrows only three low-level utilities from the public side: `lib/csv.ts`, `lib/seasonConfig.ts` (for season labels), and `lib/scheduleData.ts` (to assign penalties to future races).

Routing uses Next.js 16 App Router. `proxy.ts` (Next's middleware convention, oddly named but correct per Next 16 conventions) gates all `/stewards/*` routes at the edge by checking for a `steward_session` cookie; `requireStewardUser()` is the second, server-side layer of the same check.

---

## 2. Main Modules

| Module | Location | Nature |
|---|---|---|
| Homepage | `app/page.tsx` | Aggregates schedule, standings snapshot, news carousel, league info — the heaviest single fetch-fan-out in the app |
| Drivers | `app/drivers/page.tsx` + `DriversGrid`/`DriverModal` | Roster, ratings, rewards |
| Schedule & Results | `app/schedule/page.tsx` + `TablesPageContent`/`ScheduleList` | Calendar, results, standings tables |
| Statistics | `app/statistics/page.tsx`, `app/stats/page.tsx` (two overlapping routes) | Historical stats, per-driver/circuit/league aggregates |
| News | `app/news/`, `app/news/[slug]/`, RSS routes | Article hub, detail pages, RSS/Zapier feeds for social automation |
| Contact | `ContactSection` + `app/api/contact/route.ts` | Signup/question form, email via Gmail SMTP |
| Steward portal | `app/stewards/**`, `lib/stewards/**` | Case management, appeals, penalties, admin — see §7 |
| Legal | `app/privacy/page.tsx` | Static policy page |

**Notable duplication already in the codebase:** `/statistics` and `/stats` are two separate routes doing overlapping jobs (`app/statistics/page.tsx` vs `app/stats/page.tsx` + `StatsPageContent`). Worth resolving during the rebuild regardless of the merger.

---

## 3. Shared Components

~35 components in `components/`, no formal design-system library — just consistent Tailwind utility patterns. Key ones by role:

- **Layout:** `Header`, `Footer`, `Section` (generic titled-section wrapper used everywhere)
- **Data display:** `ResultsTable` (generic table primitive), `StandingsTable`, `RaceResultsTable`, `StandingsSection`
- **Driver/team:** `DriversGrid`, `DriverCard`, `DriverModal` (751 lines — the largest single "feature" component), `AchievementBadges` (533 lines, hand-drawn SVG medal icons), `DriverLookupProvider` (React Context for opening driver modals from anywhere)
- **Homepage-specific:** `HomeRaceCards` (770 lines), `ContactSection` (320 lines), `NewsCarousel`
- **Stats:** `StatsPageContent` — **3,940 lines**, by far the largest file in the codebase. Contains its own sub-components (SearchableSelect, TabBar, Toggle, charts) inline rather than extracted.
- **UI primitives:** `Button`, `LoadingLink`, `ZoomableImage`, `SuccessModal`, `SeasonSelector` — thin, reusable, well-scoped

Reuse is generally healthy — `ResultsTable`, `Button`, and `Section` in particular are used across most pages. The exceptions are `StatsPageContent` and `HomeRaceCards`, which are large enough to be maintenance risks independent of the rebrand.

---

## 4. Data Layer

`lib/` (excluding `lib/stewards/`):

> **Note:** the "coupling" column below describes real hardcoded assumptions in the code — accurate observations, not hypothetical. But per the scope correction in §0, this project is a **data reset**, not a **two-league merge**. Under a reset, only one row in this table (`driversData.ts` team colors) needs an actual change; the rest are dormant risks that would only matter if PSGiL and the new league's data ever needed to coexist (they won't).

| File | Role | Hardcoded single-dataset assumptions | Action needed for a reset (not a merge) |
|---|---|---|---|
| `csv.ts` | Fetch + RFC4180 parse | None — fully generic | None |
| `seasonConfig.ts` | **Single source of truth**: hardcoded Sheet ID (split across 3 strings to dodge a Netlify bundler bug), 11 hardcoded tab GIDs, one global "current season" resolver | These are all fine for a single active dataset — this is exactly what the app already assumes | Point at the reset/new sheet; set `is_current=TRUE` on the new league's season 1 |
| `siteConfig.ts` | Static nav/hero/footer copy | N/A (content, not data) | Rewrite copy for new brand (§11 Redesign) |
| `resultsData.ts` | Race results & standings types/mappers | `event_id` format, bracket/competition-status conventions | None — new data just follows the same conventions |
| `driversData.ts` | Driver/team roster, rating merge, ranking | Team colors hardcoded by PSGiL-specific `team_key` string match (e.g. `"psgil-ferrari"` → hex) | **Replace the team-color map** with the new league's team keys (or move it into a CSV column — see §11 Extract) |
| `scheduleData.ts` | Events, Israel-timezone date/time parsing, race-day grouping, Wild-league double-header logic | `event_id` format, hardcoded `Asia/Jerusalem` TZ, hardcoded "Wild Event N" text parsing | None if new league keeps the same conventions (confirm TZ/format decisions with new league's ops) |
| `statsComputed.ts` | Rating engine (Speed/Consistency/Performance/Agility/Driver Rating), circuit/league aggregates | Min-max normalization pools all drivers in the current result set together | None — correct behavior for one dataset; would only need per-league filtering if two datasets coexisted |
| `statsMetricRegistry.ts` / `statsData.ts` | Metric display/tooltip layer, legacy types | None (presentation only, though full of English strings — see §9) | None (i18n only) |
| `h2h.ts` | Head-to-head engine | Indexes by **driver name string**, not ID — a latent bug independent of any merger (two same-named drivers in the new roster would still collide) | Optional cleanup: switch to `driver_id` keying while touching this file for other reasons |
| `rewardsData.ts` | Season awards | Numeric `season_id` | None — fine for one dataset's season numbering |
| `newsData.ts` / `newsCategories.ts` | Articles | Low — genuinely dataset-agnostic | None |
| `raceAlertState.ts`, `ga.ts`, `youtube.ts` | Utilities | None | None |

**Important correction to CLAUDE.md:** the doc describes `lib/statsInsights.ts` (driver DNA, archetypes, tiers, auto-generated narrative sentences, `computeSeasonNarrative`, etc.) in detail. I verified directly — **this file does not exist**, and none of its documented exports appear anywhere in the codebase. Either it was removed after CLAUDE.md was written, or it was speculative documentation that was never implemented. Practically, this means: (a) there is currently **no narrative-sentence generation** anywhere in the app — good news for i18n, since that's usually the hardest category; (b) CLAUDE.md's §7 "Statistics Engine" table should be corrected/pruned as part of this project so future agents don't plan around a module that isn't there.

---

## 5. Business Logic

- **Rating engine** (`statsComputed.ts`): five composite indices computed via hardcoded weighted formulas (e.g. Speed = 0.65·grid + 0.25·finish + …) and min-max normalized to a 50–100 scale across *all* drivers in the current result set. Weather categorization, reverse-grid handling, playoff/regular-season split, and streak tracking (win/podium/points/DNF-free) all live here.
- **Standings**: **not computed by the app at all.** A Google Apps Script (`scripts/standings/psgil-standings.gs`) running inside the spreadsheet computes standings; the site only reads output CSV tabs. This is an important dependency to remember — it's not migratable code, it's a Google Sheet script tied to the current spreadsheet.
- **Head-to-head / rivalries** (`h2h.ts`): pairwise driver comparison, keyed by driver *name* rather than ID (a latent bug independent of the merger, made worse by it).
- **Penalty rules engine** (`lib/stewards/penaltyRules.ts` + `repository.ts`): CSV-driven license-point thresholds automatically generate race-service penalties, with severity sorting, quantity support, roll-forward chains, and appeal-driven overrides. This is genuinely sophisticated business logic and fully self-contained.
- **Race-day grouping / alerting** (`scheduleData.ts`, `raceAlertState.ts`): timezone-aware grouping of same-day events, RSS-based alerting for social automation (Zapier), with file-based (or in-memory fallback) dedup state.

---

## 6. Pages

Full route inventory (see agent reports for line-level detail; summarized here):

**Public:** `/` (home), `/drivers`, `/schedule`, `/statistics`, `/stats` (duplicate of statistics), `/news`, `/news/[slug]`, `/articles` (legacy redirect to `/news`), `/privacy`.

**Feeds:** `/news/rss.xml`, `/rss/race-alerts.xml`, `/rss/articles-instagram.xml`, `/rss/race-alerts-instagram.xml` — all public, no auth, built for Zapier/social automation rather than end users.

**API:** `POST /api/contact` (rate-limited, honeypot, dual email templates), `GET /api/debug-csv` (dev-only CSV inspector), `GET /api/stats-export` (API-key-gated JSON bridge, apparently for an external "PSGiL Editor agent"), `GET/POST /api/stewards/*` (attachment download, notification badge).

**Steward (protected):** `/stewards/login`, `/stewards/change-password`, `/stewards` (dashboard), `/stewards/cases`, `/stewards/cases/[id]`, `/stewards/appeals`, `/stewards/appeals/[id]`, `/stewards/penalties`, `/stewards/penalties-to-serve`, `/stewards/admin`.

Heaviest/most complex pages: `news/[slug]/page.tsx` (recap/preview resolution logic), `stewards/cases/page.tsx` (dual driver/steward view + complaint submission), `app/page.tsx` (489 lines of parallel data fetching), `app/drivers/page.tsx` (multi-scope rating merges).

---

## 7. Admin / Steward Functionality

This module is **the best-isolated part of the codebase** and the one I'd touch least during the rebrand.

- **Data model** (`lib/stewards/types.ts`): Users (3 roles: admin/steward/member) → Cases (with responses, internal steward-only comments, verdicts with per-driver penalties) → Appeals (36-hour window, can override verdicts) → Penalties-to-serve (7-state machine, auto-generated from license-point thresholds, roll-forward chains linking cycles).
- **Storage** (`lib/stewards/store.ts`): environment-detected — Netlify Blobs in prod/preview, local JSON file in dev, single write-queue to serialize mutations, with on-read schema migration for older records.
- **Auth** (`lib/stewards/auth.ts`): JWT (HS256 via `jose`), `steward_session` cookie, a clean `PERMISSION_MATRIX` mapping 13 permissions to 3 roles.
- **Notifications**: 10 distinct email triggers (case submitted, all responses in, verdict published, penalty assigned/reminder/rolled-forward, appeal submitted/verdict) via Nodemailer/Gmail, all fire-and-forget, all hardcoded English HTML+text.
- **Server Actions** (`app/stewards/actions.ts`, 908 lines): ~25 actions covering every mutation — auth, case lifecycle, user management, penalty management, appeals.

Confirmed zero type-sharing with the public site — the only shared imports are the same low-level utilities noted in §4 (CSV fetch, season config, schedule data for race assignment).

---

## 8. Existing Design System

- **Tailwind CSS v4**, correctly configured with no `tailwind.config.js` — theme lives in `app/globals.css` via `@theme` and CSS custom properties.
- **Palette:** dark-only. `--background: #0b0b0e`, `--foreground: #ffffff`, `--muted: #a0a0a0` as CSS variables; brand purple `#7020B0` and gold `#D4AF37` are **hardcoded hex literals repeated 100–250+ times directly in JSX classNames**, not tokenized. A separate muted "steward gold/cream" palette (`#8f8470`/`#b8b0a0`) exists for the steward UI only.
- **Fonts:** Inter (body) + Rajdhani (display), both **Latin-subset only** via `next/font`.
- **No icon library** — hand-authored inline SVGs throughout (including a full custom medal/trophy icon set in `AchievementBadges.tsx`).
- **No animation library** — CSS `@keyframes` only (hero zoom/glide, logo breathe, live-pulse, modal-pop, steward gold sheen).
- **No dark/light mode toggle** (site is dark-only by design) and **no RTL infrastructure** anywhere except two manually-tagged `dir="rtl"` textareas in the steward complaint form.
- Recharts is the only charting dependency, used exclusively inside `StatsPageContent`.

This is a coherent, if informally systematized, design language — reusable enough to extract into real tokens, but not yet tokenized in a way a second brand identity could swap into.

---

## 9. Where UI Text Lives

Roughly 500+ user-facing strings, in four tiers of extractability:

1. **Centralized (trivial to extract):** `lib/siteConfig.ts` — nav labels, hero copy, trust chips, league-format blurbs, join CTA, footer, social labels. ~50 strings, already isolated.
2. **Scattered in components/pages (moderate effort):** ~50+ strings spread across `app/page.tsx`, `app/privacy/page.tsx`, `ContactSection`, `TablesPageContent`, `StatsPageContent`, `NewsCarousel`, `Header`/`Footer`, etc. Mechanical but touches 40+ files.
3. **Embedded in business/data logic (hard):** ~150+ strings — metric tooltips and labels in `statsData.ts`/`statsMetricRegistry.ts`, award labels/tooltips in `rewardsData.ts`. These are paired with CSV-column-matching logic, not just plain copy, so translation requires reworking the lookup layer, not just swapping strings.
4. **Email templates (hardest):** `lib/stewards/notifications.ts` (~40+ strings across 10 triggers) and `app/api/contact/route.ts` (full HTML+text auto-reply templates). Structure and language are fused — there's no template/content separation to exploit.

Content-data consideration: news articles, driver bios, and any other Google-Sheets-authored copy are currently **single-language per row** — there's no `content_en`/`content_he` column convention. That's an editorial/CMS decision as much as a code one.

---

## 10. Where Multilingual Support Gets Hard

Ranked by actual difficulty, not by string count:

1. **No i18n library at all** — no `next-intl`/`react-i18next`/etc. This is infrastructure, not a blocker, but it's zero rather than partial.
2. **`<html lang="en">` is hardcoded**, no `dir` attribute, and fonts are Latin-only — Hebrew text today would render in a fallback system font with no RTL layout at all.
3. **RTL is not just a font problem** — Tailwind v4 doesn't auto-flip logical properties everywhere they're used here (a lot of directional spacing is written as physical `pl-`/`pr-`/`ml-`/`mr-`, not `ps-`/`pe-`). A real RTL pass touches most components, not just text.
4. **Metric-key detection logic is English-keyword-driven** (`normalizeNewsCategory`, `statsMetricRegistry` fuzzy matching) — these aren't copy, they're categorization logic that happens to be written in English. Translating the *label* is easy; translating without breaking the *matching* requires separating detection keys from display labels (which, encouragingly, is close to how `statsComputed.ts` already keys its raw output — the fix is discipline, not a rewrite).
5. **Email templates fuse structure and language** — no template/content separation exists to translate into.
6. **CSV content is single-language** — solving this is a spreadsheet/CMS workflow decision, independent of code, and should be decided before code work starts (per-language columns vs. per-language sheets vs. per-language rows).

The one piece of good news: because `lib/statsInsights.ts` (narrative sentence generation) doesn't actually exist (§4), the single hardest category of i18n problem — language fused into computed prose — isn't present in this codebase today. If it gets built later for the new brand, build it i18n-aware from day one.

---

## 11. Recommendations

### Keep as-is (low risk, high existing value)
- **Steward module end-to-end** (`lib/stewards/**`, `app/stewards/**`) — data model, auth, storage abstraction, permission matrix, penalty engine. It's isolated, correct, and has nothing brand- or league-specific baked in except copy (which is a small, well-contained find-and-replace / i18n pass, not a rewrite).
- **`lib/csv.ts`** — generic, no changes needed.
- **Google Apps Script standings computation** — works, is out of the Next.js codebase's blast radius, keep using it (per league, see below) rather than porting the calculation into the app.
- **CSV-as-CMS approach in general** — don't reach for a database. It's the right architecture for this content model and the team's existing workflow.
- **Tailwind v4 / no-config approach**, `next/font`, App Router structure, ISR caching strategy.

### Refactor (same behavior, better structure)
- **Tokenize the design system**: pull `#7020B0`, `#D4AF37`, and the steward palette out of scattered JSX literals into CSS custom properties / `@theme` tokens, so a rebrand is a palette swap, not a grep-and-replace across 250+ call sites.
- **Split `StatsPageContent.tsx` (3,940 lines)** and `HomeRaceCards.tsx` (770 lines) into smaller components — not because of the merger, but because both will need touching for i18n and for double-league filtering, and 3,940 lines is not a safe unit to edit under either pressure.
- **Fix `h2h.ts` to key by `driver_id` instead of `driver_name`** — a latent correctness bug that becomes a guaranteed collision risk the moment a second league's roster is merged in.
- **Consolidate `/statistics` and `/stats`** into one route — pre-existing duplication, worth resolving alongside the rebuild rather than carrying two versions of the same feature into the new brand.
- **Correct CLAUDE.md** — remove or rewrite the `lib/statsInsights.ts` section (§4) so future work (by Claude or humans) doesn't plan around a nonexistent module.

### Redesign (new structure needed, not just cleanup)
- **Visual identity** — new logo, palette, typography (and Hebrew-capable fonts if multilingual is in scope) for the merged brand. This is a from-scratch design exercise, not a migration of the existing purple/gold PSGiL identity.
- **Copy/content strategy** — home page "About Us," league-format blurbs, and all brand-voice copy in `siteConfig.ts` needs to be rewritten for the merged entity, not translated from PSGiL's.

### Extract (pull out as standalone, reusable units)
- **`ResultsTable`, `Button`, `Section`, `SeasonSelector`, `ZoomableImage`** — already well-scoped generic primitives; formalize as the seed of a real component library if the rebrand wants one.
- **CSV fetch/parse/mapper pattern** (`lib/csv.ts` + the mapper convention in `*Data.ts` files) — extract as the documented pattern for onboarding the second league's data, rather than reinventing per-file.
- **Metric tooltip/label dictionaries** (`statsMetricRegistry.ts`, `rewardsData.ts` award labels) — extract into translation-ready key/value files as a discrete, mechanical first i18n task.

---

## 12. Technical Risks

| Risk | Why it matters | Severity |
|---|---|---|
| **Team-color map in `driversData.ts` is hardcoded to PSGiL's team keys** | Will render wrong/fallback colors for the new league's teams until updated. Trivial fix, but easy to forget since it's a silent fallback (falls back to brand purple), not an error. | **Low** (was flagged Critical under the merge assumption — downgraded now that this is a reset, not a merge) |
| **Who owns/edits the reset Google Sheet, and does the Apps Script standings calculator get reused or rebuilt** | Even without a data merge, someone still needs to decide: reuse the existing sheet (wipe and repopulate tabs) vs. spin up a new one; and whether `scripts/standings/psgil-standings.gs` is copied over as-is or needs adjustment for the new league's rules. Workflow decision, not a code risk, but worth deciding explicitly before Phase 1 below. | **Medium** |
| **`STEWARD_SESSION_SECRET` / Netlify Blobs continuity** | If the steward store or auth secret isn't carried over correctly during a domain/infra migration, all in-flight cases, appeals, and pending penalties are at risk. | **High** |
| **`StatsPageContent.tsx` scale** | 3,940 lines increases the odds of regressions during both the i18n pass and the league-filtering pass, since both need to touch it. | **Medium-High** |
| **No i18n library + ~500 scattered strings** | Large mechanical effort; risk is mostly schedule/scope, not correctness, provided extraction happens before the redesign (not after). | **Medium** |
| **RTL is a layout project, not a translation project** | If multilingual is scoped as "add Hebrew," but RTL layout work is discovered mid-way, it will blow up estimates. Scope it explicitly upfront. | **Medium** |
| **CLAUDE.md documents a module that doesn't exist** | Low direct risk, but a reminder that this doc (and any AI agent reading it) can drift from reality — worth a documentation-accuracy pass as part of this project, not just a one-off fix. | **Low** |
| **`/statistics` vs `/stats` duplication, legacy `statsData.ts` fetchers** | Carrying known cruft into a rebuild multiplies its cost. Cheap to fix now, more expensive to fix after doubling the data model for two leagues. | **Low-Medium** |

---

## 13. Proposed Migration Phases

Since this is a **data reset**, not a two-league merge, the data layer no longer needs a dedicated redesign phase — it needs one small content/config update (Phase 1 below), and the rest of the effort is the rebrand and, optionally, multilingual support.

**Phase 0 — Decisions (no code)**
Reuse the existing Google Sheet (wipe and repopulate tabs with the new league's drivers/teams/schedule) vs. spin up a new sheet and repoint `seasonConfig.ts` at it; whether `scripts/standings/psgil-standings.gs` is reused as-is or needs adjustment for the new league's rules; whether multilingual is in scope for launch or a fast-follow; CMS strategy for bilingual content if so.

**Phase 1 — Data reset**
Repopulate (or point at a new) Google Sheet with the new league's drivers, teams, schedule, and season 1, following the existing "Adding a New Season" checklist (CLAUDE.md §16) — no schema changes required. Update the hardcoded team-color map in `driversData.ts` to the new league's `team_key`s (or move it into a CSV column, per §11 Extract, while touching this file anyway). Optionally fix `h2h.ts` to key by `driver_id` instead of driver name while in the area. This phase is low-risk and mostly a content/ops task, not an engineering one — it should be done first since every later phase (rebrand, i18n) is easier to verify against real new-league content than against leftover PSGiL data.

**Phase 2 — Visual rebrand**
New identity, tokenized design system (building on the extraction in §11), new copy in `siteConfig.ts` and page content, component splitting for `StatsPageContent`/`HomeRaceCards` done here or just ahead of this phase so the redesign lands on a maintainable base rather than a 3,940-line file.

**Phase 3 — Multilingual (if in scope)**
Introduce an i18n library, extract the four tiers of strings from §9 in order (config → components → business-logic dictionaries → email templates), add `lang`/`dir` handling and RTL-aware CSS, resolve Hebrew font loading, decide and implement the bilingual CSV/CMS content strategy. Full architecture and step-by-step plan: [i18n-architecture.md](./i18n-architecture.md).

**Phase 4 — Steward module carry-over**
Lowest-risk phase: point the existing module at new branding/copy, confirm environment variables and Netlify Blobs continuity, run through the case/appeal/penalty lifecycle end-to-end on the new domain before cutover. Do this in parallel with earlier phases where possible since it has minimal dependency on them.

**Phase 5 — Cutover**
DNS/domain switch, final data reconciliation, monitoring for the first live race weekend under the new brand.

---

*This document reflects the repository state as analyzed on 2026-07-01, corrected the same day once scope was clarified as a full data reset (new league, new roster, new season 1) rather than a merge of two leagues' historical datasets.*
