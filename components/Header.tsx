"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import Button from "@/components/Button";
import LoadingLink from "@/components/LoadingLink";
import { siteConfig } from "@/lib/siteConfig";

export default function Header() {
  const [isOpen, setIsOpen] = useState(false);
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-50 border-b border-white/10 bg-[#0B0B0E]/80 backdrop-blur">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-6">
        <Link href="/" className="flex items-center gap-3">
          <span className="flex h-12 w-12 items-center justify-center rounded-full border border-white/20 bg-white/5 md:h-14 md:w-14">
            <Image
              src="/psgil-logo.png"
              alt="PSGiL logo"
              width={64}
              height={64}
              className="h-full w-full object-contain"
              sizes="(max-width: 768px) 48px, 56px"
              priority
            />
          </span>
          <span className="font-display text-lg tracking-wide text-white">
            {siteConfig.leagueName}
          </span>
        </Link>

        <nav className="hidden items-center gap-8 md:flex">
          {siteConfig.navigation.map((link) => {
            const isComingSoon = link.label === "Articles";
            return (
              <div key={link.href} className="relative">
                <LoadingLink
                  href={link.href}
                  className={`text-sm font-medium transition ${
                    pathname === link.href ? "text-white" : "text-white/60 hover:text-white"
                  }`}
                >
                  {link.label}
                </LoadingLink>
                {isComingSoon && (
                  <span className="ml-2 rounded-[4px] bg-red-700/90 px-1.5 py-0.5 text-[9px] font-medium leading-none text-white">
                    Coming soon
                  </span>
                )}
              </div>
            );
          })}
        </nav>

        <div className="flex items-center gap-3">
          <Button href={siteConfig.discordUrl} size="sm" external>
            Join Now
          </Button>
          <button
            onClick={() => setIsOpen((open) => !open)}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white/80 transition hover:text-white md:hidden"
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
        <div className="border-t border-white/10 bg-[#0B0B0E] md:hidden">
          <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-6 py-4">
            {siteConfig.navigation.map((link) => {
              const isComingSoon = link.label === "Articles";
              return (
                <div key={link.href} className="flex items-center gap-2">
                  <LoadingLink
                    href={link.href}
                    onClick={() => setIsOpen(false)}
                    className={`text-sm font-medium transition ${
                      pathname === link.href ? "text-white" : "text-white/70 hover:text-white"
                    }`}
                  >
                    {link.label}
                  </LoadingLink>
                  {isComingSoon && (
                    <span className="rounded-[4px] bg-red-700/90 px-1.5 py-0.5 text-[9px] font-medium leading-none text-white">
                      Coming soon
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </header>
  );
}
