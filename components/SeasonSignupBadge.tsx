"use client";

import { gaEvent } from "@/lib/ga";

/** The upcoming season being announced. Update this when the season rolls over. */
const SEASON_LABEL = "Season 7";

/**
 * Prominent announcement "sign" for the top of the homepage hero.
 *
 * Smooth-scrolls to the Contact Us section (`#contact-us`) via a native anchor,
 * and asks the contact form to open on the "Sign Up" tab by dispatching the
 * `psgil:request-signup` event (handled in ContactSection).
 */
export default function SeasonSignupBadge() {
  const handleClick = () => {
    // Ask the contact form to switch to the Sign Up tab.
    window.dispatchEvent(new Event("psgil:request-signup"));
    // Track the click (no-op outside production).
    gaEvent({
      action: "click_season_signup",
      category: "engagement",
      label: SEASON_LABEL,
    });
  };

  return (
    <a
      href="#contact-us"
      onClick={handleClick}
      aria-label={`${SEASON_LABEL} sign-ups are open — go to the sign-up form`}
      className="group inline-flex max-w-full items-center gap-2.5 rounded-full border border-[#D4AF37]/60 bg-[linear-gradient(135deg,rgba(112,32,176,0.72),rgba(112,32,176,0.32))] px-4 py-2.5 text-sm font-semibold text-white shadow-[0_0_36px_rgba(112,32,176,0.55)] ring-1 ring-[#D4AF37]/20 backdrop-blur-md transition-all duration-200 hover:-translate-y-0.5 hover:border-[#D4AF37] hover:shadow-[0_0_48px_rgba(112,32,176,0.85)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7020B0]/70 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0B0B0E] sm:gap-3 sm:px-6 sm:py-3 sm:text-base"
    >
      {/* "NOW OPEN" tag with a pulsing dot */}
      <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-[#D4AF37] px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-black sm:text-[11px]">
        <span className="relative flex h-1.5 w-1.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-black/70" />
          <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-black" />
        </span>
        Now Open
      </span>

      <span className="leading-tight">
        <span aria-hidden="true">🏁 </span>
        {SEASON_LABEL} sign-ups are open
      </span>

      <svg
        viewBox="0 0 20 20"
        fill="currentColor"
        aria-hidden="true"
        className="h-4 w-4 shrink-0 text-[#D4AF37] transition-transform duration-200 group-hover:translate-x-1 sm:h-5 sm:w-5"
      >
        <path
          fillRule="evenodd"
          d="M3 10a.75.75 0 01.75-.75h10.638L10.23 5.29a.75.75 0 111.04-1.08l5.5 5.25a.75.75 0 010 1.08l-5.5 5.25a.75.75 0 11-1.04-1.08l4.158-3.96H3.75A.75.75 0 013 10z"
          clipRule="evenodd"
        />
      </svg>
    </a>
  );
}
