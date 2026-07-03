# Manual Smoke Checklist

Use this checklist after each migration phase (see [implementation-roadmap.md](./implementation-roadmap.md)) to reduce regression risk. It covers every real route plus a steward lifecycle. Bilingual note: once Phase 9 lands, run the public sections in **both** `/en` and `/he` and confirm RTL layout.

## Preconditions

- Install dependencies: `npm install`
- Start dev server: `npm run dev`
- Use a fresh browser tab to avoid stale UI state

## Public routes

### 1) Home (`/`)
- Page loads without errors.
- Header navigation renders and links work.
- Main home widgets/cards render (race widgets, next/last race areas, standings snapshot, news carousel).

### 2) Drivers (`/drivers`)
- Drivers page loads with cards/list visible.
- Search/filter interactions work.
- Clicking a driver opens the driver modal.

### 3) Driver Modal (from Drivers / tables links)
- Modal opens and closes (close button, backdrop, Escape).
- Driver details, rating bars, and achievement medals render.
- "Full Driver Stats" link navigates to the stats page.

### 4) Schedule & standings (`/schedule`)
- Schedule renders grouped race/event content; season switching works.
- Standings tables (drivers main/wild, constructors) render here.
- Driver links in tables open the driver modal; P1/P2/P3 row highlighting appears.
- Race detail popups/modals open where applicable.

### 5) Statistics (`/statistics`)
- Historical stats render (drivers, circuits, league aggregates).
- Season/category filtering works.

### 6) Stats dashboard (`/stats`)
- Tabs switch correctly; driver select/compare controls work.
- Charts and tables render without runtime errors.
- H2H filters and race-row modal interactions work.

### 7) News (`/news` and `/news/[slug]`)
- News hub lists articles by category; carousel advances.
- An article page opens, renders body/prose, YouTube embeds, and any race recap/preview widgets (standings/results).
- "Back to news" and related-article links work.

### 8) Contact form (on `/`)
- Both modes (Sign Up / Question) render their fields.
- Submitting a valid form shows the success modal; a test email arrives.
- Honeypot/validation errors surface correctly.

### 9) Privacy (`/privacy`)
- Static policy page renders with a single h1.

### 10) Feeds (machine consumers — verify XML is well-formed)
- `/news/rss.xml`, `/rss/race-alerts.xml`, `/rss/articles-instagram.xml`, `/rss/race-alerts-instagram.xml` all return valid XML with current data.

## Steward portal (`/stewards`) — full lifecycle

Log in with a steward account (dev seed users are created on first run).

- **Auth:** login works; unauthenticated access to a protected route redirects to `/stewards/login`; forced password-change flow works for a `mustChangePassword` user; logout works.
- **Case lifecycle:** create a complaint (with evidence) → responds/records → add an internal comment → draft and publish a verdict with per-driver penalties → confirm the case status transitions (Open → … → Closed).
- **Penalties:** a published verdict that crosses a threshold generates a penalty-to-serve; the penalties-to-serve queue shows correct statuses; mark served / roll forward works.
- **Appeals:** file an appeal within the window; add internal discussion; publish an appeal verdict; confirm it overrides the original penalties.
- **Admin:** create/edit a user and update roles (admin only); attachment download works.
- **Statuses:** every case/penalty/appeal status is distinguishable (post-redesign: by shape + label + position, not color alone).

## Verification gate (required after each phase)

- **Type-check:** `npx tsc --noEmit` — no errors.
- **Lint:** `npm run lint` — no new failures.
- **CI:** the GitHub Actions workflow (`.github/workflows/ci.yml`) runs type-check + lint on every PR; it must be green before merge.
- **Build:** production build runs on Netlify at deploy. Only run `npm run build` locally when explicitly verifying a deploy (it fetches live CSV during prerender and is slow).
- **Visual (redesign phases):** compare against the screenshot baseline for the affected routes, desktop and mobile.
