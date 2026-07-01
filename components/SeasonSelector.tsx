"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { useState, useRef, useEffect, useCallback, useTransition } from "react";

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
 * the emphasized-number display. Returns null for non-standard labels.
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
        <span className={highlight ? "text-ink" : "text-ink-2"}>
          {parsed.prefix}
        </span>
        <span
          className={`num font-bold ${
            highlight ? "text-ink" : "text-meta"
          }`}
        >
          {parsed.number}
        </span>
      </span>
    );
  }
  return (
    <span className={highlight ? "text-ink" : "text-ink-2"}>
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
  const [isPending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const [focusIdx, setFocusIdx] = useState(-1);

  const selectedOption = seasons.find((s) => s.key === selected);
  const selectedLabel = selectedOption?.label || selected;

  const handleSelect = useCallback(
    (value: string) => {
      if (isPending) return;
      if (value === selected) {
        setOpen(false);
        return;
      }
      const params = new URLSearchParams(searchParams.toString());
      params.set("season", value);
      setOpen(false);
      startTransition(() => {
        router.replace(`?${params.toString()}`, { scroll: false });
      });
    },
    [router, searchParams, selected, isPending],
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
      <span className="font-isl-body text-[0.75rem] font-semibold uppercase tracking-[0.2em] text-meta">
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
        aria-busy={isPending}
        disabled={isPending}
        onClick={() => setOpen((v) => !v)}
        onKeyDown={handleKeyDown}
        className={`
          group relative flex min-w-[150px] cursor-pointer items-center justify-between gap-3
          rounded-[2px] border bg-paper px-4 py-2
          text-base font-semibold outline-none
          transition-colors duration-200
          ${
            open
              ? "border-ink"
              : "border-[color:var(--isl-hairline-strong)] hover:border-ink"
          }
          focus-visible:border-ink
          focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--isl-oxblood)]
          disabled:cursor-wait disabled:opacity-80
        `}
      >
        {/* Season text + gold number */}
        <SeasonLabel label={selectedLabel} highlight />

        {/* Chevron */}
        {isPending ? (
          <svg
            className="h-4 w-4 animate-spin text-oxblood"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2.5}
          >
            <path d="M12 3a9 9 0 1 0 9 9" strokeLinecap="round" />
          </svg>
        ) : (
          <svg
            className={`h-4 w-4 text-meta transition-transform duration-200 group-hover:text-ink ${
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
        )}
      </button>

      {/* -------- Dropdown list -------- */}
      {open && !isPending && (
        <ul
          id="season-listbox"
          ref={listRef}
          role="listbox"
          aria-activedescendant={
            focusIdx >= 0 ? `season-option-${focusIdx}` : undefined
          }
          className="
            absolute end-0 top-full z-50 mt-2 min-w-[150px]
            overflow-hidden rounded-[2px] border border-[color:var(--isl-hairline-strong)]
            bg-sink
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
                      ? "bg-cream text-ink"
                      : "text-ink-2 hover:bg-cream"
                  }
                  ${isSelected ? "!text-ink" : ""}
                `}
              >
                <SeasonLabel label={s.label} highlight={isSelected} />
                {/* Check mark for selected */}
                {isSelected && (
                  <svg
                    className="ms-auto h-3.5 w-3.5 text-oxblood"
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
