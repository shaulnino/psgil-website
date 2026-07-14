"use client";

import { useEffect, useRef, useState } from "react";
import { MoreVertical } from "lucide-react";
import { cn } from "@/lib/utils";

export type MenuItem = {
  key: string;
  label: string;
  onSelect: () => void;
  /** `danger` tints the item red (destructive). */
  tone?: "default" | "danger";
  disabled?: boolean;
  /** Native tooltip, e.g. the reason an action is blocked. */
  title?: string;
};

/**
 * ISL overflow (⋯) Menu — an accessible three-dot actions menu. Trigger is a
 * semantic button with `aria-haspopup="menu"`; the panel is `role="menu"` with
 * `role="menuitem"` children. Closes on outside-click and Escape, focuses the
 * first enabled item on open, and mirrors correctly in RTL (`end-0`).
 */
export function Menu({ items, label }: { items: MenuItem[]; label: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    // Focus the first enabled item for keyboard users.
    panelRef.current?.querySelector<HTMLButtonElement>("button:not([disabled])")?.focus();
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={label}
        className="rounded-[2px] p-1.5 text-meta transition-colors hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--isl-oxblood)]"
      >
        <MoreVertical className="h-4 w-4" strokeWidth={2} aria-hidden />
      </button>
      {open && (
        <div
          ref={panelRef}
          role="menu"
          className="absolute end-0 z-40 mt-1 min-w-[12rem] rounded-[2px] border border-[color:var(--isl-hairline)] bg-paper py-1 shadow-[0_8px_24px_rgba(0,0,0,0.5)]"
        >
          {items.map((item) => (
            <button
              key={item.key}
              type="button"
              role="menuitem"
              disabled={item.disabled}
              title={item.title}
              onClick={() => {
                setOpen(false);
                item.onSelect();
              }}
              className={cn(
                "block w-full px-3 py-2 text-start font-isl-body text-sm transition-colors",
                "focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[color:var(--isl-oxblood)]",
                item.disabled
                  ? "cursor-not-allowed text-faint"
                  : item.tone === "danger"
                    ? "text-[color:var(--isl-danger)] hover:bg-cream"
                    : "text-ink-2 hover:bg-cream hover:text-ink",
              )}
            >
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
