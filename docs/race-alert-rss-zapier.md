# PSGiL Race Alert RSS (Zapier)

Use this dedicated feed to auto-post a "race starts soon" alert via Zapier.

## Feed URL

- Production: `https://psgil.com/rss/race-alerts.xml`
- Local: `http://localhost:3000/rss/race-alerts.xml`

## How it works

- The feed checks the same schedule CSV used by the site countdown widgets.
- It finds the next `Scheduled` race and computes start time in `Asia/Jerusalem`.
- It emits exactly one RSS item only in this window:
  - `now >= race_start - 15 minutes`
  - `now < race_start`
- The item links to the watch flow on site:
  - `/schedule?season=Sx&event=<event_id>&watch=1#watch`
- If poster image exists in schedule data, the feed also emits:
  - `media:content` (image)
  - `enclosure` (image)
- Once emitted, the race alert is marked as posted so it is not emitted again.

## Zapier setup

1. Trigger app: **RSS by Zapier**
2. Trigger event: **New Item in Feed**
3. Feed URL: `https://psgil.com/rss/race-alerts.xml`
4. Action app: **Facebook Pages** (or your chosen social app)
5. Map fields:
   - Post text/title: RSS `title`
   - Link URL: RSS `link`
   - Body/description: RSS `description`
   - Image URL: RSS `media:content.url` (or `enclosure.url` fallback)

## Polling frequency note

- Best reliability: poll every 1-2 minutes if your plan allows it.
- Current alert window is 15 minutes before race start (to better match slower polling intervals such as 15 minutes).

## Debug/testing query params

- `?force=1`
  - Emit an alert item for the next scheduled race even if not in the 5-minute window.
- `?race_id=s6_r04_main&force=1`
  - Emit for a specific race id.
- `?commit=1`
  - Persist posted state in force mode.
  - Without `commit=1`, force mode is preview-only and does not persist.

Examples:

- `https://psgil.com/rss/race-alerts.xml?force=1`
- `https://psgil.com/rss/race-alerts.xml?race_id=s6_r04_main&force=1`
- `https://psgil.com/rss/race-alerts.xml?race_id=s6_r04_main&force=1&commit=1`

