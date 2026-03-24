"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type NavItem = { href: string; label: string };

export default function StewardNav({ items }: { items: NavItem[] }) {
  const pathname = usePathname();

  return (
    <nav className="border-b border-white/10 bg-[#0f0f14]">
      <div className="mx-auto flex w-full max-w-6xl flex-wrap gap-2 px-6 py-3 text-sm">
        {items.map(({ href, label }) => {
          // Exact match for dashboard; for others require href to be followed
          // by "/" or end-of-string so e.g. /penalties doesn't match /penalties-to-serve
          const isActive =
            href === "/stewards"
              ? pathname === "/stewards"
              : pathname === href || pathname.startsWith(href + "/");

          return (
            <Link
              key={href}
              href={href}
              className={`rounded-full px-3 py-1.5 font-medium transition ${
                isActive
                  ? "bg-steward-gold/15 text-steward-cream border border-steward-gold/40"
                  : "text-white/70 hover:bg-steward-gold/10 hover:text-steward-cream"
              }`}
            >
              {label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
