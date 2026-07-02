"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";

type Indicator = { id: string; label: string; count: number; href: string };

const ICON: Record<string, string> = {
  "driver-response": "⚑",
  "steward-review":  "⚖",
};

export default function StewardNotifBadge() {
  const t = useTranslations("stewards");
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
        className="flex items-center gap-1.5 rounded-[2px] border border-brass bg-cream px-2.5 py-1 text-xs font-bold text-ink transition hover:bg-paper"
        aria-label={t("shell.notif.ariaLabel", { count: total })}
      >
        <span className="relative flex h-2 w-2">
          <span className="relative inline-flex h-2 w-2 rounded-full bg-oxblood animate-[f1-tick_1s_step-end_infinite]" />
        </span>
        <span className="num">{total}</span>
      </button>

      {open && (
        <div className="absolute end-0 top-full z-50 mt-2 w-72 overflow-hidden rounded-[2px] border border-[color:var(--isl-hairline)] bg-paper">
          <div className="border-b border-[color:var(--isl-hairline)] px-4 py-2.5">
            <p className="font-isl-body text-[10px] font-semibold uppercase tracking-[0.2em] text-brass-ink">
              {t("shell.notif.pendingActions")}
            </p>
          </div>
          <ul className="divide-y divide-[color:var(--isl-hairline)]">
            {items.map((item) => (
              <li key={item.id}>
                <Link
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-3 px-4 py-3 transition hover:bg-cream"
                >
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[2px] border border-[color:var(--isl-hairline)] bg-cream text-sm text-ink">
                    {ICON[item.id] ?? "●"}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-ink">{item.label}</p>
                  </div>
                  <span className="num flex h-5 w-5 shrink-0 items-center justify-center rounded-[2px] border border-[color:var(--isl-hairline)] bg-cream text-[10px] font-bold text-ink">
                    {item.count}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
          <div className="border-t border-[color:var(--isl-hairline)] px-4 py-2">
            <Link
              href="/stewards"
              onClick={() => setOpen(false)}
              className="text-[11px] text-meta transition hover:text-oxblood-deep"
            >
              {t("shell.notif.openSystem")}
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
