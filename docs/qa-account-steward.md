# QA Plan — My Account + Steward Portal

> Scope: the full **My Account** area (`/[locale]/account`) — header, attendance, driver photo, security, logout, admin/steward shortcuts — plus the **Steward Portal** (`/stewards/*`) it links into, with emphasis on the recent redesign and the site→portal locale inheritance fix. Covers English (LTR) and Hebrew (RTL).

Legend for **Method**: `A` = automated (tsc/lint/route/curl), `C` = code-trace verification (read the implementation and confirm the branch/logic), `M` = manual browser check (needs a human; agent flags expected result).

Test personas (dev store `data/accounts/store.json`):
- **P-ADMIN-DRIVER** — roles `[admin, driver]`, linked `driverId`, active. (Sees everything.)
- **P-DRIVER** — role `[driver]`, linked `driverId`, active.
- **P-DRIVER-NOLINK** — role `[driver]`, `driverId = null`, active.
- **P-STEWARD** — roles `[steward, driver]`, active.
- **P-REGISTERED** — role `[registered_user]`, active, no driver link.
- **P-SUSPENDED** — any role, `isActive = false`.

---

## A. Access & session (`/account`)

| ID | Precondition | Steps | Expected | Method |
|----|----|----|----|----|
| A1 | Guest (no cookie) | GET `/en/account` | 307 → `/en/login?next=/account` (locale preserved) | A/C |
| A2 | Guest | GET `/account` (he) | 307 → `/login?next=/account` | A/C |
| A3 | P-SUSPENDED signed in | GET `/account` | `requireUser` blocks (isActive false) → redirect `/login` | C |
| A4 | Any active user | GET `/account` | 200, page renders | A/M |
| A5 | User with `mustChangePassword` | login → `/account` | login redirects to `/stewards/change-password`; `/account` itself does NOT force it (documented) | C |

## B. Account header

| ID | Persona | Expected | Method |
|----|----|----|----|
| B1 | P-DRIVER (photo uploaded) | avatar = `driverPhotoUrl` | C/M |
| B2 | P-DRIVER (no upload, CSV `photo_url` set) | avatar = CSV `photo_url` | C/M |
| B3 | any (no photo anywhere) | avatar = initials monogram from name | C/M |
| B4 | any | name in `<bdi>`; email `dir="ltr"` and not reversed in Hebrew | C/M |
| B5 | P-ADMIN-DRIVER | role badges: admin+steward = brass, driver/registered = ink; localized labels | C/M |
| B6 | P-SUSPENDED (if reachable) | StatusBadge = Suspended (danger); else Active (success) | C |
| B7 | P-DRIVER linked, main driver w/ team | linked line shows team logo + driver name + team name (all `<bdi>`) | C/M |
| B8 | P-DRIVER linked, driver missing from CSV | linked line shows raw `driverId` (fallback), no crash | C |
| B9 | P-DRIVER-NOLINK | linked line = "Not linked" | C/M |
| B10 | P-REGISTERED | no Steward shortcut, no Admin shortcut; only Sign out | C/M |
| B11 | P-STEWARD | Steward shortcut visible (`view_steward_area`), Admin hidden | C/M |
| B12 | P-ADMIN-DRIVER | both Steward + Admin shortcuts visible | C/M |
| B13 | any | Sign out submits `logoutAction` → clears cookie → `/` | C/M |
| B14 | Hebrew | shortcuts/sign-out row aligns to inline-end; no overflow | M |

## C. Attendance (`/account`)

| ID | Precondition | Expected | Method |
|----|----|----|----|
| C1 | No current-season next race (`fetchNextRaceWindow` → none) | attendance card NOT rendered at all | C |
| C2 | Race exists, window `open`, P-DRIVER linked | segmented selector editable; current status highlighted; save is immediate | C/M |
| C3 | Race exists, window `before` | selector shown read-only? No — editable=false → shows "Your response" + badge/no-response; notice = opensNotice | C |
| C4 | Race exists, window `closed` | editable=false; notice = closedNotice; response read-only | C |
| C5 | P-DRIVER-NOLINK, race exists | no selector (canRsvp false); roster still visible | C/M |
| C6 | P-REGISTERED, race exists | no selector; roster visible (read-only to any signed-in user) | C |
| C7 | Click Going/Maybe/Out while open | `setAttendanceAction` saves `setBy:driver`, revalidates; new status reflected | C/M |
| C8 | Attempt save while window not open (forged) | server rejects: "Attendance for this race isn't open right now." | C |
| C9 | Attempt save for a non-next race (forged raceId) | server rejects (raceId mismatch) | C |
| C10 | P-SUSPENDED | can't reach page (A3); server action also blocks (`!isActive`) | C |
| C11 | Summary with 0 responses | "No responses yet." (no empty 3-col grid) | C/M |
| C12 | Summary with responses | count chips always visible; "Show names" expands grouped names; team logos where available | C/M |
| C13 | Double-header race | label includes "(double-header)" localized | C |
| C14 | Hebrew | race name `<bdi>`, date/time `dir="ltr"` not reversed; counts tabular `.num` | C/M |
| C15 | pending state | buttons disabled during submit (no double submit) | C/M |

## D. Driver photo (`/account`)

| ID | Precondition | Expected | Method |
|----|----|----|----|
| D1 | non-driver role (registered) | photo card NOT shown (`showDriverPhoto=false`) | C |
| D2 | driver role, `driverId=null` | card shows "not linked" message, no uploader | C/M |
| D3 | driver role + link | uploader shown with current photo or placeholder icon | C/M |
| D4 | choose file via click | preview updates to chosen file; Save/Cancel appear | M |
| D5 | drag-drop image onto frame | file accepted, assigned to input, preview shows | M |
| D6 | choose oversized (>5MB) | client error "exceeds 5 MB", no submit | C/M |
| D7 | choose wrong type (e.g. .txt/pdf) | client error "Unsupported image type" (accept filter + JS check) | C/M |
| D8 | Save valid image | `uploadDriverPhotoAction` saves, redirect `/account?photo=1`, success flash, new photo shown | C/M |
| D9 | server rejects (e.g. corrupt) | inline server error surfaced | C |
| D10 | Cancel after choosing | preview cleared, input reset, current photo remains | M |
| D11 | object URL cleanup | no memory leak (revoked on change/unmount) | C |
| D12 | Hebrew | filename `<bdi>`; drop hint + hint text RTL-correct | C/M |

## E. Security / password (`/account`)

| ID | Steps | Expected | Method |
|----|----|----|----|
| E1 | Open Security card → "Change password" | Dialog opens (focus trap, Escape closes, backdrop closes) | C/M |
| E2 | Submit with wrong current password | inline error "current password is incorrect" | C/M |
| E3 | New password < 8 chars | server/zod error surfaced; `minLength` also on input | C/M |
| E4 | New ≠ confirm | error "New passwords do not match." | C/M |
| E5 | Valid change | `changeOwnPasswordAction` returns `{ok}`; dialog shows success + Close; no full reload | C/M |
| E6 | show/hide toggles | each field toggles type; aria-label swaps | C/M |
| E7 | pending | Change button shows spinner + disabled (no double submit) | C/M |
| E8 | password fields dir | inputs are `dir="ltr"` | C/M |
| E9 | reopen after success | fresh form (state reset via unmount on close) | C |

## F. Layout & responsive & RTL (`/account`)

| ID | Expected | Method |
|----|----|----|
| F1 | Desktop + race: 2-col grid (attendance span-2 / photo+security) | C/M |
| F2 | Desktop no race: photo+security 2-col (`sm:grid-cols-2`) | C/M |
| F3 | Mobile: single column; order header → attendance → photo → security | C/M |
| F4 | Hebrew: whole page RTL; no horizontal scroll | M |
| F5 | English: LTR preserved | M |
| F6 | max width `max-w-4xl`, compact `p-5/6` cards (less empty space than before) | C/M |

## G. i18n integrity

| ID | Expected | Method |
|----|----|----|
| G1 | `messages/en/account.json` + `he/account.json` valid JSON; all new keys present in both | A/C |
| G2 | `messages/en/attendance.json` + `he` have `yourResponse/showNames/hideNames` | A/C |
| G3 | No missing-key console errors on `/account` in he or en | M |
| G4 | `roleLabels.*` exist for all 4 roles both locales | C |

## H. Steward portal access (`/stewards/*`)

| ID | Precondition | Expected | Method |
|----|----|----|----|
| H1 | Guest | GET `/stewards` → 307 `/stewards/login?next=/stewards` (proxy.ts) | A/C |
| H2 | Guest | `/stewards/login` public → 200 | A |
| H3 | P-REGISTERED (no `view_steward_area`) signed in | GET `/stewards` → `requireStewardUser` redirects to `/account` | C |
| H4 | P-DRIVER (`view_steward_area` includes driver) | `/stewards` renders dashboard | C/M |
| H5 | P-STEWARD / P-ADMIN-DRIVER | `/stewards` renders; nav + role display correct | C/M |
| H6 | `mustChangePassword` user | login → redirect `/stewards/change-password` | C |
| H7 | account→portal link | header account menu + `/account` Steward shortcut both link `/stewards` (unprefixed) | C |

## I. Locale inheritance (the fix) — critical

| ID | Precondition | Expected | Method |
|----|----|----|----|
| I1 | Browsing `/` (he) sets `NEXT_LOCALE=he` | GET `/stewards/login` with `NEXT_LOCALE=he` → `<html lang="he" dir="rtl">` | A |
| I2 | Browsing `/en/*` sets `NEXT_LOCALE=en` | GET `/stewards/login` with `NEXT_LOCALE=en` → `lang="en" dir="ltr"` | A |
| I3 | No cookie (fresh browser, direct to portal) | falls back to account.locale → else English | A/C |
| I4 | In-portal HE/EN toggle | `setStewardLocaleAction` sets `account.locale` AND `NEXT_LOCALE` cookie; reload reflects choice | C/M |
| I5 | Toggle to EN in portal, then browse site in Hebrew, return to portal | portal is Hebrew again (cookie tracks last browse) — documented tradeoff | C/M |
| I6 | Protected layout dir/lang | uses resolved `getLocale()` so wrapper matches messages | C |
| I7 | Middleware sets `NEXT_LOCALE` on public routes | `Set-Cookie: NEXT_LOCALE=he` on `/`, `=en` on `/en` | A |

## J. Regression / build gates

| ID | Expected | Method |
|----|----|----|
| J1 | `npx tsc --noEmit` clean | A |
| J2 | ESLint clean on changed files (pre-existing warnings noted) | A |
| J3 | `/en`, `/`, `/en/login`, `/en/account`(307), `/stewards`(307), `/stewards/login`(200) return expected codes | A |
| J4 | No 500 from message-namespace loading (admin+account+attendance) | A |
| J5 | Deleted components (`PasswordForm`/`DriverPhotoForm`/`AttendanceSection`/`AttendanceRoster`) not imported anywhere | A/C |

---

### Notes for the QA executor
- The dev server is running on `http://localhost:3000`.
- Next.js server actions can't be driven by raw `curl` (encrypted action refs), so form-submit flows (attendance save, photo upload, password change, logout) are verified by **code trace** (C) + flagged for human **manual** (M) confirmation.
- Report each ID as PASS / FAIL / NEEDS-MANUAL with a one-line evidence note; list any FAIL with file:line and a suggested fix.
