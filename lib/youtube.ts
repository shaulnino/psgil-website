/* ------------------------------------------------------------------ */
/*  YouTube URL helpers                                                */
/* ------------------------------------------------------------------ */

/**
 * Extract the video ID from a YouTube URL.
 *
 * Supported formats:
 *   - https://www.youtube.com/watch?v=VIDEO_ID
 *   - https://youtube.com/watch?v=VIDEO_ID
 *   - https://youtu.be/VIDEO_ID
 *   - https://www.youtube.com/embed/VIDEO_ID
 *   - https://www.youtube.com/live/VIDEO_ID
 *   - URLs with extra params (&t=, &list=, etc.)
 *
 * Returns null if the URL is missing or cannot be parsed.
 */
export function getYouTubeVideoId(url: string | undefined | null): string | null {
  if (!url) return null;
  const trimmed = url.trim();
  if (!trimmed) return null;

  try {
    const u = new URL(trimmed);

    // youtu.be/VIDEO_ID
    if (u.hostname === "youtu.be") {
      const id = u.pathname.slice(1).split("/")[0];
      return id || null;
    }

    // youtube.com variants
    if (
      u.hostname === "www.youtube.com" ||
      u.hostname === "youtube.com" ||
      u.hostname === "m.youtube.com"
    ) {
      // /watch?v=VIDEO_ID
      const v = u.searchParams.get("v");
      if (v) return v;

      // /embed/VIDEO_ID or /live/VIDEO_ID or /v/VIDEO_ID
      const segments = u.pathname.split("/").filter(Boolean);
      if (
        segments.length >= 2 &&
        ["embed", "live", "v", "shorts"].includes(segments[0])
      ) {
        return segments[1] || null;
      }
    }
  } catch {
    // Not a valid URL — try regex fallback
    const match = trimmed.match(
      /(?:youtube\.com\/(?:watch\?.*v=|embed\/|live\/|v\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/,
    );
    return match?.[1] ?? null;
  }

  return null;
}

/**
 * Build an embeddable YouTube URL from any supported YouTube URL.
 * Returns null if the video ID cannot be extracted.
 *
 * The embed URL includes:
 *   - `rel=0` (don't show unrelated videos)
 *   - `modestbranding=1` (minimal YouTube branding)
 */
export function getYouTubeEmbedUrl(url: string | undefined | null): string | null {
  const id = getYouTubeVideoId(url);
  if (!id) return null;
  return `https://www.youtube.com/embed/${id}?rel=0&modestbranding=1`;
}
