"use client";

import Image from "next/image";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import LoadingLink from "@/components/LoadingLink";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import { siteConfig } from "@/lib/siteConfig";
import { gaClickJoinNow } from "@/lib/ga";
import StewardNotifBadge from "@/app/stewards/components/StewardNotifBadge";

export default function Header() {
  const [isOpen, setIsOpen] = useState(false);
  const pathname = usePathname();
  const t = useTranslations("common");

  return (
    <header className="sticky top-0 z-50 border-b border-[color:var(--isl-hairline)] bg-bone/95 backdrop-blur-sm">
      <div className="isl-gold-rule" />
      <div className="mx-auto flex h-16 w-full max-w-[1240px] items-center justify-between px-5">
        <LoadingLink
          href="/"
          hideSpinner
          aria-label={t("leagueShort")}
          className="group flex items-center"
        >
          <Image
            src="/isl-logo.png"
            alt={t("a11y.logoAlt")}
            width={1299}
            height={560}
            className="h-9 w-auto transition group-aria-[busy=true]:opacity-60 md:h-10"
            priority
            unoptimized
          />
        </LoadingLink>

        <nav className="hidden items-center gap-1 md:flex">
          {siteConfig.navigation.map((link) => {
            const isStewards = link.id === "stewards";
            const active =
              pathname === link.href || (isStewards && pathname.startsWith("/stewards"));
            return (
              <div key={link.href} className="relative flex items-center gap-1.5">
                <LoadingLink
                  href={link.href}
                  className={`border-b-2 px-3 py-2 font-isl-body text-sm font-medium transition-colors ${
                    active
                      ? "border-oxblood text-ink"
                      : "border-transparent text-meta hover:text-ink"
                  }`}
                >
                  {t(`nav.${link.id}`)}
                </LoadingLink>
                {isStewards && <StewardNotifBadge />}
              </div>
            );
          })}
        </nav>

        <div className="flex items-center gap-3">
          <LanguageSwitcher className="hidden sm:inline-flex" />
          <div className="hidden sm:block">
            <Button href="/#contact-us" size="sm" onClick={gaClickJoinNow}>
              {t("joinNow")}
            </Button>
          </div>
          <button
            onClick={() => setIsOpen((open) => !open)}
            className="flex h-11 w-11 items-center justify-center rounded-[2px] border border-[color:var(--isl-hairline)] text-ink-2 transition-colors hover:border-ink hover:text-ink md:hidden"
            aria-label={t("a11y.toggleNav")}
            aria-expanded={isOpen}
          >
            <span className="relative flex h-3 w-4 flex-col justify-between">
              <span className="block h-0.5 w-full bg-current" />
              <span className="block h-0.5 w-full bg-current" />
              <span className="block h-0.5 w-full bg-current" />
            </span>
          </button>
        </div>
      </div>

      {isOpen && (
        <div className="border-t border-[color:var(--isl-hairline)] bg-paper md:hidden">
          <div className="mx-auto flex w-full max-w-[1240px] flex-col gap-1 px-5 py-4">
            {siteConfig.navigation.map((link) => {
              const active = pathname === link.href;
              return (
                <LoadingLink
                  key={link.href}
                  href={link.href}
                  onClick={() => setIsOpen(false)}
                  className={`rounded-[2px] border-s-2 px-3 py-2.5 font-isl-body text-base font-medium transition-colors ${
                    active
                      ? "border-oxblood bg-cream text-ink"
                      : "border-transparent text-ink-2 hover:bg-cream hover:text-ink"
                  }`}
                >
                  {t(`nav.${link.id}`)}
                </LoadingLink>
              );
            })}
            <div className="flex flex-col gap-2 pt-2">
              <LanguageSwitcher className="w-full justify-center py-2.5" />
              <Button href="/#contact-us" size="sm" onClick={gaClickJoinNow} className="w-full">
                {t("joinNow")}
              </Button>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
