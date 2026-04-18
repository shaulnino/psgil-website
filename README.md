# PSGiL Website

Premiere Sim Gaming Israeli League — official website.

## Getting Started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Safe Refactor Guardrail

For low-risk refactor phases, use the manual click-through and build gate checklist:

- `docs/manual-smoke-checklist.md`

## Environment Variables

Create a `.env.local` file with the following:

| Variable                   | Required     | Description                                                                 |
| -------------------------- | ------------ | --------------------------------------------------------------------------- |
| `GMAIL_APP_PASSWORD`       | Yes          | Gmail App Password for sending emails via SMTP.                             |
| `NEWS_SHEET_URL`           | Yes          | Public Google Sheets CSV URL for the `articles` tab.                        |
| `STEWARD_SESSION_SECRET`   | Yes (prod)   | Random secret for signing steward JWT sessions. Falls back to a public dev default if unset — **must be set in production**. Generate with: `openssl rand -hex 32` |
| `REWARDS_SHEET_URL`        | No           | Public CSV URL for the `rewards` dataset (season awards).                   |
| `NEXT_PUBLIC_SITE_URL`     | No           | Public base URL used in steward email notification links (defaults to `https://psgil.com`). |
| `SITE_BASE_URL`            | No           | Public site base URL used for absolute RSS/OG links (defaults to `https://psgil.com`). |
| `NEXT_PUBLIC_GA_ID`        | No           | Google Analytics 4 Measurement ID (e.g. `G-XXXXXXXXXX`).                   |

### Gmail App Password setup

1. Enable 2-Step Verification on the Gmail account (`psgileague@gmail.com`).
2. Go to [Google App Passwords](https://myaccount.google.com/apppasswords).
3. Generate a new app password for "Mail".
4. Copy the 16-character password into `GMAIL_APP_PASSWORD`.

### Contact form emails

The contact form (`/api/contact`) sends two emails per submission:

1. **Admin notification** — to `psgileague@gmail.com` with the form data.
2. **Auto-reply** — to the user confirming receipt. The template varies by form mode:
   - *Sign-up*: "PSGiL — Sign up received 🏁"
   - *Question*: "PSGiL — We got your message ✅"

### Anti-spam

- A hidden honeypot field rejects bot submissions silently.
- In-memory rate limiting allows max 5 submissions per IP per 60 seconds.

## News / Articles via Google Sheets

The news system reads from a public Google Sheet tab named `articles` via `NEWS_SHEET_URL`.

Required headers in that tab:

- `id`
- `title`
- `slug` (URL-safe and unique)
- `date` (ISO `YYYY-MM-DD`)
- `author` (optional)
- `excerpt`
- `cover_image_url` (public direct URL)
- `tags` (optional comma-separated)
- `category` (optional: `announcements` | `race` | `hub`)
- `youtube_url` (optional YouTube URL for in-article embed)
- `status` (`draft` or `published`)
- `content` (Markdown or plain paragraphs separated by blank lines)

Publishing rules:

- Only rows with `status=published` are shown on the website.
- Articles are sorted newest-first by `date`.
- Missing author defaults to `PSGiL`.
- Missing/invalid `category` defaults to `hub` (`F1 & Sim Hub`).
- Missing `youtube_url` means no video embed is rendered on the article page.

Content notes:

- Markdown is supported and rendered with PSGiL article styles.
- HTML output is sanitized before rendering for safety.

Images:

- `cover_image_url` must be publicly accessible (no auth required).
- If an image is missing/broken, the site automatically falls back to a local placeholder.

## RSS feed for automation

Use the RSS feed to drive no-code automations (IFTTT, Zapier, Make, social schedulers):

- Feed URL: `/news/rss.xml`
- Full production example: `https://psgil.com/news/rss.xml`
- Instagram-ready variant: `/rss/articles-instagram.xml`

The feed is RSS 2.0 with media namespace and includes:

- `title`
- `link`
- `description` (excerpt)
- `pubDate`
- `media:content` image tag when `cover_image_url` exists

When a new article is marked `published` in the sheet, it appears in the feed automatically.

Race countdown alert feed (for social auto-posting without Facebook API):

- Feed URL: `/rss/race-alerts.xml`
- Full production example: `https://psgil.com/rss/race-alerts.xml`
- Instagram-ready variant: `https://psgil.com/rss/race-alerts-instagram.xml`
- Emits one alert item only in the 15-minute pre-race window for the next scheduled race
- Prevents duplicate alerts using persisted posted-state storage
- Setup guide: `docs/race-alert-rss-zapier.md`
- Instagram setup guide: `docs/instagram-rss-zapier.md`

## Season Rewards Dataset

To keep rewards season-aware and future-proof, use a dedicated `rewards` CSV and set its public URL in `REWARDS_SHEET_URL`.

Required columns (one row per award winner):

- `season_id`
- `competition` (`main` | `lower` | `wild` | `constructors` | `community`)
- `award_code` (stable key, e.g. `champion`, `cleanest_driver`)
- `award_label` (human-readable label for UI)
- `recipient_type` (`driver` | `team`)
- `recipient_id` (must match `driver_id` or `team_key`)

Optional columns:

- `notes`
- `source`
- `icon_key`
- `tooltip`
- `rank` (lower number = higher priority)
