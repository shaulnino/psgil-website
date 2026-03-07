# PSGiL Instagram via RSS + Zapier

This guide explains how to auto-post PSGiL content to Instagram using RSS feeds and Zapier.

## Prerequisites

- Instagram **Business** or **Creator** account
- Instagram connected to a Facebook Page (Meta requirement for many publishing tools)
- Zapier plan with access to RSS polling + Instagram publishing actions

## Recommended feeds

Use dedicated Instagram-ready feeds:

- Articles/news: `https://psgil.com/rss/articles-instagram.xml`
- Race reminders (15 min before start): `https://psgil.com/rss/race-alerts-instagram.xml`

These feeds include:

- `title`
- `description`
- `link`
- `guid`
- `pubDate`
- `media:content` + `enclosure` image URL
- `social_type`
- `social_caption`
- `social_image_url`

## Zap 1 — News/articles to Instagram

1. Trigger app: **RSS by Zapier**
2. Trigger event: **New Item in Feed**
3. Feed URL: `https://psgil.com/rss/articles-instagram.xml`
4. Action app: your Instagram publishing app in Zapier
5. Map fields:
   - Caption/Text: `social_caption` (fallback: `title`)
   - Image URL: `social_image_url` (fallback: `media:content.url` or `enclosure.url`)
   - Optional website URL in caption: `link`

Caption template (already generated in feed):

`New on PSGiL News: {title}\nRead more on our website.\n{link}`

## Zap 2 — Race reminder to Instagram

1. Trigger app: **RSS by Zapier**
2. Trigger event: **New Item in Feed**
3. Feed URL: `https://psgil.com/rss/race-alerts-instagram.xml`
4. Action app: your Instagram publishing app in Zapier
5. Map fields:
   - Caption/Text: `social_caption`
   - Image URL: `social_image_url`
   - Optional link in caption: `link`

Caption template (already generated in feed):

`PSGiL goes live in 15 minutes! {race_name}\nWatch on our website:\n{link}`

## Notes on race-alert duplicate behavior

- Existing Facebook race-alert feed remains unchanged:
  - `https://psgil.com/rss/race-alerts.xml`
- Instagram race-alert feed tracks posted state separately (Instagram key suffix),
  so one platform does not consume the alert for the other.
- Debug params are supported on the Instagram feed too:
  - `?force=1`
  - `?race_id=<event_id>&force=1`
  - `?commit=1`

## Troubleshooting

- If Instagram post has no image:
  - Verify `social_image_url` resolves publicly in browser/incognito
  - Ensure Zap maps `social_image_url` or `enclosure.url`
- If posts are missed:
  - Reduce Zap polling interval if possible
  - Race reminder window is 15 minutes pre-race

