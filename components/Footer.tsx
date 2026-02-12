"use client";

import { siteConfig } from "@/lib/siteConfig";
import LoadingLink from "@/components/LoadingLink";

const footerLinks = [
  { label: "Home", href: "/" },
  { label: "Drivers", href: "/drivers" },
  { label: "Schedule & Results", href: "/schedule" },
  { label: "Tables", href: "/statistics" },
  { label: "Articles", href: "/articles" },
];

export default function Footer() {
  return (
    <footer className="border-t border-white/10 bg-[#0B0B0E]">
      <div className="mx-auto w-full max-w-6xl px-6 py-10">
        <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm text-white/70">
              © {new Date().getFullYear()} {siteConfig.leagueName} – F1 Sim Racing
            </p>
            <p className="mt-2 text-xs text-white/50">{siteConfig.footerNote}</p>
          </div>
          <div className="flex flex-wrap items-center gap-4 text-xs text-white/50">
            {footerLinks.map((link) => (
              <LoadingLink
                key={link.href}
                href={link.href}
                className="transition hover:text-white/80"
              >
                {link.label}
              </LoadingLink>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}
