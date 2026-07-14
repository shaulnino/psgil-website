"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, Search } from "lucide-react";
import { useTranslations } from "next-intl";

export type DriverOption = { id: string; name: string; role: string };

/**
 * Searchable driver-link combobox. Shows the current link, opens a filterable
 * list of CSV drivers, and always offers an explicit "no driver link" option.
 * Historic drivers are tagged so an admin knows the link points at an inactive
 * roster entry. Nothing else (roles) is changed automatically.
 */
export function DriverLinkField({
  value,
  onChange,
  drivers,
}: {
  value: string | null;
  onChange: (driverId: string | null) => void;
  drivers: DriverOption[];
}) {
  const t = useTranslations("admin");
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const selected = drivers.find((d) => d.id === value) ?? null;
  const missing = value !== null && !selected; // linked id no longer in the CSV roster

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return drivers;
    return drivers.filter(
      (d) => d.name.toLowerCase().includes(q) || d.id.toLowerCase().includes(q),
    );
  }, [drivers, query]);

  const triggerLabel = missing
    ? t("driverLink.missingValue", { id: value })
    : selected
      ? selected.name
      : t("driverLink.none");

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={`flex w-full items-center justify-between gap-2 rounded-[2px] border bg-sink px-3 py-2.5 text-start text-sm transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--isl-oxblood)] ${
          missing
            ? "border-[color:var(--isl-warning)] text-[color:var(--isl-warning)]"
            : "border-[color:var(--isl-hairline-strong)] text-ink"
        } ${!selected && !missing ? "text-faint" : ""}`}
      >
        <span className="truncate">{triggerLabel}</span>
        <ChevronDown className={`h-4 w-4 shrink-0 transition-transform ${open ? "rotate-180" : ""}`} aria-hidden />
      </button>

      {open && (
        <div className="absolute z-40 mt-1 w-full min-w-[14rem] rounded-[2px] border border-[color:var(--isl-hairline)] bg-paper shadow-[0_8px_24px_rgba(0,0,0,0.5)]">
          <div className="flex items-center gap-2 border-b border-[color:var(--isl-hairline)] px-2.5 py-2">
            <Search className="h-4 w-4 shrink-0 text-meta" aria-hidden />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("driverLink.searchPlaceholder")}
              aria-label={t("driverLink.searchPlaceholder")}
              className="w-full bg-transparent text-sm text-ink placeholder:text-faint focus:outline-none"
            />
          </div>
          <ul role="listbox" className="max-h-56 overflow-y-auto py-1">
            <li>
              <button
                type="button"
                role="option"
                aria-selected={value === null}
                onClick={() => {
                  onChange(null);
                  setOpen(false);
                }}
                className="block w-full px-3 py-1.5 text-start font-isl-body text-sm text-meta transition-colors hover:bg-cream hover:text-ink"
              >
                {t("driverLink.unlink")}
              </button>
            </li>
            {filtered.map((d) => (
              <li key={d.id}>
                <button
                  type="button"
                  role="option"
                  aria-selected={d.id === value}
                  onClick={() => {
                    onChange(d.id);
                    setOpen(false);
                  }}
                  className={`flex w-full items-center justify-between gap-2 px-3 py-1.5 text-start font-isl-body text-sm transition-colors hover:bg-cream ${
                    d.id === value ? "text-ink" : "text-ink-2 hover:text-ink"
                  }`}
                >
                  <span className="truncate">{d.name}</span>
                  {d.role === "historic" && (
                    <span className="shrink-0 text-[0.65rem] uppercase tracking-[0.1em] text-faint">
                      {t("driverLink.historic")}
                    </span>
                  )}
                </button>
              </li>
            ))}
            {filtered.length === 0 && (
              <li className="px-3 py-2 text-sm text-faint">{t("driverLink.noMatches")}</li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
