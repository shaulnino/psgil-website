# UI Specification — "Qav Rishon" (The Racing Broadsheet)

> **Status:** Complete UI specification. No code has been written. This is the visual identity and component spec that plugs into the architecture already planned in [design-system-migration.md](./design-system-migration.md) and sequenced in [implementation-roadmap.md](./implementation-roadmap.md). The reference design ([design-spec.md](./design-spec.md), "Motorsong Editorial") was used as *inspiration only* — this is a distinct identity, not a copy of it or of any website.

---

## 0. How this identity was chosen

You asked for a *unique* identity inspired by the reference, not a copy. To avoid the trap of simply echoing the reference, five deliberately-divergent directions were designed from different creative anchors, scored by three independent judges (brand distinctiveness / product-function fit / bilingual-scalability), and the winner was synthesized with the strongest ideas grafted from the others.

| Direction | Idea | Result |
|---|---|---|
| **D2 — Qav Rishon (Racing Broadsheet)** | The league as a national newspaper of record | **Winner (204)** |
| D1 — Apex Timing | Dark pit-wall telemetry screen, phosphor-green | Runner-up (201) — its sector bars & delta chips were **grafted in** |
| D3 — Bauhaus Levant | Tel-Aviv White-City Mediterranean modernism | 194 — its shape-first status glyphs were **grafted in** |
| D5 — Podium Protocol | Broadcast podium ceremony | 193 |
| D4 — Circuit Cartography | The track map as the whole UI system | 189 — its neutral `--datum` chart-ink idea was **grafted in** |

The winner is a **light "paper of record"** broadsheet, not the dark telemetry screen — the judges favored it for premium restraint and print-grade data legibility, while its weakness (bars/deltas/statuses) was fixed by grafting the best instruments from D1 and D3. The result is one coherent identity, not a committee average.

---

## 1. Reading the reference — themes, language, and what we kept vs. changed

Before designing our own identity, here is what the provided reference actually *is*, distilled — and precisely where "Qav Rishon" stays faithful to its **spirit** while owning a **different body**.

**Recurring visual themes in the reference.** Printed-artifact restraint (paper, not screen); a single disciplined luxury accent used only as a hairline, never a fill; flat surfaces (no gradients/shadows/glassmorphism); timing-tower precision expressed through tabular monospace numerals; poster/masthead-grade display type; editorial whitespace and alternating tonal bands; sharp 2px corners.

**Its design language.** "Ink on cardstock" — warmth over sterile white, discipline over decoration, typography doing the work that icons and color do in lesser systems.

**Its typography.** Condensed display (Barlow Condensed) + monospace numerals (JetBrains Mono) + neutral body (Inter) + a Hebrew sans (Heebo).

**Its palette.** Cream `#f6f1e6` / ink `#151515` / a single never-filling gold `#c0973f`.

**Its component philosophy.** shadcn "new-york" primitives, cream cards with 1px hairlines, gold-hairline table headers, ink-fill buttons, uppercase tracked badges.

**Its page hierarchy.** Alternating white/cream bands, a 1240px container, editorial section rhythm.

**What we keep (the spirit):** premium restraint, flat surfaces, one disciplined primary accent, tabular timing numerals, editorial hierarchy, masthead-grade display type, 2px corners, the shadcn token+primitive architecture, and every one of the reference's stated *rejections* (no pure black, no purple/indigo chrome, no neon, no gradients, no rounded pills, no drop shadows, no glassmorphism, no sans-serif numerals, no gaming vibes).

**What we deliberately change (so it is its own identity, not a copy):**

| Axis | Reference ("Motorsong") | **Qav Rishon (ours)** |
|---|---|---|
| Metaphor | European GP race *programme* | National racing *newspaper of record* (masthead, dateline, filed archive) |
| Ground | Cream `#f6f1e6` | Bone newsprint `#F4EFE4` — grayer, more pigmented |
| Ink | Neutral `#151515` | Warm brown-ink `#1C1712` |
| Accent | Single gold `#c0973f`, never fills | **Two-role ink+metal system**: **oxblood `#7E2A1E`** (live/attention, may fill small marks) + **brass/silver/bronze** (record/earned/tier, 1px only) |
| Display type | Barlow Condensed (condensed sans) | **Zilla Slab** (a newspaper *slab-serif* masthead) |
| Body / mono | Inter / JetBrains Mono | **Public Sans** (civic/institutional) / **Spline Sans Mono** |
| Hebrew | Heebo (sans) | **Frank Ruhl Libre** (literary-newspaper *serif*) + Assistant — chosen Hebrew-first, not as a Latin afterthought |
| Signature line | Single gold hairline | **Asymmetric thin-over-thick double rule** with a single oxblood tick |
| Signature cut | Chicane clip + gold speed-lines | **Folded-page corner** + timing-tick ruler + brass **case-stamp frame** |
| Editorial voice | No italics allowed | Owns an **italic dateline & pull-quote** — a broadsheet has a voice a programme doesn't |

Nothing in our pigment, fonts, or graphic marks overlaps the reference. The connection is philosophical (premium editorial motorsport restraint), not visual.

---

## 2. The identity in one paragraph

**Qav Rishon** (קו ראשון — "the front row") stages the merged super-league as a **national racing broadsheet**: a masthead, a live dateline, and an archive of results *filed on the record*. Two rival grids merged — and you legitimize a merger by printing it. The surface is warm **bone newsprint** pressed with **brown ink**; the single voice of attention is **oxblood** (a printer's second ink, a stamped seal); **brass** is the archival metal reserved strictly for the earned and the filed. Onto that editorial base are grafted the most motorsport-legible instruments — **segmented sector bars** for ratings, **signed delta chips** for every change, **shape-first status glyphs**, and a **gold/silver/bronze medal ladder** — so the calm never costs data density. It is **bilingual by birth**: the English and Hebrew mastheads are equals.

**Tagline:** *One league, printed in ink. Every lap on the record.*

**Theme:** Light-first, single mode — a broadsheet has one press stock. Depth comes only from four flat tone steps + 1px rules; no dark twin (a future "night edition" would be a pure token swap, explicitly out of scope).

---

The remaining sections are the implementation-ready specification: color/foundations, typography, components, page hierarchy, motion/signature/imagery, and bilingual/RTL/accessibility. Every value is a token; a rebrand is a token swap.

---
## 3. Design Foundations & Color System

> *Qav Rishon — The Racing Broadsheet.* One press stock, one ink of attention, one archival metal. This section is the authoritative token contract: every color, its role, its verified contrast, and the strict rules that keep the broadsheet disciplined. It is single-mode, light-first — depth is four flat tone steps and 1px rules, never shadow or gradient. Consume it as the `@theme` layer in `globals.css` (Tailwind v4, no config file); shadcn `new-york` primitives resolve their variables from these tokens.

---

### 1. Theme mode contract

| Property | Value |
|---|---|
| Modes | **One.** Light-first, single "paper of record" theme. No dark twin. |
| Rationale | A broadsheet has one press stock. A single token set halves the QA matrix — no mode branching, no `dark:` variants. |
| Future night edition | Explicitly **out of scope.** If ever built, it is a pure token swap of this same contract — no new component code. |
| Depth model | Four flat surface tones (`--bg` / `--bg-alt` / `--bg-sink` / `--bg-paper`) + 1px rules. **No** gradients, drop shadows, glass, or blur. |
| Radius | Hard flat **2px** everywhere (`--radius-sm/md/lg` all resolve to `2px`). Only genuinely circular marks (avatar dot, live dot, hollow-circle glyph) are round. |

Because there is no dark mode, no token below carries a "dark behavior" column — every value is final. The one place a token's *usage* changes by surface is contrast-driven substitution (e.g. `--accent` → `--accent-deep` on darker grounds), documented per token.

---

### 2. Surface tones (the press stock)

Four solid steps. **All four are opaque solids, never opacity tints** — this is load-bearing: sticky/frozen table cells and pinned columns must paint an opaque ground, directly retiring the pre-blended `STICKY_CELL_BG` hex landmine in `ResultsTable.tsx`.

| Token | Hex | Role | Notes |
|---|---|---|---|
| `--bg` | `#F4EFE4` | Primary page background — warm bone newsprint. | The paper of record. Grayer/more pigmented than reference cream so it never reads as programme stock. |
| `--bg-paper` | `#FBF8F0` | Lightest surface — table bodies, inset panels, modal sheets, input fields. | The "fresh page" that lifts data off the bone band. Backs sticky cells opaquely. |
| `--bg-alt` | `#EAE2D0` | Alternate section band + card fill — toasted bone. | Bands alternate `--bg`/`--bg-alt` for vertical rhythm; cards are `--bg-alt` + hairline frame. |
| `--bg-sink` | `#DED4BF` | Recessed wells — `thead` rows, disabled fields, pinned-column gutter, zebra base. | The **hardest AA ground**; every status hue is verified against it. Frozen columns recompute against this token, never a dark bar. |

**Band rhythm rule:** sections alternate `--bg` → `--bg-alt` → `--bg` down the page (Header on `--bg`, Section wrappers toggle). Cards ("clippings") sit on whichever band with a `--bg-alt` fill + 1px `--hairline` frame.

---

### 3. Ink scale (text)

| Token | Hex | Contrast on `--bg` | AA verdict | Role |
|---|---|---|---|---|
| `--ink` | `#1C1712` | ~14.8:1 | AAA all sizes | Primary text, headings, masthead nameplate, primary button fill. Warm near-black brown-ink — never `#000`. |
| `--ink-2` | `#3A322A` | ~8.8:1 | AAA all sizes | Secondary text, body emphasis, table data values, chart axis labels. Clears AA on all three light surfaces. |
| `--muted` | `#6E6455` | ~4.7:1 | AA normal text | Meta, captions, datelines, timestamps, column sub-labels, placeholders. **On `--bg-sink` drops below AA for small text — substitute `--ink-2`.** |
| `--faint` | `#9A8E79` | ~2.4:1 | **Decorative / large only** | Tertiary/disabled text, watermark numerals, empty-state text, inactive tabs. **Never carries load-bearing info alone.** |

**Text-on-surface substitution table** (small text = <18px regular / <14px bold):

| Text token | on `--bg` | on `--bg-paper` | on `--bg-alt` | on `--bg-sink` |
|---|---|---|---|---|
| `--ink` | ✅ AAA | ✅ AAA | ✅ AAA | ✅ AAA |
| `--ink-2` | ✅ AAA | ✅ AAA | ✅ AA+ | ✅ AA |
| `--muted` | ✅ AA | ✅ AA | ✅ AA (borderline) | ⚠️ **use `--ink-2`** |
| `--faint` | large/decorative only across all grounds |

---

### 4. Accent — OXBLOOD (the single primary)

| Token | Hex | Contrast on `--bg` | Role |
|---|---|---|---|
| `--accent` | `#7E2A1E` | ~7.0:1 | **THE** single primary accent. Masthead rule tick, active tab underline, links, focus ring, section eyebrows, leading-position marker, live/hot indicator, sector-bar fill. |
| `--accent-deep` | `#5A1D14` | ~10:1 | Oxblood pressed darker — accent-as-text on `--bg-alt`/`--bg-sink`, plus hover/active states. |

**The oxblood hard rules (non-negotiable):**

1. **Lines, text, small marks, and thin fills ONLY.** Oxblood may fill a chip, an underline, a rule, or a ≤sector-bar segment. It may **never** flood a hero panel, **never** be a gradient, **never** be a glow.
2. It is the **only** color permitted to *fill* a small mark.
3. **Surface-aware substitution:** when oxblood is used **as text or a small mark on `--bg-alt` or `--bg-sink`**, switch to `--accent-deep` (base oxblood clears AA on `--bg` but not reliably on the darker wells). Oxblood *as a rule/underline/border* (non-text) may stay `--accent` on any ground.
4. **Never shares a component role with `--destructive`.** Links/active-state/live = oxblood; errors/penalties = destructive-red. They are visually distinct hues (see §7) and must stay role-separated.

```
Hover/active on interactive oxblood elements → --accent-deep.
Links: --accent, underline draws in on hover (a link becoming a rule), color → --accent-deep.
```

---

### 5. Archival metals — the medal ladder (quarantined)

Metals encode **permanence / earned / tier** — a role wholly distinct from oxblood's *live/attention*. They are **almost always a 1px line, never a fill adjacent to an oxblood fill.** All three text variants clear AA on `--bg`.

| Token | Hex | Contrast on `--bg` | Role |
|---|---|---|---|
| `--brass` | `#9C7A3C` | ~3.5:1 (large/line) | Support metal: the 1px frame around a filed/official element (published verdicts, masthead brass rule, `OFFICIAL RECORD` case-stamp) + **P1 / first-tier** medal metal. |
| `--brass-ink` | `#6F5628` | ~5.4:1 | Brass-toned **text** on light bands (award labels, `OFFICIAL RECORD` / `CHAMPION` eyebrows). |
| `--silver-ink` | `#5E5A52` | ~6.1:1 | **P2 / second-tier** medal metal (text + 1px frame). Never chrome. |
| `--bronze-ink` | `#7A4B28` | ~5.8:1 | **P3 / third-tier** medal metal + the "rolled-forward / historical" record tone. |

**Metal quarantine rules:**

- `--brass` at `#9C7A3C` is a **line/large-label metal only** — for small text use `--brass-ink`.
- Metals appear **only** in earned/record/tier/podium contexts (AchievementBadges, published verdicts, `OFFICIAL RECORD` stamps, medal ladder). A lint guard should flag any metal token used in generic chrome.
- **Medal tier is never encoded by hue alone.** The ladder is read by **frame metal + stamp label + count** together:

| Tier | Metal token | Stamp label | Count glyph |
|---|---|---|---|
| P1 | `--brass` frame | `CHAMPION` / `P1` | ● count |
| P2 | `--silver-ink` frame | `P2` | ● count |
| P3 | `--bronze-ink` frame | `P3` | ● count |

Reuses the existing `p1/p2/p3` gold/silver/bronze SVG styling in `AchievementBadges.tsx` — this is a re-pigment, not a rewrite.

---

### 6. Rules, chart ink, and the "best" data mark

| Token | Value | Role |
|---|---|---|
| `--hairline` | `rgba(28,23,18,0.14)` | Default 1px rule/border — warm ink at 14%. Workhorse divider for tables, cards, fields, column-gutter rules. Thin member of the double-rule. |
| `--hairline-strong` | `rgba(28,23,18,0.30)` | Emphasis rule — masthead underline, `thead` top border, active card edge. Thick member of the double-rule. |
| `--datum` | `#8A7E6A` | **Non-semantic** chart ink — the default Recharts series color and profile-strip line. The map's neutral pencil. |
| `--best` | `#6F5628` (= `--brass-ink`) | **Strictly lint-guarded, DATA-ONLY.** Session/overall-best marks in fastest-time cells. **Never chrome.** A build lint must confine `--best` to data cells. |

**The Double Rule (signature separator):** a 1px `--hairline` sitting **3px above** a 2px `--hairline-strong`, opened by a **single short `--accent` tick** at the inline-start. Appears under the masthead, above **every** table `thead`, and to open each section. On tables with **8+ columns**, add 1px `--hairline` column-gutter rules between column groups. Flat, hairline-only, no fills.

**Chart palette rule (Recharts JS theme):** background/unselected series use `--datum`; **oxblood is reserved ONLY for the single highlighted/selected trace.** Categorical fallback for 4+ series runs:

```
--datum (#8A7E6A) → --info (#2F5A6E) → --success (#3F6B3A) → --warning (#B07A1E) → --muted (#6E6455)
```

so series stay distinguishable without the accent doing double duty. Axis labels/ticks use `--ink-2`; grid lines use `--hairline`.

---

### 7. Status color system

Six+ steward statuses must stay distinguishable **without relying on hue alone.** Every status is a **triple-redundant file-tag**: **Bauhaus shape glyph → uppercase tracked mono label → fixed column position**, with **hue as confirmation only.** All statuses survive grayscale and colorblind rendering because shape is read before color and the label is always present.

#### 7a. Status hue tokens (a non-colliding set)

| Token | Hex | on `--bg` | on `--bg-alt` | on `--bg-sink` | Role |
|---|---|---|---|---|---|
| `--success` | `#3F6B3A` | ~4.6:1 ✅ | ✅ ≥4.5 | ✅ ≥4.5 | POSITIVE — served, closed, verdict published, race completed, upheld. Deep printed-green. |
| `--warning` | `#B07A1E` | ~4.5:1 ✅ | ✅ | ⚠️ darken to `#8F6216` for small text | ATTENTION / in-flight — under review, awaiting confirmation, pending, upcoming. Amber-ochre, **more saturated than `--brass`** so a *state* never reads as an *award*. |
| `--destructive` | `#9A2B1C` | ~5.9:1 ✅ | ✅ | ✅ | Errors, penalties imposed, not-served, cancelled, validation. A **hotter, brighter** red than oxblood — penalty/error is unmistakably NOT the brand. Drops into shadcn `new-york` Button/Alert/Badge unmodified. |
| `--info` | `#2F5A6E` | ~5.6:1 ✅ | ✅ | ✅ | Neutral/procedural — open, submitted, assigned, rolled-forward-procedural, waiting. Slate-teal — the cool anchor that breaks the warm cluster. |

Warm/cool spread (green + ochre + hot-red + slate-teal) plus the brass/bronze metals gives a **six-plus non-colliding set**. `--destructive` and `--accent` never share a component role, mitigating oxblood-vs-red confusion.

#### 7b. Shape vocabulary (Bauhaus primitives — shape is read first)

| Glyph | Meaning | Lucide reference |
|---|---|---|
| ■ filled square | active / assigned | `square` (filled) |
| ○ hollow circle | pending / open | `circle` |
| ◎ circle-ring | awaiting response/confirmation | `circle-dot` outline |
| △ triangle | alert / attention / not-served | `triangle-alert` |
| ✓ check | served / closed / completed | `check` |
| ▣ box | archived | `archive` / `square` outline |
| ⌦ box-strike | cancelled | `square` + strike |
| → arrow | rolled-forward / historical | `arrow-right` |
| ◆ stamp | verdict ready / on-the-record | brass case-stamp |

Icons: **Lucide, 1.5px stroke**, `--ink` by default; the status hue tints the glyph **only to reinforce an already-labeled+shaped state.**

#### 7c. Full status maps (glyph + label + fixed position + hue)

**CaseStatus (6):**

| Status | Glyph | Label | Hue |
|---|---|---|---|
| Open | ○ hollow circle | `OPEN` | `--info` |
| Waiting for Response | ◎ hollow-circle-outline | `WAITING` | `--info` |
| Under Review | △ triangle | `UNDER REVIEW` | `--warning` |
| Verdict Ready | ◆ stamp | `VERDICT READY` | `--brass` |
| Closed | ✓ check | `CLOSED` | `--success` |
| Archived | ▣ box | `ARCHIVED` | `--muted` |

**PenaltyToServe (7):**

| Status | Glyph | Label | Hue |
|---|---|---|---|
| pending | ○ hollow circle | `PENDING` | `--warning` |
| assigned | ■ filled square | `ASSIGNED` | `--info` |
| awaiting_confirmation | ◎ circle-ring | `AWAITING` | `--warning` |
| served | ✓ check | `SERVED` | `--success` |
| not_served | △ triangle | `NOT SERVED` | `--destructive` |
| rolled_forward | → arrow | `ROLLED FWD` | `--bronze-ink` |
| cancelled | ⌦ box-strike | `CANCELLED` | `--muted` |

**AppealStatus (4)** — reuses the same vocabulary: Open→`--info`/○, Under Review→`--warning`/△, Upheld→`--success`/✓, Rejected→`--destructive`/△.

**Schedule (5):**

| Status | Glyph | Label | Hue |
|---|---|---|---|
| Live | ● filled dot + ON-AIR chip | `ON AIR` | `--accent` (oxblood — the sole "live" exception) |
| Upcoming | ○ hollow circle | `UPCOMING` | `--warning` |
| Completed | ✓ check | `COMPLETED` | `--success` |
| Postponed | ◎ circle-ring | `POSTPONED` | `--info` |
| Cancelled | ⌦ box-strike | `CANCELLED` | `--destructive` |

> **Encoding rule (enforced by one `StatusBadge` primitive):** every badge renders `[glyph][label]` at a **fixed inline-start column position** so labels align vertically in any list; the hue tints glyph + optional 1px chip frame only. Removing the hue must still leave the status fully readable. This one primitive drives all CaseStatus / PenaltyToServe / AppealStatus / schedule states.

> **Live is the one oxblood status.** The `ON AIR` chip carries liveness by **motion + filled dot + label** — a slow 1s discrete *timing tick* (stepped opacity on the oxblood dot), **never a glow.** Under `prefers-reduced-motion` it degrades to a static filled dot + label.

---

### 8. Team-livery color handling

Team/constructor colors come from CSV (`csv_teams`) and are **untrusted external data** that must never override the token discipline.

| Rule | Detail |
|---|---|
| **Confined to a 1px accent stripe** | Livery color renders **only** as a short `border-inline-start` stripe (3px) on a driver/team row or card, or as a small `10px` swatch dot beside a team name. Never a fill, never text, never a background. |
| **Never a text color** | Livery hex is not contrast-verified against our grounds, so it is **forbidden as text or icon color.** Text stays `--ink`/`--ink-2`. |
| **Contrast fallback** | If a livery hex fails a **3:1 boundary check** against its neighboring surface (stripe/dot legibility), wrap it in a 1px `--hairline` frame so the swatch edge stays visible on both `--bg` and `--bg-sink`. |
| **Never the leading-position marker** | P1/leading row uses `--accent` (oxblood) via `border-inline-start`; livery stripes sit at a **different, thinner** channel so the two never collide. |
| **Missing/blank livery** | Fall back to `--datum` (`#8A7E6A`) for the swatch — the neutral pencil, never a random default. |

Livery colors are therefore **decorative identity cues**, quarantined the same way metals are — they never enter the semantic token layer.

---

### 9. Focus ring & ::selection

| Token / rule | Value | Detail |
|---|---|---|
| `--focus` | `#7E2A1E` (= `--accent`) | The one accent expression on **every** interactive element. |
| Focus ring | `outline: 2px solid var(--focus); outline-offset: 2px;` | Applied globally on `:focus-visible` — buttons, links, inputs, tabs, table rows, badges. **Never** removed without replacement. Radius follows the element's 2px. |
| `::selection` | `background: var(--accent); color: var(--bg-paper);` | Oxblood highlight, bone text — a "printer's press" selection. `::-moz-selection` mirrors it. |
| Focus on dark wells | On `--bg-sink`/`--bg-alt`, keep the 2px oxblood ring (it clears 3:1 non-text contrast on all grounds); if the element itself is oxblood, ring switches to `--accent-deep` for separation. |

---

### 10. The `@theme` token contract (globals.css)

Drop-in Tailwind v4 `@theme` block. shadcn `new-york` variables (`--primary`, `--destructive`, `--ring`, `--border`, `--radius`) map onto these so primitives inherit the broadsheet with zero per-component overrides.

```css
@theme {
  /* — Surfaces (opaque solids, never opacity tints) — */
  --color-bg:            #F4EFE4;
  --color-bg-paper:      #FBF8F0;
  --color-bg-alt:        #EAE2D0;
  --color-bg-sink:       #DED4BF;

  /* — Ink scale — */
  --color-ink:           #1C1712;
  --color-ink-2:         #3A322A;
  --color-muted:         #6E6455;
  --color-faint:         #9A8E79;

  /* — Accent: OXBLOOD (single primary) — */
  --color-accent:        #7E2A1E;
  --color-accent-deep:   #5A1D14;

  /* — Archival metals (quarantined: earned/record/tier) — */
  --color-brass:         #9C7A3C;
  --color-brass-ink:     #6F5628;
  --color-silver-ink:    #5E5A52;
  --color-bronze-ink:    #7A4B28;

  /* — Rules / chart ink / best-mark — */
  --color-hairline:        rgba(28,23,18,0.14);
  --color-hairline-strong: rgba(28,23,18,0.30);
  --color-datum:           #8A7E6A;
  --color-best:            #6F5628;  /* DATA cells only — lint-guarded */

  /* — Status hues (icon+label+position required; hue confirms) — */
  --color-success:       #3F6B3A;
  --color-warning:       #B07A1E;   /* small text on --bg-sink → #8F6216 */
  --color-destructive:   #9A2B1C;
  --color-info:          #2F5A6E;

  /* — Focus — */
  --color-focus:         #7E2A1E;   /* = accent */

  /* — Radius: hard flat 2px everywhere — */
  --radius-sm: 2px;
  --radius-md: 2px;
  --radius-lg: 2px;

  /* — shadcn new-york bridge — */
  --primary:     var(--color-ink);        /* primary button fill */
  --primary-foreground: var(--color-bg-paper);
  --destructive: var(--color-destructive);
  --ring:        var(--color-focus);
  --border:      var(--color-hairline);
  --radius:      2px;
}
```

```css
/* Global focus + selection (outside @theme) */
:where(a, button, input, select, textarea, [role="tab"], [tabindex]):focus-visible {
  outline: 2px solid var(--color-focus);
  outline-offset: 2px;
}
::selection   { background: var(--color-accent); color: var(--color-bg-paper); }
::-moz-selection { background: var(--color-accent); color: var(--color-bg-paper); }
```

**Button role map (shadcn `new-york`):**

| Variant | Fill | Text | Edge | Hover |
|---|---|---|---|---|
| primary | `--ink` | `--bg-paper` | none | fill → `--ink` @ 92% tone-step (no shadow) |
| secondary | `--bg-alt` | `--ink` | 1px `--hairline` | edge → `--hairline-strong` |
| ghost | transparent | `--ink` | none | gains 1px `--accent` underline (a link becoming a rule — never a fill) |
| destructive | `--destructive` | `--bg-paper` | none | `--destructive` @ 92% tone-step |

---

### 11. Token discipline (the contract's guarantees)

1. **Every color/radius/font is a token** — a rebrand is a token swap, nothing hardcoded.
2. **No opacity tints for surfaces** — `--bg-alt`/`--bg-sink`/`--bg-paper` are solids so sticky/frozen cells paint opaquely (retires `STICKY_CELL_BG`).
3. **Oxblood is fill-capable only on small marks**; metals are 1px lines in earned/record contexts; livery is a 1px stripe from untrusted data.
4. **Status = shape + label + position + hue**, in that priority — hue is never the sole carrier; verified AA on `--bg`, `--bg-alt`, **and** `--bg-sink`.
5. **RTL by logical properties** — `border-inline-start`, `ps/pe`, `text-start` throughout; mono numerals bidi-isolated LTR inside RTL. No token references a physical side.
6. **Lint guards:** `--best`, `--brass`, `--silver-ink`, `--bronze-ink` are flagged outside data/earned/record contexts; `--faint` flagged on small body text; livery hex flagged as text/background.

---

## 4. Typography System

> Qav Rishon is a broadsheet before it is an app. The type stack is the single loudest signal that this is *the paper of record* — a slab-serif nameplate, an institutional civic sans for prose, humanist mono for the timing tower, and a first-class Hebrew literary serif. Every numeral locks vertically like a printed results column; every heading reads like a masthead, never a UI label.

---

### 1. Font Families

Load all families via `next/font` (with `next/font/local` or `next/font/google`) so weights are subset, self-hosted, and `font-display: swap`. Expose each as a CSS variable on `<html>` and map it in the `@theme` layer. **Hebrew subsets are loaded first-class, not as Latin afterthoughts.**

| Role | Family | CSS var | Weights loaded | Fallback stack |
|---|---|---|---|---|
| **Display** (mastheads, H1–H3, poster headlines) | **Zilla Slab** | `--font-display` | 600, 700; **300 *italic*** (dateline + pull-quote ONLY) | `"Zilla Slab", "Roboto Slab", Georgia, serif` |
| **Body / UI** (prose, forms, tables, buttons, labels) | **Public Sans** | `--font-body` | 400, 500, 600 | `"Public Sans", system-ui, -apple-system, "Segoe UI", sans-serif` |
| **Mono / numerals** (all timing data) | **Spline Sans Mono** | `--font-mono` | 400, 500 (600 for emphasis marks) | `"Spline Sans Mono", "JetBrains Mono", ui-monospace, monospace` |
| **Hebrew display** (masthead, HE headlines) | **Frank Ruhl Libre** | `--font-he-display` | 500, 700 | `"Frank Ruhl Libre", "David Libre", serif` |
| **Hebrew body / UI** (HE prose, tables, forms) | **Assistant** | `--font-he-body` | 400, 500, 600 | `"Assistant", "Heebo", system-ui, sans-serif` |

**Weight discipline.** The system never uses 800/900 — a broadsheet gets gravity from size and slab weight, not from black weights. Body copy never exceeds 600. Zilla Slab 300 italic is quarantined to exactly two devices (dateline, pull-quote) and appears nowhere else — this is the deliberately-owned editorial affordance.

```css
@theme {
  --font-display:    var(--font-zilla-slab), "Roboto Slab", Georgia, serif;
  --font-body:       var(--font-public-sans), system-ui, sans-serif;
  --font-mono:       var(--font-spline-mono), "JetBrains Mono", ui-monospace, monospace;
  --font-he-display: var(--font-frank-ruhl), "David Libre", serif;
  --font-he-body:    var(--font-assistant), "Heebo", system-ui, sans-serif;
}
```

---

### 2. Type Scale

Modular ~1.2 (minor third), `clamp()`-capped for mobile. Base body = `1rem` (16px), line-height `1.6`. Headings are tight (`line-height: 1.08`, `letter-spacing: 0.005em`) so slab display reads as a masthead, not a paragraph. All display text is `--ink` (`#1C1712`); eyebrows are oxblood/brass; meta is `--muted`.

| Token | Role / real usage | Font | Size (clamp) | Weight | Line-height | Tracking | Color |
|---|---|---|---|---|---|---|---|
| `.type-hero` | Masthead nameplate ("Qav Rishon"), home hero, `/stats` page title | Display | `clamp(2.0rem, 5vw, 3.5rem)` | 700 | 1.04 | `0.005em` | `--ink` |
| `.type-h1` | Page titles: `/drivers`, `/schedule`, `/statistics`, `/news`, article `<h1>` | Display | `clamp(1.75rem, 3.5vw, 2.5rem)` | 700 | 1.08 | `0.005em` | `--ink` |
| `.type-h2` | Section headers (`Section` component), "Championship Standings", steward dashboard blocks | Display | `1.6rem` → `2.25rem` at `md` | 600 | 1.1 | `0.005em` | `--ink` |
| `.type-h3` | Card titles (`DriverCard`, `HomeRaceCards`), modal titles, rank-card headers | Display | `1.375rem` → `1.6rem` at `md` | 600 | 1.15 | `0` | `--ink` |
| `.type-eyebrow` | Section eyebrows, "OFFICIAL RECORD" / "CHAMPION" stamps, tab overlines, dateline labels | Body | `0.75rem` (12px) | 600 | 1.2 | **`0.18em`** | `--accent` / `--brass-ink` |
| `.type-body` | All prose, article body, form help text, modal copy | Body | `1rem` | 400 | **1.6** | `0` | `--ink-2` |
| `.type-body-strong` | Emphasized body, table data labels, active nav | Body | `1rem` | 500–600 | 1.5 | `0` | `--ink` |
| `.type-small` | Secondary UI text, table cell text, form labels, badge labels | Body | `0.875rem` (14px) | 400–500 | 1.45 | `0` | `--ink-2` |
| `.type-caption` | Captions, datelines, timestamps, column sub-labels, footer meta | Body | `0.75rem` (12px) | 400 | 1.4 | `0.01em` | `--muted` |
| `.type-dateline` | Live dateline block ("Season · Round · Circuit · GMT+3"), pull-quotes | **Display 300 *italic*** | `0.9375rem` (15px) | 300 | 1.4 | `0` | `--muted` |

**Mono caption floor.** Never render `.num` mono labels below `0.75rem` (12px) — but `13px` is the *scannable* floor for tracked mono labels (column sub-labels, status labels). Below 13px, mono tracking collapses legibility.

**Masthead responsive rule.** Under `480px` the masthead collapses to nameplate-only (drops the dateline block); `.type-hero` clamps to its `2.0rem` floor. EN and HE nameplate sizes are tuned **independently** (see §5) so the two scripts carry equal visual weight side by side.

---

### 3. Numerals — the `.num` treatment

Every position, time, points total, lap, gap, license-point tally, radar/DNA value, delta, countdown digit, and folio number is **mono, tabular, and (in RTL) bidi-isolated LTR**. This is what makes standings and results read like a timing tower — columns lock vertically to the pixel.

```css
.num {
  font-family: var(--font-mono);
  font-variant-numeric: tabular-nums;
  font-feature-settings: "tnum" 1, "lnum" 1;   /* tabular + lining */
  letter-spacing: -0.01em;                      /* slight negative tracking */
  font-variant-ligatures: none;
}
```

**Rules:**

- **Always tabular.** `font-variant-numeric: tabular-nums` on every numeric cell so `1` and `9` occupy identical advance width — non-negotiable in `ResultsTable`, `StandingsTable`, `RaceResultsTable`, and every stat tile.
- **Lining figures**, never oldstyle — data columns must sit on a common baseline.
- **Weight:** 400 for standard data; 500 for the leading row / P1 / current-season; 600 reserved for the single quarantined best-mark (`--best`, DATA cells only, never chrome).
- **Countdown (`NextRaceWidget`):** digits swap crisply per-tick — a mono **digit-swap**, NO odometer roll, NO smooth pulse. Each digit is `.num` in a fixed-width slot so the countdown never reflows.
- **Delta chips:** `.num` value + explicit sign + Lucide arrow, colored `--success` (gain) / `--destructive` (loss). Sign and arrow are redundant channels so the chip survives grayscale/colorblind.
- **Sector-bar values, radar values, H2H figures:** all `.num`.

**RTL bidi-isolation (critical).** Inside a Hebrew (`dir="rtl"`) context, every run of Latin numerals — times, positions, "P1", "GMT+3", "1:23.456" — must be wrapped so digits render LTR and are not reordered by the bidi algorithm:

```css
.num {
  direction: ltr;
  unicode-bidi: isolate;   /* isolate the numeric run inside RTL flow */
}
```

Use a `<span class="num" dir="ltr">…</span>` (or `<bdi class="num">`) around any inline numeral in RTL prose. Table numeric cells are `.num` + `text-align: end` (logical) so the column still hugs the correct edge while the digits themselves stay LTR. **Never** let a bare Latin number sit in an RTL text run without `.num` isolation — it will reorder ("23:1" instead of "1:23").

---

### 4. Eyebrow Style

The eyebrow is a load-bearing device: it labels sections, stamps records, and overlines tabs.

| Property | Value |
|---|---|
| Font | `--font-body` (Public Sans) — Assistant in HE |
| Size | `0.75rem` (12px), floor `0.6875rem` (11px) only in tight stamp frames |
| Weight | 600 |
| Case | `text-transform: uppercase` (Latin) |
| Tracking | **`0.18em`** — the signature wide track |
| Color | `--accent` (oxblood) for live/section eyebrows; `--brass-ink` for record/award stamps ("OFFICIAL RECORD", "CHAMPION", "RULING") |
| Companion | Often preceded by the single oxblood tick of the double-rule |

**Hebrew eyebrows do NOT uppercase** (Hebrew has no case). Instead HE eyebrows use Assistant 600 at the same size with tracking reduced to `0.05em` (Hebrew loses legibility above ~0.06em) and rely on color + weight + the oxblood tick for the same "overline" signal.

---

### 5. Hebrew / RTL Font-Swap Rules

Hebrew is a **native design decision**, not a Latin subset. The swap is driven by an ancestor `dir`/`lang`, never by per-string logic.

```css
:root { --active-display: var(--font-display); --active-body: var(--font-body); }

[lang="he"], [dir="rtl"] {
  --active-display: var(--font-he-display);  /* Frank Ruhl Libre */
  --active-body:    var(--font-he-body);     /* Assistant */
}
```

Every text class references `--active-display` / `--active-body`, so a single `dir="rtl"` on a subtree swaps the entire stack.

| Latin | Hebrew equivalent | Notes |
|---|---|---|
| Zilla Slab (display) | **Frank Ruhl Libre** | Serif-to-serif — mirrors slab gravitas; the reason we did NOT pick a Hebrew sans for headlines |
| Public Sans (body) | **Assistant** | Legible at small table/form sizes |
| Spline Sans Mono | **(unchanged)** — numerals stay Latin mono, `.num` LTR-isolated | Hebrew never restyles digits |

**Independent hero sizing.** Frank Ruhl Libre's x-height and vertical rhythm differ from Zilla Slab; set HE hero/H1 sizes independently (typically HE nameplate `−0.05rem` to `−0.1rem` off the EN clamp cap) so EN and HE mastheads read as equal-weight peers, not one dominating.

**Line-height for HE.** Hebrew display gets slightly more leading (`1.12` vs Latin `1.08`) to accommodate niqqud/ascenders; HE body stays `1.6`.

**Layout is logical-property only.** All spacing/alignment uses `ps/pe`, `ms/me`, `text-start/end`, `border-inline-*` — never physical `left/right`. This is what lets the oxblood leading-row marker (`border-inline-start`) mirror correctly in RTL standings without a second ruleset.

---

### 6. Real-Surface Application

| Surface | Class(es) | Notes |
|---|---|---|
| **Home hero / masthead** | `.type-hero` (EN) + HE via `--active-display`; `.type-dateline` for the live dateline | Bilingual nameplate as equals; dateline in Zilla 300 italic |
| **`StandingsTable` / `ResultsTable`** | thead labels `.type-eyebrow`-ish (mono, tracked, 13px); cells `.num` tabular; driver name `.type-small` weight 500 | Double-rule above thead; P1 row numerals weight 500; pinned cells `.num` on solid `--bg-paper`/`--bg-sink` |
| **`NextRaceWidget` countdown** | `.num` weight 500, fixed digit slots | Crisp per-tick digit-swap; framed by HUD corner brackets |
| **`StatsPageContent` stat tiles / rank cards** | tile label `.type-eyebrow`; big figure `.num` `clamp(1.75rem,4vw,2.75rem)` weight 500; delta chip `.num` | Radar/H2H values `.num`; selected trace oxblood, others `--datum` |
| **`DriverModal` / `AchievementBadges`** | title `.type-h3`; medal counts `.num`; award label `.type-eyebrow` in `--brass-ink` | Brass/silver/bronze ladder labels use eyebrow style |
| **`ScheduleList` statuses** | glyph + `.type-eyebrow`-style uppercase mono label (13px), fixed column | "ON AIR" chip: oxblood label + timing-tick dot |
| **Steward tables (`/stewards`)** | headers mono tracked 13px; case IDs / dates / license points `.num`; status labels uppercase tracked mono | All 6 case / 7 penalty / 4 appeal statuses use shape + `.type-eyebrow` label + fixed position |
| **`/news` article body** | `.type-body` (1rem/1.6); pull-quote `.type-dateline` (Zilla 300 italic); `<h2>`/`<h3>` display | The one place pull-quote italic is allowed |
| **`Footer`** | `.type-caption` in `--muted`; folio/version `.num` | — |

---

### 7. Dos and Don'ts

**Do**
- Route every text element through the class tokens (`.type-*`, `.num`) — no ad-hoc `font-size`/`font-family`.
- Wrap every Latin numeral in `.num` (`<span class="num" dir="ltr">`) — especially inside Hebrew prose.
- Keep all data numerals `tabular-nums` + lining so columns lock vertically.
- Reserve Zilla Slab 300 italic strictly for dateline + pull-quote.
- Use `--active-display` / `--active-body` so HE swaps happen via ancestor `dir`, not per-string logic.
- Uppercase + `0.18em` track Latin eyebrows; drop to `0.05em` and NO uppercase for Hebrew.

**Don't**
- **Don't** use font weights 800/900 anywhere — the broadsheet gets weight from size and slab, not black type.
- **Don't** use oldstyle/proportional figures in any data context.
- **Don't** let a bare Latin number sit in RTL flow without `.num` isolation (it will reorder).
- **Don't** uppercase or over-track Hebrew (no case; tracking above ~0.06em breaks legibility).
- **Don't** apply italic anywhere except the two sanctioned devices.
- **Don't** use Spline Sans Mono for prose, or Public Sans for numerals — mono is numerals-only, sans is prose-only.
- **Don't** render tracked mono labels below 13px, or any numeral below 12px.
- **Don't** introduce a second display or mono family — one masthead voice, one timing-tower voice.

---

## 5. Component Philosophy & Primitive Specs

> **Scope.** This section defines the component language for every shadcn "new-york" primitive and key composite in *Qav Rishon — The Racing Broadsheet*. Everything routes through the single `@theme` token layer in `globals.css` (Tailwind v4, no config file). No component invents its own color, radius, font, or shadow. **Surfaces are strictly flat: no gradients, no drop shadows, no glassmorphism, no blur.** Depth comes only from the four tone steps (`--bg` / `--bg-alt` / `--bg-sink` / `--bg-paper`) and 1px rules. RTL is handled entirely by logical properties (`ps`/`pe`, `border-inline-*`, `text-start`) — never physical sides. Every preserved surface (ResultsTable, StandingsTable, StatsPageContent, ScheduleList, DriverModal, steward portal) keeps 100% of its existing functionality; this is a re-skin at the token + primitive layer.

---

### 0. Global Foundations (apply to every primitive)

| Concern | Rule |
|---|---|
| **Radius** | Hard flat **2px everywhere**. Override the shadcn radius scale so `--radius-sm` / `--radius-md` / `--radius-lg` all resolve to `2px` (not the default calc of 0/2/4). Class-level: use `rounded-[2px]`, never `rounded-md`/`rounded-lg`. **Sole exceptions** (genuinely circular marks): avatar dots, the live dot, the Bauhaus hollow-circle status glyph, and radar/scatter point marks → `rounded-full`. |
| **Focus ring** | Global, on `:focus-visible` only: `outline: 2px solid var(--focus); outline-offset: 2px;` (`--focus` = oxblood `#7E2A1E`). Never a box-shadow ring, never a glow. This is the single accent expression present on every interactive element. |
| **Border weight** | `1px` default (`--hairline` `rgba(28,23,18,0.14)`); `2px` for emphasis members of the double-rule (`--hairline-strong` `rgba(28,23,18,0.30)`) and for brass case-stamp corners. Metals (`--brass`/`--silver-ink`/`--bronze-ink`) are almost always **1px lines, never fills adjacent to oxblood**. |
| **Motion** | 120–200ms `ease-out` on opacity, tone-step, and the inline-start underline/rule draw-in. No scale-bounce, no glow, no gradient sweep. All motion respects `prefers-reduced-motion` (collapses to instant state swap). Motion never carries information that shape/label/position doesn't. |
| **Numerals** | Every position, time, points, lap, gap, license-point tally, radar value, delta, and countdown uses `.num` = **Spline Sans Mono**, `font-variant-numeric: tabular-nums`, slight negative tracking. Inside RTL, numerals are `dir="ltr"` bidi-isolated (`unicode-bidi: isolate`). |
| **Eyebrows** | Uppercase, `letter-spacing: 0.18em`, `font-size: 0.75rem` (13px floor), color `--accent` (oxblood) or `--brass-ink` for record/earned contexts. |

---

### 1. Button

`components/ui/button.tsx` — shadcn "new-york" base. `--destructive` maps to `#9A2B1C` so the `destructive` variant drops in unmodified.

| Variant | Surface / Fill | Text | Border | Hover | Active | Disabled | Focus |
|---|---|---|---|---|---|---|---|
| **primary** (default) | `--ink` `#1C1712` fill | `--bg-paper` `#FBF8F0` | none | fill → `--accent-deep` `#5A1D14` (tone-step, 150ms) | fill `#4a180f`, no translate | `opacity: 0.45`, `cursor: not-allowed`, no hover | global 2px oxblood ring |
| **secondary** | `--bg-alt` `#EAE2D0` | `--ink-2` `#3A322A` | `1px --hairline` | border → `--hairline-strong`; fill → `--bg-sink` | fill `--bg-sink` | `opacity: 0.45` | ring |
| **ghost** | transparent | `--ink` | none | gains a `1px --accent` **inline-start-to-full underline** drawn in over 150ms (a link becoming a rule — never a fill) | underline `--accent-deep` | `--faint` text, no underline | ring |
| **destructive** | `--destructive` `#9A2B1C` fill | `--bg-paper` | none | fill darkens ~8% | — | `opacity: 0.45` | ring |
| **link** | transparent | `--accent` `#7E2A1E` | none | `--accent-deep` + underline | — | `--faint` | ring |

- **Shape/radius:** `rounded-[2px]`, height `h-10` (2.5rem) default / `h-9` sm / `h-11` lg. Horizontal padding `px-4`. No pill radius anywhere.
- **Icon buttons:** square `h-10 w-10`, Lucide 1.5px stroke, `--ink` icon; accent only to reinforce an already-labeled state.
- **Never:** gradient fills, drop-shadow, scale-on-press. Oxblood may fill a `link`/`ghost` underline but never a large button body (that is `--ink`'s job).

---

### 2. Card ("clippings")

Cards are pasted clippings on the broadsheet.

- **Surface:** `--bg-alt` `#EAE2D0` fill. **Radius** `rounded-[2px]`. **Frame** `1px solid --hairline`.
- **Header:** optional eyebrow (uppercase oxblood, tracked 0.18em) + Zilla Slab title (`H3` 1.6rem, `line-height: 1.08`, `letter-spacing: 0.005em`).
- **Hover (interactive cards only):** frame → `--hairline-strong`; **no** lift, **no** shadow, **no** scale. Optional inline-start oxblood tick draws in.
- **On-the-record variant (`.card--record`):** adds the **brass case-stamp frame** — `1px solid --brass` `#9C7A3C` with 2px reinforced corners — plus a stamped eyebrow (`OFFICIAL RECORD` / `RULING` / `CHAMPION`) in `--brass-ink` `#6F5628`. Reserved strictly for on-the-record content (published verdicts, awards, live-race panel). **Never decorative.** Brass stays a line, never a fill, never adjacent to an oxblood fill.
- **HUD variant (`.card--hud`):** four short L-shaped `1px --hairline` corner brackets instead of a full box — precision cue for live/telemetry moments (NextRaceWidget, live-race, focused stat tile). **Brackets and case-stamp frame never stack on the same element.**

---

### 3. Badge & StatusBadge (the shape-first status system)

Two distinct primitives. Do not conflate.

**`Badge`** (generic label chip): `--bg-sink` fill, `--ink-2` text, `1px --hairline`, `rounded-[2px]`, `px-2 py-0.5`, uppercase mono `0.75rem`.

**`StatusBadge`** — ONE primitive drives **all** steward + schedule statuses. Triple redundancy so shape is read *before* color and every state survives grayscale/print/colorblind: **Bauhaus-primitive glyph + uppercase tracked mono label + fixed column position**. Hue is confirmation, never the sole carrier.

- **Anatomy:** `[glyph 12px] [label uppercase mono 0.75rem, letter-spacing 0.08em] `, glyph pinned to inline-start at a fixed column so labels left-align down a table. `1px` frame in the state hue at ~30% + state-hue text; fill stays paper-toned (`--bg-paper`/`--bg-alt`) — status hues are **lines and text, never floods**.
- **Glyph vocabulary (Lucide, 1.5px stroke):** filled square = active/assigned · hollow circle = pending/open · triangle = alert · check = served/closed · box = archived · stamp (brass) = ruling/verdict-ready · signed arrow = rolled-forward · struck box = cancelled.

**Case status (6):**

| State | Hue | Token | Glyph |
|---|---|---|---|
| Open | info | `#2F5A6E` | hollow circle |
| Waiting for Response | info | `#2F5A6E` | hollow circle (outline ring) |
| Under Review | warning | `#B07A1E` | triangle |
| Verdict Ready | brass | `#9C7A3C` | stamp |
| Closed | success | `#3F6B3A` | check |
| Archived | muted | `#6E6455` | box |

**Penalty-to-serve (7):**

| State | Hue | Token | Glyph |
|---|---|---|---|
| pending | warning | `#B07A1E` | hollow circle |
| assigned | info | `#2F5A6E` | filled square |
| awaiting_confirmation | warning | `#B07A1E` | circle-ring |
| served | success | `#3F6B3A` | check |
| not_served | destructive | `#9A2B1C` | triangle |
| rolled_forward | bronze | `#7A4B28` | signed arrow |
| cancelled | muted | `#6E6455` | struck box |

**Schedule (5):** Live = oxblood ON-AIR chip (see NextRaceWidget) · Upcoming = warning/hollow circle · Completed = success/check · Postponed = info/circle-ring · Cancelled = destructive/struck box. **AppealStatus (4)** reuses the same vocabulary.

> **Contrast guarantee:** every state hue+text pairing clears WCAG AA against `--bg`, `--bg-alt`, **and** `--bg-sink` (the sink is the hardest ground — explicitly verified). On `--bg-sink`, small `--warning` text darkens to a text-safe step. Oxblood and destructive-red **never share a component role**.

---

### 4. Dialog / Modal (Dialog, DriverModal, the 3 ScheduleList modals)

- **Sheet surface:** `--bg-paper` `#FBF8F0` (the "fresh page"), `1px --hairline` frame, `rounded-[2px]`, **no drop shadow**.
- **Overlay:** `--ink` at ~55% opacity (`rgba(28,23,18,0.55)`) — a flat ink wash, never a blur/backdrop-filter.
- **Header:** the **double-rule** (thin `--hairline` 3px above thick `2px --hairline-strong`, opened by one short oxblood tick at inline-start) sits under the title. Title = Zilla Slab; dateline/meta = Spline Sans Mono `--muted`.
- **Close:** ghost icon-button, inline-**end** (RTL-mirrors).
- **Motion:** opacity fade 150ms ease-out, no scale-in. `prefers-reduced-motion` → instant.
- **Record modals** (published verdict, official ruling): apply `.card--record` brass case-stamp frame inside the sheet.

---

### 5. Input, Textarea, Select, SearchableSelect

Form controls read as **document fields**.

- **Surface:** `--bg-paper` `#FBF8F0` fill (solid — inputs sit on the fresh page). **Frame** `1px --hairline`. **Radius** `rounded-[2px]`. Height `h-10`. Text `--ink-2`; placeholder `--muted` `#6E6455` (drops to `--ink-2` if the field sits on `--bg-sink`).
- **States:** hover → border `--hairline-strong`. Focus-visible → global 2px oxblood ring at 2px offset (border stays hairline; ring is the signal). Disabled → `--bg-sink` fill, `--faint` text, `cursor: not-allowed`. Error → `1px --destructive` border + inline `--destructive` helper text with a Lucide alert icon (icon + label, never color alone).
- **Label:** eyebrow-style uppercase `--muted` above the field; required marked with an oxblood tick, not a bare `*`.
- **Select / SearchableSelect (StatsPageContent driver/season pickers):** trigger matches Input. Popover = `--bg-paper`, `1px --hairline`, flat (no shadow). Option hover → `--bg-alt`; selected → `1px` inline-start oxblood tick + `--ink` text; keyboard-active row → oxblood ring inset. Search field inside popover matches Input. **SeasonSelector** is a compact Select variant with the same tokens.

---

### 6. DataTable — ResultsTable / StandingsTable / RaceResultsTable (crown jewels)

The most important surface in the system: a **timing tower rendered as a front page.** All three tables share one base.

| Concern | Spec |
|---|---|
| **Numerals** | Every numeric cell = `.num` Spline Sans Mono `tabular-nums`, negative tracking → columns lock vertically like a timing tower. RTL: numerals `dir="ltr"` isolated. |
| **thead** | Opened by the **double-rule** (1px `--hairline` + 2px `--hairline-strong`, single oxblood inline-start tick). Header cells `--bg-sink` `#DED4BF` fill, `--muted`/`--ink-2` uppercase mono sub-labels, tracked 0.08em. |
| **Zebra** | Body rows alternate `--bg-paper` and a **~3% ink tint** over it (`rgba(28,23,18,0.03)`). Kept subtle — the paper must still read as paper. |
| **Leading row (P1)** | Marked by an **oxblood `border-inline-start: 2px solid --accent`** — mirrors correctly in RTL. Position number may carry the sole permitted small oxblood mark. No full-row fill. |
| **Column-gutter rules** | Tables with **8+ columns** get `1px --hairline` vertical rules between column groups for editorial column separation. Under 8 columns: none. |
| **Sticky / pinned columns** | Fill with the **SOLID** tokens `--bg-paper` `#FBF8F0` (body) / `--bg-sink` `#DED4BF` (header) — **recomputed against paper, never opacity tints.** ⚠️ This **directly retires the pre-blended dark-hex `STICKY_CELL_BG` values** documented in `ResultsTable.tsx`, so a frozen column never renders as a dark bar over paper. Zebra tint on a pinned cell is composited into a solid hex, not layered as alpha. |
| **Row hover** | Tone-step to `--bg-alt` (150ms), no shadow. |
| **Sort affordance** | Lucide chevron 1.5px `--muted`; active sort column header → `--ink` + oxblood chevron. |
| **Delta cells** | Position/points/gap changes render as **signed delta chips** (§10). |
| **Medals** | P1/P2/P3 cells in standings use the brass/silver/bronze medal ladder (§12) — frame-metal + count, not hue alone. |
| **Empty / loading** | EmptyState (§8) spans the table body; skeleton rows = `--bg-sink` bars at 150ms opacity, no shimmer. |

---

### 7. Tabs (StatsPageContent, steward sub-navigation)

- **List:** flat, no pill background. Tab labels = Public Sans 500, `--muted` inactive / `--ink` active.
- **Active indicator:** `2px --accent` **underline** on the inline-start-aligned baseline (RTL-mirrors), drawn in over 150ms — the "link becoming a rule" device. No filled tab, no rounded pill.
- **Hover:** inactive tab → `--ink-2`, faint 1px `--hairline` underline hint.
- **Focus:** global oxblood ring on the tab trigger.
- **Disabled tab:** `--faint`, no underline.

---

### 8. EmptyState

- **Surface:** transparent (sits on whatever band it lands in). Centered.
- **Content:** large **watermark numeral / glyph** in `--faint` `#9A8E79` (decorative, below AA by design — never load-bearing), a Zilla Slab line in `--ink-2`, and `--muted` supporting copy.
- **Optional action:** a `ghost` or `secondary` Button.
- **Voice:** editorial, restrained — "No results filed for this round." (dateline register), not playful.

---

### 9. Tooltip

- **Surface:** `--ink` `#1C1712` fill, `--bg-paper` text, `1px` no border, `rounded-[2px]`, **no shadow** — a small pressed ink tag. `0.75rem` mono/sans.
- **Motion:** opacity 120ms ease-out; reduced-motion → instant.
- **Arrow:** small flat triangle in `--ink`, or omitted. Never a glow/blur.
- Used for chart series identity, delta explanations, and glyph legends — always echoing a label already present, never the sole information carrier.

---

### 10. Eyebrow, StatTile & Signed Delta Chips

**Eyebrow** (`components/ui`): uppercase, `letter-spacing: 0.18em`, `0.75rem`, `--accent` (oxblood) default or `--brass-ink` for record/earned. Section openers and card headers.

**StatTile** (StatsPageContent rank cards / stat tiles):
- **Surface** `--bg-paper`, `1px --hairline`, `rounded-[2px]`. Focused/highlighted tile gets the `.card--hud` **corner brackets**.
- **Value** big Spline Sans Mono `tabular-nums` `--ink`; **label** eyebrow `--muted`; **rank** as `#n` mono, oxblood only when it's a leading/#1 value.
- **Sector-bar meter** (§11) for any ratable value.

**Signed Delta Chip** — the universal "value changed" mark, everywhere a value moves (tables, H2H, stat tiles):
- **Anatomy:** `[Lucide arrow] [explicit sign + tabular value]` in a `1px`-framed `rounded-[2px]` chip.
- **Redundant channels:** arrow direction **+** explicit `+`/`−` sign **+** value **+** color — survives grayscale and colorblind checks.
- **Color:** `--success` `#3F6B3A` (gain) / `--destructive` `#9A2B1C` (loss). Frame + text tint only; never a flood.
- **Best-mark:** session/overall-best figures may use the strictly lint-guarded quarantined `--best` token **on data cells only** (fastest-time cells) — hard-guarded out of any chrome.

---

### 11. Charts (Recharts) — dedicated JS theme object

Charts get a **dedicated theme object** (not ad-hoc per-chart colors) so the accent never does double duty.

| Concern | Spec |
|---|---|
| **Default series ink** | `--datum` `#8A7E6A` — the map's neutral pencil. **All** background/unselected series and the profile-strip line use `--datum`. |
| **Highlight** | **Oxblood `--accent` is reserved ONLY for the single highlighted/selected trace.** Never a background series, never a gradient, never a glow. |
| **Categorical fallback** (4+ series) | `--datum` → `--info` `#2F5A6E` → `--success` `#3F6B3A` → `--warning` `#B07A1E` → `--muted` — stay distinguishable without the accent. |
| **Axes / grid** | Axis labels `--ink-2` Spline Sans Mono; gridlines `--hairline`; no gradient fills under areas (flat tint at low opacity max). |
| **Radar (DNA / H2H compare)** | Background driver = `--datum` polygon (low-opacity flat fill); selected driver = oxblood stroke, `--accent` low-opacity fill. 6-axis DNA, values in mono. 4+ compared drivers fall through the categorical ramp. |
| **Sector bars** (5 ratings + Racecraft + DNA meters) | Segmented **3-tick S1/S2/S3** bar: flat `--accent` fill over a `--bg-sink` dim track. **No gradient, no glow.** Replaces plain bar-rules. Value printed in mono at the inline-end. |
| **Tooltip** | The Tooltip primitive (§9): `--ink` tag, mono values. |
| **Bars / lines** | Flat fills, 1.5px line stroke, points `rounded-full` `--datum` (oxblood only on the selected trace). |

---

### 12. DriverCard / DriverModal / AchievementBadges (medal ladder)

**DriverCard** (DriversGrid): clipping card (`--bg-alt`, `1px --hairline`, `rounded-[2px]`). Driver image `/public/drivers/{driver_id}.webp`. Name = Zilla Slab; team/nationality meta = `--muted` mono. Hover → frame `--hairline-strong`, no lift. A `#n` championship-tier medal shows via the ladder below.

**DriverModal:** Dialog surface (§4). Rating axes render as **sector bars** (§11); stat figures Spline Sans Mono. Circuit/H2H breakdowns use `--datum` charts with oxblood on the selected trace. Champion status uses the medal ladder.

**AchievementBadges / medals — the gold/silver/bronze ladder:**
- **Tier is encoded by frame-metal + stamp label + count — NEVER hue alone.**
  - **P1 / first tier** → `--brass` `#9C7A3C` frame, `--brass-ink` `#6F5628` label (`CHAMPION`).
  - **P2 / second tier** → `--silver-ink` `#5E5A52` frame + label.
  - **P3 / third tier** → `--bronze-ink` `#7A4B28` frame + label.
- **Reuse** the existing `p1`/`p2`/`p3` gold/silver/bronze SVG styling — this is a re-pigment, not a rebuild.
- Metals stay **1px frames**, quarantined to earned/record/tier contexts (never a second primary, never a fill adjacent to oxblood).
- Count badge (e.g. `×3`) in mono next to the medal.

---

### 13. NextRaceWidget / SnapshotStrip / HomeRaceCards / NewsCarousel / ContactSection / ZoomableImage

**NextRaceWidget (countdown):**
- **Surface** `.card--hud` corner-bracket frame (live/telemetry moment). Dateline (season · round · circuit · GMT+3) in mono `--muted`.
- **Countdown digits:** Spline Sans Mono `tabular-nums`, crisp **mono digit-swap** on tick (no odometer roll). Reduced-motion → instant.
- **ON-AIR (live) chip:** the sole ambient motion in the system — a slow **1s discrete timing-tick** (stepped opacity beat on the oxblood dot, like a stopwatch hand) + filled oxblood dot + `ON AIR` label. **Liveness is carried by motion + filled dot + label — never color/glow alone.** Reduced-motion → static filled dot + label.

**SnapshotStrip / HomeRaceCards:** clipping cards / bands alternating `--bg` / `--bg-alt` for editorial rhythm; mono figures; double-rule section openers.

**NewsCarousel:** clipping cards, `--muted` italic **dateline** (Zilla Slab 300 italic — the one place italics are permitted, alongside pull-quotes). Nav arrows = ghost icon-buttons. No shadow, no scale.

**ContactSection:** form controls per §5; submit = primary Button; success/error states use `--success`/`--destructive` with icon + label.

**ZoomableImage:** `1px --hairline` frame, `rounded-[2px]`, flat. Zoom overlay = ink wash (§4 overlay), no blur.

---

### 14. Composition Rules (cross-cutting invariants)

1. **One accent, one metal-family, one role each.** Oxblood = LIVE/attention (fill-capable on small marks only). Brass/silver/bronze = PERMANENCE/earned/tier (1px lines only). They never swap roles; brass never fills adjacent to an oxblood fill.
2. **Status hue is confirmation, not the carrier.** Every status = glyph (shape) + uppercase mono label + fixed position, *then* hue.
3. **Depth is tone + rule only.** No shadow, no gradient, no blur, no glass anywhere.
4. **Radius is 2px** except genuinely circular marks.
5. **HUD brackets and brass case-stamp frame never stack** on the same element (telemetry vs. record).
6. **Sticky cells use SOLID tokens** — retiring the `STICKY_CELL_BG` pre-blended dark hex.
7. **Charts:** `--datum` for all but the one selected trace (oxblood).
8. **RTL by logical properties only;** numerals always LTR-isolated.
9. **All status/text pairings clear AA against `--bg`, `--bg-alt`, and `--bg-sink`.**
10. **A rebrand is a token swap** — no primitive hardcodes a hex outside the `@theme` layer.

---

## 6. Page Hierarchy & Layout

> **Scope.** This section defines the spatial system for *Qav Rishon — The Racing Broadsheet*: container widths, the layout grid, the spacing rhythm, section banding, and a per-route information hierarchy across every real surface in the repo. It is the frame the press prints on. Every value here is a token or a fixed measure; nothing invents a route or removes a feature. All color references are the identity tokens (`--bg` `#F4EFE4`, `--bg-alt` `#EAE2D0`, `--accent` oxblood `#7E2A1E`, `--brass` `#9C7A3C`, `--hairline`, etc.). Direction is expressed **only** with logical properties (`ps/pe`, `ms/me`, `border-inline-*`, `text-start`) — never physical sides — so the Hebrew RTL edition mirrors for free.

---

### 1. The Broadsheet Grid — container widths & measure

A broadsheet is a fixed sheet with disciplined margins. The site is built on **one content column width** plus two deliberate widenings for data-dense surfaces and one narrowing for prose.

| Token | Value | Role | Applied to |
|---|---|---|---|
| `--page-max` | `72rem` (1152px) | **Standard measure** — the default page column. Matches the existing `max-w-6xl` so no reflow of current pages. | Home, Drivers, Schedule, News list, Contact, most Section bodies |
| `--page-max-wide` | `80rem` (1280px) | **Timing-tower measure** — for data grids that need more horizontal room before scroll kicks in. | Statistics, Stats dashboard, Standings tables, steward case/penalty tables |
| `--page-max-prose` | `44rem` (704px) | **Reading measure** — optimal line length (~72ch) for long editorial copy. | `/news/[slug]` article body, `/privacy` |
| `--page-max-full` | `90rem` (1440px) | **Masthead bleed cap** — the outer bound the masthead rule and footer double-rule may span; content still sits inside `--page-max`. | Header masthead rule, Footer top double-rule |

**Gutters (page inline padding), fluid by breakpoint:**

| Breakpoint | Inline gutter (`ps`/`pe`) | Class-level |
|---|---|---|
| `< 640px` (mobile) | `1rem` (16px) | `px-4` |
| `≥ 640px` (sm) | `1.5rem` (24px) | `sm:px-6` — matches current `px-6` |
| `≥ 1024px` (lg) | `2rem` (32px) | `lg:px-8` |

**Container primitive.** A single `.broadsheet-container` utility centers content and applies the fluid gutter: `margin-inline: auto; max-inline-size: var(--page-max); padding-inline: 1rem;` with `sm:` / `lg:` gutter steps. Wide and prose surfaces set `max-inline-size` to the corresponding token. This replaces every ad-hoc `mx-auto max-w-6xl px-6` in `Section.tsx`, `Header.tsx`, `Footer.tsx`, and page shells with one class.

**Breakpoint ladder** (Tailwind v4 defaults, no config file — the identity constraint): `sm 640` · `md 768` · `lg 1024` · `xl 1280` · `2xl 1536`. The design targets **three device classes**: phone (`< 768`), tablet (`768–1023`), desktop (`≥ 1024`).

---

### 2. Spacing Rhythm — the baseline

Vertical rhythm follows a **4px base unit** on a modular ladder, so ink sits on a predictable grid like set type. Use these tokens rather than arbitrary values.

| Token | px | Typical use |
|---|---|---|
| `--space-1` | 4 | Icon–label gap in a status file-tag, delta-chip internal padding |
| `--space-2` | 8 | Chip padding, dense table cell `py` |
| `--space-3` | 12 | Standard table cell `py`, form field internal padding |
| `--space-4` | 16 | Card padding (mobile), stack gap between related rows |
| `--space-5` | 24 | Card padding (desktop), gap between cards in a grid |
| `--space-6` | 32 | Space below a section title before its body |
| `--space-8` | 48 | Between sibling content blocks within a section |
| `--space-10` | 64 | **Section vertical padding, mobile** (`py-16` equivalent) |
| `--space-12` | 96 | **Section vertical padding, desktop** — the band breathing room |

**Section vertical rhythm.** `Section.tsx` currently uses `py-12 md:py-16` (48/64px) and `py-14 md:py-20` for page headers. The broadsheet increases air to read as a printed page:

- Standard section: `py-16 md:py-24` (64 → 96px).
- Page-header section: `pt-12 md:pt-16` / `pb-10 md:pb-14`, because the masthead already provides top presence — the old radial-glow page header block (`bg-[#7020B0]/[0.07] blur-[100px]`) is **removed** (no glows, no gradients per the identity) and replaced by the masthead + double-rule device (§5).

---

### 3. Section Banding — vertical rhythm of the page

Depth comes only from the four flat tone steps and 1px rules. Sections alternate ground tone to create editorial band rhythm — the newsprint equivalent of column separation down a front page.

**Band rule (applies to every stacked page).**

| Band position | Ground | Notes |
|---|---|---|
| Odd sections (1st, 3rd, …) | `--bg` `#F4EFE4` | The paper of record — default. |
| Even sections (2nd, 4th, …) | `--bg-alt` `#EAE2D0` | Toasted bone band. |
| Any inset panel / table body inside a band | `--bg-paper` `#FBF8F0` | The "fresh page" lifted off the band. |
| Recessed wells (thead, disabled, pinned gutter) | `--bg-sink` `#DED4BF` | Solid — never an opacity tint. |

- **Separator between bands:** the **Double Rule** signature device (§5) — a 1px `--hairline` sitting 3px above a 2px `--hairline-strong`, opened by one short oxblood tick at the inline-start. It renders at the *top* of each new band, spanning `--page-max`.
- **No full-bleed color fills.** Oxblood and brass never flood a band; bands carry only the four bone/sink tones.
- **Band tone is decided by document order, not route** — a component (e.g. `HomeRaceCards`) does not hardcode a ground; the section wrapper assigns it. This keeps banding correct if sections are reordered.

---

### 4. The Global Shell — Header, Footer, NextRaceWidget

The root layout (`app/layout.tsx`) keeps its structure — `Header` → page `children` → `Footer` → `NextRaceWidgetServer` — and re-skins each to the broadsheet.

#### 4.1 Header / Masthead

Replaces the current dark sticky bar (`bg-[#0B0B0E]/80 backdrop-blur`). **No backdrop blur** (glassmorphism is banned).

| Property | Value |
|---|---|
| Position | `sticky top-0 z-50` |
| Height | `4rem` (64px) desktop, `3.5rem` (56px) mobile |
| Ground | `--bg` `#F4EFE4`, **fully opaque** (no translucency) |
| Bottom edge | The **Double Rule** spanning `--page-max-full`, with the single oxblood tick at inline-start |
| Nameplate | Bilingual, equals: **`Qav Rishon`** (Zilla Slab 700) beside **`קו ראשון`** (Frank Ruhl Libre) — not stacked as translation; laid out `flex` with a hairline divider between. Under 480px, collapses to **nameplate + burger only** (dateline and folio drop). |
| Dateline (desktop only, `≥ md`) | Mono block (`Spline Sans Mono`, `--muted`): `S6 · R08 · CIRCUIT · GMT+3`, bidi-isolated LTR. Sits after the nameplate. |
| Folio | Small oxblood folio numeral at the inline-end of the masthead row, mono. |
| Nav (desktop) | Inline links, `--ink-2` default; **active tab = oxblood 2px underline** (`border-block-end: 2px solid var(--accent)`) drawn on the inline-start edge, not a filled pill. Hover = the underline draws in over 150ms (a link becoming a rule). Active detection reuses existing `pathname` logic including `/stewards` prefix match. |
| Stewards item | Keeps `StewardNotifBadge` — re-skinned as a small oxblood count chip. |
| Join Now | Primary button: `--ink` fill / `--bg-paper` text, 2px radius. |

#### 4.2 Footer

Opens with a Double Rule spanning `--page-max-full`, ground `--bg-alt`. Three logical columns on desktop (`grid` `1fr 1fr 1fr`), single stacked column on mobile. Nameplate echo, nav mirror, social links, and a mono colophon line (`--muted`) reading like an imprint (`Printed on the record · GMT+3`).

#### 4.3 NextRaceWidget (floating countdown)

Persistent instrument, bottom inline-end. Re-cased as a **HUD-bracket instrument**: four short L-shaped `--hairline` corner brackets (not a full box), ground `--bg-paper`, countdown digits in mono tabular with **crisp digit-swap** (no odometer roll). If the race is live, it becomes the **ON-AIR chip** carrying the 1s discrete timing-tick on its oxblood dot. Mobile: docks as a full-width strip above the fold of the footer region, or a compact bottom-inline-end pill under 480px.

---

### 5. Signature layout devices (placement rules)

| Device | Where it appears in layout | Rule |
|---|---|---|
| **Double Rule** | Top of every band, under masthead, above **every** table `thead`, opening each `Section` title | Oxblood tick appears **once** per rule, at inline-start. Column-gutter 1px rules added only on tables with **8+ columns**. |
| **Masthead + dateline** | Global header; page-level `Section` headers echo a mini-dateline eyebrow | Nameplate-only under 480px. |
| **Case-stamp frame** (brass 1px, 2px corners) | Wraps *on-the-record* blocks only: published verdicts, awards on DriverModal, the live-race panel, `SnapshotStrip` "OFFICIAL RECORD" | Brass stays a 1px line, never a fill, never adjacent to an oxblood fill. |
| **HUD corner brackets** | Live/telemetry moments only: NextRaceWidget, focused stat tile, live-race row | Never stacks on the same element as a case-stamp frame. |
| **Sector bars / delta chips / file-tag statuses** | Inside content (ratings, changes, statuses) — see per-route hierarchy | Layout reserves fixed column slots for status file-tags so shape reads before color. |

---

### 6. Per-Route Information Hierarchy

For each route: **what leads** (primary focal block), **what supports** (secondary), **what recedes** (tertiary/meta). Layout is mobile-first single-column, widening per breakpoint.

#### `/` — Home
- **Leads:** Masthead + a front-page hero band — bilingual nameplate, tagline, and the current **SnapshotStrip** (league snapshot numbers) framed as an "OFFICIAL RECORD" case-stamp. This is the front page.
- **Supports:** `HomeRaceCards` (last result + next race as pasted-clipping cards, `--bg-alt`, hairline frame), `NewsCarousel` (latest filings), `WhatYouGet`.
- **Recedes:** `ContactSection` (`#contact-us`, target of Join Now), footer colophon.
- **Layout:** hero full-width band (`--bg`); race cards `grid` 1-col → `md:grid-cols-2`; news carousel horizontal-scroll on mobile, 3-up peek on desktop. Sections alternate `--bg`/`--bg-alt`.

#### `/drivers`
- **Leads:** `DriversGrid` roster — the printed team sheet.
- **Supports:** `SeasonSelector` (mono segmented control at top), driver `DriverCard` clippings.
- **Recedes:** empty-state / count meta (`--faint`).
- **Grid:** keeps existing responsive columns, re-skinned — `grid gap-6` `grid-cols-1` → `sm:grid-cols-2` → `lg:grid-cols-4`. Cards: `--bg-alt`, 1px `--hairline` frame, avatar dot circular (allowed exception to 2px radius).
- **DriverModal:** centered sheet, `--bg-paper`, `max-inline-size: 42rem`. **AchievementBadges** render as the brass/silver/bronze **medal ladder** inside a case-stamp frame; rating bars become sector bars with an oxblood fill tip.

#### `/schedule`
- **Leads:** `ScheduleList` — the calendar of record, one row per event.
- **Supports:** `NextRaceWidget` reference at top; season/round dateline eyebrow.
- **Recedes:** past-event rows dimmed to `--ink-2`/`--muted`; the three modals (event / results / info) are on-demand.
- **Row layout (desktop):** keep the existing `md:grid md:grid-cols-[60px_1fr_120px_100px_100px_90px_36px]` rhythm, re-skinned — mono round number, event name in slab, status **file-tag in a fixed column slot** (glyph + uppercase mono label + hue). Statuses: **Live** = oxblood ON-AIR chip w/ timing-tick; **Upcoming** = info hollow-circle; **Completed** = success check; **Postponed** = warning triangle; **Cancelled** = destructive triangle. Header row = the Double Rule.
- **Mobile (`< md`):** the grid collapses to a stacked card per event (existing `flex flex-col gap-2` fallback) — status file-tag pinned to the block's inline-start, name leads, date/circuit recede as mono meta. No horizontal scroll on schedule.
- **Modals:** `max-inline-size` `44rem` / `56rem` / `36rem` (matching current `max-w-2xl/4xl/5xl`), ground `--bg-paper`, hairline frame; results modal uses the Standings/Results table treatment (§6 stats note + §7).

#### `/statistics` (standings) & `/stats` (dashboard)

Both use `--page-max-wide` (1280px). These are the **timing towers** — the crown jewels.

**`/statistics` — StandingsTable / RaceResultsTable / constructors:**
- **Leads:** the standings table itself.
- **Supports:** `SeasonSelector`, main/wild/constructors tabs (oxblood active underline).
- **Recedes:** legend, footnotes (`--muted`).
- **Table layout:** mono tabular numerals lock columns; `thead` opens with the Double Rule and sits on `--bg-sink`; ~3% ink zebra on body rows; **oxblood marks P1 / the leading row via `border-inline-start`** (RTL-mirrors); medal rows (P1/P2/P3) via brass/silver-ink/bronze-ink frame + label, not hue alone.

**`/stats` — StatsPageContent dense dashboard:**
- **Leads:** the selected driver's identity block + Driver Rating (sector-bar hero) and rank cards.
- **Supports:** metric tabs, radar/bar/line charts, H2H compare, stat tiles.
- **Recedes:** filter chips, search selects, secondary axis labels.
- **Charts:** Recharts theme — `--datum` `#8A7E6A` for background/unselected series; **oxblood ONLY on the single highlighted trace**; categorical fallback `datum → info → success → warning → muted`. No glow, no gradient fill.
- **Sector bars** for the 5 rating axes + Racecraft + DNA (flat oxblood over `--bg-sink` dim track). **Delta chips** (arrow + sign + value + color) on every position/points/gap change.

#### `/news` (list) & `/news/[slug]` (article)
- **List — Leads:** newest article as a lead clipping; **Supports:** grid of article cards; **Recedes:** category tags (`NewsCategoryTag`), dates (`--muted`). Grid `grid-cols-1` → `sm:grid-cols-2` → `lg:grid-cols-3`, `--page-max`.
- **Article — Leads:** headline (Zilla Slab) + **italic dateline** (the deliberately-owned editorial affordance) + hero `NewsImage`; **Supports:** prose body at `--page-max-prose` (704px) for optimal measure, `NewsArticleActions`; **Recedes:** related links, share row. Body ground `--bg-paper`; pull-quotes use the reserved 300-italic. `ZoomableImage` opens as a `--bg-paper` sheet.

#### `/privacy`
- Single reading column at `--page-max-prose`. Leads: H1 nameplate-style title; supports: body prose; recedes: last-updated dateline (`--muted`, mono).

#### Steward portal `/stewards/*` (`--page-max-wide`)
The record office. Distinct from public bands but same token set.
- **login / change-password:** narrow centered card (`max-inline-size: 24rem`, `--bg-paper`, hairline frame). Leads: nameplate + form; recedes: help text.
- **dashboard:** Leads: attention queue (cases needing action, file-tag statuses); Supports: metric tiles + recent activity; Recedes: archived counts.
- **cases / cases/[id] / appeals / appeals/[id]:** list pages lead with the **case table** (`thead` Double Rule, fixed status column slot). Detail pages lead with the case header inside a brass **case-stamp frame** when a verdict is published ("RULING" / "OFFICIAL RECORD" stamp); supporting timeline recedes as a hairline-separated log; attachments recede to a mono file list.
- **penalties / penalties-to-serve:** table-led; the 7 `PenaltyToServe` statuses render as file-tags in a fixed column (pending=warning/hollow-circle, assigned=info/filled-square, awaiting_confirmation=warning/circle-ring, served=success/check, not_served=destructive/triangle, rolled_forward=bronze-ink/arrow, cancelled=muted/box-strike).
- **admin:** table-led user management; destructive actions use `--destructive`, never oxblood.

**Status layout invariant (all steward + schedule tables):** every status occupies a **fixed inline-start column slot** carrying glyph → label → hue, so state is scannable in grayscale, in print, and for colorblind stewards. Oxblood and `--destructive` never share a component role.

---

### 7. Dense-Table Behavior — mobile-first + desktop

Standings, race results, and steward tables are the load-bearing surfaces. Behavior:

| Concern | Desktop (`≥ lg`) | Tablet (`768–1023`) | Mobile (`< 768`) |
|---|---|---|---|
| Container | `--page-max-wide` (1280px) | full gutter width | full gutter width |
| Wide table (>viewport) | fits or horizontal-scrolls within a bounded region | **horizontal scroll** with pinned columns | **horizontal scroll** with pinned columns |
| Frozen columns | first 1–2 columns pinned (`position: sticky; inset-inline-start`) | same | same |
| `thead` | sticky top, Double Rule, `--bg-sink` | same | same |

**Sticky-cell fix (retires the documented landmine).** `ResultsTable.tsx` currently computes pre-blended dark hex for sticky cells (`stickyBodyCellBg`) and a black drop-shadow on the last frozen column — both are dark-theme artifacts. Under the broadsheet:

- Frozen cells are backed by the **SOLID** tokens `--bg-paper` (`#FBF8F0`) for body / `--bg-sink` (`#DED4BF`) for the pinned gutter and thead — **never opacity tints**, so a frozen column can never render as a dark bar over paper. This is exactly why those two are solid tokens.
- The last-frozen shadow is replaced by a **1px `--hairline-strong` inline-end rule** (a column-gutter rule), not a shadow (drop shadows banned).
- Zebra tint recomputes as ~3% `--ink` over the *current* ground so frozen and scrolling cells share the same stripe.

**Scrollbar & affordance.** Keep the current hidden-scrollbar treatment on the scroll region; add a 1px `--hairline` fade rule at the scroll edge as the "more columns" cue (no gradient). Never collapse a table to cards on `/statistics` — the timing-tower reading depends on aligned mono columns; horizontal scroll is the correct broadsheet behavior. `/schedule` is the one exception (stacks to cards) because each event row is a discrete record, not a comparative column.

---

### 8. Mobile Navigation Model

- **Header on mobile (`< md`):** 56px sticky bar — **nameplate (collapsing to nameplate-only under 480px) + Join Now + burger**. Dateline and folio drop. The Double Rule stays as the bottom edge.
- **Menu:** keeps the existing toggle (`isOpen` state, `aria-expanded`). Re-skinned to an **opaque `--bg` panel** (no dark fill, no blur) that expands below the masthead, separated by the Double Rule. Full-width stacked links, each `py-3` (44px min touch target). **Active link = oxblood 2px inline-start rule + `--ink` text** (a link becoming a rule), inactive = `--ink-2`. `StewardNotifBadge` and the "Coming soon" tag preserved as oxblood/warning chips.
- **Motion:** menu open/close is a 150ms opacity + tone-step, no slide-bounce, respects `prefers-reduced-motion` (instant swap).
- **Reachability:** primary CTA (Join Now) stays in the bar, always thumb-reachable; NextRaceWidget docks bottom inline-end so it never overlaps the burger.

---

### 9. Consistency Guarantees

- **One token layer.** All widths, gutters, spacing, grounds, and rules above resolve to tokens in `globals.css @theme` (Tailwind v4, no config file). A rebrand is a token swap.
- **RTL by construction.** Every measure uses logical properties; the Hebrew edition mirrors the grid, the oxblood P1 rule, the frozen-column gutter, and the nav active-rule automatically. Mono numerals stay LTR-isolated inside RTL.
- **Flat depth only.** Layering is expressed solely through `--bg` / `--bg-alt` / `--bg-sink` / `--bg-paper` and 1px rules — no shadows, gradients, blur, or glow appear anywhere in the layout system.
- **Radius 2px everywhere** except genuinely circular marks (avatar dots, live dot, hollow-circle glyph).
- **No feature removed.** SeasonSelector, all three schedule modals, H2H, stats tabs/charts, achievement badges, notif badge, contact form, RSS/debug routes, and the floating countdown all retain their function — they are re-cased, not cut.

---

## 7. Motion, Signature Devices & Imagery

> **Governing principle.** Motion is *ink being pressed*, devices are *the furniture of a broadsheet*, and imagery is *filed on the record* — documentary, restrained, precise. Nothing here introduces a gradient, a glow, a drop shadow, a blur, a scale-bounce, or a rounded pill. Depth is only ever the four tone steps (`--bg #F4EFE4` / `--bg-paper #FBF8F0` / `--bg-alt #EAE2D0` / `--bg-sink #DED4BF`) and 1px rules. Every value below is a token or a concrete measurement; a rebrand is a token swap.

---

### 1. Motion Language

#### 1.1 Duration & easing scale (tokenized)

All timing lives as CSS variables in the `@theme` layer so no component hardcodes a duration.

| Token | Value | Use |
|---|---|---|
| `--motion-instant` | `0ms` | Sector-bar fill and delta-chip appearance on first paint; reduced-motion collapse target. |
| `--motion-fast` | `120ms` | Hover tone-step, ghost-button underline draw, icon color reinforcement. |
| `--motion-base` | `150ms` | Filter cross-tone on sector bars / delta chips / charts; tab-underline slide. |
| `--motion-slow` | `200ms` | Modal / sheet open, disclosure expand, row expand. |
| `--motion-tick` | `1000ms` | The live "ON AIR" timing tick (discrete, stepped — see 1.3). |
| `--ease-press` | `cubic-bezier(0.2, 0, 0.2, 1)` | The single global ease-out. "Ink settling," never overshoot. |
| `--ease-step` | `steps(1, end)` | Discrete swaps: countdown digits, the timing tick. |

**Hard rules.** Only three properties may transition: `opacity`, `background-color`/`color` (the tone-step), and the `transform`/`width` of an **inline-start underline or rule that draws in**. No `box-shadow`, `filter`, `backdrop-filter`, `scale`, or `translate`-for-drama transitions. No easing that overshoots (no `cubic-bezier` with a value >1 or <0 on the output axis).

#### 1.2 The motion catalogue (keyframe-level intent)

| Named motion | Trigger | Spec | Class hook |
|---|---|---|---|
| **Underline-becomes-rule** | Ghost button / nav link / active tab hover + `:focus-visible` | An oxblood (`--accent #7E2A1E`) 1px rule grows from the inline-start to full text width over `--motion-fast`, `--ease-press`. Uses `transform: scaleX(0→1)` with `transform-origin: inline-start` (RTL: origin flips via logical handling). Never a fill. | `.link-rule`, `[data-nav-underline]` |
| **Tone lift** | Row / card / secondary-button hover | `background-color` steps one tone lighter (e.g. `--bg-alt → --bg-paper`) over `--motion-fast`. Ink text unchanged. No border added on hover — the hairline is always present. | `.hover-tone` |
| **Cross-tone (data)** | Filter change on sector bars, delta chips, rank cards, chart series | The changed value cross-fades its fill/tone over `--motion-base`. Position/label update instantly; only the tone eases. | `.data-crosstone` |
| **Sheet press** | Modal / drawer / ScheduleList modal open | Content fades `opacity 0→1` over `--motion-slow` with a ≤4px inline-start `translateX` settle (logical). Backdrop is a flat `--ink`-at-40% scrim fade — no blur. | `.sheet-in` |
| **Disclosure** | Row expand, accordion, "read more" | `grid-template-rows: 0fr→1fr` (or height) over `--motion-slow`, `--ease-press`; content opacity `--motion-base`. | `.disclose` |
| **Digit swap** | Countdown, live lap/position updates | Crisp mono digit replacement via `--ease-step` — **no odometer roll, no flip**. Old digit out / new digit in, `--motion-fast`. | `.num-swap` |
| **Stamp settle** | A verdict/award transitioning to "on the record" | The brass case-stamp frame appears at `opacity 0→1` over `--motion-slow`. One-time, on state change only — never a loop, never on scroll. | `.stamp-in` |

#### 1.3 The live / countdown affordance (the one ambient motion)

The **Timing Tick** is the *only* self-perpetuating animation in the entire system. It lives exclusively on the live-race "ON AIR" chip (NextRaceWidget live state, ScheduleList `Live` file-tag, homepage live panel).

```
Anatomy of ON AIR chip:
[ ● ]  ON AIR              ← filled oxblood dot + uppercase mono label
 └ the dot ticks; the label and dot never change color
```

- **Tick behavior:** the oxblood dot's `opacity` steps between `1.0` and `0.35` on a **discrete `steps(1)` beat every `--motion-tick` (1s)** — a stopwatch hand advancing, *not* a smooth sine pulse. `animation-timing-function: --ease-step`.
- **Liveness is carried by three redundant channels:** motion (the tick) + the filled dot shape + the "ON AIR" label. Color alone never signals live. No glow, no ring, no scale.
- **Countdown (NextRaceWidget):** digits are Spline Sans Mono `tabular-nums`, LTR-isolated (`unicode-bidi: isolate; direction: ltr`) even inside RTL. They update via **Digit swap** (1.2) on the second boundary. The colon separators do not blink.
- **Reduced motion:** the tick degrades to a **static filled oxblood dot + label** (no opacity animation); the countdown still swaps digits (that is information, not decoration — it is exempt as a data update but uses no easing).

#### 1.4 `prefers-reduced-motion`

A single global block, not per-component opt-outs:

```
@media (prefers-reduced-motion: reduce) {
  * { animation-duration: 0.01ms !important; animation-iteration-count: 1 !important;
      transition-duration: 0.01ms !important; scroll-behavior: auto !important; }
}
```

- The Timing Tick → static filled dot + label.
- Underline-becomes-rule → the rule is simply present in hover/focus end-state (instant).
- Sheet press / disclosure → instant state swap, no translate.
- **Guarantee:** no motion in the system ever conveys information not *also* carried by shape, label, position, or a delta value. Turning motion off never loses meaning.

---

### 2. Signature Graphic Devices

Five named devices. Each has a single owner-role and an explicit **may / may-not** boundary. All are flat, hairline-first, and use logical properties for RTL.

#### 2.1 The Double Rule (thin-over-thick)

The broadsheet's signature separator and the identity's answer to a single gold hairline.

- **Anatomy:** a `1px` `--hairline` (`rgba(28,23,18,0.14)`) sitting `3px` above a `2px` `--hairline-strong` (`rgba(28,23,18,0.30)`). Opened by **one** short oxblood tick (`--accent`, `2px × 10px`) at the **inline-start** only.
- **May appear:** under the masthead; above **every** table `thead`; to open each `Section`. On tables with **8+ columns**, joined by `1px --hairline` **column-gutter rules** between column groups.
- **May NOT:** appear more than once per section boundary; carry more than one oxblood tick; be used as a decorative divider inside body copy; ever be filled or tinted. The tick is oxblood and nothing else.

| Surface | Application |
|---|---|
| Header / masthead | Full-width double rule beneath nameplate + dateline. |
| ResultsTable / StandingsTable / RaceResultsTable | Above `thead`, with column-gutter rules when ≥8 cols. |
| Section | Opens each `<Section>` block on `/`, `/statistics`, `/stats`. |

#### 2.2 Masthead + Live Dateline + Case-Stamp Frame

- **Masthead:** bilingual nameplate — **Qav Rishon** (Zilla Slab 700) and **קו ראשון** (Frank Ruhl Libre) as *equals*, sized independently so visual weight matches across scripts. Flanked by a mono **dateline** (`season · round · circuit · GMT+3`, Spline Sans Mono, `--muted`, `300 italic` permitted here) and a small oxblood **folio number**. On `<480px`, reduces to nameplate-only.
- **Case-Stamp Frame:** a `1px` **brass** (`--brass #9C7A3C`) rectangle with `2px` corners and a stamped eyebrow (`OFFICIAL RECORD` / `RULING` / `CHAMPION`, uppercase, `--brass-ink`, tracked `0.18em`). Brass = **permanence / on-the-record**.
- **May appear:** masthead on every page; case-stamp frame **strictly** on filed content — published steward verdicts, appeal rulings, season awards (AchievementBadges), the champion record.
- **May NOT:** the brass frame is never a fill, never adjacent to an oxblood fill, never decorative, never on live/in-flight content. It never stacks on the same element as HUD corner brackets (§2.5) — permanence and liveness are mutually exclusive states.

#### 2.3 Sector Bars + Signed Delta Chips

- **Sector Bars:** the 5 rating axes + Racecraft + DNA render as **segmented 3-tick bars** (S1/S2/S3 anatomy) — flat `--accent` oxblood fill over a `--bg-sink` dim track. Gap between segments `2px`; track height `8px`; corners `2px`. **No gradient, no glow, no rounded ends.** Replaces plain bar-rules in StatsPageContent and DriverModal rating meters.
- **Delta Chips:** every position/points/gap change and H2H comparison renders as a signed mono chip — **Lucide arrow (1.5px stroke) + explicit sign + `tabular-nums` value**. `--success #3F6B3A` for gain, `--destructive #9A2B1C` for loss. Four redundant channels (arrow + sign + value + color) survive grayscale and colorblind checks.
- **`--best` mark:** session/overall-best marks may use a strictly lint-guarded quarantined `--best` token on **DATA cells only** (fastest-time / personal-best figures) — **never chrome**, never a background, never on a control.

| Surface | Device |
|---|---|
| StatsPageContent (rating axes, DNA, progress) | Sector bars. |
| StatsPageContent / DriverModal / StandingsTable | Delta chips on any changed value. |
| RaceResultsTable (fastest lap) | `--best` mark on the fastest-time cell only. |

- **May NOT:** sector bars never carry a gradient or animate on a loop; delta chips never appear without a value (no bare arrow); `--best` never touches a button, badge chrome, or frame.

#### 2.4 Shape-First File-Tag Status

One `StatusBadge` primitive drives all steward + schedule statuses. **Shape is read before color; hue is confirmation only.** Anatomy: `[Bauhaus glyph] + [UPPERCASE tracked mono label] + [fixed column position]`.

| Domain | State → glyph / hue |
|---|---|
| **CaseStatus (6)** | Open = hollow-circle / `--info`; Waiting for Response = hollow-circle-outline / `--info`; Under Review = triangle / `--warning`; Verdict Ready = stamp / `--brass`; Closed = check / `--success`; Archived = box / `--muted`. |
| **PenaltyToServe (7)** | pending = hollow-circle / `--warning`; assigned = filled-square / `--info`; awaiting_confirmation = circle-ring / `--warning`; served = check / `--success`; not_served = triangle / `--destructive`; rolled_forward = arrow / `--bronze-ink`; cancelled = box-strike / `--muted`. |
| **AppealStatus (4)** | Reuses the same glyph+label+position vocabulary. |
| **Schedule** | Live = filled dot / `--accent` (ON AIR, §1.3); Upcoming = hollow-circle / `--info`; Completed = check / `--success`; Postponed = triangle / `--warning`; Cancelled = box-strike / `--destructive`. |

- **May NOT:** never rely on hue alone; never omit the label; never let oxblood and `--destructive` red share a component role. Glyphs are Bauhaus primitives at `1.5px` stroke, `2px` radius (except the genuinely circular hollow-circle and the live dot).

#### 2.5 HUD Corner Brackets

Four short **L-shaped `1px --hairline` corner brackets** (arm length `12px`) framing a surface — a precision cue, *not* a full box.

- **May appear:** key instrument surfaces only — NextRaceWidget countdown, the live-race panel, a focused/selected stat tile in StatsPageContent.
- **May NOT:** never on record/permanence content (that is the brass case-stamp frame, §2.2); the two devices **never stack on one element**. Not decorative; not on cards, tables, or list rows. Oxblood is permitted only if the bracketed surface is *live* (then the brackets stay hairline; the liveness lives in the ON AIR chip, not the brackets).

---

### 3. Imagery & Photography Treatment

Imagery is **filed, not staged** — every image reads as a clipping pasted onto the paper of record. Existing assets and routes are preserved exactly (`/public/drivers/{driver_id}.webp`, `/public/events/{event_id}.*`, `/public/teams/*`).

#### 3.1 Universal image rules

| Rule | Value |
|---|---|
| Corners | Flat `2px` (matches global radius). Never rounded pills, never circles — **except** the avatar dot / live dot / hollow-circle glyph. |
| Frame | `1px --hairline` on every image. Promotes to `1px --brass` case-stamp frame **only** when the image is on-the-record (champion portrait in AchievementBadges, official event poster). |
| Elevation | **None.** No drop shadow, no glow. Separation is the hairline frame + tone step of the surface behind it. |
| Background behind image | `--bg-paper` (the "fresh page") so the clipping lifts off the bone band. |
| Loading | Flat `--bg-sink` placeholder block (no shimmer sweep, no gradient skeleton). Fades in `opacity 0→1` over `--motion-base`. |
| Overlay text (posters/hero) | Solid `--ink`-at-appropriate-opacity band behind text — **never** a gradient scrim. Text is `--bg-paper` on the ink band. |

#### 3.2 Per-asset treatment

| Asset | Treatment |
|---|---|
| **Driver photos** (`DriverCard`, `DriverModal`, `DriversGrid`) | `2px` flat corners, `1px --hairline` frame, `--bg-paper` backing. Duotone-free — photos run at natural color but sit on the bone ground so they read as printed. On `DriverCard`, the driver name is Zilla Slab; nation/team meta is Spline Sans Mono `--muted`. |
| **Team logos** (`/public/teams/*`) | Displayed at native color on `--bg-paper`; `1px --hairline` frame optional (omit for transparent-PNG marks that already read as ink). Never recolored, never given a glow. |
| **Event posters** (`HomeRaceCards`, `ScheduleList`, event modals) | The clipping. `2px` corners, `1px --hairline`. Poster for a **completed, official** result may take the brass case-stamp frame + `OFFICIAL RECORD` eyebrow. Overlay title uses a solid ink band, no scrim gradient. |
| **Hero image** (`/` homepage) | Treated as the front-page lead cut: `--bg-paper` mount, `1px --hairline-strong` frame, double rule (§2.1) beneath. **No** full-bleed gradient hero, **no** parallax, **no** Ken Burns motion. Any overlay text sits on a solid ink band. |
| **ZoomableImage** | Zoom is a flat scale of the *content* inside a fixed hairline frame; the frame and backdrop do not blur. Backdrop is `--ink`-at-40% flat scrim (no glassmorphism). Zoom transition `--motion-base`, `--ease-press`, no bounce. |
| **News imagery** (`NewsCarousel`, `/news`, `/news/[slug]`) | Article thumbnails as clippings: `2px` corners, `1px --hairline`, `--bg-paper` backing. Carousel advances by a flat opacity/position cross, `--motion-base` — no slide-with-easing-bounce, no auto-play faster than a readable cadence. |
| **The folded-page corner** (identity clip) | The one permitted decorative image affordance: a subtle folded top-inline-end corner on "clipping" cards (`--bg-alt` fill card, `1px --hairline`). Rendered as a `1px` hairline fold triangle, `≤14px` — **not** a chicane, **not** a gradient, **not** a shadow. Use sparingly on `HomeRaceCards` and news clippings; never on data tables.

#### 3.3 What imagery may NOT do

- No gradient scrims, glassmorphism, blur, drop shadows, glows, or vignettes anywhere.
- No duotone/oxblood-tint over photos — the accent is an *ink for marks*, not a photo filter.
- No parallax, Ken Burns, auto-zoom, or motion on hero/poster imagery beyond the flat opacity fade-in (§3.1) and ZoomableImage's flat content scale.
- No circular crops except the avatar/live/glyph dots.
- Brass framing on imagery is reserved strictly for on-the-record content and never coexists with HUD corner brackets on the same element.

---

**Consistency check.** Every duration, easing, hue, and frame above resolves to a token already in the palette (`--accent`, `--brass`, `--success`, `--destructive`, `--info`, `--warning`, the four tone steps, the two hairlines) plus the motion tokens defined in §1.1. Oxblood remains the sole fill-capable mark; brass remains a 1px permanence line; the single ambient motion is the Timing Tick; and no device introduces a gradient, shadow, blur, or overshoot.

---

## 8. Bilingual, RTL & Accessibility

> This section governs how *Qav Rishon* behaves in Hebrew RTL and how it meets WCAG 2.1 AA. The identity's discipline — one warm-bone press stock, oxblood as the single fill-capable ink, brass quarantined to the record, shape-first status — is not a Latin-only luxury. A bilingual broadsheet prints both mastheads as equals, so RTL and a11y are native design decisions, not retrofits. **The governing rule: information must survive translation, grayscale, and a screen reader — never carried by direction, color, or hue alone.**

---

### 1. Document Direction & Language Handling

The site is one document tree served in two script directions. Direction is a data attribute on `<html>`, never inferred from content per-node.

| Concern | Mechanism | Value |
|---|---|---|
| Root direction | `<html dir="rtl" lang="he">` for Hebrew, `<html dir="ltr" lang="en">` for English | Set at layout root (`app/layout.tsx`), driven by the active locale |
| Locale swap | Full document re-render on locale change (no per-node dir toggling) | One `dir`/`lang` pair per request |
| Mixed-script islands | `lang` override on the element, never a `dir` override unless bidi requires it | e.g. an English driver name inside Hebrew body gets `lang="en"` |
| Bidi isolation | Numerals, codes, GMT offsets, and Latin names embedded in Hebrew get `dir="ltr"` + isolation | `<bdi>` or `.num` wrapper (see §4) |

**Rule:** Never set `dir` on a component to "fix" a layout bug. If a layout only looks right in one direction, the layout is using a physical property that must become logical (§2). `dir` flips are reserved for genuine bidi content isolation.

---

### 2. Logical-Property Mirroring (the RTL contract)

Every directional style uses **CSS logical properties** so a single token set mirrors automatically under `dir="rtl"`. No `.rtl-` override classes, no physical-side duplication, no per-direction stylesheets.

| Never use (physical) | Always use (logical) | Tailwind v4 class family |
|---|---|---|
| `margin-left` / `-right` | `margin-inline-start` / `-end` | `ms-*` / `me-*` |
| `padding-left` / `-right` | `padding-inline-start` / `-end` | `ps-*` / `pe-*` |
| `left` / `right` (inset) | `inset-inline-start` / `-end` | `start-*` / `end-*` |
| `border-left` / `-right` | `border-inline-start` / `-end` | `border-s-*` / `border-e-*` |
| `text-align: left/right` | `text-align: start/end` | `text-start` / `text-end` |
| `float: left/right` | `float: inline-start/end` | `float-start` / `float-end` |
| rounded-l / rounded-r | `border-start-start-radius` etc. | `rounded-s-*` / `rounded-e-*` |

**Signature-device consequences (must mirror):**

- **The Double Rule** — the short oxblood tick that opens each rule sits at the **inline-start**. In RTL it moves to the visual right automatically because it is anchored with `inset-inline-start: 0`, never `left: 0`. Column-gutter rules (`border-inline-start` on 8+ column tables) mirror the same way.
- **Leading-row marker** — the oxblood P1 marker in `StandingsTable`/`ResultsTable`/`RaceResultsTable` is a `border-inline-start: 2px solid var(--accent)` on the `<tr>`, so it hugs the reading-start edge in both directions. It is **never** `border-left`.
- **Case-stamp brass frame** & **HUD corner brackets** — symmetric, so no mirroring is needed; but the stamped eyebrow label (`OFFICIAL RECORD` / `OFFICIAL RECORD` HE equivalent) uses `text-align: start`.
- **Sector bars** fill from the **inline-start**: S1→S2→S3 grows toward reading-end. In RTL the segments render right-to-left so the "first sector" is nearest the reading origin. Anchor with logical flex direction (`flex` + `flex-row` inherits document direction; do not force `flex-row-reverse`).
- **Ghost-button hover underline** ("a link becoming a rule") draws from `inset-inline-start` so the rule grows from the reading origin in both scripts.
- **Folded-page card corner** (the clip) sits at the **inline-end** top corner via logical positioning, mirroring to the opposite visual side in RTL.

---

### 3. Directional Icon Flips (Lucide, 1.5px stroke)

Icons split into **directional** (must flip) and **absolute** (must never flip). Flip only the former, via a single `.icon-flip` utility applied under RTL (`[dir="rtl"] .icon-flip { transform: scaleX(-1); }`).

| Flip under RTL (`.icon-flip`) | Never flip (absolute meaning) |
|---|---|
| `chevron-left` / `-right` (nav, carousels, breadcrumbs, "next/prev round") | Clock / countdown glyphs |
| `arrow-left` / `-right` (back links, pagination) | Up/down **delta-chip arrows** (gain/loss is vertical, not directional) |
| `chevron-right` disclosure caret on `ScheduleList` / accordion rows | Bauhaus status glyphs (square, circle, triangle, check, box) |
| Carousel controls on `NewsCarousel`, `HomeRaceCards` | Medal / podium marks, brass stamp |
| `SeasonSelector` prev/next arrows | Live **ON-AIR** oxblood dot, timing-tick |
| `arrow-right` "read more" on `NewsCarousel` cards | Logos, national flags, avatar dots |

**Delta chips** are the sharpest trap: their arrow encodes *gain (▲) / loss (▼)*, a **vertical** semantic. It must **not** flip with direction. Keep delta-chip arrows outside `.icon-flip`.

---

### 4. Numerals Stay LTR (the timing-tower guarantee)

All numerals — positions, times, points, gaps, lap counts, license-point tallies, radar/DNA values, deltas, countdown digits, dates, GMT offsets, folio numbers — render in **Spline Sans Mono, `tabular-nums`, LTR-isolated** even inside RTL Hebrew prose. This is what lets a timing tower lock vertically regardless of document direction.

**The `.num` primitive:**

```
.num {
  font-family: var(--font-mono);   /* Spline Sans Mono */
  font-variant-numeric: tabular-nums;
  letter-spacing: -0.01em;         /* slight negative tracking */
  direction: ltr;                  /* force LTR */
  unicode-bidi: isolate;           /* isolate from surrounding bidi run */
}
```

Rules:
- Every timing/stat/date figure is wrapped in `.num` (or a `<bdi class="num">`), so `"P3 +1.204s"` inside a Hebrew sentence never reorders to `"s1.204+ P3"`.
- Table numeric columns get `.num` on the cell and `text-align: end` so digits right-align to the reading-end in both directions while staying internally LTR.
- **Signed delta chips**: the sign, arrow, and value are one LTR-isolated `.num` run — `−0.312` never renders as `0.312−`. Sign is explicit (`+`/`−`, U+2212 for minus) so it survives grayscale.
- Countdown (`NextRaceWidget`) uses the crisp mono **digit-swap** transition, LTR-isolated, so `02:14:07` never mirrors.
- Western Arabic digits (0–9) are used in both locales for consistency with the timing-tower discipline; Hebrew locale does **not** switch to a different numeral set.
- GMT offset in the dateline (`GMT+3`) is LTR-isolated so the `+3` never flips against a Hebrew masthead.

---

### 5. Per-Field Input Direction

Form fields (`ContactSection`, steward login, case/appeal/penalty forms, admin, searchable selects in `StatsPageContent`) set direction **per field by content type**, not by document locale.

| Field type | `dir` | Alignment | Notes |
|---|---|---|---|
| Hebrew free text (name, message, verdict body) | `rtl` | start | Follows document in HE locale |
| English free text | `ltr` | start | `lang="en"` if inside HE page |
| Email / URL / username | `ltr` | `text-align: start` | Always LTR — email is Latin; label still mirrors |
| Numeric (license points, penalty seconds, round no.) | `ltr` + `.num` | end | Digits align to reading-end, internal LTR |
| Mixed / unknown (search boxes, driver select) | `dir="auto"` | start | UA infers from first strong char; placeholder gets its own `dir` |
| Password | `ltr` | start | Masked; LTR avoids caret jump |

**Placeholder direction:** a placeholder is set with the same `dir` as its expected input, so a Hebrew placeholder in an email field (`dir=ltr`) is explicitly overridden with `dir="rtl"` on the placeholder text where needed. Caret and text selection must not jump — enforced by fixing `dir` on the `<input>`, not relying on `auto` for known-type fields.

**Searchable selects** (driver pickers, `SeasonSelector`): the trigger label mirrors, the numeric badge/count inside stays `.num`, and the dropdown list aligns `text-start`.

---

### 6. Hebrew Typography

Hebrew is **first-class**, chosen Hebrew-first — not a Latin subset. Two families, loaded via `next/font` with a Hebrew subset, exposed as the same logical tokens the Latin stack uses.

| Role | Latin | Hebrew | Token |
|---|---|---|---|
| Display / masthead / headlines | Zilla Slab (700/600) | **Frank Ruhl Libre** (700/600) | `--font-display` |
| Body / UI / tables / forms | Public Sans (400/500/600) | **Assistant** (400/500/600) | `--font-body` |
| Numerals (all) | Spline Sans Mono | Spline Sans Mono (digits are shared, LTR-isolated) | `--font-mono` |

**Rules & tuning:**

- **Independent hero sizing.** EN and HE display sizes are tuned separately so visual weight matches across scripts — Frank Ruhl Libre's letterforms run visually smaller at a given px, so HE headlines step up. The masthead ships **EN + HE nameplates as equals**, not translation afterthoughts; under 480px both reduce to nameplate-only.
- **Line-height.** Hebrew has no ascender/descender rhythm identical to Latin; body line-height lifts to **1.7** for Assistant (vs 1.6 Latin body) to keep dense steward prose legible. Headlines stay tight at 1.08–1.12.
- **No letter-spacing on Hebrew.** The tracked uppercase eyebrow device (`letter-spacing: 0.18em`, oxblood/brass) is **Latin-only**. Hebrew has no case and letter-spacing damages Hebrew legibility — HE eyebrows use weight + oxblood color + the same size, **no tracking, no uppercasing**. Never apply `text-transform: uppercase` to Hebrew.
- **Italics.** The identity's editorial italic (dateline + pull-quote, Zilla Slab 300 italic) is **Latin-only**. Frank Ruhl Libre italic is not idiomatic Hebrew; the HE dateline/pull-quote uses the upright serif at the same 300/400 weight, distinguished by tone (`--muted`) and rule, not slant.
- **Punctuation & marks.** Use logical quotation and gershayim conventions in HE strings; do not hard-code Latin `"`/`'` around Hebrew.
- **Mono in Hebrew.** Digits and codes inside Hebrew always come from `--font-mono`, LTR-isolated (§4) — Assistant is never asked to render tabular timing columns.

---

### 7. AA Contrast Guarantees

All text and status pairings are validated against **the three light grounds** — `--bg #F4EFE4`, `--bg-alt #EAE2D0`, and the hardest, `--bg-sink #DED4BF`. `--bg-sink` is the explicit worst case (thead rows, pinned-column gutters, disabled fields, zebra base). Every load-bearing pairing clears **WCAG AA (4.5:1 normal, 3:1 large ≥18.66px/24px or ≥14px bold)**.

| Foreground | On `--bg` | AA verdict | On `--bg-sink` (worst) | Guidance |
|---|---|---|---|---|
| `--ink` #1C1712 | ~14.8:1 | Pass (any size) | Pass | Primary text everywhere |
| `--ink-2` #3A322A | ~8.8:1 | Pass (any size) | Pass (≥~4.9:1) | Body/data values, all three grounds |
| `--muted` #6E6455 | ~4.7:1 | Pass (normal) | **Fails small** — swap to `--ink-2` | Meta/captions; on sink use `--ink-2` |
| `--faint` #9A8E79 | ~2.5:1 | **Large/decorative only** | Fail | Never load-bearing alone; watermark/disabled |
| `--accent` (oxblood) #7E2A1E | ~7.0:1 | Pass (normal) | ~3.8:1 — **use `--accent-deep`** | Links/marks; on darker surface → `--accent-deep` |
| `--accent-deep` #5A1D14 | ~10:1 | Pass | Pass (≥~5.4:1) | Oxblood-as-text on `--bg-alt`/`--bg-sink` |
| `--brass-ink` #6F5628 | ~5.4:1 | Pass (normal) | verify ≥4.5 | Award/record eyebrows |
| `--silver-ink` #5E5A52 | ~6.1:1 | Pass | Pass | P2 medal text/frame |
| `--bronze-ink` #7A4B28 | ~5.8:1 | Pass | Pass | P3 medal / historical tone |
| `--success` #3F6B3A | ~4.6:1 | Pass (normal) | verified ≥4.5 | Served/closed; icon+label always |
| `--warning` #B07A1E | pass large; **darken for small text on sink** | Large/icon | Icon+label; text-safe variant when small | Never text-only small on sink |
| `--destructive` #9A2B1C | pass | Pass (normal) | verified ≥4.5 | Penalty/error; icon+label always |
| `--info` #2F5A6E | ~5.6:1 | Pass (normal) | verified ≥4.5 | Open/procedural; icon+label |

**Enforcement rules:**
- `--muted` on `--bg-sink` (thead sub-labels, pinned-gutter meta) **must** upgrade to `--ink-2`.
- `--accent` used as *text* on any surface darker than `--bg` **must** become `--accent-deep`. As a *fill* on a mark (chip/underline/tick/sector-bar) oxblood is retained regardless (the mark is a shape, not read as text).
- Status **hue is confirmation only** — legibility never depends on distinguishing `--warning` from `--brass` by color (see §11); the shape glyph + label carry the meaning.
- `--faint` is quarantined to decorative/large-text roles; it is never the sole carrier of information.
- Non-text UI (1px rules, sector-bar track vs fill, focus ring, glyph strokes) meets the **3:1 non-text contrast** minimum: `--hairline-strong` and `--accent`/`--accent-deep` clear it against all three grounds; the `--bg-sink` sector track vs `--accent` fill clears 3:1.

---

### 8. Focus Visibility

A single global focus expression — the one place oxblood touches **every** interactive element.

```
:focus-visible {
  outline: 2px solid var(--focus);   /* --focus = --accent #7E2A1E */
  outline-offset: 2px;
  border-radius: 2px;                /* matches the flat 2px system */
}
```

- **`:focus-visible`, not `:focus`** — mouse clicks don't paint the ring; keyboard/AT navigation does.
- **Never `outline: none`** without an equally-visible replacement. The ring is the accessibility contract.
- Oxblood ring clears **3:1 non-text contrast** against `--bg`, `--bg-alt`, `--bg-sink`, and against `--ink` button fills (offset gap keeps separation). On the darkest interactive surface, the 2px offset guarantees the ring reads against the element edge.
- Ring is **direction-agnostic** (full outline, not a side border) so RTL needs no change.
- Modals/dialogs receive focus on open and **trap** focus within (§10); the ring rides the same token.
- Skip-link ("Skip to results" / HE equivalent) is the first focusable node, visually hidden until `:focus`, then shown with the standard ring at the inline-start.

---

### 9. Tap Targets & Hit Area

Minimum **44×44 CSS px** interactive target (WCAG 2.5.5 / Apple HIG), even where the visual mark is smaller.

| Element | Visual size | Hit area |
|---|---|---|
| Icon buttons (carousel arrows, close ✕, `SeasonSelector` prev/next) | 24px glyph | 44×44 min via padding |
| Status file-tag (interactive, in steward lists) | text height | row-height ≥44px; full row clickable where applicable |
| Table sort headers | text | ≥44px thead cell height |
| Delta chip (if interactive) | ~20px | 44px hit box, transparent inset padding |
| Tab triggers (`StatsPageContent`) | text | ≥44px tab height, generous `px` |
| Ghost/link buttons | text | ≥44px line-box; underline-on-hover doesn't shrink hit area |
| Modal close, dialog buttons | icon/text | 44×44 |

- Adjacent targets keep ≥**8px** gap so they aren't mis-tapped.
- Hit area is expanded with **padding or a transparent `::before` overlay**, never by scaling the visible glyph.
- Table rows in steward lists (`cases`, `penalties-to-serve`) that navigate on click expose the whole row as one ≥44px target; the file-tag glyph is decorative-within-the-target, not a separate small tap zone.

---

### 10. Dialog & Overlay Accessibility

The product is dialog-heavy: `DriverModal`, the three `ScheduleList` modals, `ZoomableImage`, steward confirmation dialogs, H2H compare. All follow one contract (shadcn "new-york" `Dialog` primitive, extended).

| Requirement | Implementation |
|---|---|
| Role & labelling | `role="dialog"` + `aria-modal="true"`; `aria-labelledby` → the modal's masthead/title; `aria-describedby` → intro/dateline where present |
| Focus on open | Move focus to the dialog (title or first control), not left on the trigger |
| Focus trap | Tab/Shift-Tab cycle within; nothing behind the scrim is reachable |
| Return focus | On close, focus returns to the invoking trigger element |
| Dismiss | `Esc` closes; scrim click closes; a visible 44×44 close control (`✕`, `aria-label` in active locale) |
| Scrim | Flat `--ink` at low opacity — **no blur, no glassmorphism** (honors the identity); still passes as an inert backdrop |
| Direction | Dialog inherits document `dir`; close control anchored `inset-inline-end` (mirrors) |
| Scroll | Background scroll locked; dialog body scrolls internally |
| `ZoomableImage` | Zoom controls keyboard-operable; `alt` text required; Esc exits zoom |
| Live regions | Async dialog results (form submit, verdict published) announce via `aria-live="polite"`; errors via `role="alert"` |

- Dialog titles use the display font (Frank Ruhl Libre in HE, Zilla Slab in EN) and carry the case-stamp brass frame **only** when the content is on-the-record (published verdict), never decoratively.
- Reduced motion: dialogs appear via instant tone-swap (no scale/fade beyond the 120–200ms opacity step), matching `motionPhilosophy`.

---

### 11. Status System — Non-Color-Dependent by Construction

The identity's central a11y promise: **shape is read before color; hue is confirmation only.** Every status carries **four redundant channels** — Bauhaus-primitive glyph + uppercase-tracked mono label (Latin) / weighted mono label (Hebrew) + fixed column position + hue — so it survives grayscale, print, and color blindness, and reads identically in LTR and RTL.

One `StatusBadge` primitive drives all vocabularies. Glyph and label are load-bearing; color is redundant.

| Vocabulary | State | Glyph (shape-first) | Hue (confirmation) | Label channel |
|---|---|---|---|---|
| **Case (6)** | Open | hollow circle | `--info` | mono label + fixed position |
| | Waiting for Response | hollow circle (outline) | `--info` | " |
| | Under Review | triangle | `--warning` | " |
| | Verdict Ready | brass stamp | `--brass` | " |
| | Closed | check | `--success` | " |
| | Archived | box | `--muted` | " |
| **Penalty (7)** | pending | hollow circle | `--warning` | " |
| | assigned | filled square | `--info` | " |
| | awaiting_confirmation | circle-ring | `--warning` | " |
| | served | check | `--success` | " |
| | not_served | triangle | `--destructive` | " |
| | rolled_forward | arrow | `--bronze-ink` | " |
| | cancelled | box-strike | `--muted` | " |
| **Appeal (4)** | reuse Open/Under-Review/Upheld(check)/Rejected(triangle) vocabulary | as above | as above | " |
| **Schedule (5)** | Live | filled oxblood dot + **timing-tick** | `--accent` | ON-AIR label + tick motion |
| | Upcoming | hollow circle | `--info` | " |
| | Completed | check | `--success` | " |
| | Postponed | triangle | `--warning` | " |
| | Cancelled | box-strike | `--destructive` | " |

**Guarantees:**
- **Grayscale test:** every state in a vocabulary has a **distinct glyph** (or glyph+strike), so two states never rely on hue to differ. `pending` (hollow circle) vs `awaiting_confirmation` (circle-ring) differ by shape even though both are amber; `Under Review` (triangle) vs `Verdict Ready` (brass stamp) differ by shape even where warm hues sit close.
- **Colorblind safety:** oxblood `--accent` (live/attention) and `--destructive` (penalty/error) **never share a component role**, so the deuteranope-confusable red pair is never the *only* difference — they appear on different glyphs (live dot vs triangle/box-strike) in different contexts.
- **Fixed column position:** in steward tables the status occupies one fixed, `text-start`-aligned column, so it's scannable down a column in both LTR and RTL.
- **Label localization:** EN labels are uppercase-tracked mono; HE labels are **weighted** mono (no uppercase, no tracking — §6) but keep the glyph and position identical. The glyph never localizes.
- **Live liveness:** the ON-AIR chip carries the 1s discrete **timing-tick** (stepped opacity on the oxblood dot) — liveness is motion + filled dot + label, **never** color/glow alone. Under `prefers-reduced-motion` it degrades to a static filled dot + label; the state remains fully legible.
- **Delta chips** apply the same doctrine to values: arrow (▲/▼) + explicit sign (`+`/`−`) + tabular value + `--success`/`--destructive` color = four channels; grayscale and colorblind users read the arrow and sign.

**Screen-reader text:** each status exposes an accessible label (`aria-label` or visually-hidden text) with the full state name in the active locale, so the meaning is never trapped in a glyph — e.g. the check icon announces "Served / הוגש" rather than nothing. Decorative glyphs are `aria-hidden="true"` with the text label carrying the semantics.

---

### 12. Bilingual Product Reality — Ties & Guarantees

- **Masthead as equals:** `Header` ships `Qav Rishon` (Zilla Slab) and `קו ראשון` (Frank Ruhl Libre) at independently-tuned sizes; the live dateline (`season · round · circuit · GMT+3`) keeps its numerals `.num` LTR-isolated regardless of masthead direction.
- **Timing tower integrity:** `ResultsTable` / `StandingsTable` / `RaceResultsTable` lock columns via `.num` + `text-align: end`; the oxblood leading-row marker is `border-inline-start` so P1 hugs the reading origin in both scripts; pinned/sticky cells use **solid** `--bg-paper`/`--bg-sink` tokens (never opacity tints) so frozen columns never render as a dark bar — a11y and RTL share the same fix.
- **Stats dashboard:** `StatsPageContent` tabs, searchable driver selects, and rank cards mirror via logical properties; radar/bar/line values are `.num`; the selected trace is oxblood while background series use `--datum`, so 4+ series stay distinguishable without color-alone reliance (reinforced by direct labels/legend).
- **HTML email** (contact, steward notifications) can't read the token layer, so it ships an **inline-hex** bone/ink/oxblood pass mirroring the tokens, sets `dir` per the recipient locale, and keeps numerals in a mono stack — the same non-color-dependent status labels appear as text, not color-only badges.
- **QA matrix:** because there is one light theme and RTL is logical-property-driven, the a11y/RTL test matrix is **direction × locale × the three grounds** — no dark-mode doubling. Every status vocabulary is checked in grayscale and at 200% zoom in both directions before ship.---

## 9. Functional preservation — mapping onto the existing project

This identity is a **skin over the existing functionality**, not a re-architecture. Every current feature is preserved; the spec expresses each through the new language. Explicit guarantees:

| Existing surface | Preserved as | How the identity applies |
|---|---|---|
| `ResultsTable` / `StandingsTable` / `RaceResultsTable` (main/wild/constructors) | Unchanged `ColumnDef` API, sticky/frozen columns, `hideMobile` | Spline Sans Mono tabular numerals, double-rule thead, oxblood leading-row marker via `border-inline-start`; **frozen cells use the solid `--bg-paper`/`--bg-sink` tokens — retiring the pre-blended dark-hex `STICKY_CELL_BG` landmine** |
| `StatsPageContent` (radar/bar/line, H2H, tabs, DNA, rank cards) | All charts, tabs, compares intact | Sector bars for the 5 ratings + Racecraft; Recharts JS theme with `--datum` background series + oxblood only on the selected trace (4+ series stay distinct); signed delta chips for every change |
| `DriverModal` + `AchievementBadges` | Rating bars, medals, tooltips intact | Medal **ladder** (brass/silver/bronze) reusing the existing p1/p2/p3 SVG styling — tier by frame-metal + stamp + count, not hue alone |
| `ScheduleList` (calendar, 3 modals, statuses) | Live/upcoming/completed/cancelled all intact | File-tag statuses (glyph + label + fixed position); "live" = oxblood ON-AIR chip with a stepped timing-tick, no glow |
| Steward portal (cases/appeals/penalties/admin; 6 case + 7 penalty + 4 appeal states) | Every status distinguishable | **StatusBadge with triple redundancy** (Bauhaus shape glyph + uppercase mono label + fixed position); full non-colliding hue set verified AA on all three grounds; scannable in grayscale/print and for color-blind stewards |
| Contact form, news article prose, carousel, countdown widget | All intact | Public Sans forms, editorial prose with italic pull-quotes, mono countdown with digit-swap |
| HTML emails (`notifications.ts`, `contact/route.ts`) | Same triggers/content | Separate inline-hex bone/ink/oxblood pass (email can't read the token layer) |

**No feature is removed, no route is dropped, no data contract changes.** The business logic, CSV data layer, stats engine, and steward workflow are untouched by this spec.

**How this connects to the roadmap.** This identity is what Phases 3–6 of [implementation-roadmap.md](./implementation-roadmap.md) build toward: the `@theme` token layer (Phase 3) is the palette + type + radius defined here; the shadcn primitives (Phase 4) are the component specs in §4; the route-by-route flip (Phase 5) applies the page hierarchy in §5; motion/imagery (Phase 6) is §6; and the RTL/a11y work (§7 here + Phase 9) is one shared logical-property system with the multilingual plan.

---

## 10. Open decisions before implementation

- **Masthead wordmark:** "Qav Rishon" is a working name derived from the identity concept ("front row"), not a locked brand name. Confirm the actual merged-league name; the identity system (broadsheet, oxblood+brass, slab-serif) holds regardless of the final name.
- **The quarantined `--best` data token** (fastest-lap / session-best marks) is proposed as a strictly lint-guarded fourth data color; confirm whether you want it, or whether best-marks should use oxblood + a "★" glyph instead (one fewer color).
- **Italic dateline/pull-quote:** confirm you're comfortable owning italics (the reference forbids them) — they're core to the "broadsheet voice" differentiation.
- **Fonts:** Zilla Slab, Public Sans, Spline Sans Mono, Frank Ruhl Libre, and Assistant are all open-license and on Google Fonts (loadable via `next/font`), but confirm the licensing/hosting path before Phase 3.
- **Night edition:** a dark token-swap is designed to be *possible* but is explicitly out of scope — confirm it stays out for v1.

---

*Produced 2026-07-01. The identity was synthesized from a judged exploration of five divergent directions; the spec sections were authored against the winning identity and the real repository surfaces. Inspired by [design-spec.md](./design-spec.md); a copy of nothing.*
