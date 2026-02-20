# PSGiL Website

Premiere Sim Gaming Israeli League — official website.

## Getting Started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Environment Variables

Create a `.env.local` file with the following:

| Variable             | Required | Description                                      |
| -------------------- | -------- | ------------------------------------------------ |
| `GMAIL_APP_PASSWORD` | Yes      | Gmail App Password for sending emails via SMTP.  |

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
