# Release Notes — "No Code Needed" Update

## 🎯 The Big Change
**Adding a new season no longer requires any code changes.** Just add a row in the Google Sheet and the website updates automatically — new season appears in dropdowns, homepage labels, schedule, standings, everything.

---

## What's New

### ✅ Zero-Code Season System
- New seasons (Season 7, 8, etc.) are added by editing a single Google Sheet tab (`csv_seasons_config`) — no developer needed.
- The website reads season settings from the sheet: name, dates, which features are active (Wild cards, Constructors, Playoffs), and fallback images.
- Season dropdowns on Tables and Schedule pages are built from the sheet automatically.
- The current/default season is picked automatically based on the sheet's `is_current` flag.

### ✅ Season Selector on Every Data Page
- **Tables page**: dropdown to switch between seasons. Shows standings filtered to the chosen season.
- **Schedule page**: dropdown to switch between seasons. Shows only that season's races.
- Selecting a season updates the URL (`?season=S6`), so links are shareable.

### ✅ Homepage is Fully Dynamic
- "Season 6 live", season labels, race info — all pulled from config, never hardcoded.
- Last Race / Next Race cards update automatically from the schedule sheet.
- Feature tags (e.g., "Season 6 live", "No assists • 50% races") redesigned as clean, non-clickable info badges with gold dot accents and square corners.

### ✅ Next Race Widget (Floating)
- A small widget appears on every page showing the next upcoming race.
- Shows: race name, track, poster, date/time, and a **live countdown** (days, hours, minutes, seconds).
- Click it to jump to that race on the schedule page.
- Can be minimised or dismissed (remembers your choice).
- Works on desktop (bottom-right corner) and mobile (bottom bar).

### ✅ Watch Races on the Website
- Races with a YouTube link can be watched **directly on the site** in a popup player — no need to leave.
- Works for live broadcasts and replays.
- "Watch the Race" button appears on:
  - Schedule page (each race row)
  - Homepage Last Race and Next Race cards
  - "Watch Last Race" hero button
  - Next Race widget
- If no video is available yet, shows a "Broadcast link coming soon" placeholder.

### ✅ Race Metadata Badges (Schedule Page)
- Each race row now shows small badges for:
  - **Weather**: ☀️ Dry, 🌧️ Wet, or 🌦️ Mixed
  - **Safety Cars**: yellow badge with count (e.g., "SC 2")
  - **Reverse Grid**: purple "RG" badge
- Hover over any badge for a tooltip explanation.
- Badges only appear when the data exists — no clutter.

### ✅ Homepage Countdown
- The Next Race card on the homepage now shows a **live countdown** with gold letters and white numbers, right in the card header.

### ✅ Social Media Buttons Updated
- Social icons now use their **original brand colors** (Facebook blue, Discord purple, YouTube red, Instagram gradient).
- The platform name is always shown next to the icon.
- Buttons have rounded corners with a clean transparent border.

### ✅ Navigation Loading Feedback
- Clicking any navigation link (menu, buttons, footer) now shows a **spinner** instantly so you know the page is loading.
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
