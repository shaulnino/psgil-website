# ARCHITECTURE.md — F1ISL Platform

> **Status:** Living technical reference. Describes the platform **as it actually exists today** (audited 2026-07-05), plus the decisions that govern how it grows. Every meaningful architectural decision updates this file.
>
> **Relationship to other docs:**
> - [PROJECT_VISION.md](./PROJECT_VISION.md) — the destination (platform evolution: PWA, accounts, attendance, notifications).
> - [CLAUDE.md](./CLAUDE.md) — operating rules for AI/dev work on this repo.
> - `docs/` — the **completed** rebrand/redesign/i18n migration plans. **Partly stale** (they describe a *light editorial* theme; the site shipped *dark broadcast* — see §12 Doc Drift). Treat `docs/*` as historical record; treat this file as current truth.
> - [DESIGN_SYSTEM.md](./DESIGN_SYSTEM.md) — the visual reference.

---

## 1. What F1ISL is

F1ISL (formerly PSGiL) is the official website for an Israeli F1 sim-racing league. It is a **single Next.js 16 application** deployed on Netlify. It is data-driven: nearly all public content is read from a single Google Spreadsheet exposed as CSV. The one stateful subsystem is the **steward module** (case management), backed by Netlify Blobs.

There is **one** frontend, **one** backend (Next.js server), **one** deployment. The website *is* the platform; an installable PWA is intended to be the same app in an app-like shell, never a separate product.

---

## 2. Tech stack (verified versions)

| Layer | Technology | Version |
|---|---|---|
| Framework | Next.js (App Router) | `16.1.4` |
| UI runtime | React / React-DOM | `19.2.3` |
| Language | TypeScript (strict) | `^5`, `target ES2017`, `moduleResolution: bundler` |
| Styling | Tailwind CSS v4 (`@tailwindcss/postcss`) — **no `tailwind.config.js`**, CSS-first via `@theme` in `globals.css` | `^4` |
| Component variants | `class-variance-authority`, `clsx`, `tailwind-merge` (via `cn()` in `lib/utils.ts`) | cva `^0.7.1` |
| Icons | `lucide-react` + hand-drawn inline SVGs (award medals) | `^1.22.0` |
| Charts | `recharts` (loaded only on stats routes) | `^3.7.0` |
| i18n | `next-intl` (he default, en prefixed, RTL) | `^4.13.1` |
| Auth (stewards) | `jose` (JWT HS256), scrypt password hashing | `jose ^6.2.2` |
| Email | `nodemailer` via Gmail SMTP | `^8.0.1` |
| Markdown | `marked` + `sanitize-html` (news) | `^17` / `^2.17` |
| Storage (stewards) | `@netlify/blobs` (prod) / local JSON (dev) | `^10.7.4` |
| Deploy | Netlify (Next.js runtime adapter) | — |
| CI | GitHub Actions: `tsc --noEmit` (hard gate) + `lint` (non-blocking) | Node 20 |

**Not present:** any PWA library (`next-pwa`/workbox), any client-state library (Redux/Zustand/Jotai/Context-for-state), any runtime schema validation (Zod/Yup), any general user-account system. Node version is pinned **only** in CI (no `.nvmrc`, no `engines`).

---

## 3. Routing & layouts

Next.js 16 App Router. Two disjoint route universes, composed at the edge by `proxy.ts` (Next 16's middleware convention):

### 3a. Public site — locale-prefixed
```
app/
  layout.tsx                    root <html lang dir> + fonts + GA + Header/Footer + NextRaceWidget + NextIntlClientProvider
  [locale]/
    layout.tsx                  validates locale, setRequestLocale()
    page.tsx                    / — home (force-dynamic; live race data)
    news/page.tsx               /news (revalidate 60) + error.tsx + loading.tsx
    news/[slug]/page.tsx        (revalidate 300, generateMetadata: OG/Twitter)
    schedule/page.tsx           (revalidate 300)
    drivers/page.tsx            (revalidate 300)
    statistics/page.tsx         (revalidate 300)
    stats/page.tsx              (revalidate 300)
    privacy/page.tsx            static
    articles/page.tsx           legacy redirect stub
    design-preview/page.tsx     internal design-system showcase
    register/ login/ verify/    PW-2b public auth (register, login, email verify)
    account/                    PW-2b profile (requireUser); profile + password + logout
```
- Locales: `["he", "en"]`, **default `he`** (unprefixed at `/`), English at `/en/*`. `localePrefix: "as-needed"`, `localeDetection: false`. Config in `i18n/routing.ts`.
- `dir="rtl"` when locale is `he`, set on `<html>` in `app/layout.tsx`.

### 3b. Steward portal — NOT locale-prefixed (by design)
```
app/stewards/
  login/                        public
  change-password/              forced-change flow
  (protected)/                  route group; layout calls requireStewardUser()
    page.tsx                    dashboard
    cases/ + cases/[id]/
    appeals/ + appeals/[id]/
    penalties/
    penalties-to-serve/
    admin/                      user management (manage_users role)
    error.tsx                   client; chunk-error detection
  actions.ts                    ALL steward mutations (server actions)
```
Steward routes stay unprefixed so existing email deep-links keep resolving. The portal is bilingual via **per-user** locale preference (`StewardUser.locale`), not URL prefix.

### 3c. API & feeds (excluded from locale middleware)
| Route | Method | Purpose | Auth |
|---|---|---|---|
| `app/api/contact` | POST | Contact/signup → email | Honeypot + in-memory rate-limit (5/min/IP) |
| `app/api/stewards/attachment` | GET | Serve case attachment from Blobs | Steward session; `Cache-Control: private, no-store` |
| `app/api/stewards/notifications` | GET | Pending-indicator count | Steward session (graceful empty fallback) |
| `app/api/stats-export` | GET | JSON stats bridge for external "ISL Editor" agent | `X-Api-Key` (skipped in dev) |
| `app/api/debug-csv` | GET | Dumps CSV source URLs | **404 in prod** (dev-only) |
| `app/news/rss.xml`, `app/rss/*` | GET | 4 RSS/Instagram/race-alert feeds | Public; drive Zapier automation |

`proxy.ts` matcher: `/((?!api|rss|_next|_vercel|.*\..*).*)` — API, feeds, Next internals, and static files bypass locale routing.

---

## 4. Data flow

### 4a. Public content (read-only, from Google Sheets)
```
Server Component
 └─ fetchCsv(url, revalidate=300)      lib/csv.ts — fetch + Next ISR cache, custom CSV parser (BOM/quote-safe)
     └─ parseCsv<T>()                  → Record<string,string>[]
         └─ mapXxx(rows)               lib/xxxData.ts — typed mapper
```
- **Single source of URLs:** `lib/seasonConfig.ts` → `GLOBAL_CSV_URLS` (+ `sheetUrl(gid)`; `SHEET_ID` split across 3 strings to survive the Netlify bundler). **Never hardcode a Sheet URL elsewhere.**
- Season keys are inconsistent across tabs (`"S6"` vs `"6"`). **Always compare via `matchesSeason()`**, never `===`.
- Data modules: `resultsData`, `driversData`, `scheduleData`, `rewardsData`, `newsData`, and the stats engine (`statsComputed.ts` ~1550 lines + `h2h.ts`, `statsMetricRegistry.ts`). All read-only; no writes back to the Sheet.
- **Public data is immutable from the app's perspective** — the Sheet is the CMS; the app never mutates it.

### 4b. Stats engine
`computeDriverStats(results, events, rewards, seasons, filters?)` → `{rows, headers}`, producing 100+ metrics and 0–100 percentile ratings (Speed / Consistency / Performance / Agility / Driver Rating). **Computed server-side, cached by ISR** (`revalidate=300`); the stats page pre-computes per-season and passes results as props. Client recomputes only when filters are active. Do not move this to the client by default — it is expensive. (Note: `lib/statsInsights.ts` referenced in older CLAUDE.md **does not exist** — doc drift.)

### 4c. Steward data (read-write)
```
Server Action (app/stewards/actions.ts)
 └─ repository.ts CRUD               getCaseById, upsertVerdict, addManualPenalty, …
     └─ readStore() / writeStore()   lib/stewards/store.ts
         ├─ prod:  Netlify Blobs key "stewards/store" (strong consistency)
         └─ dev:   data/stewards/store.json (auto-seeded)
```
- **The entire steward domain is one JSON document.** Writes are serialized through an in-process `_writeQueue` promise chain (read-modify-write-whole-blob).
- On-read migration back-fills missing fields (e.g. `mustChangePassword`, `locale`) — the sanctioned pattern for schema evolution.
- Domain: users, cases, responses, internal comments, verdicts (+ per-driver verdicts: license points, time penalties, warnings), penalties-to-serve (full lifecycle: pending→assigned→awaiting_confirmation→served/not_served/rolled_forward/cancelled), appeals (+ time-windowed).

> ⚠️ **Scaling note (governs future work):** the single-document + in-process-queue model is correct for a few dozen stewards. It is **not** a safe target for write-heavy public data (general accounts, attendance) — serverless instances don't share the queue, so concurrent cross-instance writes can lose updates. See §11 Roadmap: new write-heavy collections must use per-record keys or a real datastore, not this monolith.

---

## 5. Authentication & authorization (current)

- **Unified account model (PW-2a).** Identity lives in `lib/accounts/` — one `Account` type (id, name, email, roles, passwordHash, isActive, mustChangePassword, `emailVerified`, `driverId`, locale). `lib/stewards/types.ts` aliases `StewardUser = Account` / `StewardRole = AppRole`, so steward code is unchanged. Roles: `admin | steward | member | driver | registered_user` (no `team_manager`). Accounts persist in a **per-record store** (`lib/accounts/store.ts`): per-key Netlify Blobs (`acct/{id}` + `email/{email}` index) in prod, JSON file in dev. The steward monolith no longer owns users — `readStore()` **hydrates** `store.users` from the accounts store (derived, read-only), `writeStore()` never persists it, and a one-time migration imported existing steward users. This is the single source of truth for identity and the base for public accounts (PW-2b) and attendance (PW-3).
- **Public accounts (PW-2b): live.** Self-service register/login/verify/profile at locale-prefixed routes (`/register`, `/login`, `/account`, `/verify`). New sign-ups get role `registered_user`, `emailVerified: false`, and are auto-signed-in; the public site stays fully browsable either way (login only gates `/account`, the steward portal, and future attendance). Session/token/mailer live in `lib/auth/` (session helpers reuse the steward JWT/cookie; verification/reset tokens use the same secret via `getSessionSecret`; email verification via nodemailer, with a dev-console link fallback when `GMAIL_APP_PASSWORD` is unset). Input validated with `zod`.
- **Navigation:** "My Account" is the single header hub for all signed-in areas — Profile, the **Steward module** (nested, shown only to `view_steward_area` accounts), and future driver-only areas (attendance). Stewards is no longer a top-level nav link. Guests see "Sign in". Driven by `authed` + `canSteward` props from the root layout (`components/AccountMenu.tsx`) so a non-steward never sees a Stewards link that would just bounce them.
- **Steward area is role-gated (not just auth-gated):** `requireStewardUser()` now requires the `view_steward_area` permission (`member`/`steward`/`admin`), redirecting plain `registered_user`/`driver` accounts to `/account`. Necessary once public accounts exist — being signed in is no longer sufficient to enter `/stewards`.
- **Known follow-ups:** server-action error strings are English-only (UI labels are localized); server redirects/links are unprefixed (default-locale Hebrew is correct; English users may land on the Hebrew equivalent). "Drivers" are still read-only CSV rows keyed by `driver_id`; linking `account.driverId → driver_id` is admin-assign (PW-2d, not yet built).
- Session: `jose` JWT (HS256), stored in `steward_session` HTTP-only cookie (`sameSite: lax`, `secure` in prod only). 12h default / 10y "remember me".
- Secret: `STEWARD_SESSION_SECRET`. Dev fallback `"dev-steward-secret-change-me"`. **⚠️ In production, a missing secret is only `console.error`-logged — the request continues with the known default secret (HIGH-severity issue; see §10).**
- Passwords: **scrypt** (`crypto.ts`, 16-byte salt, keylen 64), `timingSafeEqual` verification. `mustChangePassword` forces a reset on first login.
- Roles: `admin | steward | member`. Enforced via `requireStewardUser()` / `requireRole()` and `PERMISSION_MATRIX` (in `lib/stewards/auth.ts`):

| Permission | member | steward | admin |
|---|:-:|:-:|:-:|
| view_steward_area | ✅ | ✅ | ✅ |
| create_complaint / submit_response / submit_appeal | ✅ | | ✅ |
| view_internal_discussion / comment_internally | | ✅ | ✅ |
| edit_verdict / publish_verdict / manage_appeals | | ✅ | ✅ |
| delete_case / manage_users / manage_penalties / reset_password | | | ✅ |

Enforcement is layered (edge cookie gate in `proxy.ts` + per-page `requireStewardUser()` + per-action `requireRole()`). One gap: `view_internal_discussion` is enforced at render, not at the data-fetch layer (MEDIUM).

---

## 6. State management

No client-state library. Data is server-fetched and passed as props; mutations go through **server actions** (steward) or **API routes** (contact). Client components hold only local UI state (`useState`/`useTransition`). Next.js server actions provide built-in CSRF protection.

---

## 7. Caching

- Public pages: ISR `revalidate=300` (5 min); news list `60`; home `force-dynamic` (live data).
- CSV fetches inherit the same window via `fetchCsv`.
- Feeds: race-alerts `force-dynamic`, others ISR 300.
- Steward routes: dynamic (auth-gated), attachments `no-store`.
- **No service worker / offline cache exists yet.**

---

## 8. Internationalization

- `next-intl` with message catalogs under `messages/{en,he}/` (namespaces: common, home, drivers, schedule, stats, news, forms, errors, rewards, stewards).
- **Language is decoupled from logic:** stats metric keys, award codes, and news categories key on stable IDs; display labels come from catalogs (the "ID/label split"). Metric names intentionally stay English; awards/categories are translated.
- RTL: `dir` on `<html>`; components use **logical properties** (`ms-/me-/ps-/pe-`, `border-s/e`, `inset-inline-*`). Numerals use `.num`/`.tabular` (Spline Sans Mono, LTR-isolated via `unicode-bidi: isolate`) so scores/timings stay correct in Hebrew.
- Fonts swap per language (Latin: Oswald/Public Sans/Spline Mono; Hebrew: Heebo/Assistant).
- **Known RTL gotcha:** `.num` forces LTR, which breaks logical start/end insets in Hebrew — use flex, not absolute positioning, for numeric elements.

---

## 9. PWA (current state — PW-1)

- `public/site.webmanifest` — F1ISL dark+gold identity (`name`, `short_name`, `description`, `theme_color`/`background_color` `#0f1113`, `scope`, `display: standalone`, `categories: ["sports"]`). Icons: `android-chrome-192/512`, `apple-touch-icon`, favicons.
- **Service worker:** `public/sw.js`, registered by `components/ServiceWorkerRegister.tsx` (**production-only** — off in dev to avoid stale-cache confusion). Strategy: navigations **network-first** → cache → `/offline.html`; `/_next/static/*` **cache-first**; other same-origin GET network-first with cache fallback; **cross-origin (Sheets CSV, font CDNs, GA) not intercepted**. Versioned caches (`f1isl-v1-*`) with activate-time cleanup + `skipWaiting`/`clients.claim`, so a new deploy takes over immediately and dynamic league data never goes stale.
- **Offline fallback:** `public/offline.html` — standalone branded (inline hex, since a SW-served page can't read app CSS vars), bilingual message.
- **Metadata:** `viewport` export (`themeColor #0f1113`, `viewportFit: cover` for safe areas) + `appleWebApp`/`applicationName` in `app/layout.tsx`.
- **Not yet:** custom install prompt UI, maskable/splash icon set, push (push is PW-4). Installability criteria (manifest + HTTPS + fetch-handling SW) are now met.

---

## 10. Deployment

- Netlify: `command = "npm run build"`, `publish = ".next"`. Next.js runtime adapter handles SSR/ISR.
- `netlify.toml`: 301s from `psgil.com`/`www` → `f1isl.com`; secrets-scan allowance for public `2PACX-*` Sheet URLs.
- CI (`.github/workflows/ci.yml`) runs `tsc --noEmit` (hard) + `lint` (non-blocking; ~36-error pre-migration baseline). **`next build` is intentionally not run in CI** (it fetches live CSV at prerender → network-flaky); the build happens on Netlify.
- Required prod env: `GMAIL_APP_PASSWORD`, `NEWS_SHEET_URL`, `STEWARD_SESSION_SECRET`, `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_GA_ID`; optional `REWARDS_SHEET_URL`, `STATS_EXPORT_API_KEY`.

---

## 11. Open security & quality items (audit 2026-07-05)

| # | Severity | Item | Location | Status |
|---|---|---|---|---|
| 1 | **HIGH** | Missing `STEWARD_SESSION_SECRET` in prod silently uses known dev secret | `lib/stewards/auth.ts` | ✅ **Fixed (PW-0)** — `secret()` now throws in production instead of falling back |
| 2 | MED | File uploads: no MIME/extension allowlist, no per-file size cap (only 20 MB action-body limit) | `app/stewards/actions.ts` `saveAttachments()` | ✅ **Fixed (PW-0)** — 10 MB/file cap + type allowlist, validated before any write |
| 3 | MED | `view_internal_discussion` enforced at render, not at data fetch | `repository.ts` / `auth.ts` | Open |
| 4 | MED | Contact rate-limiter is in-memory (resets on cold start; not cross-instance) | `app/api/contact/route.ts` | Open |
| 5 | LOW | Several `next/image` uses set `unoptimized` for remote images | multiple components | Open |
| 6 | LOW | Lint baseline ~36 errors; lint is non-blocking in CI | CI | Open |

---

## 12. Doc drift (reconcile deliberately)

- `docs/design-spec.md` + `docs/design-system-migration.md` describe a **light "Motorsong Editorial"** theme. The site **shipped dark "Race Control" broadcast** (charcoal + gold). The design docs are historical; **DESIGN_SYSTEM.md is the current visual truth.** CLAUDE.md now points to the canonical docs and flags `docs/*` as historical (PW-0).
- `lib/statsInsights.ts` (referenced in older notes) **does not exist**; CLAUDE.md §7 already records this. No action outstanding.
- `docs/implementation-roadmap.md` Phases 0–10 describe the **completed** rebrand/redesign/i18n effort. Its phase numbering is unrelated to (and predates) the PROJECT_VISION.md phases. To avoid collision, **platform-evolution work uses the PW-0…PW-5 roadmap in the decision log, not the vision's phase numbers.**

---

## 13. Architectural decisions log

| Date | Decision | Rationale |
|---|---|---|
| 2026-07-01 | Rebrand/redesign/i18n governed by `docs/migration-principles.md` (preserve functionality, refactor before rewrite, always deployable) | Risk-minimized, stop-anywhere migration |
| ~2026-07 | Design pivoted light-editorial → **dark broadcast "Race Control"** | Brand direction (superseded original spec) |
| 2026-07 | i18n via ID/label split (language decoupled from logic) | Translation as infrastructure, not a `t()` bolt-on |
| 2026-07 | Steward portal stays unprefixed; per-user locale | Preserves email deep-links |
| 2026-07-05 | **Platform evolution roadmap = PW-0…PW-5** (Stabilize → PWA shell → Identity → Attendance → Notifications → Mobile polish). Renumbered from PROJECT_VISION.md's Phase 1–8 to avoid collision with the shipped rebrand Phase 0–10. | Dependency-honest ordering (identity before attendance; SW before push); adds the security/hardening prereq the vision omitted |
| 2026-07-05 | **Public identity = extend the existing steward auth** (generalize JWT + scrypt + `PERMISSION_MATRIX` into one account model; add `registered_user`/`driver`/`team_manager`; link account ↔ CSV `driver_id`). **Not** a third-party auth (Auth.js/Clerk/Supabase). | "One authentication system"; reuse proven code; no new external dependency. **Consequence:** high-write collections (accounts, attendance) must move off the monolithic single-blob store to per-record keys or a real datastore — the steward case store stays as-is. |

| 2026-07-05 | **PW-0 (Stabilize) implemented.** `STEWARD_SESSION_SECRET` now hard-fails in prod; steward upload validation (10 MB/file + type allowlist); `site.webmanifest` corrected to F1ISL dark+gold; CLAUDE.md points to canonical docs. | Sound base before Identity/PWA; closes the HIGH security gap |

| 2026-07-05 | **PW-1 (PWA shell) implemented.** Hand-rolled service worker (no `next-pwa`/Serwist dependency), network-first navigation + offline fallback, prod-only registration, PWA/viewport metadata. | Full control of the freshness policy; avoids a build-integration dependency on Tailwind v4 / Next 16 |
| 2026-07-05 | **PW-2a (Identity foundation) implemented.** Unified `Account` model in `lib/accounts/`; per-record account store (per-key Blobs / dev file) behind a swappable repo; steward users migrated in; `zod` added for account input. Roles gain `driver`/`registered_user`; **`team_manager` dropped** (not needed). | One account model, no monolithic-write clobbering for future high-write collections; reuse existing JWT/scrypt |
| 2026-07-05 | **PW-2b (public accounts) implemented.** `lib/auth/` (session helpers, purpose-scoped verify/reset tokens, mailer with dev fallback, zod schemas, server actions); routes register/login/account/verify; `Input`/`Label` primitives; Header account menu; `account` i18n namespace (en + he). Verified end-to-end in dev. | Reuse steward JWT/scrypt/nodemailer; one auth system; public site stays fully public |
| 2026-07-05 | **Nav restructure + steward access gate.** "My Account" is the single hub (Profile / Stewards / future driver areas); Stewards left the top nav. `requireStewardUser()` now gates on the `view_steward_area` role, so a signed-in non-steward is redirected to `/account`. Added `driver`/`registered_user` role labels to steward catalogs. | Stewards is a sub-module under the account; public accounts must not reach the steward shell just by being logged in |
| 2026-07-05 | **Identity v2 (plan refinement — not yet built).** Registration → **pending** (can log in, email-verify, but sees only "awaiting approval"); **admin approval** grants access and, **by default, the `driver` role**; email verification kept as a separate gate. **Drivers = accounts with driver permission** and become the steward module's participant set (`member` migrates to `driver`; `view_steward_area` gains `driver`). **Account administration moves out of the steward module** to a platform admin console under "My Account". **Driver photo upload** overrides the CSV `photo_url`. See [docs/pw-2-identity-design.md](./docs/pw-2-identity-design.md) §13–14. | Admin-gated membership; unify driver identity with participation; account admin is a platform concern, not a steward one |

> **Implementation status (2026-07-05):** PW-0, PW-1, PW-2a, PW-2b done — then **refined to Identity v2**, which adjusts PW-2b (approval/pending) and the steward driver source. **Revised remaining phases:** PW-2c (approval + platform admin console) → PW-2d (steward↔driver-account integration) → PW-2e (driver profile & photo) → PW-2f (reset password) → PW-3 Attendance → PW-4 → PW-5. Nothing from Identity v2 is built yet.

*Last audited: 2026-07-05.*
