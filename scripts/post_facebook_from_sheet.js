/* eslint-disable no-console */
const { google } = require("googleapis");

const GRAPH_API_BASE = "https://graph.facebook.com/v19.0";

function requiredEnv(name) {
  const value = (process.env[name] || "").trim();
  if (!value) throw new Error(`Missing required env var: ${name}`);
  return value;
}

function optionalEnv(name, fallback = "") {
  const value = (process.env[name] || "").trim();
  return value || fallback;
}

function normalize(value) {
  return (value || "").trim();
}

function normalizeLower(value) {
  return normalize(value).toLowerCase();
}

function splitCsvRows(csv) {
  const rows = [];
  const source = String(csv || "").replace(/^\uFEFF/, "");
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < source.length; i += 1) {
    const char = source[i];
    const next = source[i + 1];

    if (char === "\"") {
      if (inQuotes && next === "\"") {
        current += "\"\"";
        i += 1;
        continue;
      }
      inQuotes = !inQuotes;
      current += char;
      continue;
    }

    if (char === "\n" && !inQuotes) {
      rows.push(current.replace(/\r$/, ""));
      current = "";
      continue;
    }

    current += char;
  }

  if (current.length > 0) rows.push(current.replace(/\r$/, ""));
  return rows;
}

function parseCsvLine(line) {
  const result = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    const next = line[i + 1];

    if (char === "\"") {
      if (inQuotes && next === "\"") {
        current += "\"";
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === "," && !inQuotes) {
      result.push(current);
      current = "";
      continue;
    }

    current += char;
  }

  result.push(current);
  return result;
}

function parseCsv(csv) {
  const rows = splitCsvRows(csv).filter((row) => row.trim().length > 0);
  if (rows.length === 0) return [];

  const headers = parseCsvLine(rows[0]).map((h) => normalize(h));
  return rows.slice(1).map((row) => {
    const values = parseCsvLine(row);
    const obj = {};
    headers.forEach((header, idx) => {
      obj[header] = normalize(values[idx] || "");
    });
    return obj;
  });
}

function toDateSortValue(dateStr) {
  const ts = Date.parse(normalize(dateStr));
  return Number.isNaN(ts) ? 0 : ts;
}

function buildArticleMessage(article, siteBaseUrl) {
  const title = normalize(article.title);
  const excerpt = normalize(article.excerpt);
  const slug = normalize(article.slug);
  const link = `${siteBaseUrl.replace(/\/+$/, "")}/news/${encodeURIComponent(slug)}`;

  const message = [
    "📰 NEW ARTICLE",
    title,
    excerpt,
    link,
  ]
    .filter(Boolean)
    .join("\n\n");

  return { message, link };
}

function resolveCoverImageUrl(rawUrl, siteBaseUrl) {
  const value = normalize(rawUrl);
  if (!value) return "";
  if (/^https?:\/\//i.test(value)) return value;
  if (value.startsWith("/")) return `${siteBaseUrl.replace(/\/+$/, "")}${value}`;
  return `${siteBaseUrl.replace(/\/+$/, "")}/${value}`;
}

async function postToFacebookFeed({ facebookPageId, facebookPageAccessToken, message, link }) {
  const endpoint = `${GRAPH_API_BASE}/${encodeURIComponent(facebookPageId)}/feed`;
  const params = new URLSearchParams();
  params.set("access_token", facebookPageAccessToken);
  params.set("message", message);
  params.set("link", link);

  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params,
  });

  const bodyText = await response.text();
  let payload;
  try {
    payload = JSON.parse(bodyText);
  } catch {
    payload = { raw: bodyText };
  }

  if (!response.ok) {
    console.error("Facebook /feed API error response:", payload);
    throw new Error(`Facebook /feed request failed: ${response.status}`);
  }

  const postId = payload?.post_id || payload?.id || "";
  if (!postId) {
    console.error("Facebook /feed response missing post id:", payload);
    throw new Error("Facebook /feed did not return a post id.");
  }

  return { postId, endpoint: "feed" };
}

async function postArticleToFacebook(article, cfg) {
  const { message, link } = buildArticleMessage(article, cfg.siteBaseUrl);
  const coverImageUrl = resolveCoverImageUrl(article.cover_image_url, cfg.siteBaseUrl);

  const usePhotoEndpoint = Boolean(coverImageUrl);
  if (!usePhotoEndpoint) {
    return postToFacebookFeed({
      facebookPageId: cfg.facebookPageId,
      facebookPageAccessToken: cfg.facebookPageAccessToken,
      message,
      link,
    });
  }

  const endpoint = `${GRAPH_API_BASE}/${encodeURIComponent(cfg.facebookPageId)}/photos`;
  const params = new URLSearchParams();
  params.set("access_token", cfg.facebookPageAccessToken);
  params.set("url", coverImageUrl);
  params.set("caption", message);
  params.set("published", "true");

  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params,
  });

  const bodyText = await response.text();
  let payload;
  try {
    payload = JSON.parse(bodyText);
  } catch {
    payload = { raw: bodyText };
  }

  if (!response.ok) {
    const errorCode = payload?.error?.code;
    const errorMsg = payload?.error?.message || "unknown error";
    console.error("Facebook /photos API error response:", payload);

    // If image upload fails (invalid/inaccessible image), fallback to /feed post.
    if (errorCode === 324 || /invalid image file/i.test(errorMsg)) {
      console.warn("Image upload failed; falling back to text/link post via /feed.");
      return postToFacebookFeed({
        facebookPageId: cfg.facebookPageId,
        facebookPageAccessToken: cfg.facebookPageAccessToken,
        message,
        link,
      });
    }

    throw new Error(`Facebook /photos request failed: ${response.status}`);
  }

  const postId = payload?.post_id || payload?.id || "";
  if (!postId) {
    console.error("Facebook API response missing post id:", payload);
    throw new Error("Facebook API did not return a post id.");
  }

  return { postId, endpoint: usePhotoEndpoint ? "photos" : "feed" };
}

function indexToA1Column(index1Based) {
  let n = index1Based;
  let col = "";
  while (n > 0) {
    const rem = (n - 1) % 26;
    col = String.fromCharCode(65 + rem) + col;
    n = Math.floor((n - 1) / 26);
  }
  return col;
}

async function markArticlePostedInSheet({
  article,
  postId,
  postedAtIso,
  sheetId,
  sheetTabName,
  googleServiceAccountJson,
}) {
  let credentials;
  try {
    credentials = JSON.parse(googleServiceAccountJson);
  } catch {
    throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON is not valid JSON.");
  }

  if (credentials.private_key) {
    credentials.private_key = credentials.private_key.replace(/\\n/g, "\n");
  }

  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });

  const sheets = google.sheets({ version: "v4", auth });
  const rangeAll = `${sheetTabName}!A1:ZZ`;
  const readRes = await sheets.spreadsheets.values.get({
    spreadsheetId: sheetId,
    range: rangeAll,
  });

  const rows = readRes.data.values || [];
  if (rows.length === 0) throw new Error("Sheet is empty.");

  const headers = rows[0].map((h) => normalizeLower(h));
  const colIdxByName = new Map(headers.map((h, idx) => [h, idx]));

  const requiredCols = ["id", "slug", "fb_posted", "fb_post_id", "fb_posted_at"];
  for (const col of requiredCols) {
    if (!colIdxByName.has(col)) {
      throw new Error(`Missing required sheet column: ${col}`);
    }
  }

  const articleId = normalize(article.id);
  const articleSlug = normalize(article.slug);

  let dataRowIndex = -1; // index inside rows array, including header
  for (let i = 1; i < rows.length; i += 1) {
    const row = rows[i] || [];
    const rowId = normalize(row[colIdxByName.get("id")]);
    const rowSlug = normalize(row[colIdxByName.get("slug")]);
    if ((articleId && rowId === articleId) || (articleSlug && rowSlug === articleSlug)) {
      dataRowIndex = i;
      break;
    }
  }

  if (dataRowIndex < 1) {
    throw new Error(`Could not find sheet row for article id=${articleId} slug=${articleSlug}`);
  }

  const sheetRowNumber = dataRowIndex + 1;
  const updates = [
    { col: "fb_posted", value: "true" },
    { col: "fb_post_id", value: postId },
    { col: "fb_posted_at", value: postedAtIso },
  ];

  const data = updates.map((u) => {
    const colIndex0 = colIdxByName.get(u.col);
    const colA1 = indexToA1Column(colIndex0 + 1);
    return {
      range: `${sheetTabName}!${colA1}${sheetRowNumber}`,
      values: [[u.value]],
    };
  });

  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId: sheetId,
    requestBody: {
      valueInputOption: "RAW",
      data,
    },
  });
}

function getEligibleArticles(rows) {
  return rows
    .filter((row) => normalizeLower(row.status) === "published")
    .filter((row) => normalizeLower(row.fb_posted) !== "true")
    .filter((row) => normalize(row.slug).length > 0)
    .sort((a, b) => toDateSortValue(a.date) - toDateSortValue(b.date));
}

async function main() {
  const cfg = {
    newsSheetCsvUrl: requiredEnv("NEWS_SHEET_CSV_URL"),
    siteBaseUrl: requiredEnv("SITE_BASE_URL"),
    facebookPageId: requiredEnv("FACEBOOK_PAGE_ID"),
    facebookPageAccessToken: requiredEnv("FACEBOOK_PAGE_ACCESS_TOKEN"),
    googleServiceAccountJson: requiredEnv("GOOGLE_SERVICE_ACCOUNT_JSON"),
    sheetId: requiredEnv("SHEET_ID"),
    sheetTabName: optionalEnv("SHEET_TAB_NAME", "articles"),
    maxPostsPerRun: Number.parseInt(optionalEnv("MAX_POSTS_PER_RUN", "1"), 10) || 1,
  };

  console.log("Starting Facebook article posting run...");
  console.log(`Sheet tab: ${cfg.sheetTabName}`);
  console.log(`Max posts per run: ${cfg.maxPostsPerRun}`);

  const csvResponse = await fetch(cfg.newsSheetCsvUrl, { cache: "no-store" });
  if (!csvResponse.ok) {
    throw new Error(`Failed to fetch NEWS_SHEET_CSV_URL: ${csvResponse.status}`);
  }
  const csvText = await csvResponse.text();
  const rows = parseCsv(csvText);

  const eligible = getEligibleArticles(rows).slice(0, cfg.maxPostsPerRun);
  console.log(`Eligible articles to post this run: ${eligible.length}`);

  if (eligible.length === 0) {
    console.log("No new published unposted articles found.");
    return;
  }

  for (const article of eligible) {
    const articleTitle = normalize(article.title);
    const articleSlug = normalize(article.slug);
    console.log(`Posting article: "${articleTitle}" (${articleSlug})`);

    const { postId, endpoint } = await postArticleToFacebook(article, cfg);
    console.log(`Facebook post created via /${endpoint}. post_id=${postId}`);

    const postedAtIso = new Date().toISOString();
    await markArticlePostedInSheet({
      article,
      postId,
      postedAtIso,
      sheetId: cfg.sheetId,
      sheetTabName: cfg.sheetTabName,
      googleServiceAccountJson: cfg.googleServiceAccountJson,
    });
    console.log(`Sheet updated for article "${articleTitle}" as posted.`);
  }

  console.log("Run completed successfully.");
}

main().catch((err) => {
  console.error("Fatal error during Facebook posting run.");
  console.error(err?.stack || err?.message || String(err));
  process.exit(1);
});

