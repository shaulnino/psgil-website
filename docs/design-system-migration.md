# Design System Migration Plan

> **Status:** Analysis + architecture only. Nothing has been implemented. This document expands Phase 2 ("Visual rebrand") of [migration-plan.md](./migration-plan.md) and is grounded in a repo-wide audit (21 agents, file/line-cited). The target design language is [design-spec.md](./design-spec.md) ("Motorsong Editorial"). It coordinates tightly with the multilingual work in [i18n-architecture.md](./i18n-architecture.md) — several workstreams are shared.

---

## 0. Executive Summary

The current UI and the target design are **near-opposites on every axis**. This is not a restyle — it is a rebuild of the token layer and a from-scratch component library, migrated behind it.

| Axis | Current | Target |
|---|---|---|
| Theme | Dark-only (`#0b0b0e` bg, white text) | Light "paper" (`#ffffff`/cream `#f6f1e6`, ink `#151515`) |
| Accent | Purple `#7020B0` fills + gold `#D4AF37` fills/glows | Gold `#c0973f` **hairlines only**, never fills |
| Depth | Gradients, glows, `backdrop-blur`, drop shadows | Flat. 1px hairlines. No shadow, no gradient, no blur |
| Corners | `rounded-full` pills, `rounded-2xl` (~584 rounded sites) | Sharp 2px everywhere |
| Display font | Rajdhani (gaming/techno) | Barlow Condensed (editorial) |
| Numerals | Proportional Inter/Rajdhani | JetBrains Mono, tabular |
| Motion | 10 keyframes incl. breathe/glow/sheen | 4 subtle keyframes (f1-rise/tick) |
| Direction | LTR-only, physical CSS props | Bilingual EN/HE, logical props, RTL-ready |
| Primitives | Effectively none (shadcn not installed) | shadcn "new-york" library |

Because there is **no shared primitive layer and no token layer** today, the single highest-leverage move is to build that foundation first, then migrate surfaces through it — so a restyle lands in one component, not across hundreds of call sites. The audit found ~250+ hardcoded color call sites, 1,224 white-opacity utilities, ~584 rounded-corner sites, and 148 raw `<button>` elements bypassing the one `Button` component. Migrating those by hand file-by-file is the debt; routing them through primitives is the exit.

**How the redesign satisfies the nine requirements** (the brief's success criteria):

| Requirement | How this plan delivers it |
|---|---|
| Modern | Flat editorial system, current type pairing, shadcn primitives |
| Premium | Cream/ink/gold restraint, hairlines, generous whitespace, no neon |
| Motorsport | Timing-tower mono numerals, chicane cuts, speed-lines, race-programme rhythm |
| Professional | One consistent primitive library, enforced tokens, no ad-hoc styling |
| Scalable | Token layer + CVA primitives; a new brand/theme is a token swap |
| Multilingual-ready | Shares the i18n message-catalog architecture; text never baked into styling |
| RTL-ready | Logical properties throughout; `dir` from locale; numerals LTR-isolated |
| Mobile-first | Rebuilt breakpoint strategy, bottom-nav, safe-area, fluid type |
| Desktop-first without compromises | 1240px container, full data-table density preserved, no feature loss |

The last two are in tension only if treated as an afterthought. The plan resolves it by making the **primitives responsive by construction** (the table, card, nav, and dialog each define their mobile and desktop behavior once) rather than retrofitting breakpoints per page — which is exactly what's wrong today (see §2.5).

---

## 1. Foundational Facts (from the audit)

Verified counts across `app/` + `components/` (~102 source files):

- **Color:** 68 files contain literal 6-digit hex. `#d4af37` ×207, `#7020b0` ×180, `#a855f7` ×21, `#cd7f32` ×12, `#c0c0c0` ×7, plus a long tail of dark-panel hexes. **1,224** white-opacity utilities (`bg-white/N`/`text-white/N`/`border-white/N`) encode the dark model structurally. Only **3** `var(--)` usages and **0** semantic token-classes in JSX. **36** gradients, **94** glow `shadow-[…]`, **21** `backdrop-blur`.
- **Radius:** `rounded-full` ×272, `rounded-lg` ×106, `rounded-2xl` ×101, `rounded-xl` ×73, `rounded-md` ×28. Exactly **one** element already uses the target `rounded-[2px]`.
- **Typography:** `.font-display` (Rajdhani) used 65× across 33 files. **No** JetBrains Mono loaded; **no** `.num`/`.tabular` utility exists; `tabular-nums` in only 4 files. `tracking-wider` ×123. ~202 uppercase eyebrow labels with 10+ different tracking values. ~18 distinct font sizes; `text-[10px]` ×91, `text-[11px]` ×43, `text-[9px]` ×13.
- **Motion:** 10 keyframes; `prefers-reduced-motion` honored in **one** scoped block only; `animate-spin`/`pulse`/`ping` ×6 each run unguarded.
- **Responsive:** 145 `md:` vs 37 `sm:` / 14 `lg:` / 1 `xl:` — a single-breakpoint desktop-retrofit signature. 45 of 90 `.tsx` files carry **zero** breakpoints. No mobile bottom-nav, no iOS safe-area handling, no `viewport` export.
- **Accessibility:** **0** global `:focus-visible` rules (`outline-none` ×30, 12 ad-hoc purple rings). **0** `role="dialog"`/`aria-modal` anywhere. **264** low-opacity white-text instances fail WCAG AA today *and* invert to invisible on paper. No skip link; **1** `sr-only` in the whole app; homepage skips h1→h3.
- **Components:** shadcn not installed (no `components.json`, no `cn()`, no CVA/clsx/tailwind-merge/lucide-react). `Button` imported by only 3 files; **148** raw `<button>` + **76** inline purple button sites bypass it. Card shell recurs in 12 files. **10** files re-implement the modal overlay. Steward input class copy-pasted ~41×. Three competing `Select` implementations.
- **Icons:** `lucide-react` absent; **75** hand-authored inline `<svg>` across 19 files; ~60 emoji used as functional icons.

---

## 2. Current-State Analysis (the 7 dimensions the brief asked for)

### 2.1 Outdated design patterns
The entire visual language is the 2020-era dark "gaming/esports" idiom the spec explicitly rejects: purple radial-gradient + diagonal-texture body background (`globals.css:24-38`), gold *glow* animations (`live-gold-flash` with `0 0 24px/48px` shadows), `backdrop-blur` glassmorphism (21 sites), breathing logo glow (`HeroLogo.tsx` purple `shadow-[0_0_45px…]` + `logo-breathe`), rounded pills everywhere, and drop-shadowed images. The `.stewards-ui` panels stack gradient + inset shadow + a `steward-gold-sheen` hover sweep — the single most "un-editorial" surface in the app.

### 2.2 Inconsistent components
The same visual thing is re-implemented divergently across files: the primary button look is hand-copied (e.g. `SuccessModal.tsx:114` reproduces `Button.tsx` verbatim); the gold pill badge recurs inline in ~9 files while only `NewsCategoryTag` is extracted; steward status-color maps (`STATUS_STYLE`/`STATUS_CHIP`) are re-declared in 4 files; three different selects exist (`SeasonSelector`, a private `SearchableSelect` inside the 3,940-line `StatsPageContent`, and native `<select>` in 14 files); two different tooltip implementations (`DriverModal` vs `AchievementBadges`); two different social-icon renderers (`SocialLinks` vs `Footer`).

### 2.3 Spacing inconsistencies
No shared `Container` — the wrapper `mx-auto w-full max-w-6xl px-6` (1152px/24px) is copy-pasted ~14 times and diverges from the target 1240px/20px. Section vertical rhythm has no dominant pair (`py-12/14/16/20` scattered; `py-24` appears once). `px-6` ×37 vs the target `px-5`. No alternating white/cream band system exists (the target cream `#f6f1e6` appears zero times).

### 2.4 Typography issues
Wrong display face (Rajdhani, 65 sites). No monospace numeral system at all — the two most number-dense tables (`StandingsTable`, `RaceResultsTable`) render points/positions in proportional Inter with no `tabular-nums`, so digits don't align. Heading tracking is backwards (`tracking-wider` ×123 vs the target 0.01em). Eyebrows have no single style (10+ tracking values, sizes from `text-[9px]`–`text-xs`, colored grey/white/purple, never a consistent gold). ~104 labels sit below the 13px caption floor.

### 2.5 Responsive issues
Desktop-first retrofit: one big `md:` collapse point, half the files fully static. Public standings tables are the strong spot (shared `ResultsTable` with `overflow-x-auto`, sticky frozen columns, `hideMobile`) — but the **stats module** (~13 `overflow-x-auto` wrappers with hard `min-w` pixel floors) and the **steward data tables** (7–8 always-visible columns, no column-hiding, no card reflow) force full-width horizontal scroll on phones. No mobile bottom-nav, no safe-area handling, hero uses stepped `md:` scaling instead of fluid `clamp()`.

### 2.6 Accessibility issues
No global focus style (and `outline-none` ×30 with several removing focus entirely); the 12 existing focus rings are purple (banned). Zero dialog semantics anywhere — every modal is a plain overlay div with no `role="dialog"`, `aria-modal`, focus trap, or (in `DriverModal`) Escape. 264 low-opacity white texts fail AA now and go invisible on paper. No skip link; near-zero `sr-only`; heading levels skip; 29 icon controls below the 44px tap target; `prefers-reduced-motion` covers only steward panels while infinite pulse/glow loops run for everyone else.

### 2.7 Reusable component opportunities
This is the biggest structural win. The audit identified a clear primitive set that would collapse hundreds of call sites: **Button, Card, Badge/StatusBadge, Dialog, Input/Textarea/Select, DataTable, Tabs, EmptyState, Tooltip, IconButton, Eyebrow, StatTile, Container, Section/Band, BottomNav, Social, EditorialImage/LogoFrame, PosChangeIndicator, Icon wrapper.** Several already exist as private functions trapped inside `StatsPageContent.tsx` (`TabBar`, `SearchableSelect`, `EmptyState`) and just need promoting.

---

## 3. Target Architecture

### 3.1 The token layer (single source of truth)
One `@theme` block in `app/globals.css` (Tailwind v4, no `tailwind.config.js`) defines the entire contract; every utility resolves through it and literal hex disappears from JSX.

```
--paper #ffffff · --cream #f6f1e6 · --ink #151515 · --ink-2 #2a2a2a · --muted #6b6b6b
--gold #c0973f (hairline/eyebrow/focus/divider ONLY) · --gold-ink #8e6e26 (gold text on cream)
--hairline rgba(21,21,21,0.12) · --destructive (deep red, errors only)
--radius 2px
--font-display (Barlow Condensed) · --font-sans (Inter) · --font-mono (JetBrains Mono) · --font-hebrew (Heebo)
```

Plus global rules authored **once** here: `:focus-visible { outline: 2px solid var(--gold); outline-offset: 2px }`, `::selection` (gold bg / ink text), the 4 approved keyframes (`f1-rise`, staggered variants, `f1-tick`), a **global** `prefers-reduced-motion` guard, and the `.num`/`.tabular`, `.hairline-t/-b`, `.gold-hairline-t/-b`, `.speed-lines`, `.chicane-*` utilities.

### 3.2 The primitive library (shadcn "new-york")
Initialize shadcn against the Tailwind v4 CSS-first path (no JS config), install `class-variance-authority` + `clsx` + `tailwind-merge` + `lucide-react`, add `cn()` to `lib/utils.ts`. Build primitives with CVA so variants live in one file:

| Primitive | Replaces | Notes |
|---|---|---|
| `Button` | `Button.tsx` + 148 raw `<button>` + 76 inline purple | primary=ink fill/paper text, ghost=ink+gold hairline, secondary=ink outline; supports `<a>` and `<button>`; no pill/glow/lift |
| `Card` | ~200 inline `rounded-2xl border-white/10 bg-white/5` shells | cream bg, 1px hairline, 2px, no shadow |
| `Badge` + `StatusBadge` | `NewsCategoryTag` fill + 9 inline pills + 4 steward status maps | uppercase tracked, ink-outline/gold-hairline, never filled; StatusBadge owns one status→variant map |
| `Dialog` | 10 overlay re-implementations + 6 steward modals | `role=dialog`/`aria-modal`/focus-trap/Escape/scroll-lock, cream panel, f1-rise, ink scrim (no blur) |
| `Input`/`Textarea`/`Select` | steward input string (×41), 3 competing selects | hairline border, gold focus ring, per-field `dir` policy; searchable Select re-backs `SeasonSelector` |
| `DataTable` (behind existing `ResultsTable` API) | dark table styling | gold 1px thead border, 3% ink alt-row tint, `.num` numerals, hairline frozen-column separation, real `<caption>`+`scope` |
| `Tabs`, `EmptyState`, `Tooltip` | private fns in `StatsPageContent`; 2 tooltip impls | promote/consolidate |
| `IconButton` | glyph/emoji close & toggle buttons | Lucide icon, required `aria-label`, 44px hit area |
| `Icon` wrapper | 75 inline SVG + ~60 emoji | Lucide, stroke 1.5–2, `currentColor`, `aria-hidden` |
| `Container`, `Section/Band` | ~14 copy-pasted wrappers; `Section.tsx` | 1240px/1.25rem; band=`paper`/`cream`, py-16→py-24, eyebrow slot |
| `BottomNav` | (new) | mobile, fixed, safe-area padded, gold hairline top |
| `Eyebrow`, `StatTile` | ~202 ad-hoc labels; font-display stat numbers | gold 0.2em label; label + `.num` display number |
| `Social`, `EditorialImage`/`LogoFrame`, `PosChangeIndicator` | dupe social renderers; scrimmed images; dupe ▲/▼ glyphs | monochrome ink; B&W + hairline frame; Lucide arrow + mono + a11y label |

---

## 4. Reconciled Decisions (resolving conflicts the audit surfaced)

These are cross-subsystem conflicts that must be decided once, up front, or the migration forks:

1. **One owner for the foundation.** A single "design foundation" PR owns the `globals.css` `@theme` block — tokens **and** fonts **and** radius **and** focus ring **and** keyframes **and** reduced-motion together. Three subsystems each wanted to edit this block; it must not be rewritten three times.
2. **`--destructive`, not `--error`.** shadcn "new-york" ships Button/Alert/Badge variants referencing `--destructive`. Adopt that name as canonical (map the spec's "deep red" onto it) so the primitives work unmodified.
3. **Force flat 2px; override shadcn's radius calc.** shadcn derives `sm/md/lg` from `--radius` via `calc()` offsets, so a 2px base yields 0/2/4px — *not* "2px everywhere." Explicitly override the radius scale so all variants resolve to 2px (the one exception: genuinely circular things like avatar dots).
4. **Icons inherit `currentColor`, never hardcode ink.** A Lucide icon on the ink-fill primary button must render in paper. The `Icon`/`IconButton` wrappers use `currentColor`; only standalone icons default to ink.
5. **Do NOT blind-alias `--color-steward-cream` → `#f6f1e6`.** `steward-cream` is used as *light text on dark* in `StewardNav`/`StewardNotifBadge`/file-input labels; aliasing it to near-white makes it invisible on paper. Aliasing `--color-steward-gold` → `--gold` is safe (it's an accent); `steward-cream` **text** usages must be intent-migrated to ink. This is the highest-severity trap in the migration.
6. **Reject the "global shim, migrate later" model.** Repointing `--background/--foreground/--muted` flips almost nothing (there are ~0 semantic token-classes in JSX); it leaves 1,224 white-opacity utilities and 431 hex lines rendering dark over a paper background — an incoherent half-inverted state. Instead migrate **route-by-route, each route fully flipped**, optionally scoping a migrated subtree with a `data-theme`/wrapper class so shipped pages are always coherent.
7. **`ResultsTable` sticky-cell color math is a landmine.** `STICKY_CELL_BG` pre-blends tints against the dark `#0B0B0E` base into opaque hex (`#1F1B12`, `#101013`) — invisible to a hex grep. If the background flips to paper while these stay, frozen columns render black bars over the most-viewed data on the site. Recompute against cream/paper (or use a solid cream token) **in the same PR** as the table's light migration.

---

## 5. Cross-cutting surfaces the visual work must not forget

The adversarial review caught these because they don't live in `components/`:

- **HTML email templates** (`app/api/contact/route.ts`, `lib/stewards/notifications.ts`) hardcode the dark/purple/gold design — gradient header bars, pill radii, purple CTA buttons, emoji, white-on-dark text. Email clients **cannot use CSS variables**, so these need a **separate inline-hex editorial palette pass** (they can't consume the token layer). They're also i18n targets — coordinate with [i18n-architecture.md](./i18n-architecture.md) §11.
- **Semantic status colors must survive the palette collapse.** Case (6 states), penalty (7 states), appeal, and schedule (Live/Postponed/Cancelled/Completed) statuses currently rely on *hue* to be distinguishable at a glance. An editorial one-accent palette can't encode 6 statuses by color. Design a `StatusBadge` that encodes state by **icon + uppercase label + position**, not hue — before collapsing the amber/emerald/blue/green vocabulary.
- **The "LIVE" affordance** currently *is* the infinite `live-dot-pulse`/`live-gold-flash` animation. Removing infinite loops (per the 4-keyframe budget) removes the signal. Re-express "live" with the allowed `f1-tick` pulse or a static filled-gold dot + label.
- **Recharts theming** (`StatsPageContent`) can't read CSS variables through className utilities — Recharts styles via JS prop objects. Build a **JS theme object** (mirroring the tokens, or read via `getComputedStyle`) and an **ink+gold+neutral categorical series palette** to replace the current purple/gold/neon compare colors on paper.
- **Error/loading/legacy surfaces** (`app/news/error.tsx`, `loading.tsx`, `app/stewards/(protected)/error.tsx`, `app/privacy/page.tsx`, `app/articles` redirect) carry dark styling and are real migration targets.
- **Print stylesheet.** An "editorial race programme" strongly implies print/PDF-friendly standings and schedules; add an `@media print` pass (none exists today).
- **`ScheduleList.tsx` (1,057 lines)** is the second-largest component and owns its own status vocabulary + 3 modals + zoomable poster + countdown — treat it as a first-class migration target, not a footnote.

---

## 6. Safety Net (currently absent — must be built first)

There are **no tests, no Storybook, no Playwright/Percy/Chromatic, and no `.github/workflows` directory at all.** A dark→light + de-purple + radius + font rewrite across 68 files has zero regression protection. Before the redesign lands:

1. **Screenshot baseline** of key routes (home, schedule, standings, drivers, stats, a steward page, a news article) captured on the *current* build, in both a desktop and mobile viewport.
2. **Minimal CI** (`.github/workflows`): `tsc --noEmit` + `lint` + a **grep guard** that fails on newly-introduced `#7020b0`/`#a855f7`/`#d4af37`/raw `bg-white|text-white|border-white` literals and physical directional utilities (`pl-`/`text-left`/…). The color subsystem assumed CI exists to host this guard — it does not; standing it up is itself net-new work.
3. **Visual-diff** on the baseline routes per PR once the foundation lands.
4. **ESLint guardrails** (ban physical directional utilities; `no-literal-string` for JSX text per the i18n plan) — added *after* the initial migrations so they don't fail on pre-migration code.

---

## 7. Phasing

Sequenced so each step ships a coherent site, and so it dovetails with the multilingual phase rather than colliding with it.

**Phase A — Safety net & spike.** Screenshot baseline + minimal CI (§6). Spike shadcn init on Tailwind v4 to confirm it does **not** write a `tailwind.config.js` (would violate the project invariant) — this is a P0 critical-path risk since every primitive depends on it.

**Phase B — Foundation PR (single owner).** Rewrite the `globals.css` `@theme`: full editorial token set, font tokens, `--radius` (with shadcn calc override), global gold focus ring, `::selection`, the 4 keyframes, global reduced-motion, and the `.num`/hairline/speed-line/chicane utilities. Load Barlow Condensed + JetBrains Mono + Heebo (Hebrew subset) via `next/font`; remove Rajdhani. Add `Container`. This is the anti-flag-day base everything migrates against.

**Phase C — Primitives.** Build in dependency order: `Button` → `Card` → `Badge`/`StatusBadge` → `Input`/`Textarea`/`Select` → `Dialog` → `DataTable` (needs `.num`) → `Tabs`/`EmptyState`/`Tooltip`/`IconButton`/`Icon`/`Eyebrow`/`StatTile`. Each with CVA + `cn()`, responsive-by-construction, RTL-safe (logical props), a11y-complete (focus/roles/labels/44px). The accessible `Dialog` and global focus ring alone close most of the a11y gaps.

**Phase D — Surface migration, route-by-route, each fully flipped.** Order: shell (Header/Footer + new BottomNav + safe-area) → homepage → tables (ResultsTable sticky-bg fix lands here) → drivers → schedule (`ScheduleList`) → stats (largest white-opacity cluster + Recharts JS theme) → news/prose → steward module (retire the bronze palette + `.stewards-ui` block; add the `StatusBadge` encoding). Migrate hex/white-opacity/radius via the primitives so most call sites collapse.

**Phase E — Imagery, motion, polish.** Editorial B&W/desaturate + hairline frames (kill scrims/drop-shadows), `HeroLogo` de-glow, `next.config.ts` AVIF/WebP + sizes, remove the 9 off-spec keyframes, chicane/speed-line signature moves, print stylesheet, email-template editorial pass (separate inline-hex).

**Phase F — RTL + a11y hardening.** The **physical→logical CSS sweep** (121 sites) can land *with* Phase D (it's LTR-safe, no behavior change) — recommended. The **`app/[locale]` route restructure** (moving `<html>` + every public route) is gated to the multilingual phase in [i18n-architecture.md](./i18n-architecture.md) to avoid re-touching every layout twice. Final: contrast verification on paper/cream, skip link, heading order, keyboard/SR pass, enable ESLint guardrails.

---

## 8. Sequencing Risks (the coordination hazards)

- **Visual rebrand vs `[locale]` restructure.** These touch the same layout/root files. Resolution: logical-property sweep rides with the visual work; the `[locale]` move is a distinct, later phase. Do **not** let the visual work land against the flat route tree and then re-do it under `[locale]`.
- **Rebrand-copy vs token-migration double-churn.** This is also a rebrand (all "PSGiL"/`psgil.com`/brand copy changes) and, if multilingual ships, ~500 strings get extracted. The design migration edits the same ~68 files for hex/radius. Plan color-migration and string-extraction as **coordinated per-file passes** (ideally one PR per file touching both), not two independent sweeps over the same files.
- **`StewardUser.locale` is a schema change.** The i18n plan assumes this field; it doesn't exist. Adding it touches `lib/stewards/types.ts`, `seed.ts`, the repository, the admin/profile UI, **and** requires a migration/default for existing users in the Netlify Blobs store. Cost it explicitly.
- **shadcn init failure blocks everything.** If init writes a `tailwind.config.js` or a `components.json` pointing at one, it breaks the "no config" invariant and blocks the entire primitive layer four subsystems depend on. Hence the Phase A spike.
- **Reduced-motion interleave.** Deleting the steward-scoped reduced-motion block and adding the global one must be one coordinated edit, or steward panels animate unguarded in the gap.

---

## 9. Open Decisions (need a stakeholder answer)

- **Incremental scoping mechanism:** ship the redesign route-by-route behind a `data-theme` wrapper (site stays half-old/half-new but each page coherent), or hold the redesign on a branch and cut over all at once against the baseline? Recommend route-by-route for reviewability.
- **Team livery colors:** the spec is one-accent editorial, but F1 team liveries (Ferrari red, Mercedes teal, etc.) are meaningful. Keep them as a 1px hairline / small dot accent only, or drop them to ink? Recommend hairline/dot.
- **Photography:** the spec mandates B&W/desaturated editorial imagery and "no stock racing shots" — confirm the league has (or will produce) suitable original photography, since current event/driver imagery is color.
- **Achievement medals:** confirm the bespoke medal SVGs (`AchievementBadges`) may be re-expressed as outline-ink/gold (keeping the award_code→icon semantic mapping) rather than the current metallic/purple/blue/green fills.
- **shadcn adoption depth:** full shadcn "new-york" primitive set, or a hand-built minimal set following the same token/CVA pattern? Recommend shadcn for the a11y/maintenance leverage, given the Phase A spike passes.

---

*Grounded in a repo-wide audit of the state as of 2026-07-01. Coordinates with [migration-plan.md](./migration-plan.md) (Phase 2) and [i18n-architecture.md](./i18n-architecture.md) (shared RTL/logical-property and copy-extraction work). Target language: [design-spec.md](./design-spec.md).*
