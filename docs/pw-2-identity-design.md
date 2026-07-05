# PW-2 — Identity Foundation (Design Doc)

> **Status:** PW-2a + PW-2b **shipped**; **refined to "Identity v2" on 2026-07-05** (§13) — adds an approval workflow, makes *driver* the default approved role, treats driver-permission accounts as the steward module's drivers, moves account administration out of the steward module, and adds driver photo upload. PW-2b needs adjustment (§14). Remaining sub-phases revised in §12.
>
> **Roadmap context:** [ARCHITECTURE.md](../ARCHITECTURE.md) decision log; roadmap PW-0 (done) → PW-1 (done) → **PW-2 (this)** → PW-3 Attendance → PW-4 Notifications → PW-5 polish.
>
> **Governed by** [docs/migration-principles.md](./migration-principles.md): preserve functionality, refactor before rewrite, reuse existing investment, always deployable, one authentication system, minimize future maintenance.

---

## 1. Objective

Give F1ISL a **single, unified account system** — the keystone the vision hangs Auth/Roles and Driver Attendance on. Today the *only* accounts are admin-provisioned steward-portal users; "drivers" are read-only CSV rows with no login. PW-2 turns the existing steward auth into a general platform identity layer, adds public self-registration, and links accounts to driver identities — **without** introducing a second auth system.

**Decision already made (2026-07-05):** extend the existing `jose` JWT + scrypt + `PERMISSION_MATRIX` — **not** a third-party auth (Auth.js/Clerk/Supabase Auth).

---

## 2. Current state (what we build on)

- **Auth:** `lib/stewards/auth.ts` — `jose` HS256 JWT in the `steward_session` httpOnly cookie; `secret()` now hard-fails in prod (PW-0). Roles `admin|steward|member` in a flat `roles[]`, enforced by `requireStewardUser()`/`requireRole()` + `PERMISSION_MATRIX`.
- **Passwords:** `lib/stewards/crypto.ts` — scrypt (16-byte salt, keylen 64), `timingSafeEqual`.
- **Users:** `StewardUser` (`lib/stewards/types.ts`) live in the steward store's `users[]` array. Created only by admins; `mustChangePassword` forces first-login reset. Referenced across the steward domain by **id string** (`complainantId`, `authorId`, `createdBy`, `submittedByUserId`, …).
- **Store:** `lib/stewards/store.ts` — Netlify Blobs (prod) / local JSON (dev), **one document**, whole-store read-modify-write serialized through an in-process `_writeQueue`. On-read migration back-fills new fields with defaults (the sanctioned schema-evolution pattern).
- **Drivers:** CSV rows keyed by stable snake_case `driver_id` (e.g. `shaul_ezra`); `lib/driversData.ts`. CLAUDE.md already mandates `driver_id` stability.
- **Email:** `nodemailer` via Gmail (`lib/stewards/notifications.ts`). **Reuse for verification/reset — no new dependency.**
- **UI:** `components/ui/` has Button, Card, Badge, Eyebrow, StatTile, StatusBadge — **but no Input/Form/Dialog primitives**; forms use raw elements today.

---

## 3. Role model

> **Superseded where it differs by §13 (Identity v2, 2026-07-05):** driver becomes the *default approved* role and the steward module's participant set; `member` is migrated into `driver`; `view_steward_area` includes `driver`; account administration moves out of the steward module. Read §13 as current intent; the below is the original PW-2a/2b model as shipped.

Canonical roles stored in `account.roles[]` (superset of today's — additive, backward-compatible):

| Role | Vision name | Meaning | Notes |
|---|---|---|---|
| `admin` | League Administrator | Full control | **unchanged** |
| `steward` | Steward | Case/verdict/appeal workflow | **unchanged** |
| `driver` | Driver | A participant linked to a CSV `driver_id`; can submit **own** attendance; can file complaints/appeals | new; inherits participant permissions the old `member` had |
| `registered_user` | Registered User | Signed-up account, no driver link (fan) | new; base authenticated role |
| `member` | — | **Retained** legacy steward-portal participant role | keep so existing cases' `complainantId` users stay valid; new signups don't get it |
| `guest` | Guest | **Not stored** — absence of a session; public read only | — |

### Access model (confirmed 2026-07-05)

**The public site stays fully public.** PW-2 is *additive* — it does not gate any content that is public today.

- **Guest (no account):** full read access to the entire public site — home, schedule, results, standings, drivers, teams, news, stats. Unchanged from today.
- **Login required only for:** the existing **steward portal** (`/stewards/*`), the personal **account/profile** page, **driver attendance submission** (PW-3), and future per-user notifications (PW-4).
- Registering is **optional** for a visitor; it only unlocks personalized/participatory features. Nothing currently public becomes gated.
- **Nav model (2026-07-05):** "My Account" is the single header hub for all signed-in areas — Profile, the **Steward module** (nested), and future driver-only areas. Stewards is not a top-level nav link. The steward area is **role-gated**: `requireStewardUser()` requires `view_steward_area` (member/steward/admin) and redirects other signed-in accounts to `/account`.

**`PERMISSION_MATRIX` changes:**
- Add `driver` to `view_steward_area`, `create_complaint`, `submit_response`, `submit_appeal` (so a driver gets exactly the participant abilities `member` has).
- New permissions (scaffolded here; enforced fully in PW-3): `submit_own_attendance` → `[driver, admin]`; `manage_attendance` → `[admin]`; `manage_own_profile` → any authenticated.

> **`team_manager` role dropped (2026-07-05, Shaul):** not needed. Team-level attendance views, if ever wanted, become an admin capability or a later addition — not a role in this model.

---

## 4. Account model (types)

Generalize `StewardUser` → the same shape with additions (keep the runtime object; a full rename to `Account` is optional cosmetic churn, **out of scope**). Add a type alias `AppRole` and widen the union:

```ts
export type AppRole =
  | "admin" | "steward" | "member"          // existing
  | "driver" | "registered_user"; // new
export type StewardRole = AppRole;          // alias kept for back-compat

export type Account = {
  id: string;
  name: string;
  email: string;                 // normalized lowercase, unique
  roles: AppRole[];
  passwordHash: string;
  isActive: boolean;
  mustChangePassword: boolean;
  emailVerified: boolean;        // NEW — grandfathered true for existing users
  driverId: string | null;       // NEW — links to CSV driver_id (null = unlinked)
  locale?: "en" | "he";
  createdAt: string;
  updatedAt: string;
};
export type StewardUser = Account; // alias kept for back-compat
```

On-read migration (existing pattern in `store.ts`): default `emailVerified: true` (grandfather current admins/stewards) and `driverId: null`.

---

## 5. Storage — the central decision

**Problem:** `writeStore()` rewrites the *entire* steward document per mutation, and the write queue is per-instance. Steward writes are rare, so this is fine today. **Registration and attendance are user-triggered and concurrent across serverless instances → last-write-wins clobbering** and an ever-growing document serialized on every write. Putting accounts in the steward monolith would couple public sign-up to the steward blob and inherit the clobber risk.

**Options considered:**

| Option | Pros | Cons | Verdict |
|---|---|---|---|
| A. Keep monolith (`users[]` in steward store) | zero new code | concurrent-write clobber; couples public signup to steward blob; unbounded doc | ❌ reject for accounts |
| **B. Per-record Netlify Blobs keys** (`account/{id}`, `account-email/{email}→id` index) | no new dependency; writes partitioned per key → no whole-store clobber; natural fit for accounts & attendance; scales to league size | no transactions (email-uniqueness has a tiny race window); list-by-prefix for admin lists | ✅ **recommended for PW-2/PW-3** |
| C. Real DB (Neon/Supabase Postgres or Turso/libSQL) | transactions, constraints, real queries | new dependency + external service + serverless connection mgmt; over-built for current scale | ⏳ defer; adopt when relational needs appear |

**Recommendation: Option B**, behind a **per-domain repository abstraction** (`lib/accounts/store.ts`, mirroring how `lib/stewards/store.ts` hides its backend). This keeps the backend swappable so the **tripwire → Option C** migration (team dashboards, reliability scores, cross-entity reporting, large notification fan-out) is a backend swap, not an app rewrite.

- **Concurrency:** accounts partition by `id`; attendance (PW-3) partitions by `(raceId, driverId)` — a driver only ever writes their own record, so **no contention**.
- **Email uniqueness (the one caveat):** maintain an `account-email/{normalizedEmail} → accountId` key; register = check-then-set. Netlify Blobs has no transaction, so two simultaneous signups with the same email have a narrow race; mitigate with check-then-set + validation on read, accept the low risk, and note that Option C removes it entirely. Log any detected collision for manual reconciliation.

**Steward case store stays monolithic** (low write volume, dense cross-references) — we only move **accounts** out.

---

## 6. Account ↔ driver_id linking

- `account.driverId` stores the CSV `driver_id` (snake_case). One-to-one: enforce a `driver_id` links to **at most one** account (uniqueness check on assign).
- **Mechanism (PW-2): admin-assign.** In the admin panel, an admin sets an account's `driverId` from a dropdown of current `csv_drivers`. Validate the id exists in the live CSV at assign time.
  - *Why not self-claim now:* the league is small and known; admin-assign eliminates impersonation risk ("I am driver X") with near-zero overhead.
  - **Deferred:** a self-serve **claim-request** flow (driver picks their identity at signup → `pending` → admin one-click approve) — document as future once volume justifies it.
- **Stability contract:** the CSV remains the source of truth for driver identity/roster; the account only *references* it. `driver_id` must stay stable (already a CLAUDE.md rule) or the link breaks.

---

## 7. Auth flows (all reuse existing infra)

- **Registration** (`/[locale]/register`): validate → create `Account` with `roles: ["registered_user"]`, `emailVerified: false` → send verification email (signed short-TTL `jose` token, purpose `verify-email`) via nodemailer. Unverified accounts can log in but see a "verify your email" banner; gating specific actions on `emailVerified` is a per-feature choice.
- **Email verification** (`/[locale]/verify?token=…`): verify token → set `emailVerified: true`. Single-use via an account `tokenVersion` counter embedded in the token (bump on use) — same idea as `mustChangePassword`.
- **Login** (`/[locale]/login`): reuse scrypt verify + JWT session. **Reuse the existing `steward_session` cookie and JWT payload** (`{sub, roles}`) so current steward sessions keep working and there's literally one session mechanism. The steward portal login stays where it is; this adds a general login for the public site.
- **Forgot / reset password** (`/[locale]/forgot-password`, `/[locale]/reset-password?token=…`): emailed signed short-TTL token → set new scrypt hash. **Anti-enumeration:** forgot-password always returns the same "if that email exists, we sent a link" response.
- **Profile** (`/[locale]/account`): view/edit name, locale, password; see driver-link status. Requires a session.

**Session generalization:** introduce `lib/auth/session.ts` (or extend `auth.ts`) with `getCurrentUser()` / `requireUser()`; keep `getCurrentStewardUser()`/`requireStewardUser()` as thin aliases. `proxy.ts` steward gate is unchanged; new `/account` and attendance pages guard server-side.

---

## 8. Routes, UI, i18n

- **New routes** (locale-prefixed, public site): `register`, `login`, `forgot-password`, `reset-password`, `verify`, `account`.
- **Header:** account menu — Login/Register (guest) vs. Profile/Logout (authed).
- **Design system:** add **`Input`, `Label`, `Field`/form-row, and a `Dialog` primitive** to `components/ui/` (they don't exist yet) and **update [DESIGN_SYSTEM.md](../DESIGN_SYSTEM.md) §6** — auth forms are the first real form surface on the public site.
- **i18n:** new `messages/{en,he}/account.json` (auth + profile strings). Hebrew reviewed by Shaul, per existing process.

---

## 9. Migration & backward-compatibility

- Existing steward/admin/member users: **move once** from the steward store's `users[]` into the per-key accounts store on first boot (bootstrap migration in the accounts repo), defaulting `emailVerified: true`, `driverId: null`. Steward code then reads users via the accounts repo. Case/verdict/appeal records reference users by **id string** — unchanged, so no data rewrite there.
- Fallback if we want less churn in one pass: keep steward `users[]` for existing accounts and put only new public accounts in the per-key store, with a unified `getUserById` that checks both (§10 decision).
- Every sub-step leaves the site deployable; the steward portal must keep working throughout.

---

## 10. Decisions (confirmed 2026-07-05)

1. **Store cutover:** ✅ **Unify now** — migrate existing steward users into the per-record accounts store this phase; one account model, no permanent split.
2. **Input validation:** ✅ **Use `zod`**, scoped to auth/attendance input.
3. **Driver linking:** ✅ **Admin-assign only** for PW-2; self-claim flow deferred.
4. **Email-verification gating:** ✅ **Browse, gate sensitive actions** — unverified users can log in and browse with a verify banner; specific actions require verification.
5. **Access model:** ✅ Public site stays fully public; login required only for steward portal, account/profile, attendance, notifications (see §3 Access model).

### Identity v2 decisions (confirmed 2026-07-05)

6. **Approval workflow:** ✅ New registrations are **pending** until an admin approves. No auto-granted access.
7. **Pending capability:** ✅ A pending account **can log in** and verify email, but sees only an "awaiting approval" state — no driver/steward abilities.
8. **Approval role:** ✅ Approval makes the account a **Driver by default** (driver permissions + steward participation); admin can downgrade to a `registered_user` (fan) or up to steward/admin.
9. **Email verification:** ✅ **Kept alongside approval** — two independent gates (verify = proves the email; approval = grants access/role).
10. **Driver photo:** ✅ An uploaded driver photo **overrides** the sheet's `photo_url`; CSV stays as fallback/seed.
11. **Admin console location:** ✅ Account administration is a **separate platform function under the "My Account" menu**, not inside the steward module.

---

## 11. Risks

- **Store correctness** (email-uniqueness race) — mitigated by check-then-set + logging; fully solved by Option C later.
- **Steward-module regression** during the user-store migration — mitigated by keeping id-string references intact and a full steward lifecycle smoke test.
- **Session/authorization gaps** — new public routes must guard server-side, not just in the UI (the audit already flagged one render-only enforcement gap; don't repeat it).
- **Rate limiting** — login/register/reset need throttling; the existing contact limiter is in-memory only (ARCHITECTURE §11 item 4). Consider a durable limiter here or accept the known limitation and log it.
- **Impersonation** — admin-assign linking avoids it; a future claim-flow must be designed carefully.

---

## 12. Proposed sub-phases (each independently shippable)

- **PW-2a** — ✅ **Done.** Account model (`lib/accounts/types.ts`) + per-record store (`lib/accounts/store.ts`, per-key Netlify Blobs / dev JSON) + repository (`lib/accounts/repository.ts`, zod-validated create). Steward users unified: `StewardUser`/`StewardRole` alias the account types; `readStore()` hydrates `users` from the accounts store; `writeStore()` no longer persists users; one-time migration imports the monolith's users. Verified: steward login → change-password works via the accounts store; migration produced `data/accounts/store.json` with the 3 users (emailVerified/driverId defaulted); no errors. Roles: `admin|steward|member|driver|registered_user` (no `team_manager`).
- **PW-2b** — ✅ **Done.** `lib/auth/` (session/tokens/mailer/schemas/actions); routes `/register`, `/login`, `/account`, `/verify`; `Input`+`Label` primitives (Dialog still deferred); Header account menu; `account` i18n namespace (en + he). New sign-ups → `registered_user`, `emailVerified:false`, auto-signed-in; verification via emailed token (dev logs the link). Verified in dev: register → verify → account → logout → login + error path, en & he. **Follow-ups:** localize server-action error strings; locale-aware redirects/links (default-he correct; en may land on he equivalent).
- **PW-2c** — **Accounts: approval + platform admin console** (expands the old "driver linking + admin" step). Account `status` lifecycle (`pending`/`approved`/`rejected`); registration → pending (§14 adjusts PW-2b); pending "awaiting approval" UX; a **platform admin console under "My Account"** (moved out of `/stewards/admin`): pending-approval queue, approve (default → driver) / reject, set roles/permissions, link account ↔ CSV `driver_id`. Finalize role model: `driver` added to `view_steward_area`; `member` migrated to `driver`.
- **PW-2d** — **Steward ↔ driver-account integration.** Steward "involved drivers" / complainant options are sourced from **driver-permission accounts** (using the driver link), replacing the `role === "member"` filter in the cases + admin flows. Migrate existing `member` accounts to `driver`; legacy cases (which reference account ids) are preserved unchanged.
- **PW-2e** — **Driver profile & photo.** Driver-editable profile in `/account` including **photo upload** stored dynamically (Netlify Blobs, per PW-0 upload validation); the public drivers rendering (`driversData` + DriverCard/DriverModal) **prefers the uploaded photo, falling back to `photo_url`**. Requires the account↔driver link (PW-2c).
- **PW-2f** — Forgot/reset password (anti-enumeration). Token + mailer already exist from PW-2b.

**Testing per sub-phase:** `tsc --noEmit` + lint; steward case→verdict→penalty→appeal lifecycle still works; register→pending→approve→driver flow; a pending account sees only the awaiting-approval state; driver appears as a steward participant after approval; uploaded photo shows on the drivers page; existing sessions survive; RTL/Hebrew pass; Claude Preview verification.

---

## 13. Identity v2 — refined model (2026-07-05)

Refinement from Shaul. Supersedes §3/§4/§7 where they differ.

**Account lifecycle.**
1. **Register → `pending`.** Account created with `status: "pending"`, no effective permissions, email-verification sent. The person **can log in** but sees only an "awaiting approval" screen (+ a "verify your email" prompt).
2. **Admin approves** (in the platform admin console, §below) → `status: "approved"` and, **by default, the `driver` role** (driver permissions + steward participation). Admin may instead set `registered_user` (approved fan, no driver perms) or grant `steward`/`admin`. If the person is a real driver, admin **links the account to a CSV `driver_id`** at approval.
3. **Reject** → `status: "rejected"` (kept for audit; cannot access).
4. Email verification is a **separate, independent gate** — proving the address, orthogonal to approval.

**Model change:** add `status: "pending" | "approved" | "rejected"` to `Account` (keep `isActive` for suspend/disable of an approved account; a distinct concept). Existing migrated users are grandfathered `status: "approved"`.

**Driver = approved account with driver permission.** The steward module's "drivers" (involved drivers, complainant options) are **driver-permission accounts**, not `member`-role accounts. So *driver count = accounts with the driver role*. `member` is migrated into `driver` and retired. `view_steward_area` includes `driver`, so drivers can enter the steward area to file complaints / see verdicts (the Stewards menu entry shows for them).

**Admin console — separate from the steward module.** Account administration (pending queue, approve/reject, roles/permissions, driver linking, later driver profiles) lives at a **new platform admin area reached from the "My Account" dropdown** (admin-gated), e.g. `/admin` or `/account/admin`. The user-management UI currently at `/stewards/(protected)/admin` **moves here**; the steward module keeps only adjudication (cases/verdicts/appeals/penalties).

**Driver profile & photo.** An approved, driver-linked account can edit its profile and **upload a photo** in `/account`. Stored dynamically (Blobs) and served via a resolver that **prefers the uploaded photo over the sheet's `photo_url`** (matched by `driverId → driver_id`), so the public drivers page/modal update automatically. CSV `photo_url` remains the fallback/seed.

---

## 14. Adjustments to already-shipped work (PW-2a/PW-2b + nav)

Consequences of Identity v2 for what's on the `PAW` branch — folded into PW-2c/2d/2e (no hot-patching):

- **Account model (PW-2a):** add `status` field + on-read/migration default `approved` for existing users.
- **Registration (PW-2b):** stop auto-activating. Create `status: "pending"` (no `driver`/participant perms); keep auto-login into the pending state; `/account` shows "awaiting approval". Keep email verification.
- **Access gate + Stewards menu:** add `driver` to `view_steward_area` so drivers reach the steward module and see the menu entry (currently member/steward/admin only). Gate must also block `pending` accounts from privileged areas.
- **Steward driver source (PW-2d):** replace the `role === "member"` filter (cases page + admin page + `createComplaintAction` validation) with driver-permission accounts.
- **Admin relocation:** move `/stewards/(protected)/admin` user management to the platform admin console; add an **Admin** entry to the My Account menu (admin-gated). The role editor there must handle the full role set (fixes the earlier member/steward/admin-only limitation) and add approve/reject + driver-link controls.
- **Docs drift:** CLAUDE.md §15 "driver image = `/public/drivers/{id}.webp` convention" is **inaccurate** — images come from the CSV `photo_url` column; correct it (and describe the upload-override once PW-2e lands).

---

*Drafted 2026-07-05; refined to Identity v2 same day. Sub-phases PW-2c→2f pending build.*
