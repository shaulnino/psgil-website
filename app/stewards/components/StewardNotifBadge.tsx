"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";

type Indicator = { id: string; label: string; count: number; href: string };

const ICON: Record<string, string> = {
  "driver-response": "⚑",
  "steward-review":  "⚖",
};

export default function StewardNotifBadge() {
  const [total, setTotal]           = useState(0);
  const [items, setItems]           = useState<Indicator[]>([]);
  const [open, setOpen]             = useState(false);
  const [loaded, setLoaded]         = useState(false);
  const containerRef                = useRef<HTMLDivElement>(null);
  const pathname                    = usePathname();

  const fetchNotifs = () => {
    fetch("/api/stewards/notifications")
      .then((r) => r.json())
      .then(({ indicators, total }: { indicators: Indicator[]; total: number }) => {
        setItems(indicators);
        setTotal(total);
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
  };

  // fetch on mount + whenever the pathname changes (i.e. user navigates)
  useEffect(() => { fetchNotifs(); }, [pathname]);

  // close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  if (!loaded || total === 0) return null;

  return (
    <div ref={containerRef} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 rounded-full border border-steward-gold/50 bg-steward-gold/15 px-2.5 py-1 text-xs font-bold text-steward-cream transition hover:border-steward-gold/80 hover:bg-steward-gold/25"
        aria-label={`${total} pending steward action${total > 1 ? "s" : ""}`}
      >
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-steward-gold opacity-60" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-steward-gold" />
        </span>
        {total}
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-72 overflow-hidden rounded-2xl border border-steward-gold/30 bg-[#111119] shadow-[0_12px_40px_rgba(0,0,0,0.5)]">
          <div className="border-b border-white/10 px-4 py-2.5">
            <p className="text-[10px] font-bold uppercase tracking-widest text-steward-gold/80">
              Pending Actions
            </p>
          </div>
          <ul className="divide-y divide-white/8">
            {items.map((item) => (
              <li key={item.id}>
                <Link
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-3 px-4 py-3 transition hover:bg-steward-gold/10"
                >
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-steward-gold/15 text-sm text-steward-cream">
                    {ICON[item.id] ?? "●"}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-white/90">{item.label}</p>
                  </div>
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-steward-gold/20 text-[10px] font-bold text-steward-cream">
                    {item.count}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
          <div className="border-t border-white/10 px-4 py-2">
            <Link
              href="/stewards"
              onClick={() => setOpen(false)}
              className="text-[11px] text-white/40 transition hover:text-steward-gold"
            >
              Open Steward System →
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
