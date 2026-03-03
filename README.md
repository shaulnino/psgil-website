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

| Variable             | Required | Description                                      |
| -------------------- | -------- | ------------------------------------------------ |
| `GMAIL_APP_PASSWORD` | Yes      | Gmail App Password for sending emails via SMTP.  |
| `NEWS_SHEET_URL`     | Yes      | Public Google Sheets CSV URL for the `articles` tab. |
| `SITE_BASE_URL`      | No       | Public site base URL used for absolute RSS/OG links (defaults to `https://psgil.com`). |

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
- `status` (`draft` or `published`)
- `content` (Markdown or plain paragraphs separated by blank lines)

Publishing rules:

- Only rows with `status=published` are shown on the website.
- Articles are sorted newest-first by `date`.
- Missing author defaults to `PSGiL`.

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

The feed is RSS 2.0 with media namespace and includes:

- `title`
- `link`
- `description` (excerpt)
- `pubDate`
- `media:content` image tag when `cover_image_url` exists

When a new article is marked `published` in the sheet, it appears in the feed automatically.
