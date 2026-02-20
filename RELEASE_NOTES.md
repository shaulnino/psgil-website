# Release Notes — "Big Stats" Update

## Highlights

This update adds a two-mode Contact form with auto-reply emails, interactive success popups, a cinematic hero section, and a refined global visual identity across the site.

---

## New Features

### Contact Form — Two-Mode Flow
- The Contact section now supports two distinct flows via a segmented toggle:
  - **Sign Up** — name + email only, for joining the league interest list.
  - **Questions** — full form with name, email, subject (optional), and message.
- Default mode is Sign Up.
- Button labels change per mode: "Join PSGiL" vs "Send Message".
- Switching modes resets the form and clears errors.
- The API payload includes a `type` field (`"signup"` or `"question"`) for backend differentiation.

### Auto-Reply Emails
- After successful submission, the server sends an automatic confirmation email to the user:
  - **Sign Up**: "PSGiL — Sign up received 🏁" with a branded dark HTML template, welcome message, and CTA to psgil.com.
  - **Questions**: "PSGiL — We got your message ✅" with confirmation and a direct email link for urgent matters.
- Admin notification emails continue to go to `psgileague@gmail.com` as before.
- Auto-reply failures are caught silently so they never break the user-facing flow.

### Success Popups with Confetti
- On successful submission, a centered modal appears instead of an inline banner:
  - **Sign Up**: title "Welcome to PSGiL! 🏁", confetti animation (purple + gold particles), "Awesome" button.
  - **Questions**: title "Message received ✅", no confetti, "Got it" button.
- Built on the native `<dialog>` element with a pop-in animation, blurred backdrop, click-outside-to-close, ESC support, and auto-focus on the primary button.
- Confetti powered by `canvas-confetti` (~6 KB gzipped).

### Anti-Spam Protection
- **Honeypot field**: a hidden input that bots fill but real users never see. If filled, the server returns a fake `200 OK` silently.
- **Rate limiting**: in-memory tracker allows max 5 submissions per IP per 60-second window. Returns `429` when exceeded.

---

## Visual & UX Improvements

### Cinematic Hero Section
- Section is now `min-h-[65vh]` with content anchored at the bottom — immersive, not contained.
- Background image has a slow zoom-in animation (scale 1 → 1.03 over 14 seconds).
- On hover: subtle brightness increase on the background image.
- Added layers: purple tint overlay, bottom gradient for text contrast, vignette on edges.
- Banner has an ambient purple glow behind it and a purple drop shadow.
- Removed `rounded-2xl` from the banner — no more "card inside a box" feel.

### Global Background Upgrade
- Base color shifted from `#0B0B0E` (flat black) to `#0a0a12` (deep dark navy).
- Body background is now multi-layered: purple radial glow (bottom-left), gold radial glow (top-right), carbon-fibre diagonal texture, and the solid base.
- Footer darkened to `#07070b` for clear visual separation.
- The site feels atmospheric and premium without visible blobs or performance cost.

### "Watch Last Race" Button Redesign
- Replaced the strong red background with a dark surface + purple brand border.
- Hover: subtle lift + purple glow — matches the "Join Now" primary button system.
- Both hero buttons now share the same height, padding, border radius, and font weight.

### Schedule Chips (Upcoming + Countdown)
- Both chips now use the same base styling: 34px pill, dark neutral background (`#13111a`), subtle purple border.
- **Upcoming**: clean red dot (no neon), white text at 90%.
- **Countdown**: gold numbers with `tabular-nums`, muted gray suffixes (d/h/m/s). No inner glow.
- Removed the always-on pulsing animation from both chips.
- Matching hover behavior: slightly brighter border + faint purple outer glow.

### "Join Now" Buttons Rerouted
- Both "Join Now" buttons (hero + header) now scroll to the Contact Us section instead of opening the Discord link.
- `LoadingLink` updated to handle hash links (`#...` / `/#...`) natively as plain `<a>` tags.

### Sections Removed
- **"Follow PSGiL"** social buttons section — removed (compact social strip below hero is sufficient).
- **"Ready to race with us?"** Discord CTA section — removed (Contact form replaces it).

### Social Strip Label
- Added "Follow us" label (gold) to the left of the compact social icon strip below the hero.
- "Key facts" label also changed to gold for consistency.

---

## Stats Page Improvements

### Circuit Tab — Season Appearances Visualization
- Replaced the bar chart with a row of six circles (S1–S6).
- Active seasons show a purple-filled circle with a checkmark and glow; inactive seasons are dimmed.
- All six seasons always appear (no gaps), and the visualization is binary — no misleading Y-axis counts.

### Circuit Tab — Podium Placements
- Added **2nd Place** (silver) and **3rd Place** (bronze) sections below the existing Winners (gold) section.
- Each renders only when the corresponding CSV column has data.

### Driver Tab — Single-Driver View
- Removed the "Key Metrics (normalised)" bar chart and "Driver Ratings" radar in single-driver mode (everything showed 100%, which was meaningless).
- Charts now only appear in compare mode where they're actually useful.

### Default Open Categories
- Changed from 3 to 1 — only the first category expands by default in Drivers and Circuits tabs.

---

## Dependencies

| Package | Type | Version |
| --- | --- | --- |
| `canvas-confetti` | runtime | ^1.9.4 |
| `@types/canvas-confetti` | dev | ^1.9.0 |
| `nodemailer` | runtime | ^8.0.1 |

---

## Environment Variables

| Variable | Required | Description |
| --- | --- | --- |
| `GMAIL_APP_PASSWORD` | Yes | Gmail App Password for sending emails (admin notifications + auto-replies). |

---

## New Files

- `components/ContactSection.tsx` — two-mode contact form with honeypot, mode toggle, and modal integration.
- `components/SuccessModal.tsx` — reusable success dialog with confetti (signup) or simple confirmation (questions).
- `app/api/contact/route.ts` — API route handling validation, admin emails, auto-reply emails, honeypot, and rate limiting.

---

## Previous Release

See below for the previous "No Code Needed" update notes.

---

# Release Notes — "No Code Needed" Update

## The Big Change
**Adding a new season no longer requires any code changes.** Just add a row in the Google Sheet and the website updates automatically — new season appears in dropdowns, homepage labels, schedule, standings, everything.

---

## What's New

### Zero-Code Season System
- New seasons (Season 7, 8, etc.) are added by editing a single Google Sheet tab (`csv_seasons_config`) — no developer needed.
- The website reads season settings from the sheet: name, dates, which features are active (Wild cards, Constructors, Playoffs), and fallback images.
- Season dropdowns on Tables and Schedule pages are built from the sheet automatically.
- The current/default season is picked automatically based on the sheet's `is_current` flag.

### Season Selector on Every Data Page
- **Tables page**: dropdown to switch between seasons. Shows standings filtered to the chosen season.
- **Schedule page**: dropdown to switch between seasons. Shows only that season's races.
- Selecting a season updates the URL (`?season=S6`), so links are shareable.

### Homepage is Fully Dynamic
- "Season 6 live", season labels, race info — all pulled from config, never hardcoded.
- Last Race / Next Race cards update automatically from the schedule sheet.
- Feature tags (e.g., "Season 6 live", "No assists • 50% races") redesigned as clean, non-clickable info badges with gold dot accents and square corners.

### Next Race Widget (Floating)
- A small widget appears on every page showing the next upcoming race.
- Shows: race name, track, poster, date/time, and a live countdown (days, hours, minutes, seconds).
- Click it to jump to that race on the schedule page.
- Can be minimised or dismissed (remembers your choice).
- Works on desktop (bottom-right corner) and mobile (bottom bar).

### Watch Races on the Website
- Races with a YouTube link can be watched directly on the site in a popup player — no need to leave.
- Works for live broadcasts and replays.
- "Watch the Race" button appears on:
  - Schedule page (each race row)
  - Homepage Last Race and Next Race cards
  - "Watch Last Race" hero button
  - Next Race widget
- If no video is available yet, shows a "Broadcast link coming soon" placeholder.

### Race Metadata Badges (Schedule Page)
- Each race row now shows small badges for:
  - Weather: Dry, Wet, or Mixed
  - Safety Cars: yellow badge with count (e.g., "SC 2")
  - Reverse Grid: purple "RG" badge
- Hover over any badge for a tooltip explanation.
- Badges only appear when the data exists — no clutter.

### Homepage Countdown
- The Next Race card on the homepage now shows a live countdown with gold letters and white numbers, right in the card header.

### Social Media Buttons Updated
- Social icons now use their original brand colors (Facebook blue, Discord purple, YouTube red, Instagram gradient).
- The platform name is always shown next to the icon.
- Buttons have rounded corners with a clean transparent border.

### Navigation Loading Feedback
- Clicking any navigation link (menu, buttons, footer) now shows a spinner instantly so you know the page is loading.
- Prevents accidental double-clicks.
- Works on all internal links across the site.

---

## Smaller Improvements

- **"Laps" column removed** from race results tables (cleaner look).
- **"Upcoming" badge** on Next Race card now pulses with YouTube-red styling.
- **Driver card "Season" toggle** shows the current season name dynamically.
- **Navigation menu** renamed "Schedule" to "Schedule & Results".
- **Articles page** "Back to home" link now uses the same button style as the rest of the site.

---

## For Admins: How to Add a New Season

1. Open the Google Sheet.
2. Go to the `csv_seasons_config` tab.
3. Add a new row (e.g., `S7`, `Season 7`, dates, flags).
4. Set `is_current` to `TRUE` for the new season (and `FALSE` for the old one).
5. Add race data to the schedule, standings, and results tabs with the new season number.
6. Done — no code changes, no deployments needed.
