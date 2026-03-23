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
          // Exact match for dashboard, prefix match for others
          const isActive =
            href === "/stewards"
              ? pathname === "/stewards"
              : pathname.startsWith(href);

          return (
            <Link
              key={href}
              href={href}
              className={`rounded-full px-3 py-1.5 font-medium transition ${
                isActive
                  ? "bg-[#D4AF37]/15 text-[#f4d98a] border border-[#D4AF37]/40"
                  : "text-white/70 hover:bg-[#D4AF37]/10 hover:text-[#f3d98a]"
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
