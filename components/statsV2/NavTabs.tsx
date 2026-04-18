"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useMemo } from "react";

const TABS = [
  { href: "/stats-v2", label: "Overview" },
  { href: "/stats-v2/drivers", label: "Drivers" },
  { href: "/stats-v2/league", label: "League" },
  { href: "/stats-v2/circuits", label: "Circuits" },
  { href: "/stats-v2/h2h", label: "Head-to-Head" },
  { href: "/stats-v2/rankings", label: "Rankings" },
  { href: "/stats-v2/records", label: "Records" },
];

export default function NavTabs() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const qs = useMemo(() => searchParams.toString(), [searchParams]);

  return (
    <nav className="border-b border-white/10 bg-[#0B0B0E]">
      <div className="mx-auto max-w-7xl px-4">
        <div className="flex gap-1 overflow-x-auto py-1.5 scrollbar-hide">
          {TABS.map((t) => {
            const isActive = t.href === "/stats-v2"
              ? pathname === "/stats-v2"
              : pathname.startsWith(t.href);
            const href = qs ? `${t.href}?${qs}` : t.href;
            return (
              <Link
                key={t.href}
                href={href}
                className={`whitespace-nowrap rounded-md px-3 py-1.5 text-sm transition-colors ${
                  isActive
                    ? "bg-white/10 text-white"
                    : "text-white/65 hover:text-white hover:bg-white/5"
                }`}
              >
                {t.label}
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
