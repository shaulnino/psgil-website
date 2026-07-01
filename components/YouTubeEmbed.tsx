"use client";

import { getYouTubeEmbedUrl, getYouTubeVideoId } from "@/lib/youtube";

/* ------------------------------------------------------------------ */
/*  Play icon (inline SVG)                                             */
/* ------------------------------------------------------------------ */

function PlayIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="currentColor"
      className="h-10 w-10 text-ink-2"
    >
      <path d="M8 5v14l11-7z" />
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/*  YouTubeEmbed                                                       */
/* ------------------------------------------------------------------ */

type YouTubeEmbedProps = {
  /** Any YouTube URL (watch, youtu.be, embed, live) */
  youtubeUrl?: string;
  /** Title for the iframe (accessibility) */
  title?: string;
};

/**
 * Responsive 16:9 YouTube embed.
 *
 * - If `youtubeUrl` is valid → renders an iframe embed.
 * - If missing or invalid → renders a placeholder.
 * - No autoplay; no sound unless user interacts.
 */
export default function YouTubeEmbed({ youtubeUrl, title }: YouTubeEmbedProps) {
  const embedUrl = getYouTubeEmbedUrl(youtubeUrl);
  const videoId = getYouTubeVideoId(youtubeUrl);

  if (!embedUrl || !videoId) {
    return (
      <div className="relative w-full overflow-hidden rounded-[2px] border border-[color:var(--isl-hairline)] bg-cream">
        <div className="aspect-video flex flex-col items-center justify-center gap-3">
          <div className="flex h-14 w-14 items-center justify-center rounded-full border border-[color:var(--isl-hairline)] bg-paper">
            <PlayIcon />
          </div>
          <p className="text-sm font-medium text-meta">
            Broadcast link coming soon
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full overflow-hidden rounded-[2px] border border-[color:var(--isl-hairline)] bg-sink">
      <div className="aspect-video">
        <iframe
          src={embedUrl}
          title={title || "Race Broadcast"}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          className="absolute inset-0 h-full w-full"
          loading="lazy"
        />
      </div>
    </div>
  );
}
