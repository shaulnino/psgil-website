"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type DriverOption = { id: string; name: string; email: string };

export default function InvolvedDriversPicker({ options }: { options: DriverOption[] }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    if (open) document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, [open]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => `${o.name} ${o.email}`.toLowerCase().includes(q));
  }, [query, options]);

  const selected = useMemo(
    () => options.filter((o) => selectedIds.includes(o.id)),
    [options, selectedIds],
  );

  const toggle = (id: string) =>
    setSelectedIds((curr) => (curr.includes(id) ? curr.filter((x) => x !== id) : [...curr, id]));

  return (
    <div className="md:col-span-2">
      <span className="mb-1 block text-sm text-ink-2">Involved drivers (single or multiple) <span className="text-status-danger">*</span></span>
      <div className="relative" ref={containerRef}>
        <button type="button" onClick={() => setOpen((v) => !v)} className="flex w-full items-center justify-between rounded-[2px] border border-[color:var(--isl-hairline)] bg-paper px-3 py-2 text-start text-sm text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--isl-oxblood)]">
          <span>{selectedIds.length ? `${selectedIds.length} driver${selectedIds.length > 1 ? "s" : ""} selected` : "Choose involved drivers"}</span>
          <span className="text-meta">{open ? "▲" : "▼"}</span>
        </button>
        {open && (
          <div className="absolute z-20 mt-2 w-full rounded-[2px] border border-[color:var(--isl-hairline)] bg-paper p-2">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search drivers..."
              className="mb-2 w-full rounded-[2px] border border-[color:var(--isl-hairline)] bg-paper px-3 py-2 text-sm text-ink placeholder:text-faint focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--isl-oxblood)]"
            />
            <div className="max-h-56 overflow-y-auto">
              {filtered.map((o) => (
                <label key={o.id} className="flex cursor-pointer items-center gap-2 rounded-[2px] px-2 py-1.5 text-ink hover:bg-cream">
                  <input type="checkbox" checked={selectedIds.includes(o.id)} onChange={() => toggle(o.id)} className="h-4 w-4 accent-[color:var(--isl-oxblood)]" />
                  <span className="text-sm">{o.name} ({o.email})</span>
                </label>
              ))}
            </div>
          </div>
        )}
      </div>
      <div className="mt-2 rounded-[2px] border border-[color:var(--isl-hairline)] bg-cream p-2">
        {selected.length ? (
          <div className="flex flex-wrap gap-2">
            {selected.map((d) => <span key={d.id} className="inline-flex rounded-[2px] border border-oxblood px-2.5 py-1 text-xs text-oxblood">{d.name}</span>)}
          </div>
        ) : (
          <p className="text-xs text-meta">Selected drivers will appear here.</p>
        )}
      </div>
      {selectedIds.map((id) => <input key={id} type="hidden" name="involved_driver_ids" value={id} />)}
      <input type="text" value={selectedIds.join(",")} readOnly required aria-hidden="true" tabIndex={-1} className="sr-only" />
    </div>
  );
}
