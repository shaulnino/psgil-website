# Multilingual (English/Hebrew) Architecture

> **Status:** Architecture only — nothing in this document has been implemented. It expands Phase 3 ("Multilingual") of [`migration-plan.md`](./migration-plan.md) into a concrete design, grounded in the actual code (file/line references throughout), not a generic i18n guide.

---

## 0. Recommendation Summary

| Decision | Choice | Why |
|---|---|---|
| Library | **`next-intl`** | Only mainstream i18n library with first-class Next.js App Router support — works in Server Components, Server Actions, and `generateMetadata`, not just client components. `react-i18next`/`next-i18next` are Pages-Router-era tools bolted onto the App Router; a hand-rolled solution means reinventing pluralization, number/date formatting, and RSC context propagation — pure technical debt for no gain here. |
| Routing | Locale-prefixed segments for the **public site** (`/en/...`, `/he/...`); steward portal **stays unprefixed** (`/stewards/...`), locale driven by the logged-in user's stored preference instead | See §3 and §7 — the public site is anonymous/shareable/SEO-relevant; the steward portal is a fixed-roster internal tool where URL-based locale would break existing bookmarks and the deep links already hardcoded into email notifications. |
| Text storage | JSON message catalogs (`messages/{locale}/*.json`), namespaced by feature | Separate from the Google Sheets content layer — UI copy and league content are different data with different owners and update cadences (see §2). |
| Business logic | Split every "English string used as both an internal key and a display label" into a **stable ID + a translated label**, once, project-wide | This is the one non-mechanical piece of work. Skipping it is exactly how i18n becomes technical debt — see §8. |
| RTL | `dir` computed from locale, Tailwind **logical properties** (`ps-`/`pe-`/`text-start`, not `pl-`/`text-left`) | One component tree serves both directions — no `dir === "rtl" ? ... : ...` branches scattered through the code (the "avoid duplicated code" requirement, structurally enforced). |

---

## 1. What I Verified Before Designing This

- **Stack:** Next 16.1.4, React 19.2.3 — current enough that `next-intl`'s App Router integration (Server Components, Server Actions, `generateMetadata`) is fully supported.
- **Routing today:** single `proxy.ts` (Next 16's middleware convention) matches only `/stewards/:path*` and checks a `steward_session` cookie — no locale logic exists anywhere. `app/layout.tsx:46` hardcodes `<html lang="en">`, no `dir` attribute. Fonts (`Inter`, `Rajdhani`) are loaded with `subsets: ["latin"]` only.
- **Dates:** exactly two `Intl.DateTimeFormat` call sites in the whole app — `lib/newsData.ts:151` (`formatNewsDate`, hardcoded `"en-GB"`) and `lib/scheduleData.ts:224` (used to extract the Israel wall-clock hour from a UTC timestamp for scheduling math, not for display). This is good news: display-date formatting is centralized, not scattered.
- **Validation/error messages, two distinct existing patterns:**
  1. `app/api/contact/route.ts` — API route returns `NextResponse.json({ error: "<English prose>" })` directly (e.g. line ~60-90). The client reads `.error` and renders it as-is.
  2. `app/stewards/actions.ts` — Server Actions `redirect()` with a **stable error code** in the query string (e.g. `redirect(`/stewards/cases/${id}?error=not-eligible`)`, line 721). The receiving page then does `error === "mismatch" ? "Passwords do not match..." : ...` ternary chains (e.g. `app/stewards/change-password/page.tsx:15-16`) to turn the code into English prose.
  Pattern 2 already has the right shape for i18n (a stable code); pattern 1 doesn't (it bakes English directly into the API contract) and needs a small change.
- **Tables:** `components/ResultsTable.tsx` is a fully generic primitive — columns/labels are props, zero hardcoded text. `StandingsTable.tsx` and `RaceResultsTable.tsx`, which *use* `ResultsTable`, hardcode English column labels directly (`label: "Pos"`, `label: "Team"`, `label: "Points"`, `label: "Driver"` — `StandingsTable.tsx:38,52,59,223`). Mechanical fix, not structural.
- **The one real structural coupling problem:** `lib/statsComputed.ts:74-160` defines a `const M = { EVENTS: "Events Participation", WINS: "Event Wins", ... }` object where **the English display label is also the internal key** used as the `DriverStatRow` field name, the `DRIVER_HEADERS` array (`statsComputed.ts:163`), and the contract of `GET /api/stats-export` (which an external "PSGiL Editor agent" depends on, per `app/api/stats-export/route.ts`). The same pattern repeats in `lib/rewardsData.ts` (`DEFAULT_AWARD_LABELS`/`DEFAULT_AWARD_TOOLTIPS`) and `lib/newsCategories.ts` (`NEWS_CATEGORY_LABEL`). This is the piece that needs a real (if mechanical-once-designed) fix — see §8.

---

## 2. Where Translated Text Lives — Two Separate Systems, Not One

This project already has two content systems (per `migration-plan.md` §4/§9), and multilingual support should **not** merge them:

| System | What it holds | Owner | Update cadence |
|---|---|---|---|
| Google Sheets → CSV (existing) | Drivers, teams, schedule, results, standings, rewards, **news articles** | League content editors | Every race weekend |
| JSON message catalogs (new) | UI copy: nav labels, buttons, page headings, form labels, validation messages, tooltips, email template copy | Developers (via PR, like code) | Whenever a feature ships |

News articles are a hybrid case — they're CSV-sourced *content*, not UI copy, but they still need to exist in both languages. That's handled inside the CSV system (§9), not by shoving article bodies into JSON message files.

**Message catalog structure:**

```
messages/
  en/
    common.json       # nav, footer, buttons, social labels — from siteConfig.ts today
    home.json
    drivers.json
    schedule.json
    stats.json         # metric labels/tooltips — replaces statsMetricRegistry.ts's hardcoded English
    news.json
    forms.json         # contact form + steward form labels/placeholders
    errors.json        # validation/error codes → message, shared by API routes and Server Actions
    stewards.json       # steward portal UI copy
    emails.json         # notification + auto-reply template copy
  he/
    (mirror structure)
```

Split by feature, not one giant file — keeps diffs reviewable and lets translators work on one page at a time.

---

## 3. Routing Behavior

**Public site:** `app/` restructures to `app/[locale]/...` for every current public route (`/`, `/drivers`, `/schedule`, `/statistics`, `/stats`, `/news`, `/news/[slug]`, `/privacy`). `next-intl`'s `createMiddleware` handles locale detection (`Accept-Language` header, then a `NEXT_LOCALE` cookie for repeat visits) and redirects `/drivers` → `/en/drivers` or `/he/drivers`. Recommend `localePrefix: "always"` (not `"as-needed"`) — every URL shows its locale explicitly (`/en/`, `/he/`), which is unambiguous for sharing/SEO/hreflang and avoids the classic bug where the default locale's un-prefixed URL and a prefixed URL both resolve and get indexed as duplicate content.

**Steward portal, RSS feeds, and API routes stay exactly where they are** (`/stewards/...`, `/news/rss.xml`, `/api/...`) — no `[locale]` segment. Rationale in §7 for stewards; RSS/API are machine consumers, not browsers, so locale-in-URL doesn't apply the same way (see §9 for how feeds still get locale variants where it matters).

**Middleware composition:** Next only runs one middleware file. `proxy.ts` needs to run `next-intl`'s middleware first (for `/en/*`, `/he/*`, and locale-detecting redirects on public paths), then apply the existing steward-auth cookie check for `/stewards/*` untouched. This is a straightforward compose-two-functions change, not a redesign — `next-intl`'s matcher and the steward matcher target disjoint path sets.

**Root layout split:** `app/layout.tsx` (the actual `<html>` tag) moves to `app/[locale]/layout.tsx` for the public tree, computing `lang={locale}` and `dir={locale === "he" ? "rtl" : "ltr"}` from the route param — never from content, never from a client-side guess. The steward portal keeps its own layout (`app/stewards/(protected)/layout.tsx`) which independently sets `lang`/`dir` from the logged-in user's stored preference (§7), not from a URL segment, since it's outside the `[locale]` tree.

---

## 4. How Articles Should Behave

News articles are CSV content (per `lib/newsData.ts`), not UI copy, so the fix belongs in the sheet schema, not in JSON message files.

**Recommended model: one row per language, linked by a shared group ID** — add two columns to the `articles` tab: `locale` (`en`/`he`) and `article_group_id` (shared across the language-variants of "the same" article). Keep `slug` unique per row (so `/en/news/season-6-round-8-recap` and `/he/news/season-6-round-8-recap-he` can differ, or share a base with a locale suffix — either works as long as it's unique).

Why this shape over wide per-language columns (`title_en`/`title_he`/`content_en`/`content_he`/...):
- Matches how editors actually work — English and Hebrew versions are usually written by different people at different times, not as one bilingual authoring pass.
- Lets one language publish before the other (`status = published` per row, independently) rather than forcing both to be ready simultaneously or shipping empty-string placeholders.
- Keeps `lib/newsData.ts`'s existing mapper (`getField` with column aliases) essentially unchanged — it just filters by `locale` in addition to `status`, rather than doubling every field.
- Avoids the double-width-CSV problem where a partially-translated row silently ships mixed-language content.

**Fetching behavior:** `fetchArticlesWithStatus()`/`fetchArticleBySlug()` take a `locale` param. If a translated row doesn't exist yet for the requested locale, **fall back to the other locale's row** (clearly labeled, e.g. a small "This article is not yet available in Hebrew — showing the English version" banner) rather than 404ing — a bilingual site with partial translation coverage is the expected steady state, not an edge case.

**RSS feeds:** `/news/rss.xml` and the Instagram-automation feeds (`/rss/articles-instagram.xml`) currently emit one feed. Since these drive Zapier social automation and a Hebrew Instagram caption reads very differently from an English one, add locale-scoped variants (`/news/rss.xml?locale=he` or `/he/news/rss.xml`) so the automation can post each language's content in that language, rather than trying to make one feed bilingual.

---

## 5. How Steward Pages Should Behave

This is the one place I'm recommending a **different mechanism** than the rest of the site, deliberately:

- The steward portal is not anonymous or shareable — every user is a known, logged-in staff member (`lib/stewards/types.ts` `StewardUser`), not a browser session.
- Deep links to specific cases/appeals are already hardcoded into email notifications (`lib/stewards/notifications.ts`) and sent to real drivers. Restructuring these routes under `/en/stewards/...`/`/he/stewards/...` would break every previously-sent email link and any bookmarks staff already have.
- A steward's language is a property of *them*, not of the URL they happened to click.

**Design:** add `locale: "en" | "he"` to `StewardUser` (settable by the user themselves and by an admin, alongside the existing profile/password-change flow). `requireStewardUser()` (already the auth gate every protected page calls) reads `user.locale` and the protected layout (`app/stewards/(protected)/layout.tsx`) wraps its children in `NextIntlClientProvider` configured with that locale — using the **same message catalogs** (`messages/{locale}/stewards.json`, `errors.json`) as the public site, just selected by user preference instead of URL segment. `dir`/`lang` on the steward layout's wrapper element follow the same `user.locale`.

Net effect: stewards get a fully bilingual UI with zero URL changes, existing email links keep working, and the plumbing (message catalogs, `useTranslations`, RTL CSS) is identical to the public site — no parallel i18n system, just a different locale *source*.

---

## 6. How Forms Should Behave

Applies to `ContactSection`, the steward complaint/response/appeal forms, and the admin user-management forms.

- Labels, placeholders, button text, helper text → `useTranslations()` (all the relevant components are already `"use client"`, so this is a direct swap of literal strings for `t("forms.contactName")`-style calls).
- **Per-field direction, not page-level direction, for structured inputs:** email addresses, dates, and dropdown-selected values (platform, driver picker) should render `dir="ltr"` regardless of overall page direction — these are inherently LTR tokens and look broken if mirrored. Free-text fields (case description, evidence text, contact message body) should use `dir="auto"` so the browser follows whatever script the user is actually typing, rather than the two steward textareas today which hardcode `lang="he" dir="rtl"` (`app/stewards/(protected)/cases/page.tsx:114,126`) regardless of what the user types — that hardcoding should become the `dir="auto"` default, since a bilingual site can't assume every free-text field is Hebrew.
- Structural layout (label-above-input, field spacing) needs no special RTL handling once the logical-properties CSS migration (§10) lands — it's direction-agnostic by construction.

---

## 7. How Validation Messages Should Behave

Two existing patterns (§1), two different fixes:

1. **Server Actions with `?error=<code>` redirects (steward module)** — already correct in shape. The *only* change needed: replace each page's hardcoded ternary chain (e.g. `app/stewards/change-password/page.tsx:15-16`) with `t(`errors.${code}`)` from the `errors` namespace. Zero data-flow changes.
2. **API routes returning prose directly (`app/api/contact/route.ts`)** — change the route to return a **stable error code** (`{ error: "missing_fields" }`, `{ error: "rate_limited" }`, `{ error: "email_service_unavailable" }`) instead of English text, and have the client component (which already reads `.error` to display it) translate the code via `t()` before rendering. Small, contained change, and it fixes a latent design smell independent of i18n — API responses shouldn't be pre-formatted for one specific UI language anyway.

Every validation/error code across the whole app (contact form, steward actions, future forms) should live in one `errors.json` namespace so there's a single registry of error codes — prevents the same logical error ("missing required field") from getting reinvented with a different string in five different forms.

---

## 8. How Business Logic Stays Language-Independent (the hard part)

This is the one piece of real engineering work, not string extraction, and it's worth doing once, correctly, rather than bolting a translation layer onto English-keyed data.

**The pattern to fix, found in three places:**
- `lib/statsComputed.ts`'s `M` object — English label *is* the field key (`M.WINS = "Event Wins"`, used as the `DriverStatRow["Event Wins"]` property name).
- `lib/rewardsData.ts`'s `DEFAULT_AWARD_LABELS`/`DEFAULT_AWARD_TOOLTIPS` — award code → English label/tooltip.
- `lib/newsCategories.ts`'s `NEWS_CATEGORY_LABEL` — category enum → English label.

**The fix — split every one of these into two layers:**

```ts
// Before (statsComputed.ts) — label IS the key
const M = { WINS: "Event Wins", ... }

// After — stable, language-neutral ID; label comes from translations
const M = { WINS: "wins", ... }  // or an actual enum; internal identifier only
```

```json
// messages/en/stats.json
{ "metrics": { "wins": { "label": "Event Wins", "tooltip": "Number of race wins" } } }
// messages/he/stats.json
{ "metrics": { "wins": { "label": "ניצחונות בגראנד פרי", "tooltip": "..." } } }
```

Everywhere the code currently prints `M.WINS` directly as UI text (chart labels, table headers, tooltips), it instead does `t(`metrics.${metricId}.label`)`. The **internal identifier never changes based on locale** — `statsComputed.ts`'s computation logic, the `DriverStatRow` shape, and rank/sort comparisons keep operating on stable IDs exactly as today, just no longer English prose.

**Backward-compatibility boundary for `/api/stats-export`:** that endpoint has an external consumer (the "PSGiL Editor agent," per `app/api/stats-export/route.ts`) that presumably depends on the current English `headers` array. Don't let that external contract force English-as-internal-identifier back into the codebase — instead, apply an explicit **ID → current-English-label mapping only at the API response boundary**, so the export's public shape is unchanged while everything upstream of it is locale-neutral. If/when that consumer can be updated, the export can switch to emitting IDs (or accept a `?locale=` param) later — not required for this migration.

Same split applies to `lib/statsMetricRegistry.ts`'s `METRIC_TOOLTIPS` (already somewhat separate from `statsComputed.ts`, so this is more of a "move it into the message catalog" than a structural change) and to status-code vocabulary (`"DNF"`, `"DSQ"`, `"Completed"`, etc., surfaced from `resultsData.ts`/`statsComputed.ts` status fields) — these read as UI vocabulary, not data, even though they're stored as English strings in the CSV; they need the same ID→label treatment rather than being left as raw passthrough text in tables.

**Explicitly not affected:** driver names, team names, circuit names, event names — these are content (proper nouns), not UI vocabulary, and don't get "translated" in the localization sense. If the new league wants Hebrew-script team/driver names as a *separate* concern, that's a content-authoring decision (e.g. optional `name_he` CSV columns), independent of this i18n architecture.

---

## 9. How Tables Should Behave

- `ResultsTable.tsx` needs no changes — it's already a generic, prop-driven primitive.
- `StandingsTable.tsx`/`RaceResultsTable.tsx` — swap their hardcoded `label: "Pos"`/`"Team"`/`"Points"`/`"Driver"` literals for `t("tables.position")` etc. (mechanical, ~10 strings total across both files).
- **Column order and alignment flip with page direction** via the logical-properties CSS migration (§10) — a standings table on `/he/schedule` should read right-to-left with "Driver" starting from the right, matching how Hebrew sports sites (e.g. the standings tables on major Israeli sports outlets) already handle this.
- **Numeric cell content stays LTR regardless of page direction** — points, lap times, gaps/intervals, positions are digit sequences that read the same in both languages and shouldn't have their digit order affected by the surrounding RTL context. Set `dir="ltr"` (or CSS `unicode-bidi: isolate` + `direction: ltr`) on numeric table cells specifically, not on the table as a whole.
- Status text rendered inside cells (`DNF`, `DSQ`, driver-of-the-day badges) goes through the ID→label translation from §8, same as everywhere else status vocabulary appears.

---

## 10. How Dates and Formatting Should Behave

- Replace the two hardcoded `Intl.DateTimeFormat("en-GB", ...)` / `Intl.DateTimeFormat("en-US", ...)` display-formatting call sites with `next-intl`'s `useFormatter()` (client) / `getFormatter()` (server) — these wrap `Intl` and automatically thread the active locale through, so `formatNewsDate`-equivalent calls just work in both languages without a locale parameter to remember to pass.
- **Keep `Asia/Jerusalem` timezone logic in `scheduleData.ts` exactly as-is** — that's a business rule (when a race actually happens), not a locale concern. Locale only changes *how* that instant is displayed (`"Feb 19, 2026"` vs `"19 בפבר׳ 2026"`), never *which* instant it is.
- **Do not enable the Hebrew calendar.** `Intl.DateTimeFormat("he", ...)` by default still uses the Gregorian calendar with Hebrew month/weekday names — exactly what's wanted. Explicitly avoid passing `calendar: "hebrew"`.
- **Numerals stay Western Arabic (0-9) in both locales** — `Intl` with locale `"he"` does not switch numeral systems unless a `numberingSystem` override is explicitly requested, so no special handling is needed; just don't introduce one by accident.
- Any future number formatting (points totals, percentages in `StatsPageContent`) should go through the same `useFormatter()`/`getFormatter()` pattern from day one rather than template-literal string building, so locale-aware thousands separators/decimal points (Hebrew locale still uses `.`/`,` the same way English does, but this guards against future locales that don't) come for free.

---

## 11. How Notifications Should Behave

`lib/stewards/notifications.ts` (10 email triggers) and `app/api/contact/route.ts`'s auto-replies currently generate hardcoded-English HTML strings via template functions.

**Restructure into shared chrome + translated copy:**
- Keep the existing HTML *shell* functions (header/footer styling, color scheme, layout table structure) as shared, language-agnostic scaffolding — they don't need to change per locale.
- Every piece of actual copy (subject line, body paragraphs, CTA button text) is sourced from `messages/{locale}/emails.json` via `getTranslations({ locale })` — `next-intl` supports calling this outside of React rendering, in plain async functions, which is exactly what `notifications.ts` is (it's never a component).
- Each `notifyX()` function gains a `locale` argument: for steward-module emails, pass the **recipient's stored `StewardUser.locale`** (§7) — a driver gets their case-verdict email in their own preferred language, a case notification to an admin goes in that admin's language, etc. For the anonymous contact-form auto-reply, use the locale of the page the form was submitted from (pass it through as a hidden field, since there's no stored user preference for an anonymous visitor).
- **RTL in emails:** set the `dir="rtl"` attribute directly on the outer table/div when rendering a Hebrew email — email client CSS support is inconsistent, so lean on the explicit `dir` attribute rather than logical CSS properties here (unlike the main app, this is server-rendered per-locale with no client-side direction switching to worry about, so it's actually simpler than the app UI, not harder).

---

## 12. Fonts and Visual RTL

- **Fonts:** `Inter`/`Rajdhani` (`app/layout.tsx:13-24`) are Latin-only and need Hebrew-capable replacements as part of the visual rebrand (`migration-plan.md` §11 Redesign) — not a separate i18n task, but sequenced together since both touch `app/layout.tsx`'s font config. Candidates with full Hebrew+Latin coverage and a similar sport/tech feel: **Rubik** or **Heebo** (both widely used on Israeli sports/news sites, good Hebrew rendering, available via `next/font/google` with a `hebrew` subset).
- **RTL CSS strategy — logical properties, not conditionals:** migrate Tailwind utilities from physical (`pl-`, `pr-`, `ml-`, `mr-`, `text-left`, `left-`, `right-`) to logical (`ps-`, `pe-`, `ms-`, `me-`, `text-start`, `text-end`, `start-`, `end-`), which Tailwind v4 supports natively and which auto-flip based on the `dir` attribute with **zero per-component branching**. This is the direct answer to "avoid duplicated code" for RTL — one component tree, not an English version and a mirrored Hebrew version.
- **Explicit exceptions that stay LTR regardless of page direction:** numeric table cells (§9), embedded Recharts charts (axis labels/legends inside `StatsPageContent` render left-to-right internally regardless of page direction — don't fight the library, isolate it), and countdown timers (`NextRaceWidget`).
- **Directional icons need mirrored variants or a CSS flip:** carousel arrows (`NewsCarousel`), "next/prev" controls, chevrons in dropdowns — use `rtl:scale-x-[-1]` (a Tailwind RTL variant) rather than duplicating icon components.
- **Brand marks don't flip:** logo, hero imagery stay as designed in both directions.

---

## 13. How This Avoids Future Technical Debt and Duplicated Code

Mechanisms this architecture bakes in, rather than relying on discipline alone:

1. **One message-catalog source of truth per locale** — no inline literal strings in components going forward. Worth adding a lint rule (e.g. banning raw string JSX text via a custom ESLint rule, or `eslint-plugin-i18next`'s `no-literal-string`) so new code can't silently reintroduce hardcoded English the way `app/page.tsx`'s "About Us" paragraph or `app/privacy/page.tsx` do today.
2. **ID/label separation for every "detection-driven" business concern** (stats metrics, award codes, news categories, result status codes) — the logic never branches on language; it always operates on stable IDs, and *only* the presentation layer asks "what locale am I in."
3. **Logical CSS properties instead of `dir === "rtl" ? a : b` branches** — RTL support is a CSS-cascade property, not application logic duplicated per component.
4. **One formatting call-site pattern** (`useFormatter`/`getFormatter`) instead of scattered `Intl.DateTimeFormat("en-GB")` literals — already only two call sites exist today, so this is cheap to get right before more accumulate.
5. **A stable API boundary** (`/api/stats-export`) that absorbs the internal ID/label split without breaking its external consumer — internal refactors don't ripple outward.
6. **Steward locale as a user property, not a URL concern** — avoids maintaining two different routing shapes for what would otherwise be the same feature twice.

---

## 14. Migration Steps (expands Phase 3 of `migration-plan.md`)

1. **Install & wire `next-intl`.** Restructure `app/` into `app/[locale]/...` for public routes only; merge `next-intl`'s middleware with the existing steward-auth check in `proxy.ts`.
2. **Extract Tier 1 copy** (`lib/siteConfig.ts` and similar centralized content) into `messages/en/common.json` + `home.json`; get Hebrew translations reviewed by a native speaker (brand voice matters for hero/CTA copy — don't rely on machine translation alone here).
3. **Do the ID/label split** (§8) for `statsComputed.ts`'s `M` constants, `rewardsData.ts`'s award labels, `newsCategories.ts`'s category labels, and result status codes. Do this once, before migrating the pages that display them, so those pages aren't touched twice.
4. **Migrate Tier 2 scattered strings** (page/component literals — `app/page.tsx`, `app/privacy/page.tsx`, `ContactSection`, `TablesPageContent`, `StatsPageContent`, `Header`/`Footer`, etc.) to `t()` calls. Mechanical, page-by-page, safely parallelizable across contributors since each page is independent.
5. **RTL CSS pass** — migrate physical→logical Tailwind utilities repo-wide; add `lang`/`dir` to the `[locale]` layout; visually verify every page in both directions; apply the LTR exceptions from §9/§12.
6. **Hebrew font integration** — pick and load the replacement font pairing (sequenced with the visual rebrand, §12).
7. **Forms + validation** — convert `app/api/contact/route.ts`'s JSON error responses from prose to codes; convert steward pages' error-code ternary chains to `t()` lookups; apply the per-field `dir` policy from §6.
8. **News/article bilingual CMS** — add `locale` + `article_group_id` columns to the articles sheet; update `lib/newsData.ts`'s fetch/mapper functions for locale filtering + fallback; add locale-scoped RSS feed variants.
9. **Steward locale** — add `StewardUser.locale`; wire `NextIntlClientProvider` in the protected layout from the user's stored preference; migrate `lib/stewards/notifications.ts` to `getTranslations` per-recipient-locale.
10. **QA pass** — full walkthrough of every page in both languages; dedicated RTL visual review; confirm `/api/stats-export`'s response shape is byte-for-byte unchanged; confirm RSS/Zapier automation still fires correctly per locale.

**Dependency note:** step 3 must land before step 4 touches the stats/rewards/news pages — otherwise those pages get migrated twice (once naively, once again after the ID/label split).

---

## 15. Open Decisions (need a stakeholder answer, not a technical one)

- **Default locale and URL prefix style** — recommend `localePrefix: "always"` (§3) regardless of which locale is default, but confirm Hebrew vs. English as the default for an unrecognized visitor.
- **Steward UI default language** — the volunteers running the module are presumably Hebrew-speaking; confirm whether the initial rollout should default new steward accounts to Hebrew or English.
- **News authoring workflow** — will articles always be written in both languages before publishing, or is one-language-first (with fallback display, §4) the expected steady state? This determines how much the fallback-banner UX in §4 actually gets used in practice.
- **Translation quality bar** — recommend professional/native-speaker review for Tier 1 marketing copy and email templates at minimum (brand voice), even if machine translation is used as a first draft for lower-visibility strings (tooltips, admin-only steward copy).

---

*This document reflects the repository state analyzed on 2026-07-01, and assumes the data-model scope from `migration-plan.md` (a full content reset for the new league, not a two-league data merge — see that document's §0).*
