# DESIGN_SYSTEM.md — F1ISL

> **Status:** Living visual reference. Documents the design system **as shipped** (audited 2026-07-05): the dark "Race Control" broadcast identity. When reusable UI changes, update this file.
>
> **This supersedes** `docs/design-spec.md` and `docs/design-system-migration.md`, which describe an earlier *light editorial* direction that was pivoted away from. Where they conflict, this file wins.
>
> There is **one** F1ISL design system. The website and the installed PWA present the same system — the PWA is not a separate visual language.

---

## 1. Brand philosophy

**"Race Control" broadcast.** Dark charcoal foundation, a single restrained metallic **gold** accent, sharp 2px corners, no gradients or glow on content (atmosphere only in the page background). The feel is an F1 broadcast graphics package / timing tower — precise, editorial, quiet. Meaning is carried by **shape + label + position**, with hue as confirmation only (so the UI survives grayscale, print, and color-blindness).

Internal codename in the CSS: **"Qav Rishon"** (ISL tokens are prefixed `--isl-*`).

---

## 2. Design principles

1. **One accent.** Gold is the only brand hue. Status colors (success/warning/danger/info) exist but are secondary and always paired with an icon + label.
2. **Shape-first semantics.** A `StatusBadge` reads correctly with no color (icon + text). Never encode meaning in hue alone.
3. **Flat, sharp, editorial.** `--radius: 2px` everywhere. No shadows/glows on components; the only atmosphere is a single fixed page-background layer.
4. **Tokens are the single source of truth.** Components never hardcode hex — they consume `--isl-*` tokens (exposed as Tailwind utilities via `@theme`). A rebrand is a one-file token swap.
5. **Logical properties for RTL.** Use `ms/me`, `ps/pe`, `border-s/e`, `inset-inline-*`. Physical `left/right` only where a motif must not mirror (e.g. corner-tick brackets).
6. **Primitives over ad-hoc UI.** Every visual pattern lives in `components/ui/`. Compose primitives; don't restyle per page.

---

## 3. Color palette (tokens, `app/globals.css`)

Defined as CSS variables and exposed as Tailwind color utilities through `@theme inline`.

### Surfaces (dark)
| Token | Hex | Use |
|---|---|---|
| `--isl-bone` | `#0f1113` | Primary page background (charcoal) |
| `--isl-paper` | `#171a1e` | Raised surface — table bodies, panels |
| `--isl-cream` | `#1c2025` | Card fill, alternating band |
| `--isl-sink` | `#0a0b0d` | Recessed wells — table headers, disabled |
| `--isl-void` | `#060606` | Atmosphere base |

### Ink (light on dark)
| Token | Hex | Use |
|---|---|---|
| `--isl-ink` | `#f3f1ec` | Primary text / headings |
| `--isl-ink-2` | `#cbc7bf` | Secondary text |
| `--isl-meta` | `#918c82` | Meta / captions (AA on charcoal) |
| `--isl-faint` | `#6a655c` | Tertiary / disabled |

### Accent — gold (single primary)
| Token | Hex | Use |
|---|---|---|
| `--isl-oxblood` → `--color-gold` | `#c9a24b` | Restrained metallic gold (primary accent) |
| `--isl-oxblood-deep` → `--color-gold-strong` | `#e2c274` | Brighter gold for hover |

> Historical note: the token is still named `--isl-oxblood` (from the earlier palette) but resolves to gold. The semantic alias `--color-gold` is the intended name for new code.

### Metals — earned/record/tier ONLY (never decorative)
| Token | Hex | Use |
|---|---|---|
| `--isl-brass` / `--isl-brass-ink` | `#b8934a` / `#d8b45f` | P1 / on-the-record |
| `--isl-silver-ink` | `#c2c6cc` | P2 |
| `--isl-bronze-ink` | `#cf9366` | P3 |

### Status (secondary; always icon + label too)
| Token | Hex |
|---|---|
| `--isl-success` | `#5fa457` |
| `--isl-warning` | `#d6a63c` |
| `--isl-danger` | `#e0584a` |
| `--isl-info` | `#5a9ab5` |

### Rules & chart ink
`--isl-hairline` `rgba(240,236,228,0.1)` · `--isl-hairline-strong` `rgba(240,236,228,0.22)` · `--isl-datum` `#9a9488` (non-semantic chart series).

> A `.isl-token-anchor` class references every token in a dead gradient so Tailwind's Lightning CSS doesn't tree-shake the custom properties (Recharts reads them via `getComputedStyle`). Don't remove it.

---

## 4. Typography

Loaded via `next/font` in `app/layout.tsx`; families selected by `lang`.

| Role | Latin | Hebrew |
|---|---|---|
| Display / masthead | Oswald (`.font-isl-display`) | Heebo |
| Body / UI | Public Sans (`.font-isl-body`) | Assistant |
| Numerals / timing | Spline Sans Mono (`.num`, `.tabular`) | Spline Sans Mono (LTR-isolated) |

- Hebrew pages swap **all** fonts to Hebrew families so headings read as one typeface (no Oswald/Heebo mix).
- Numerals always use tabular mono + `unicode-bidi: isolate` so tables/countdowns align and stay LTR inside RTL.
- Legacy Inter/Rajdhani remain loaded as fallback references only.

---

## 5. Spacing, grid, radius

- **Radius:** `--radius: 2px` (all variants resolve to 2px — sharp corners are a brand rule).
- **Spacing:** standard Tailwind scale; sections use `Section.tsx` rhythm (`py-14 md:py-20` page header; `py-12 md:py-16` standard; `py-6 md:py-10` compact).
- **Grid:** mobile-first; common patterns `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3/4/6`. Breakpoints: `sm 640 / md 768 / lg 1024 / xl 1280`.
- **Container:** page content is width-constrained and centered; `Section` provides the header/rule/index-tag scaffolding.

---

## 6. Primitive component library (`components/ui/`)

All CVA-driven, composed with `cn()`, token-only colors, 2px corners, logical properties.

| Primitive | Variants / API | Notes |
|---|---|---|
| **Button** | `variant: primary \| secondary \| ghost`, `size: sm \| md \| lg` | primary = gold fill + charcoal ink; secondary = gold hairline; ghost = ink + gold underline. Renders `<a>` or `<button>`. 2px gold focus ring. |
| **Card** | `stamped?`, `chamfer?`, `cornerTicks?` + `CardHeader/Content/Title` | default cream + hairline; `stamped` = brass hairline (on-the-record); `chamfer` = cut corners; `cornerTicks` = gold L-brackets. |
| **Badge** | `variant: ink \| brass \| oxblood \| danger` | outline only (no fill), uppercase, tracked. |
| **Eyebrow** | `tone: oxblood \| brass \| meta` | small uppercase tracked label above headings. |
| **StatTile** | `{label, value, sub?}` | timing-tower figure; value in `.num`. |
| **StatusBadge** | `icon: LucideIcon`, `tone: info \| warning \| success \| danger \| brass \| bronze \| muted` | **shape-first** — icon + label carry meaning, hue confirms. |

New reusable UI must be added here, not inlined per feature. A live gallery exists at `/design-preview`.

---

## 7. Composite components (selected)

- **ResultsTable** — generic table primitive: sticky header, horizontal scroll with N frozen columns (`horizontalStickyCount`), zebra rows, medal hairlines (brass/silver/bronze on `border-s`), tabular numerals. Used by public standings/results **and** steward tables — keep it token-adaptive.
- **StandingsTable / RaceResultsTable / TablesPageContent** — build on ResultsTable.
- **DriverModal / DriverCard / DriversGrid** — roster UI with rating breakdowns.
- **StatsPageContent** (large) — filter pills, Recharts bar/radar/line, H2H, leaderboards. Charts use a **JS theme object** reading `--isl-*` (Recharts can't read Tailwind classes).
- **Header / Footer / BottomNav** — shell; Header has `md:hidden` hamburger drawer.
- **NextRaceWidget / HomeRaceCards / ScheduleList** — live-race indicators (`f1-tick` pulse), LTR-isolated countdowns.
- **SuccessModal** — native `<dialog>` + confetti; the standard modal pattern.
- **AchievementBadges** — hand-drawn SVG medal ladder (Trophy/Plate/Lion/etc.), tiered gold/silver/bronze.

---

## 8. Motifs (CSS utilities, `globals.css`)

`.isl-gold-rule` (thin gold line + bright start tick) · `.isl-chamfer` / `.isl-chamfer-lg` (clip-path cut corners) · `.isl-corner-ticks` (L-brackets, physical-positioned so they don't mirror) · `.isl-hero-frame*` (cinematic broadcast frame) · `.isl-speed-lines` (115° gold hatch) · `.isl-global-bg` (single fixed page atmosphere: near-black + corner gold nebula + vignette + masked gold dust). Atmosphere lives **only** in the global background — never on content cards.

---

## 9. Icons

`lucide-react` for UI; hand-drawn inline SVG for award medals (`AchievementBadges.tsx`, `MEDAL_COLORS`). Social/footer icons are inline SVG with `currentColor`. No icon fonts, no emoji in UI chrome.

---

## 10. Motion

CSS only (no Framer Motion). Two sanctioned keyframes: `f1-rise` (entrance) and `f1-tick` (stepped live pulse). Global `@media (prefers-reduced-motion: reduce)` neutralizes all animation/transition. Spinners use Tailwind `animate-spin`.

---

## 11. States

- **Loading:** `LoadingLink`/`LoadingButton` (route transitions via `useTransition`, `aria-busy`), inline SVG spinners, `SeasonSelector` loader. Route-level `loading.tsx` on news.
- **Empty:** dashed-border panel with `.isl-speed-lines` + centered message (DriversGrid, TablesPageContent).
- **Error:** `StatusBadge tone="danger"`; client `error.tsx` boundaries (steward, news) with chunk-error detection + retry.
- **Missing:** no skeleton components yet (server-side Suspense instead).

---

## 12. Accessibility

- Status uses shape + label + position, not hue alone.
- Global `:focus-visible` gold ring; reduced-motion honored globally.
- Logical properties + language-specific fonts for RTL; tabular LTR-isolated numerals.
- Modals target focus trap / Escape / restore (native `<dialog>`).
- Contrast targets AA on charcoal (meta/faint tokens tuned for this).
- **Gaps to watch:** skip-link, tap-target audit (44px), and a full keyboard/SR pass are part of remaining hardening.

---

## 13. Responsive behavior

Single responsive tree (no separate mobile routes). Mobile-first utilities; Header collapses to a hamburger drawer at `<md`; tables switch to horizontal scroll with frozen columns; widgets reposition (bottom-right desktop / bottom bar mobile). The installed PWA should reuse this exact responsive system — no parallel mobile UI.

---

## 14. Design decisions log

| Date | Decision | Rationale |
|---|---|---|
| ~2026-07 | Dark "Race Control" broadcast, single gold accent | Brand direction; superseded light editorial spec |
| 2026-07 | 2px radius everywhere; token override of shadcn radius `calc()` | Sharp broadcast aesthetic as a hard rule |
| 2026-07 | Shape+label+position for status (color as confirmation) | Preserve steward status distinguishability without multi-hue palette |
| 2026-07 | `.num` LTR-isolation for all numerals | Correct alignment/direction in Hebrew RTL |

*Last audited: 2026-07-05.*
