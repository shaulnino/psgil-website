# Migration Principles

> **Status:** Canonical governing principles for the entire rebrand / redesign / multilingual effort. These constraints **override** any conflicting recommendation in the other planning docs. Every plan ([migration-plan.md](./migration-plan.md), [design-system-migration.md](./design-system-migration.md), [i18n-architecture.md](./i18n-architecture.md), [implementation-roadmap.md](./implementation-roadmap.md), [ui-specification.md](./ui-specification.md)) is subordinate to this list. When in doubt, follow these.

## The principles

1. **Preserve functionality whenever possible.**
2. **Refactor before rewriting.**
3. **Never rewrite working business logic only for cleaner code.**
4. **Every implementation should leave the application in a deployable state.**
5. **Reuse existing components whenever reasonable.**
6. **Introduce multilingual support as infrastructure, not as a translation layer.**
7. **The redesign must not change user capabilities unless explicitly requested.**
8. **Keep code modular and AI-friendly for future development.**
9. **If multiple implementation strategies exist, prefer the one that minimizes future maintenance while preserving existing investment.**

---

## How the existing plans honor each principle — and what it sharpens

The plans were largely built in this spirit, so most of this is confirmation. The **"Sharpens / changes"** column is where a principle actually tightens or overrides a prior recommendation — read those.

| # | Principle | Already reflected in | Sharpens / changes |
|---|---|---|---|
| 1 | Preserve functionality | Roadmap §"cross-cutting notes" (data layer/business logic never rewritten); UI-spec §9 (no feature removed, no route dropped) | — (holds) |
| 2 | Refactor before rewriting | Design-migration: route existing inline styles **through** new primitives; keep `ResultsTable`'s `ColumnDef` API; promote trapped atoms (`TabBar`/`SearchableSelect`/`EmptyState`) | The `StatsPageContent.tsx` (3,940-line) split must be a **pure behavior-preserving refactor** (extract components, move code) — not a re-implementation. Same for any large-file work. |
| 3 | Don't rewrite working logic for cleanliness | Stats engine, CSV mappers, steward workflow all left intact | **Downgrades the `h2h.ts` name→id re-keying**: do it *only if* the new roster actually contains duplicate driver names (a correctness need), **not** as opportunistic cleanup. If no collision exists, leave it. |
| 4 | Always deployable | Roadmap's core invariant — every phase leaves a shippable site; the shadcn spike is a Phase 0 go/no-go gate | — (holds; this is the roadmap's spine) |
| 5 | Reuse existing components | Reuse `ResultsTable`, `AchievementBadges` SVGs (as the medal ladder), `SuccessModal`'s native `<dialog>` pattern, `SeasonSelector` | Prefer **re-backing** existing components with new primitives over replacing them (e.g. `SeasonSelector` → wrap the shared `Select`, don't delete). |
| 6 | Multilingual as infrastructure | This is literally the thesis of [i18n-architecture.md](./i18n-architecture.md) §8 — the ID/label split decouples **language from logic** so translation is not a bolt-on `t()` wrapper | **Explicitly sanctions the one apparent conflict with #3:** the `statsComputed`/`rewards`/`newsCategories` ID/label split *is* a rewrite of working logic, but it is **required infrastructure for a requested capability**, not cleanliness — so it is exempt from #3 and mandated by #6. |
| 7 | No capability change unless requested | UI-spec §9 functional guarantees | **Guards the status-color collapse:** reducing to one accent must **not** cost the steward's ability to distinguish 6+ statuses — hence the shape+label+position triple-redundancy is *mandatory*, not optional. The redesign is visual-only; it adds no capability and removes none. |
| 8 | Modular & AI-friendly | Token layer + shadcn primitive library + splitting the 3,940-line component + one-concern modules | Reinforces: keep files single-concern, name things by role, keep the primitive library the single source of visual truth so future changes are one-file edits. |
| 9 | Minimize future maintenance, preserve investment | shadcn adoption chosen for long-term maintenance leverage; token-driven rebrand = one-file swap | **Tie-breaker on open decisions:** favor the token/primitive path (one edit-point) over per-call-site fixes; and for the 2–3 highest-churn files, use the roadmap's escape-hatch to combine the visual + i18n passes (one-time churn is acceptable to reduce it, but never at the cost of #4). |

---

## Tensions, resolved

- **#3 (don't rewrite working logic) vs #6 (multilingual as infrastructure).** The stats/rewards/category ID→label split rewrites working code. #6 wins here **because** it is infrastructure for an explicitly requested capability (Hebrew), not a cleanliness rewrite — and it is behavior-preserving (English output stays byte-identical; the `/api/stats-export` contract is held at the boundary). This is the *only* sanctioned rewrite of working logic in the whole program.
- **#4 (always deployable) vs #9 (minimize churn).** Deployability favors coarse, independently-shippable phases; minimizing churn favors combining passes over the same files. #4 is the hard constraint (never break deployability); #9 is applied *within* it via the roadmap's per-file escape-hatch for the few highest-churn files only.
- **#1/#7 (preserve functionality/capability) vs the visual redesign.** The redesign is strictly a skin: no route, feature, form field, or data contract changes. Anything that would alter a user capability (e.g. losing status distinguishability) is treated as a bug against these principles, not an acceptable trade-off.

---

*Adopted 2026-07-01. Referenced by all planning docs; supersedes any conflicting guidance within them.*
