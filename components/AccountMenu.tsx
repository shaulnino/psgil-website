"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import LoadingLink from "@/components/LoadingLink";
import { logoutAction } from "@/lib/auth/actions";

/**
 * Account hub (PW-2b, restructured): "My Account" is the single entry point to
 * every signed-in area — Profile, the Steward module, and (later) driver-only
 * areas like attendance. The public content nav stays separate. Guests see a
 * plain "Sign in" link instead.
 *
 * Top-level component intentionally holds NO hooks and only branches, so the
 * hook-bearing desktop dropdown is a stable child regardless of auth state.
 */
export default function AccountMenu({
  authed,
  canSteward = false,
  variant = "desktop",
  className = "",
}: {
  authed: boolean;
  canSteward?: boolean;
  variant?: "desktop" | "mobile";
  className?: string;
}) {
  if (!authed) return <GuestSignIn className={className} />;
  if (variant === "mobile") return <AccountMobile canSteward={canSteward} />;
  return <AccountDropdown canSteward={canSteward} className={className} />;
}

function GuestSignIn({ className }: { className: string }) {
  const t = useTranslations("account.menu");
  return (
    <LoadingLink
      href="/login"
      className={`font-isl-body text-sm font-medium text-meta transition-colors hover:text-ink ${className}`}
    >
      {t("signIn")}
    </LoadingLink>
  );
}

const menuItem =
  "block w-full rounded-[2px] px-3 py-2 text-start font-isl-body text-sm text-ink-2 transition-colors hover:bg-cream hover:text-ink";

function AccountDropdown({ className, canSteward }: { className: string; canSteward: boolean }) {
  const t = useTranslations("account.menu");
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div ref={ref} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="menu"
        className="flex items-center gap-1 font-isl-body text-sm font-medium text-meta transition-colors hover:text-ink"
      >
        {t("account")}
        <span aria-hidden className={`text-[10px] transition-transform ${open ? "rotate-180" : ""}`}>
          ▾
        </span>
      </button>
      {open && (
        <div
          role="menu"
          className="absolute end-0 z-50 mt-2 min-w-[11rem] rounded-[2px] border border-[color:var(--isl-hairline)] bg-paper py-1"
        >
          <LoadingLink href="/account" onClick={() => setOpen(false)} className={menuItem}>
            {t("profile")}
          </LoadingLink>
          {canSteward && (
            <LoadingLink href="/stewards" onClick={() => setOpen(false)} className={menuItem}>
              {t("stewards")}
            </LoadingLink>
          )}
          <div className="my-1 border-t border-[color:var(--isl-hairline)]" />
          <form action={logoutAction}>
            <button type="submit" className={menuItem}>
              {t("signOut")}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}

function AccountMobile({ canSteward }: { canSteward: boolean }) {
  const t = useTranslations("account.menu");
  return (
    <div className="flex flex-col gap-1">
      <span className="px-3 pt-1 font-isl-body text-xs font-semibold uppercase tracking-[0.14em] text-meta">
        {t("account")}
      </span>
      <LoadingLink href="/account" className={menuItem}>
        {t("profile")}
      </LoadingLink>
      {canSteward && (
        <LoadingLink href="/stewards" className={menuItem}>
          {t("stewards")}
        </LoadingLink>
      )}
      <form action={logoutAction}>
        <button type="submit" className={menuItem}>
          {t("signOut")}
        </button>
      </form>
    </div>
  );
}
