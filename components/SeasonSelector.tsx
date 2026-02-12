"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { useState, useRef, useEffect, useCallback } from "react";

/* ------------------------------------------------------------------ */
/*  Season dropdown – persists selection in ?season= query param       */
/*  Driven by seasons config (label + key), no hardcoded list.         */
/* ------------------------------------------------------------------ */

type SeasonOption = {
  key: string;   // e.g. "S6"
  label: string; // e.g. "Season 6"
};

type SeasonSelectorProps = {
  seasons: SeasonOption[];
  selected: string; // season_key
};

/**
 * Parse a season label like "Season 6" into { prefix, number } for
 * the gold-number display. Returns null for non-standard labels.
 */
function parseLabel(label: string): { prefix: string; number: string } | null {
  const m = label.match(/^(.*?\s*)(\d+)$/);
  return m ? { prefix: m[1], number: m[2] } : null;
}

function SeasonLabel({
  label,
  highlight,
}: {
  label: string;
  highlight: boolean;
}) {
  const parsed = parseLabel(label);
  if (parsed) {
    return (
      <span className="flex items-baseline gap-1.5">
        <span className={highlight ? "text-white/90" : "text-white/60"}>
          {parsed.prefix}
        </span>
        <span
          className={`font-bold ${
            highlight ? "text-[#D4AF37]" : "text-[#D4AF37]/70"
          }`}
        >
          {parsed.number}
        </span>
      </span>
    );
  }
  return (
    <span className={highlight ? "text-white/90" : "text-white/70"}>
      {label}
    </span>
  );
}

export default function SeasonSelector({
  seasons,
  selected,
}: SeasonSelectorProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const [focusIdx, setFocusIdx] = useState(-1);

  const selectedOption = seasons.find((s) => s.key === selected);
  const selectedLabel = selectedOption?.label || selected;

  const handleSelect = useCallback(
    (value: string) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set("season", value);
      router.replace(`?${params.toString()}`, { scroll: false });
      setOpen(false);
    },
    [router, searchParams],
  );

  /* Close on click outside */
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  /* Reset focus index when opening */
  useEffect(() => {
    if (open) {
      const idx = seasons.findIndex((s) => s.key === selected);
      setFocusIdx(idx >= 0 ? idx : 0);
    }
  }, [open, seasons, selected]);

  /* Scroll focused option into view */
  useEffect(() => {
    if (open && listRef.current && focusIdx >= 0) {
      const item = listRef.current.children[focusIdx] as
        | HTMLElement
        | undefined;
      item?.scrollIntoView({ block: "nearest" });
    }
  }, [open, focusIdx]);

  /* Keyboard handling */
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!open) {
      if (e.key === "Enter" || e.key === " " || e.key === "ArrowDown") {
        e.preventDefault();
        setOpen(true);
      }
      return;
    }

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setFocusIdx((prev) => Math.min(prev + 1, seasons.length - 1));
        break;
      case "ArrowUp":
        e.preventDefault();
        setFocusIdx((prev) => Math.max(prev - 1, 0));
        break;
      case "Enter":
      case " ":
        e.preventDefault();
        if (focusIdx >= 0 && focusIdx < seasons.length) {
          handleSelect(seasons[focusIdx].key);
        }
        break;
      case "Escape":
      case "Tab":
        setOpen(false);
        break;
    }
  };

  return (
    <div
      ref={containerRef}
      className="relative inline-flex items-center gap-3"
    >
      {/* -------- Label -------- */}
      <span className="text-xs font-bold uppercase tracking-[0.22em] text-[#D4AF37]/70">
        Season
      </span>

      {/* -------- Trigger button -------- */}
      <button
        type="button"
        role="combobox"
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-controls="season-listbox"
        aria-label={selectedLabel}
        onClick={() => setOpen((v) => !v)}
        onKeyDown={handleKeyDown}
        className={`
          group relative flex min-w-[150px] cursor-pointer items-center justify-between gap-3
          rounded-xl border-[1.5px] bg-[#111118]/80 px-4 py-2
          text-base font-semibold outline-none
          transition-all duration-200
          ${
            open
              ? "border-[#7020B0] shadow-[0_0_12px_rgba(112,32,176,0.25),0_0_4px_rgba(212,175,55,0.15)]"
              : "border-white/[0.12] hover:border-[#7020B0]/50 hover:shadow-[0_0_8px_rgba(112,32,176,0.15)]"
          }
          focus-visible:border-[#7020B0] focus-visible:shadow-[0_0_12px_rgba(112,32,176,0.25),0_0_4px_rgba(212,175,55,0.15)]
          focus-visible:ring-1 focus-visible:ring-[#7020B0]/40
        `}
      >
        {/* Season text + gold number */}
        <SeasonLabel label={selectedLabel} highlight />

        {/* Chevron */}
        <svg
          className={`h-4 w-4 text-white/40 transition-transform duration-200 group-hover:text-white/60 ${
            open ? "rotate-180" : ""
          }`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2.5}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </button>

      {/* -------- Dropdown list -------- */}
      {open && (
        <ul
          id="season-listbox"
          ref={listRef}
          role="listbox"
          aria-activedescendant={
            focusIdx >= 0 ? `season-option-${focusIdx}` : undefined
          }
          className="
            absolute right-0 top-full z-50 mt-2 min-w-[150px]
            overflow-hidden rounded-xl border border-white/[0.12]
            bg-[#111118]/95 shadow-[0_8px_32px_rgba(0,0,0,0.5),0_0_12px_rgba(112,32,176,0.1)]
            backdrop-blur-md
          "
        >
          {seasons.map((s, i) => {
            const isSelected = s.key === selected;
            const isFocused = i === focusIdx;
            return (
              <li
                key={s.key}
                id={`season-option-${i}`}
                role="option"
                aria-selected={isSelected}
                onClick={() => handleSelect(s.key)}
                onMouseEnter={() => setFocusIdx(i)}
                className={`
                  flex cursor-pointer items-baseline gap-1.5 px-4 py-2
                  text-base font-semibold transition-colors duration-100
                  ${
                    isFocused
                      ? "bg-[#7020B0]/15 text-white"
                      : "text-white/70 hover:bg-white/5"
                  }
                  ${isSelected ? "!text-white" : ""}
                `}
              >
                <SeasonLabel label={s.label} highlight={isSelected} />
                {/* Check mark for selected */}
                {isSelected && (
                  <svg
                    className="ml-auto h-3.5 w-3.5 text-[#D4AF37]"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={3}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
