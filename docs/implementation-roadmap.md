# Implementation Roadmap — League Rebrand, Redesign & Multilingual

> **Status:** Roadmap only. No code has been written. This unifies the three planning documents into one ordered, risk-minimized sequence:
> - [migration-plan.md](./migration-plan.md) — data reset / rebrand (new league on the same schema)
> - [design-system-migration.md](./design-system-migration.md) — visual redesign to [design-spec.md](./design-spec.md) ("Motorsong Editorial")
> - [i18n-architecture.md](./i18n-architecture.md) — English/Hebrew multilingual + RTL
>
> **Ordering principle:** phases ascend from *safest* to *most dangerous* (by blast radius, reversibility, and live-site impact). Where strict risk-order conflicts with a hard dependency, the dependency wins and it's called out. **Every phase leaves the site fully functional and shippable.** You can stop after any phase.
>
> **Governed by [migration-principles.md](./migration-principles.md)** — the canonical constraints (preserve functionality, refactor before rewrite, never rewrite working logic for cleanliness, always deployable, reuse components, multilingual-as-infrastructure, no capability change unless requested, keep code modular, minimize future maintenance). Those principles override anything here that conflicts.

---

## 0. How to read this

**The stop-anywhere guarantee.** Each phase is designed as a coherent checkpoint. If the project halts after any phase, the live site keeps working. The trade-off is stated per phase (e.g. "site works but is visually mixed old/new during Phase 5").

**Two things every phase gets that aren't repeated below:**
- Run `npx tsc --noEmit` and `npm run lint` before merge (project invariant).
- Re-capture the screenshot baseline (Phase 0) at the end of any phase that intentionally changes appearance, so the *next* phase's visual diff is meaningful.

**Per-phase fields:** Goal · Expected files · Affected modules · Dependencies · Risks · Testing · Stoppable state.

### Phase summary

| # | Phase | Risk | Reversibility | Depends on |
|---|---|---|---|---|
| 0 | Safety net, CI, doc accuracy, **debug-csv fix + shadcn go/no-go spike** | 🟢 Lowest | Trivial | — |
| 1 | Data reset (new league content) | 🟡 Medium (touches live CMS) | High (Sheet backup) | 0 |
| 2 | Brand identity & copy | 🟢 Low | High | 1 |
| 3 | Design foundation (tokens/fonts, additive) | 🟢 Low | High | 0 (spike gate) |
| 4 | Primitive component library (unconsumed) | 🟢 Lowest of the design work | High | 3 |
| 5 | Visual surface migration (route-by-route) | 🔴 High | Medium | 4 |
| 6 | Imagery, motion, print polish | 🟡 Medium | Medium | 5 |
| 7 | Email templates (editorial, inline-hex) | 🟡 Medium | High | 2 |
| 8 | i18n internal foundation (English-only) | 🔴 High | Medium | 5 |
| 9 | i18n activation ([locale] + Hebrew + RTL) | 🔴 Highest | Low | 8 |
| 10 | Guardrails & final hardening | 🟢 Low | High | all |

> **Sequencing notes:**
> - Hard dependencies: 3→4, 4→5, 8→9. Phase 7 (email) is independent after Phase 2 and may slot anywhere from its position onward.
> - **The shadcn-init spike is a Phase 0 go/no-go gate**, not part of Phase 3. It's the design work's critical-path risk (if shadcn init writes a `tailwind.config.js` on Tailwind v4, it breaks the project invariant and blocks Phases 3–5). De-risking it *first*, as a throwaway spike, is what lets Phase 3 be genuinely low-risk.
> - **Phase 1 vs Phase 4 risk honesty:** Phase 4 (build unconsumed primitives) is the single safest checkpoint in the plan — a stop there is provably a zero-delta live site. Phase 1 wipes the production Google Sheet (the real CMS), depends on new-league data existing, needs an external Apps Script re-run, and has a *silent* fallback failure mode. Both are recoverable, but Phase 1 has real live-content blast radius — hence 🟡, and data-first is chosen only because it makes the redesign verifiable against real content.
> - The multilingual block (8–9) is last-but-one because the `[locale]` route restructure is the single highest-blast-radius change in the project.

---

## Phase 0 — Safety net, CI & documentation accuracy

**Goal.** Establish regression protection *before* touching anything, fix the one known documentation defect, close a live security exposure, and run the shadcn go/no-go spike that gates all design work. Nothing user-facing changes (except closing the exposure).

**Expected files.**
- `.github/workflows/ci.yml` (new) — `tsc --noEmit`, `lint`, `next build` on PR.
- `docs/manual-smoke-checklist.md` (extend the existing checklist to cover all public routes + a steward case lifecycle).
- Screenshot baseline artifacts (store outside the app, e.g. a `baseline/` folder or CI artifact) for: `/`, `/drivers`, `/schedule`, `/statistics` or `/stats`, `/news`, a `/news/[slug]`, a steward page — desktop **and** mobile viewport.
- `CLAUDE.md` — correct/remove the §7 reference to `lib/statsInsights.ts` (verified nonexistent; see [claude-md-drift memory]).
- **`app/api/debug-csv/route.ts` — gate behind `NODE_ENV !== "production"` (or delete).** Confirmed live in prod today with no dev-guard and no auth: it dumps every internal `GLOBAL_CSV_URLS` endpoint to any anonymous caller (CLAUDE.md §13 flags it dev-only, but nothing enforces that). This is a pre-existing prod exposure that the rebrand's URL repointing (Phase 1/2) would otherwise leave open — close it now.
- **shadcn go/no-go spike** (throwaway branch, not merged): run `shadcn init` against Tailwind v4 and confirm it does **not** write a `tailwind.config.js` and the build stays green. If it fails, resolve the init approach before Phase 3 (this is the design work's only P0 blocker).

**Affected modules.** CI/tooling; docs; one API route (security fix).

**Dependencies.** None.

**Risks.** Low. CI misconfiguration (contained to CI). The debug-csv change is a pure removal of exposure. The spike is throwaway — its *purpose* is to surface the shadcn-on-v4 risk here rather than mid-redesign.

**Testing.** CI green on `main`; baseline screenshots captured; `/api/debug-csv` returns 404/403 in a prod-like build; spike branch confirms shadcn init is clean on v4 (then discard the branch).

**Stoppable state.** Identical site (minus the closed debug-csv hole), now with a regression net and a validated shadcn path.

---

## Phase 1 — Data reset (new league content)

**Goal.** Drop all PSGiL-specific data and populate the Google Sheet with the new league's drivers, teams, schedule, and season 1 — on the **existing CSV schema** (this is the "reset, not merge" scope confirmed in [migration-plan.md](./migration-plan.md) §0). No structural code change.

**Expected files.**
- **Google Sheet** (the real CMS): repopulate `csv_drivers`, `csv_teams`, `csv_schedule`, `csv_race_results`, standings tabs, `rewards`, `csv_seasons_config` (`is_current = TRUE` on the new season 1). **Back up the current sheet first** (File → Make a copy) — this is the reversibility anchor.
- `lib/driversData.ts` — replace the hardcoded PSGiL team-color map (`getTeamColor`, `psgil-*` keys) and the purple `FALLBACK_TEAM_COLOR` with the new league's team keys/colors (or, better, move it to a CSV column while here).
- `lib/h2h.ts` — *optional, recommended while in the area:* switch the head-to-head index from `driver_name` keying to `driver_id` (latent-bug cleanup flagged in migration-plan.md §4).
- `public/drivers/*.webp`, `public/teams/*`, `public/events/*` — new media assets (manually managed).
- `scripts/standings/psgil-standings.gs` — confirm the Apps Script standings calculator is reused/adjusted for the new league's rules (decision from migration-plan.md Phase 0).

**Affected modules.** Data layer (`driversData`, `h2h`), public content, standings pipeline (external Apps Script), media assets.

**Dependencies.** Phase 0 (regression net). Requires the new league's roster/schedule data to exist.

**Risks.** (Medium blast radius — this touches the live CMS, not just code.)
- Deleting live data feels dangerous — **mitigated** by the Sheet backup (fully reversible).
- Team-color fallback is silent (falls back to a single color) — a missed `team_key` won't error, just render wrong. **Hard gate:** every team must resolve a non-fallback color before this phase is "done" — not a note, a merge blocker.
- Standings won't populate until the Apps Script runs against the new results; ISR means up to a 5-min lag.
- `driver_id` conventions must stay stable/snake_case so `public/drivers/{id}.webp` resolves.
- A bad `event_id`/date format in the new sheet can silently break the RSS/Zapier automation feeds (fire-and-forget) — test them (below).

**Testing.** Every public page renders with new data (no missing images, no fallback colors leaking — hard gate); standings compute after running the Apps Script; driver modals open; `/api/stats-export` still returns valid JSON; **all four RSS/feed routes (`/news/rss.xml`, `/rss/race-alerts.xml`, `/rss/articles-instagram.xml`, `/rss/race-alerts-instagram.xml`) return valid XML with new-league data** (these drive live social automation). Run the smoke checklist.

**Stoppable state.** Fully functional site showing the new league's data on the *current (dark) design*, still English-only.

---

## Phase 2 — Brand identity & copy

**Goal.** Replace all PSGiL brand references with the new league's identity — still on the current design and still English. High visibility, low code risk.

**Expected files.**
- `lib/siteConfig.ts` — league name, hero title/subtitle, trust chips, league-format blurbs, join CTA, footer, social links (rewrite copy for the merged brand, not translate PSGiL's).
- `app/layout.tsx` — metadata `title`/`description`, favicon set, manifest.
- `public/` — new logo, favicons, `site.webmanifest`, `/psgil-banner.png` → new banner, `/hero.jpg`.
- Domain/email references: `lib/ga.ts` (`psgil.com` hostname gate), `lib/stewards/notifications.ts` (incl. the **hardcoded `https://psgil.com` footer URL** that bypasses `NEXT_PUBLIC_SITE_URL`) + `app/api/contact/route.ts` (from-address, `psgil.com`, `psgileague@gmail.com` — copy strings only here; the email *design* is Phase 7), `app/privacy/page.tsx`.
- `lib/newsData.ts` — the dev-fallback sample article (`slug: "psgil-news-sample"`, `coverImageUrl: "/psgil-banner.png"`) and `DEFAULT_AUTHOR`; `lib/stewards/seed.ts` — the `@psgil.local` seed users (cosmetic, but confusing for a new-league dev).
- Env: `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_GA_ID` in Netlify (new domain / GA property).

**Affected modules.** Site config, layout/SEO, analytics, contact + steward notification copy, legal page.

**Dependencies.** Phase 1 (so brand + data are coherent).

**Risks.**
- GA hostname gate in `lib/ga.ts` hardcodes `psgil.com`; analytics silently stops on the new domain until updated.
- Steward notification emails reference the old domain in deep links — update `NEXT_PUBLIC_SITE_URL`.
- **Double-touch note:** `siteConfig.ts` copy edited here will be re-touched in Phase 8 (extraction to message catalogs). Accepted trade-off — each pass is independently safe and shippable, which the roadmap prioritizes over minimizing churn.

**Testing.** Grep confirms no stray "PSGiL"/`psgil.com`/old-email references **anywhere in `app/`, `components/`, or `lib/`** (not only obvious UI copy — include the `notifications.ts` footer URL and `newsData.ts` sample); metadata/OpenGraph correct; favicon/manifest load; a test contact email arrives with correct branding/links.

**Stoppable state.** Fully rebranded (name, logo, copy, domain) site on the current design, English-only. **This is a legitimate "done enough to launch the rebrand" checkpoint** if the redesign/multilingual work must pause.

---

## Phase 3 — Design foundation (tokens, fonts, a11y globals) — additive, non-flipping

**Goal.** Stand up the entire token layer, fonts, and global rules **alongside** the existing dark theme, without flipping anything. Nothing consumes the new tokens yet, so the live site is unchanged (except pure-win a11y additions). This is the "anti-flag-day" base from [design-system-migration.md](./design-system-migration.md) §4.6.

**Expected files.**
- `lib/utils.ts` (new) — `cn()` (clsx + tailwind-merge).
- `components.json` (new) — shadcn init, **targeting the Tailwind v4 CSS-first path** using the approach validated by the Phase 0 spike (must NOT write a `tailwind.config.js`).
- `package.json` — add `class-variance-authority`, `clsx`, `tailwind-merge`, `lucide-react`.
- `app/globals.css` — **single foundation edit** owning: the editorial `@theme` token set (`--paper`, `--cream`, `--ink`, `--ink-2`, `--muted`, `--gold`, `--gold-ink`, `--hairline`, `--destructive`), `--radius: 2px` (with an explicit override of shadcn's radius `calc()` so all variants resolve to 2px — §4.3), font tokens, the 4 approved keyframes (`f1-rise`/staggered/`f1-tick`), a **global** `prefers-reduced-motion` guard, global `:focus-visible` ring structure, `::selection`, and the `.num`/`.tabular`/`.hairline-*`/`.speed-lines`/`.chicane-*` utilities.
- `app/layout.tsx` — load Barlow Condensed + JetBrains Mono + Heebo (Hebrew subset) via `next/font`; keep Inter; **keep Rajdhani for now** (still referenced by unmigrated pages — removed in Phase 5).

**Affected modules.** Global styling/tokens, fonts, build tooling. No page/component consumes the new tokens yet.

**Dependencies.** Phase 0.

**Risks.**
- The critical-path shadcn-on-v4 risk was **already de-risked by the Phase 0 spike** — this phase just applies the validated approach. If the spike hadn't passed, this phase would be blocked; that gate is why Phase 3 is now genuinely low-risk.
- Adding fonts increases the font payload; the site still uses Inter/Rajdhani, so the new fonts load but aren't shown — acceptable, briefly.
- The global reduced-motion guard is a pure a11y win even on the dark theme; the gold focus ring may look slightly off on dark until Phase 5 (cosmetic only).

**Testing.** Build stays green; no `tailwind.config.js` created; site renders visually identical to Phase 2 (still dark); reduced-motion preference now neutralizes animations; `tsc`/lint pass.

**Stoppable state.** Visually unchanged site (dark), now with a full token layer + fonts loaded + global a11y guards in place, ready to be consumed.

---

## Phase 4 — Primitive component library (built, unconsumed)

**Goal.** Build the shadcn "new-york" primitives themed to the editorial tokens, **without swapping them into any page yet**. Because nothing imports them, the live site is unchanged — this is a very safe checkpoint that front-loads the hardest design work.

**Expected files (new, under `components/ui/` unless noted).**
- `button.tsx`, `card.tsx`, `badge.tsx`, `input.tsx`, `textarea.tsx`, `select.tsx`, `dialog.tsx`, `table.tsx` (DataTable), `tabs.tsx`, `empty-state.tsx`, `tooltip.tsx`, `icon-button.tsx`, `eyebrow.tsx`, `stat-tile.tsx`.
- `components/Container.tsx`, refactored `components/Section.tsx` (Band-aware), `components/BottomNav.tsx` (new), `components/Social.tsx` (new), `components/StatusBadge.tsx` (steward status→variant, non-color encoding), `EditorialImage`/`LogoFrame`, `PosChangeIndicator`, an `Icon` wrapper over Lucide.
- Optional: a `/dev/components` demo route or Storybook to render every primitive in isolation.

**Affected modules.** New `components/ui/` layer only. Existing pages untouched.

**Dependencies.** Phase 3 (tokens, `cn()`, fonts, shadcn init).

**Risks.**
- Low — new files, unconsumed. Main risk is designing an API that later proves awkward; mitigated by building against the demo route and by keeping the existing `ResultsTable` `ColumnDef` API (the one strong reuse pattern) rather than reinventing it.
- Getting a11y right in `Dialog` (focus trap, `role`, Escape, scroll-lock) and the 44px `IconButton` hit area is the real work — but it's isolated and testable.

**Testing.** Demo route renders each primitive in light theme; keyboard-navigate the Dialog (focus trapped, Escape closes, focus restored); Badge/StatusBadge encode status without relying on color; `.num` numerals align in the DataTable; `tsc`/lint pass. No visual change to real routes.

**Stoppable state.** Unchanged live site + a complete, tested primitive library on the shelf.

---

## Phase 5 — Visual surface migration (route-by-route theme flip)

**Goal.** The core redesign. Migrate real routes to the primitives + light theme + logical CSS properties + `.num` numerals + contrast fixes — **one route at a time, each fully flipped**, so every shipped route is internally coherent. This is the most dangerous non-i18n phase.

**Sub-order (safest route first).** shell (Header/Footer + new BottomNav + safe-area/viewport) → homepage → drivers → news + `.news-prose` → schedule (`ScheduleList`) → tables/standings → stats (`StatsPageContent`, largest cluster) → steward module (retire the `--color-steward-*` palette + `.stewards-ui` block; apply `StatusBadge`).

**Shared-component rule (critical for stop-anywhere).** A per-route `data-theme` wrapper does **not** isolate a *shared* component's own hardcoded colors. Components rendered on both migrated and un-migrated routes — `ResultsTable` (public standings **and** steward tables), `DriverModal`/`DriverLookupProvider` (openable from anywhere), `NewsCarousel` (home + news), `SeasonSelector`, `NextRaceWidget` — must be made **token-adaptive** (driven by the theme tokens, not hardcoded hex) so they render correctly under either theme, OR every route that consumes them must flip in the same PR. Specifically, the moment `ResultsTable`'s `STICKY_CELL_BG` is recomputed for cream, every route using `ResultsTable` (including steward tables) must already be light — otherwise the still-dark routes get cream cells over a dark table (the inverse black-bar bug). Make shared/leaf components token-adaptive first; migrate route shells after.

**Expected files (representative, by sub-step).**
- `components/Header.tsx`, `components/Footer.tsx`, `components/BottomNav.tsx`, `app/layout.tsx` (add `export const viewport = { viewportFit: "cover" }`, safe-area), `components/NextRaceWidget.tsx` (safe-area padding).
- `app/page.tsx`, `components/HomeRaceCards.tsx`, `components/HeroLogo.tsx`, `components/SnapshotStrip.tsx`, `components/WhatYouGet.tsx`, `components/NewsCarousel.tsx`, `components/ContactSection.tsx`.
- `app/drivers/page.tsx`, `components/DriversGrid.tsx`, `components/DriverCard.tsx`, `components/DriverModal.tsx`, `components/AchievementBadges.tsx`.
- `app/news/**`, `app/globals.css` (`.news-prose` block), `components/NewsImage.tsx`, `components/NewsCategoryTag.tsx`, `components/NewsArticleActions.tsx`.
- `components/ScheduleList.tsx`, `components/RaceCard.tsx`, `components/ZoomableImage.tsx`, `components/WatchLastRaceButton.tsx`.
- `components/ResultsTable.tsx` (**fix `STICKY_CELL_BG` pre-blended dark hex — §4.7, must land with this route**), `components/StandingsTable.tsx`, `components/RaceResultsTable.tsx`, `components/StandingsSection.tsx`, `components/TablesPageContent.tsx`.
- `components/StatsPageContent.tsx` + `components/stats/*` (+ a **Recharts JS theme object** and paper-safe series palette — §5), `app/stats/page.tsx`, `app/statistics/page.tsx`.
- `app/stewards/**` (protected layout, cases, appeals, penalties, admin, login), `app/stewards/components/*`, `app/globals.css` (delete `.stewards-ui` gradient/sheen block).
- Remove Rajdhani from `app/layout.tsx` + `globals.css` once no route references `--font-rajdhani`.
- `app/news/error.tsx`, `app/news/loading.tsx`, `app/news/[slug]/loading.tsx`, `app/stewards/(protected)/error.tsx`, `app/privacy/page.tsx` (dark → light; add missing `h1`).

**Affected modules.** Essentially every component and public/steward route. The data layer, business logic, and steward *logic* are untouched — this is presentational only.

**Dependencies.** Phase 4 (primitives). Recommended after Phases 1–2 so it's verified against real new-league content.

**Risks (highest of the non-i18n work).**
- **`ResultsTable` sticky-cell math** renders black bars over the paper table if the pre-blended dark hex isn't recomputed in the same PR — the most-viewed data on the site.
- **Recharts** doesn't read CSS variables via className; charts stay dark unless the JS theme object lands — easy to miss.
- **Contrast inversion:** 264 low-opacity white texts must migrate by *intent* (fill→cream, hairline→hairline token, text→ink), not a blanket opacity bump, or text goes invisible/low-contrast on paper.
- **Transient inconsistency:** while this phase is in flight, some routes are editorial-light and others still dark. The site is *functional* but *visually mixed*. Mitigate by scoping migrated routes with a `data-theme` wrapper — **but note the shared-component rule above: route scoping alone is insufficient for components shared across migrated/un-migrated routes.** Those must be token-adaptive first. **Alternative** (if mixed aesthetic is unacceptable): run all of Phase 5 on a long-lived branch and cut over at once — but that forfeits the per-route stop-anywhere property for the sub-steps.
- `StatsPageContent.tsx` at 3,940 lines is regression-prone; migrate it last, behind the stable primitives, and consider splitting it while there.
- Do **not** change form `name`/`value`/submit semantics when swapping inputs to primitives — they post to `/api/contact` and steward server actions.

**Testing.** Per route: visual diff vs. the (re-captured) baseline; keyboard + screen-reader pass on modals and nav; contrast check ≥ AA on paper/cream; standings/results frozen columns render correctly on horizontal scroll (desktop + mobile); charts render in light theme; steward case → verdict → penalty lifecycle still works; `tsc`/lint. Verify each route in Claude Preview.

**Stoppable state.** After *each route*, the site is functional; after the *whole* phase, the site is fully redesigned (light editorial), English-only, LTR (logical props in place but `dir` not yet switched).

---

## Phase 6 — Imagery, motion cleanup & print

**Goal.** Finish the editorial look: photography treatment, remove off-spec motion, add signature moves, print stylesheet, modern image formats.

**Expected files.**
- `components/HomeRaceCards.tsx`, `app/news/**`, `components/DriverCard.tsx`, `components/DriverModal.tsx`, `components/ScheduleList.tsx` — B&W/desaturate + 1px hairline frames; remove dark gradient scrims and drop-shadows.
- `components/HeroLogo.tsx` — remove purple glow/ring/breathe (verify its actual render path first; `app/page.tsx` currently uses `/psgil-banner.png`).
- `app/globals.css` — delete the remaining off-spec keyframes (`hero-zoom`, `hero-glide`, `logo-*`, `live-*`, `modal-pop`, `steward-*`, dead `upcoming-pulse`); keep only `f1-rise`/`f1-tick`; re-express the "LIVE" affordance with `f1-tick` or a static gold dot (§5).
- `next.config.ts` — add `images.formats: ['avif','webp']` + device/image sizes.
- `app/globals.css` — `@media print` pass for standings/schedule (editorial "race programme" printability).

**Affected modules.** Imagery components, global motion/keyframes, image config, print.

**Dependencies.** Phase 5 (surfaces already light).

**Risks.** Medium. Grayscale filter interacting with `next/image` wrappers; removing keyframes that a lingering component still references (grep first); print CSS is low-risk but easy to skip-test.

**Testing.** Visual check of imagery in both viewports; confirm no component references a deleted keyframe (`tsc` won't catch CSS class strings — grep `animate-[`); reduced-motion still honored; print-preview of a standings and schedule page; AVIF/WebP served.

**Stoppable state.** Fully polished editorial site, English-only, LTR.

---

## Phase 7 — Email templates (editorial redesign, inline-hex)

**Goal.** Bring the HTML emails onto the editorial palette. These are a **separate surface** — email clients can't use CSS variables, so this is an inline-hex pass, independent of the token layer (§5 of design doc).

**Expected files.**
- `lib/stewards/notifications.ts` — 10 notification templates (case submitted, responses in, verdict, penalties, appeals): replace gradient headers/pill radii/purple CTAs/emoji/white-on-dark with inline editorial ink/cream/gold-hairline, sharp corners.
- `app/api/contact/route.ts` — welcome/sign-up/question auto-reply templates, same treatment.

**Affected modules.** Steward notifications, contact API. (Business logic untouched — templates only.)

**Dependencies.** Phase 2 (brand strings/domain settled). Independent of the visual phases otherwise — can run any time from here.

**Risks.** Medium — email client rendering is inconsistent; inline styles only, test across clients. Fire-and-forget send path means a broken template fails silently.

**Testing.** Trigger each email type to a test inbox; check rendering in Gmail/Apple Mail/Outlook (or a Litmus-style tool); confirm links use the new domain; plain-text fallbacks intact.

**Stoppable state.** All transactional emails match the new brand; site as of Phase 6.

---

## Phase 8 — i18n internal foundation (English-only, no route move)

**Goal.** Do the *hard, behavior-preserving* i18n groundwork without changing routes or adding Hebrew yet: split English-label-as-key patterns into stable IDs + translated labels, install `next-intl`, and extract strings to catalogs — site stays English-only and single-locale. This front-loads the riskiest refactor (the ID/label split) separately from the riskiest structural change (Phase 9).

**Expected files.**
- `lib/statsComputed.ts` (the `M` metric-key constants), `lib/statsMetricRegistry.ts`, `lib/rewardsData.ts` (award labels/tooltips), `lib/newsCategories.ts` — split display label from internal ID; logic keys on stable IDs (see [i18n-architecture.md](./i18n-architecture.md) §8).
- `app/api/stats-export/route.ts` — **preserve the external contract**: map internal IDs → current English headers at the response boundary so the "PSGiL Editor agent" consumer sees byte-identical output.
- `messages/en/*.json` (new) — `common`, `home`, `drivers`, `schedule`, `stats`, `news`, `forms`, `errors`, `stewards`, `emails` namespaces.
- `next.config.ts` / `app` wiring for `next-intl` provider (single locale `en`, no `[locale]` segment yet).
- `app/api/contact/route.ts` + steward pages — convert prose error responses / error-code ternaries to `t()` lookups against `errors.json` (§7 of i18n doc).
- `package.json` — add `next-intl`.

**Affected modules.** Stats engine (keys), rewards, news categories, stats-export contract, all UI copy (now catalog-driven), forms/validation.

**Dependencies.** Phase 5, then extract that copy. Must precede Phase 9.

> **Named trade-off (this is the one real conflict between "stop anywhere" and "minimize churn").** [design-system-migration.md](./design-system-migration.md) §8 recommends coordinated *per-file* passes (one PR touching both color + strings) to avoid editing the same ~68 files twice. This roadmap instead does visual (Phase 5) and extraction (Phase 8) as separate sweeps — which **does** re-touch high-churn files (`StatsPageContent.tsx` at 3,940 lines, `app/page.tsx`) twice. That is the deliberate cost of keeping each phase independently shippable/stoppable, which the brief prioritizes. **Escape hatch:** for the 2–3 highest-churn files only, do the combined visual+extraction pass during Phase 5 and skip them in Phase 8. Choose per-file; don't apply globally.

**Risks.** High but contained (no behavior change is the safety property).
- The ID/label split touches the **stats engine** and the **`/api/stats-export` contract** — a regression here silently corrupts stats or breaks the external consumer. The boundary-mapping test is mandatory.
- CSV column keys must **not** be renamed (metric display names flow from CSV headers) — the split is code-side only.
- Missing a hardcoded string leaves English text that won't translate in Phase 9 — a `no-literal-string` lint (Phase 10) backstops this.

**Testing.** Stats pages render identically to Phase 6; `/api/stats-export` output is **byte-identical** to before (diff it); all catalog keys resolve (no missing-key warnings); English site unchanged; `tsc`/lint.

**Stoppable state.** English site, visually identical, now fully catalog-driven with language and logic decoupled — a clean base that could stay English-only indefinitely.

---

## Phase 9 — i18n activation ([locale] routes, Hebrew, RTL)

**Goal.** Turn on bilingualism: restructure public routes under `[locale]`, compose middleware, switch `dir`/`lang`, add Hebrew content, and activate RTL. This is the **single highest-blast-radius change** in the project — it moves the `<html>` tag and every public route path, and touches the persisted steward store.

**Expected files.**
- `app/[locale]/layout.tsx` (new root `<html lang dir>`), move public *page* routes (`page`, `drivers`, `schedule`, `statistics`, `stats`, `news/**`, `privacy`) under `app/[locale]/`.
- **Stays unprefixed / redirect-mapped (do NOT move under `[locale]`):** the steward portal (`/stewards/*`, by design — protects existing email deep-links), the four feed routes (`app/news/rss.xml`, `app/rss/*` — existing Zapier/Instagram subscribers hit fixed URLs; add locale *variants* rather than moving the base), the API routes (`app/api/*`), and the legacy `app/articles` redirect (must still resolve at bare `/articles` and redirect to a locale-resolved `/news`). With `localePrefix: "always"`, bare `/news` and `/articles` won't resolve unless middleware handles them — explicitly map these.
- `proxy.ts` — compose `next-intl` middleware (locale detection/redirect for public paths) with the existing steward-auth cookie check (disjoint matchers); ensure it also handles the bare `/articles` and feed paths.
- `messages/he/*.json` (new, mirror of `en`) — native-reviewed translations, especially hero/CTA/email copy.
- `app/globals.css` / components — final directional touch-ups; confirm the Phase 5 logical-property migration mirrors correctly; ensure `.num` numerals stay LTR-isolated.
- **Steward locale:** `lib/stewards/types.ts` (`StewardUser.locale`), `lib/stewards/seed.ts`, repository, admin/profile UI, **and a default/migration for existing users in the Netlify Blobs store**; steward layout sets `dir`/`lang` from `user.locale`.
- **Bilingual articles:** add `locale` + `article_group_id` columns to the `articles` sheet; update `lib/newsData.ts` fetch/mapper for locale filtering + fallback; add locale-scoped RSS variants.
- **Email i18n:** `lib/stewards/notifications.ts` + `app/api/contact/route.ts` — `getTranslations({ locale })` per recipient (`StewardUser.locale` / submission locale).

**Affected modules.** Routing/middleware, root layout, every public page path, steward auth/store schema, news CMS, RSS, email localization.

**Dependencies.** Phase 8 (catalogs, `next-intl`, ID/label split). Relies on Phase 5's logical-property work for RTL to render correctly.

**Risks (highest).**
- Moving every public route changes URLs — set up redirects and verify SEO/`hreflang`; steward email deep-links must keep working (steward stays unprefixed by design — i18n doc §5).
- Middleware composition bug could block `/stewards/*` auth or misroute locales — **and could break the `/articles` redirect + feed URLs** if they aren't in the unprefixed/redirect map above. This is the highest-risk item in the phase, alongside the route move itself.
- `StewardUser.locale` is a schema addition to the persisted Blobs store — **but this is Low risk, not high**: `lib/stewards/store.ts` already performs defensive on-read migration (it back-fills missing fields like `mustChangePassword` with defaults on every read). Adding `locale` is the exact same one-line default in that existing block — not a "reads fail" scenario. Add it to the existing migration; don't treat it as a scary schema break.
- RTL layout regressions surface only in Hebrew — requires a dedicated both-directions QA pass.
- Article fallback (untranslated row) must degrade gracefully, not 404.

**Testing.** Every page route resolves under `/en/` and `/he/`; language switch works; RTL layout mirrors correctly (dedicated Hebrew pass, all pages); numerals stay LTR in RTL context; **bare `/articles` still redirects, and all four feed URLs still resolve at their original unprefixed paths** (existing subscribers) plus new locale variants; steward login/case/appeal/penalty lifecycle works with a Hebrew-locale user; existing steward users load unchanged (on-read Blobs migration); localized emails render per recipient; old public paths redirect to a locale-resolved equivalent; `tsc`/lint.

**Stoppable state.** Fully bilingual (EN/HE), RTL-correct, redesigned, rebranded site — the end-state.

---

## Phase 10 — Guardrails & final hardening

**Goal.** Lock in the new baselines so regressions can't creep back, and do the final cross-cutting a11y/QA pass. Last because these rules would fail against pre-migration code.

**Expected files.**
- `eslint.config.mjs` — ban physical directional utilities (`pl-`/`pr-`/`text-left`…), enable `eslint-plugin-i18next` `no-literal-string` for JSX, add `jsx-a11y`/axe checks.
- `.github/workflows/ci.yml` — add the grep guard (fail on new `#7020b0`/`#a855f7`/`#d4af37`/raw `bg-white|text-white|border-white` literals) and visual-diff on baseline routes.
- Possibly small fixes surfaced by the audit (skip link, remaining heading-order/tap-target items) if not already closed in Phase 5.

**Affected modules.** Tooling/CI, lint config; targeted a11y fixes.

**Dependencies.** All prior phases (rules must match the migrated code).

**Risks.** Low. Over-strict lint rules could block legitimate future code — tune the allowlist.

**Testing.** CI green with new rules; full keyboard + screen-reader pass in both languages; contrast audit; final smoke checklist in EN and HE, desktop and mobile.

**Stoppable state.** Complete: rebranded, redesigned, bilingual, RTL-ready, accessibility-hardened, regression-guarded.

---

## Cross-cutting notes

- **Data layer & business logic are never rewritten.** Across all phases, `lib/csv.ts`, the CSV mappers, `statsComputed`, `h2h`, and the steward *logic* stay intact. The only data-layer edits are the team-color map (Phase 1), the ID/label split (Phase 8, behavior-preserving), and `StewardUser.locale` (Phase 9). This is what keeps every phase low-to-bounded risk.
- **The steward module** is touched three times, each independently safe: visual migration (Phase 5), email redesign (Phase 7), and locale (Phase 9). Its case/appeal/penalty engine is never altered.
- **If multilingual is descoped**, stop cleanly after Phase 7 (or Phase 6): a fully rebranded, redesigned, English site. Phases 8–9 are the only ones that assume bilingualism.
- **Biggest single risk in the whole program** is Phase 9's `[locale]` restructure; it's placed last-but-one deliberately, after everything else is stable and after Phase 8 has de-risked the language/logic decoupling separately.
- **Re-baseline discipline:** capture fresh screenshots after Phases 1, 2, 6, and each Phase 5 route, so the *next* change's visual diff isolates unintended regressions.

---

*Synthesized 2026-07-01 from migration-plan.md, design-system-migration.md, and i18n-architecture.md. Ordering optimizes for risk minimization and stop-anywhere shippability per the brief.*
