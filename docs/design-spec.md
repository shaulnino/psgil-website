# F1 Israeli Super League — Design Specification

> Client-provided target design language ("Motorsong Editorial"), committed to the repo as the canonical reference for the redesign. The migration plan in [design-system-migration.md](./design-system-migration.md) maps the current UI onto this spec.

## 1. Design Direction — "Motorsong Editorial"
A fusion of racing-poster boldness (Barlow Condensed, tabular timing data, hairline gold accents) and editorial restraint (cream paper background, generous whitespace, ink typography). The feel: a printed race programme from a European GP weekend — not neon, not gaming, not tech-bro. Ink on cardstock, with gold as the single luxury accent.

Core tensions:
- Cream + Ink, not white + black. Warmer, more premium.
- Condensed display type + monospace numerals — like a timing tower.
- Hairline gold — never fills, only 1px lines and small accents.
- Sharp 2px corners — this is a poster, not an app.

---

## 2. Color System (exact tokens)

| Token | Hex | Usage |
|---|---|---|
| `--bg` | `#ffffff` | Primary page background (paper white) |
| `--bg-alt` | `#f6f1e6` | Warm cream — section bands, cards, alt surfaces |
| `--ink` | `#151515` | Primary text, headings, buttons |
| `--ink-2` | `#2a2a2a` | Secondary text |
| `--muted` | `#6b6b6b` | Meta labels, captions, timestamps |
| `--gold` | `#c0973f` | Single accent — hairlines, eyebrows, focus rings, dividers |
| `--gold-ink` | `#8e6e26` | Darker gold for text on cream |
| `--hairline` | `rgba(21,21,21,0.12)` | Default 1px borders |
| destructive | `oklch(0.55 0.22 27)` | Deep red — errors only |

Rules:
- Never pure black `#000` (except iOS safe-area filler). Ink is `#151515`.
- Gold is accent only — never fill buttons, cards, or large surfaces with it.
- No gradients. No shadows (or ultra-subtle only).
- Selection: gold background, ink text.

---

## 3. Typography

### Font families
| Role | Family | Weights |
|---|---|---|
| Display LTR (H1–H4) | **Barlow Condensed** | 700 / 800 |
| Display RTL (Hebrew) | **Heebo** | 800 |
| Body LTR | **Inter Variable** | 400 / 500 / 700 |
| Body RTL (Hebrew) | **Heebo** | 400 / 500 / 700 |
| Numerals / timing / stats | **JetBrains Mono** | 400 / 500 / 700 |

### Rules
- Headings: `letter-spacing: 0.01em`, `line-height: 1.05`, weight 700–800.
- Hebrew headings auto-swap to Heebo 800, letter-spacing `0`.
- Numbers (points, times, positions, dates, countdowns) always use `.num` / `.tabular` → JetBrains Mono, tabular-nums, letter-spacing `-0.02em`.
- Body: Inter Variable, antialiased, `text-rendering: optimizeLegibility`.
- No italics. No serifs. No decorative fonts.

### Type scale
| Element | Size | Weight |
|---|---|---|
| Hero display | `clamp(3rem, 8vw, 6.5rem)` | 800 |
| H1 | 3rem / 48px | 700 |
| H2 | 2.25rem / 36px | 700 |
| H3 | 1.5rem / 24px | 700 |
| Eyebrow (gold, uppercase, tracked) | 0.75rem, `letter-spacing: 0.2em` | 500 |
| Body | 1rem / 16px, line-height 1.6 | 400 |
| Caption / meta | 0.8125rem / 13px, `--muted` | 400 |

---

## 4. Layout & Spacing

- Container: max-width `1240px`, `padding-inline: 1.25rem`, centered.
- Border radius: `2px` everywhere. Sharp, poster-like.
- Section rhythm: `py-16` mobile → `py-24` desktop.
- Alternate `--bg` (white) and `--bg-alt` (cream) bands for vertical rhythm.
- Safe-area black filler for iOS status bar.
- Mobile bottom-nav adds `pb-[calc(80px+env(safe-area-inset-bottom))]` to main.

---

## 5. Lines, Dividers, Signature Moves

Hairlines are the identity — 1px only.
- `.hairline-gold-top` → 1px gold top border
- `.hairline-gold-bottom` → 1px gold bottom border
- Default borders: `var(--hairline)` (12% ink)

### Angled clips (chicane cue) — use sparingly
- `.angled-cut-bottom` → `clip-path: polygon(0 0, 100% 0, 100% calc(100% - 28px), 0 100%)`
- `.angled-cut-top` → `clip-path: polygon(0 28px, 100% 0, 100% 100%, 0 100%)`

### Speed lines background
`.speed-lines` — two layered `repeating-linear-gradient` at 115°, gold at 6% and 4% opacity. Subtle backdrop for hero panels or empty states.

---

## 6. Motion

Only four keyframes, all subtle:
- `f1-rise` — 14px up + fade, 0.7s, `cubic-bezier(0.2, 0.7, 0.2, 1)`
- `.f1-rise-2 / -3 / -4` — same, staggered 80 / 160 / 240 ms
- `f1-tick` — opacity 0.55 → 1 (countdown pulse)
- Respect `prefers-reduced-motion` — disable all.

No parallax, no scroll-jack, no big transitions. Content lands, that's it.

---

## 7. Components (shadcn "new-york", customized)

- **Buttons**: sharp 2px corners; primary = ink fill / paper text; ghost = ink text with gold hairline on hover.
- **Cards**: cream background, 1px hairline border, no shadow.
- **Tables (results, standings)**: monospace numerals, alternating row tint at 3% ink, gold 1px top border on `<thead>`.
- **Badges**: uppercase, tracked, small — ink outline or gold hairline.
- **Focus ring**: `2px solid var(--gold)`, offset `2px`. Global on `:focus-visible`.

---

## 8. Iconography

- Lucide only. Stroke width 1.5–2. Ink color. Never colored fills.
- Use sparingly — this design leans on typography, not icons.

---

## 9. Imagery

- Team logos on cream cards, 1px hairline frame.
- Photography: high-contrast editorial B&W or desaturated color. No stock racing shots.
- Avoid drop shadows on images — use hairline frames instead.

---

## 10. RTL / Bilingual

- `dir="rtl"` on `<html>` when Hebrew.
- Hebrew body → Heebo; Hebrew display → Heebo 800 (auto via `html[dir="rtl"] .font-display`).
- Numerals stay LTR/monospace regardless of language.
- Layouts mirror via Tailwind logical properties (`ps-*`, `pe-*`, `start-*`, `end-*`).

---

## 11. Do / Don't

**Do**
- Cream + ink + one gold hairline.
- Barlow Condensed display, JetBrains Mono numbers.
- 2px radius, 1px borders.
- Alternate white/cream section bands.
- Editorial whitespace.

**Don't**
- Pure black, purple/indigo, neon, gradients.
- Rounded pills, drop shadows, glassmorphism.
- Sans-serif numerals in tables/timing.
- Icons doing the work of typography.
- Any font outside Barlow Condensed / Inter / Heebo / JetBrains Mono.

---

## 12. CSS Variables — Copy Block

```css
:root {
  --bg: #ffffff;
  --bg-alt: #f6f1e6;
  --ink: #151515;
  --ink-2: #2a2a2a;
  --muted: #6b6b6b;
  --gold: #c0973f;
  --gold-ink: #8e6e26;
  --hairline: rgba(21, 21, 21, 0.12);

  --font-display: "Barlow Condensed", "Heebo", system-ui, sans-serif;
  --font-sans: "Inter Variable", "Heebo", system-ui, sans-serif;
  --font-hebrew: "Heebo", "Inter Variable", system-ui, sans-serif;
  --font-mono: "JetBrains Mono", ui-monospace, monospace;

  --radius: 2px;
}
```
