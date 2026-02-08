"use client";

import { useState, useRef, useEffect } from "react";

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
/*  Shared Tailwind classes — match existing Button secondary/md       */
/* ------------------------------------------------------------------ */

const base =
  "inline-flex items-center justify-center rounded-full font-semibold transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7020B0]/70 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0B0B0E]";
const secondary =
  "border border-white/20 text-white/90 hover:border-[#7020B0]/60 hover:text-white hover:shadow-[0_0_16px_rgba(112,32,176,0.35)]";
const md = "h-11 px-6 text-sm md:text-base";
const btnClass = `${base} ${secondary} ${md}`;

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function WatchLastRaceButton({ links, label }: Props) {
  const [open, setOpen] = useState(false);
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

  /* ---- Single link: plain anchor ---- */
  if (links.length === 1) {
    return (
      <a
        href={links[0].url}
        className={btnClass}
        target="_blank"
        rel="noopener noreferrer"
      >
        {label}
      </a>
    );
  }

  /* ---- Multiple links: button + dropdown picker ---- */
  return (
    <div ref={wrapperRef} className="relative">
      <button type="button" className={btnClass} onClick={() => setOpen((v) => !v)}>
        {label}
        <svg
          className={`ml-1.5 h-3.5 w-3.5 transition-transform ${open ? "rotate-180" : ""}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2.5}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="absolute left-0 top-full z-50 mt-2 min-w-[220px] overflow-hidden rounded-xl border border-white/10 bg-[#151120] shadow-[0_8px_30px_rgba(0,0,0,0.5)]">
          {links.map((link) => (
            <a
              key={link.url}
              href={link.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex w-full items-center gap-2 px-4 py-3 text-sm text-white/80 transition hover:bg-[#7020B0]/20 hover:text-white"
              onClick={() => setOpen(false)}
            >
              <svg className="h-4 w-4 shrink-0 text-white/40" fill="currentColor" viewBox="0 0 24 24">
                <path d="M10 15l5.19-3L10 9v6m11.56-7.83c.13.47.22 1.1.28 1.9.07.8.1 1.49.1 2.09L22 12c0 2.19-.16 3.8-.44 4.83-.25.9-.83 1.48-1.73 1.73-.47.13-1.33.22-2.65.28-1.3.07-2.49.1-3.59.1L12 19c-4.19 0-6.8-.16-7.83-.44-.9-.25-1.48-.83-1.73-1.73-.13-.47-.22-1.1-.28-1.9-.07-.8-.1-1.49-.1-2.09L2 12c0-2.19.16-3.8.44-4.83.25-.9.83-1.48 1.73-1.73.47-.13 1.33-.22 2.65-.28 1.3-.07 2.49-.1 3.59-.1L12 5c4.19 0 6.8.16 7.83.44.9.25 1.48.83 1.73 1.73z" />
              </svg>
              {link.label}
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
