/* eslint-disable no-console */
const GRAPH_API_BASE = "https://graph.facebook.com/v25.0";

function maskToken(token) {
  const t = String(token || "");
  if (!t) return "(empty)";
  return `***${t.slice(-6)}`;
}

async function parseResponseJson(response) {
  const bodyText = await response.text();
  try {
    return JSON.parse(bodyText);
  } catch {
    return { raw: bodyText };
  }
}

function formatGraphError(errorObj) {
  if (!errorObj) return "Unknown Graph API error.";
  const message = errorObj.message || "Unknown error";
  const type = errorObj.type || "UnknownType";
  const code = errorObj.code ?? "n/a";
  const subcode = errorObj.error_subcode ?? "n/a";
  return `${message} (type=${type}, code=${code}, error_subcode=${subcode})`;
}

async function graphGet(url) {
  const response = await fetch(url, { method: "GET" });
  const payload = await parseResponseJson(response);
  if (!response.ok || payload?.error) {
    const err = payload?.error || payload;
    console.error("Graph API GET failed:", payload);
    throw new Error(formatGraphError(err));
  }
  return payload;
}

async function graphPost(url, params) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params,
  });
  const payload = await parseResponseJson(response);
  if (!response.ok || payload?.error) {
    const err = payload?.error || payload;
    console.error("Graph API POST failed:", payload);
    throw new Error(formatGraphError(err));
  }
  return payload;
}

async function getPageAccessToken({ userAccessToken, pageId }) {
  const token = String(userAccessToken || "").trim();
  const id = String(pageId || "").trim();
  if (!token) throw new Error("Missing userAccessToken for getPageAccessToken().");
  if (!id) throw new Error("Missing pageId for getPageAccessToken().");

  const url = `${GRAPH_API_BASE}/me/accounts?fields=id,name,access_token&access_token=${encodeURIComponent(token)}`;
  const payload = await graphGet(url);
  const pages = Array.isArray(payload?.data) ? payload.data : [];
  const matched = pages.find((p) => String(p?.id || "").trim() === id);

  if (!matched?.access_token) {
    const available = pages.map((p) => `${p.id}:${p.name}`).join(", ");
    throw new Error(
      `Could not find page id ${id} in /me/accounts. Available pages: ${available || "(none)"}`,
    );
  }

  return matched.access_token;
}

async function sanityCheckPageAccess({ pageId, pageAccessToken }) {
  const id = String(pageId || "").trim();
  const token = String(pageAccessToken || "").trim();
  if (!id) throw new Error("Missing pageId for sanityCheckPageAccess().");
  if (!token) throw new Error("Missing pageAccessToken for sanityCheckPageAccess().");

  const url = `${GRAPH_API_BASE}/${encodeURIComponent(id)}?fields=id,name&access_token=${encodeURIComponent(token)}`;
  return graphGet(url);
}

async function postToFacebookPage({
  pageId,
  pageAccessToken,
  message,
  link,
  dryRun = false,
}) {
  const id = String(pageId || "").trim();
  const token = String(pageAccessToken || "").trim();
  const msg = String(message || "").trim();

  if (!id) throw new Error("Missing pageId for postToFacebookPage().");
  if (!token) throw new Error("Missing pageAccessToken for postToFacebookPage().");
  if (!msg) throw new Error("Missing message for postToFacebookPage().");

  const payloadForLog = { pageId: id, message, link: link || "", published: "true" };
  if (dryRun) {
    console.log("DRY_RUN=true: skipping Facebook POST. Payload:", payloadForLog);
    return { postId: null, endpoint: "feed", dryRun: true, payload: payloadForLog };
  }

  const endpoint = `${GRAPH_API_BASE}/${encodeURIComponent(id)}/feed`;
  const params = new URLSearchParams();
  params.set("access_token", token);
  params.set("message", msg);
  params.set("published", "true");
  if (link) params.set("link", String(link).trim());

  const res = await graphPost(endpoint, params);
  const postId = res?.id || res?.post_id || "";
  if (!postId) throw new Error("Facebook /feed returned success but no post id.");
  return { postId, endpoint: "feed", dryRun: false };
}

async function fetchPostVisibility({ postId, pageAccessToken }) {
  const id = String(postId || "").trim();
  const token = String(pageAccessToken || "").trim();
  if (!id || !token) return null;
  const url = `${GRAPH_API_BASE}/${encodeURIComponent(id)}?fields=id,permalink_url,is_published&access_token=${encodeURIComponent(token)}`;
  return graphGet(url);
}

module.exports = {
  maskToken,
  getPageAccessToken,
  postToFacebookPage,
  sanityCheckPageAccess,
  fetchPostVisibility,
};

