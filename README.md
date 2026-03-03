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
- `fb_posted` (empty or `true`)
- `fb_post_id` (filled automatically by automation)
- `fb_posted_at` (ISO timestamp, filled automatically)

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

## Facebook auto-post automation (GitHub Actions)

When a new article is marked `published` and `fb_posted` is not `true`, GitHub Actions can auto-post it to your Facebook Page.

- Workflow file: `.github/workflows/facebook-articles.yml`
- Script: `scripts/post_facebook_from_sheet.js`
- Trigger: every 15 minutes + manual `workflow_dispatch`
- Safety: posts oldest eligible article first, default `MAX_POSTS_PER_RUN=1`

How it works:

1. Reads `articles` from `NEWS_SHEET_CSV_URL`
2. Filters: `status=published` and `fb_posted!=true`
3. Posts to Facebook Graph API:
   - with image: `/{page-id}/photos` (caption includes article link)
   - without image: `/{page-id}/feed`
4. Updates the same sheet row with:
   - `fb_posted=true`
   - `fb_post_id=<facebook id>`
   - `fb_posted_at=<ISO timestamp>`

Required GitHub Secrets:

- `FACEBOOK_PAGE_ID`
- `FACEBOOK_PAGE_ACCESS_TOKEN`
- `NEWS_SHEET_CSV_URL`
- `SITE_BASE_URL` (example: `https://psgil.com`)
- `GOOGLE_SERVICE_ACCOUNT_JSON` (full JSON key as one secret value)
- `SHEET_ID` (Google Spreadsheet ID)
- `SHEET_TAB_NAME` (optional, defaults to `articles`)
- `MAX_POSTS_PER_RUN` (optional, defaults to `1`)

Manual local run (for debugging):

```bash
npm run post:facebook-articles
```
