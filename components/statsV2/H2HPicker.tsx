"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useTransition } from "react";

type DriverOpt = { id: string; name: string };

export default function H2HPicker({
  drivers,
  selected,
}: {
  drivers: DriverOpt[];
  selected: string[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const [pending, startTransition] = useTransition();

  function setSelected(next: string[]) {
    const params = new URLSearchParams(sp.toString());
    params.delete("d");
    next.slice(0, 4).forEach((id) => params.append("d", id));
    const url = params.toString() ? `${pathname}?${params.toString()}` : pathname;
    startTransition(() => router.replace(url, { scroll: false }));
  }

  function toggle(id: string) {
    const set = new Set(selected);
    if (set.has(id)) set.delete(id);
    else if (set.size < 4) set.add(id);
    setSelected([...set]);
  }

  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.02] p-4">
      <div className="flex items-baseline justify-between mb-3">
        <h3 className="text-sm font-semibold">Select drivers (up to 4)</h3>
        <span className="text-xs text-white/50">{selected.length}/4 selected{pending ? " · updating…" : ""}</span>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {drivers.map((d) => {
          const isOn = selected.includes(d.id);
          const disabled = !isOn && selected.length >= 4;
          return (
            <button
              key={d.id}
              onClick={() => toggle(d.id)}
              disabled={disabled}
              className={`rounded-md px-2 py-1 text-xs border transition-colors ${
                isOn
                  ? "border-cyan-400/40 bg-cyan-500/15 text-cyan-100"
                  : disabled
                  ? "border-white/5 bg-white/[0.02] text-white/30 cursor-not-allowed"
                  : "border-white/10 bg-white/[0.03] text-white/80 hover:bg-white/[0.07]"
              }`}
            >
              {d.name || d.id}
            </button>
          );
        })}
      </div>
      {selected.length > 0 && (
        <button
          onClick={() => setSelected([])}
          className="mt-3 text-xs text-white/50 hover:text-white/80 underline"
        >
          Clear selection
        </button>
      )}
    </div>
  );
}
