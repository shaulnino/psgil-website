"use client";

import { useState, useRef, useEffect } from "react";
import YouTubeEmbed from "@/components/YouTubeEmbed";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

type RaceLink = { label: string; url: string };

type Props = {
  /** Pre-computed unique YouTube links from the last-race group. */
  links: RaceLink[];
  /** Button label text (e.g. "Watch Last Race"). */
  label: string;
};

/* ------------------------------------------------------------------ */
/*  Shared Tailwind classes — ISL secondary/md button language         */
/* ------------------------------------------------------------------ */

const base =
  "inline-flex items-center justify-center gap-2 rounded-[2px] font-medium uppercase tracking-[0.08em] transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--isl-oxblood)]";
const secondary =
  "border border-[color:var(--isl-hairline-strong)] text-ink hover:border-ink bg-transparent";
const md = "text-sm md:text-base px-6 py-2.5";
const btnClass = `${base} ${secondary} ${md}`;

/* ------------------------------------------------------------------ */
/*  Watch modal                                                        */
/* ------------------------------------------------------------------ */

function WatchModal({
  label,
  youtubeUrl,
  onClose,
}: {
  label: string;
  youtubeUrl: string;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/70"
      onClick={onClose}
    >
      <div
        className="relative mx-4 w-full max-w-4xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center gap-1.5 rounded-[2px] border border-oxblood px-2.5 py-1 font-isl-body text-[0.75rem] font-semibold uppercase tracking-[0.2em] text-oxblood">
              <span className="h-1.5 w-1.5 rounded-full bg-oxblood" />
              Race Broadcast
            </span>
            <h3 className="font-display font-bold tracking-[0.005em] leading-[1.05] text-sm text-ink md:text-base">
              {label}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-[2px] border border-[color:var(--isl-hairline)] bg-paper text-ink-2 transition-colors hover:text-ink"
          >
            ×
          </button>
        </div>

        {/* Embed */}
        <YouTubeEmbed
          youtubeUrl={youtubeUrl}
          title={`${label} – Race Broadcast`}
        />

        {/* External link fallback */}
        <div className="mt-3 flex justify-end">
          <a
            href={youtubeUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-[2px] border border-[color:var(--isl-hairline)] bg-paper px-3 py-1.5 text-[11px] font-medium text-oxblood transition-colors hover:text-oxblood-deep hover:border-ink"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
              className="h-3.5 w-3.5"
            >
              <path
                fillRule="evenodd"
                d="M4.25 5.5a.75.75 0 00-.75.75v8.5c0 .414.336.75.75.75h8.5a.75.75 0 00.75-.75v-4a.75.75 0 011.5 0v4A2.25 2.25 0 0112.75 17h-8.5A2.25 2.25 0 012 14.75v-8.5A2.25 2.25 0 014.25 4h5a.75.75 0 010 1.5h-5zm7.25-.75a.75.75 0 01.75-.75h3.5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0V6.31l-5.47 5.47a.75.75 0 01-1.06-1.06l5.47-5.47H12.5a.75.75 0 01-.75-.75z"
                clipRule="evenodd"
              />
            </svg>
            Open on YouTube
          </a>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function WatchLastRaceButton({ links, label }: Props) {
  const [open, setOpen] = useState(false);
  const [watchTarget, setWatchTarget] = useState<RaceLink | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Close picker on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  /* ---- No links: disabled state with tooltip ---- */
  if (links.length === 0) {
    return (
      <span
        className={`${btnClass} cursor-not-allowed opacity-50`}
        title="Video coming soon"
      >
        {label}
      </span>
    );
  }

  /* ---- Single link: open embed modal directly ---- */
  if (links.length === 1) {
    return (
      <>
        <button
          type="button"
          className={btnClass}
          onClick={() => setWatchTarget(links[0])}
        >
          {label}
        </button>
        {watchTarget && (
          <WatchModal
            label={watchTarget.label || label}
            youtubeUrl={watchTarget.url}
            onClose={() => setWatchTarget(null)}
          />
        )}
      </>
    );
  }

  /* ---- Multiple links: button + dropdown picker → embed modal ---- */
  return (
    <>
      <div ref={wrapperRef} className="relative">
        <button type="button" className={btnClass} onClick={() => setOpen((v) => !v)}>
          {label}
          <svg
            className={`ms-1.5 h-3.5 w-3.5 transition-transform rtl:scale-x-[-1] ${open ? "rotate-180" : ""}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2.5}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {open && (
          <div className="absolute start-0 top-full z-50 mt-2 min-w-[220px] overflow-hidden rounded-[2px] border border-[color:var(--isl-hairline)] bg-paper">
            {links.map((link) => (
              <button
                key={link.url}
                type="button"
                className="flex w-full items-center gap-2 px-4 py-3 text-start text-sm text-ink-2 transition-colors hover:bg-cream hover:text-ink"
                onClick={() => {
                  setOpen(false);
                  setWatchTarget(link);
                }}
              >
                <svg className="h-4 w-4 shrink-0 text-oxblood" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M10 15l5.19-3L10 9v6m11.56-7.83c.13.47.22 1.1.28 1.9.07.8.1 1.49.1 2.09L22 12c0 2.19-.16 3.8-.44 4.83-.25.9-.83 1.48-1.73 1.73-.47.13-1.33.22-2.65.28-1.3.07-2.49.1-3.59.1L12 19c-4.19 0-6.8-.16-7.83-.44-.9-.25-1.48-.83-1.73-1.73-.13-.47-.22-1.1-.28-1.9-.07-.8-.1-1.49-.1-2.09L2 12c0-2.19.16-3.8.44-4.83.25-.9.83-1.48 1.73-1.73.47-.13 1.33-.22 2.65-.28 1.3-.07 2.49-.1 3.59-.1L12 5c4.19 0 6.8.16 7.83.44.9.25 1.48.83 1.73 1.73z" />
                </svg>
                {link.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Watch modal */}
      {watchTarget && (
        <WatchModal
          label={watchTarget.label || label}
          youtubeUrl={watchTarget.url}
          onClose={() => setWatchTarget(null)}
        />
      )}
    </>
  );
}
