"use client";

import Image from "next/image";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import LoadingLink from "@/components/LoadingLink";
import { siteConfig } from "@/lib/siteConfig";
import { gaClickJoinNow } from "@/lib/ga";
import StewardNotifBadge from "@/app/stewards/components/StewardNotifBadge";

export default function Header() {
  const [isOpen, setIsOpen] = useState(false);
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-50 border-b border-[color:var(--isl-hairline)] bg-bone">
      <div className="mx-auto flex h-16 w-full max-w-[1240px] items-center justify-between px-5">
        <LoadingLink href="/" hideSpinner className="group flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center transition group-aria-[busy=true]:opacity-60 md:h-12 md:w-12">
            <Image
              src="/psgil-logo.png"
              alt="ISL logo"
              width={64}
              height={64}
              className="h-full w-full object-contain"
              sizes="(max-width: 768px) 44px, 48px"
              priority
              unoptimized
            />
          </span>
          <span className="font-display text-2xl font-bold tracking-[0.01em] text-ink">
            {siteConfig.leagueName}
          </span>
        </LoadingLink>

        <nav className="hidden items-center gap-1 md:flex">
          {siteConfig.navigation.map((link) => {
            const isStewards = link.label === "Stewards";
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
                  {link.label}
                </LoadingLink>
                {isStewards && <StewardNotifBadge />}
              </div>
            );
          })}
        </nav>

        <div className="flex items-center gap-3">
          <div className="hidden sm:block">
            <Button href="/#contact-us" size="sm" onClick={gaClickJoinNow}>
              Join Now
            </Button>
          </div>
          <button
            onClick={() => setIsOpen((open) => !open)}
            className="flex h-11 w-11 items-center justify-center rounded-[2px] border border-[color:var(--isl-hairline)] text-ink-2 transition-colors hover:border-ink hover:text-ink md:hidden"
            aria-label="Toggle navigation"
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
                  {link.label}
                </LoadingLink>
              );
            })}
            <div className="pt-2">
              <Button href="/#contact-us" size="sm" onClick={gaClickJoinNow} className="w-full">
                Join Now
              </Button>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
