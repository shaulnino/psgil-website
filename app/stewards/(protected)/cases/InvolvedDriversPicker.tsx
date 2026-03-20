"use client";

import { useMemo, useState } from "react";

type DriverOption = { id: string; name: string; email: string };

export default function InvolvedDriversPicker({ options }: { options: DriverOption[] }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

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
      <span className="mb-1 block text-sm text-white/80">Involved drivers (single or multiple) <span className="text-red-400">*</span></span>
      <div className="relative">
        <button type="button" onClick={() => setOpen((v) => !v)} className="flex w-full items-center justify-between rounded-lg border border-white/15 bg-black/30 px-3 py-2 text-left text-sm">
          <span>{selectedIds.length ? `${selectedIds.length} driver${selectedIds.length > 1 ? "s" : ""} selected` : "Choose involved drivers"}</span>
          <span className="text-white/50">{open ? "▲" : "▼"}</span>
        </button>
        {open && (
          <div className="absolute z-20 mt-2 w-full rounded-lg border border-white/15 bg-[#111119] p-2 shadow-xl">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search drivers..."
              className="mb-2 w-full rounded-lg border border-white/15 bg-black/30 px-3 py-2 text-sm"
            />
            <div className="max-h-56 overflow-y-auto">
              {filtered.map((o) => (
                <label key={o.id} className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 hover:bg-white/5">
                  <input type="checkbox" checked={selectedIds.includes(o.id)} onChange={() => toggle(o.id)} className="h-4 w-4 accent-[#7020B0]" />
                  <span className="text-sm">{o.name} ({o.email})</span>
                </label>
              ))}
            </div>
          </div>
        )}
      </div>
      <div className="mt-2 rounded-lg border border-white/10 bg-black/20 p-2">
        {selected.length ? (
          <div className="flex flex-wrap gap-2">
            {selected.map((d) => <span key={d.id} className="inline-flex rounded-full border border-[#7020B0]/40 bg-[#7020B0]/20 px-2.5 py-1 text-xs">{d.name}</span>)}
          </div>
        ) : (
          <p className="text-xs text-white/55">Selected drivers will appear here.</p>
        )}
      </div>
      {selectedIds.map((id) => <input key={id} type="hidden" name="involved_driver_ids" value={id} />)}
      <input type="text" value={selectedIds.join(",")} readOnly required aria-hidden="true" tabIndex={-1} className="sr-only" />
    </div>
  );
}
