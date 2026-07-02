"use client";

import { useLocale } from "next-intl";
import { usePathname as useRawPathname } from "next/navigation";
import { usePathname } from "@/i18n/navigation";

/**
 * HE / EN toggle for the public site (Phase 9b). Switches the active locale
 * while preserving the current path (/drivers ⇄ /en/drivers). Uses a full
 * navigation on purpose: the <html lang/dir> tag and Header live in the shared
 * root layout, which Next.js preserves across soft navigations — a hard reload
 * guarantees the document direction, fonts, and chrome all match the new locale.
 * Hidden on the steward portal (unprefixed; locale becomes a user preference in 9e).
 */
export default function LanguageSwitcher({ className = "" }: { className?: string }) {
  const locale = useLocale();
  const pathname = usePathname(); // locale-stripped (e.g. "/drivers", "/")
  const rawPathname = useRawPathname();

  if (rawPathname.startsWith("/stewards")) return null;

  const target = locale === "he" ? "en" : "he";
  const label = locale === "he" ? "EN" : "עברית";
  const aria = locale === "he" ? "Switch to English" : "החלפה לעברית";

  const base = pathname === "/" ? "" : pathname;
  const href = target === "en" ? `/en${base}` : pathname || "/";

  return (
    <a
      href={href}
      aria-label={aria}
      className={`inline-flex items-center rounded-[2px] border border-[color:var(--isl-hairline)] px-2.5 py-1 font-isl-body text-xs font-semibold uppercase tracking-[0.12em] text-meta transition-colors hover:border-ink hover:text-ink ${className}`}
    >
      {label}
    </a>
  );
}
