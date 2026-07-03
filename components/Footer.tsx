"use client";

import { useTranslations } from "next-intl";
import { siteConfig } from "@/lib/siteConfig";
import LoadingLink from "@/components/LoadingLink";

const footerColumns = [
  {
    titleKey: "league",
    links: [
      { id: "home", href: "/" },
      { id: "drivers", href: "/drivers" },
      { id: "schedule", href: "/schedule" },
    ],
  },
  {
    titleKey: "data",
    links: [
      { id: "tables", href: "/statistics" },
      { id: "stats", href: "/stats" },
      { id: "news", href: "/news" },
    ],
  },
];

function SocialIcon({ icon }: { icon: string }) {
  switch (icon) {
    case "facebook":
      return (
        <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
          <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" />
        </svg>
      );
    case "discord":
      return (
        <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
          <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
        </svg>
      );
    case "youtube":
      return (
        <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
          <path d="M22.54 6.42a2.78 2.78 0 0 0-1.95-1.96C18.88 4 12 4 12 4s-6.88 0-8.59.46a2.78 2.78 0 0 0-1.95 1.96A29 29 0 0 0 1 12a29 29 0 0 0 .46 5.58A2.78 2.78 0 0 0 3.41 19.6C5.12 20 12 20 12 20s6.88 0 8.59-.46a2.78 2.78 0 0 0 1.95-1.95A29 29 0 0 0 23 12a29 29 0 0 0-.46-5.58zM9.75 15.02V8.98L15.5 12l-5.75 3.02z" />
        </svg>
      );
    case "instagram":
      return (
        <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
          <rect x="2" y="2" width="20" height="20" rx="5" ry="5" fill="none" stroke="currentColor" strokeWidth="2" />
          <circle cx="12" cy="12" r="4" fill="none" stroke="currentColor" strokeWidth="2" />
          <circle cx="17.5" cy="6.5" r="1" />
        </svg>
      );
    default:
      return null;
  }
}

export default function Footer() {
  const t = useTranslations("common");
  return (
    <footer className="relative">
      {/* Thin gold divider — the recurring architectural line */}
      <div className="isl-gold-rule" />
      <div className="mx-auto w-full max-w-[1240px] px-5 py-12">
        <div className="grid grid-cols-1 gap-10 md:grid-cols-[2fr_1fr_1fr]">
          {/* Brand */}
          <div>
            <p className="font-display text-3xl font-bold tracking-[0.01em] text-ink">
              {t("leagueShort")}
            </p>
            <p className="mt-1 font-isl-body text-[11px] font-semibold uppercase tracking-[0.2em] text-brass-ink">
              {t("leagueFullName")}
            </p>
            <p className="mt-4 max-w-xs font-isl-body text-sm leading-relaxed text-meta">
              {t("footerNote")}{t("footer.tagline")}
            </p>
          </div>

          {/* Nav columns */}
          {footerColumns.map((col) => (
            <div key={col.titleKey}>
              <h3 className="mb-4 font-isl-body text-[11px] font-bold uppercase tracking-[0.24em] text-brass-ink">
                {t(`footer.${col.titleKey}`)}
              </h3>
              <ul className="space-y-2.5">
                {col.links.map((link) => (
                  <li key={link.href}>
                    <LoadingLink
                      href={link.href}
                      className="font-isl-body text-sm text-ink-2 transition-colors hover:text-oxblood"
                    >
                      {t(`nav.${link.id}`)}
                    </LoadingLink>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Bottom bar */}
        <div className="mt-10 flex flex-col gap-5 border-t border-[color:var(--isl-hairline)] pt-8 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-2">
            {siteConfig.socials.map((s) => (
              <a
                key={s.label}
                href={s.href}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={s.label}
                className="flex h-9 w-9 items-center justify-center rounded-[2px] border border-[color:var(--isl-hairline)] text-meta transition-colors hover:border-ink hover:text-ink"
              >
                <SocialIcon icon={s.icon} />
              </a>
            ))}
          </div>

          <p className="font-isl-body text-xs text-meta">
            © {new Date().getFullYear()} {t("leagueShort")} {t("footer.copyright")}
          </p>
        </div>
      </div>
    </footer>
  );
}
