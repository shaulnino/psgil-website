"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
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
  canAdmin = false,
  canAttendance = false,
  variant = "desktop",
  className = "",
}: {
  authed: boolean;
  canSteward?: boolean;
  canAdmin?: boolean;
  canAttendance?: boolean;
  variant?: "desktop" | "mobile";
  className?: string;
}) {
  if (!authed) return <GuestSignIn className={className} />;
  if (variant === "mobile")
    return <AccountMobile canSteward={canSteward} canAdmin={canAdmin} canAttendance={canAttendance} />;
  return (
    <AccountDropdown
      canSteward={canSteward}
      canAdmin={canAdmin}
      canAttendance={canAttendance}
      className={className}
    />
  );
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

function AccountDropdown({
  className,
  canSteward,
  canAdmin,
  canAttendance,
}: {
  className: string;
  canSteward: boolean;
  canAdmin: boolean;
  canAttendance: boolean;
}) {
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
          {canAdmin && (
            <LoadingLink href="/admin" onClick={() => setOpen(false)} className={menuItem}>
              {t("admin")}
            </LoadingLink>
          )}
          {canAttendance && (
            <LoadingLink href="/admin/attendance" onClick={() => setOpen(false)} className={menuItem}>
              {t("attendance")}
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

/** Indented sub-item inside the mobile "My Account" group. */
function subItemClass(active: boolean): string {
  return `block w-full rounded-[2px] ps-8 pe-3 py-2 text-start font-isl-body text-sm transition-colors ${
    active ? "bg-cream text-ink" : "text-meta hover:bg-cream hover:text-ink"
  }`;
}

function AccountMobile({
  canSteward,
  canAdmin,
  canAttendance,
}: {
  canSteward: boolean;
  canAdmin: boolean;
  canAttendance: boolean;
}) {
  const t = useTranslations("account.menu");
  const pathname = usePathname();

  const inAccount = (p: string) => pathname === p || pathname.startsWith(`${p}/`);
  const isAdminActive = inAccount("/admin") && !inAccount("/admin/attendance");
  const isAccountActive =
    inAccount("/account") || inAccount("/stewards") || inAccount("/admin");

  // Expand by default when the user is already inside an account section.
  const [open, setOpen] = useState(isAccountActive);

  return (
    <div className="flex flex-col">
      {/* Section header — styled like the other top-level nav items */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className={`flex w-full items-center justify-between rounded-[2px] border-s-2 px-3 py-2.5 font-isl-body text-base font-medium transition-colors ${
          isAccountActive
            ? "border-oxblood bg-cream text-ink"
            : "border-transparent text-ink-2 hover:bg-cream hover:text-ink"
        }`}
      >
        <span>{t("account")}</span>
        <span
          aria-hidden
          className={`text-[10px] transition-transform ${open ? "rotate-180" : ""}`}
        >
          ▾
        </span>
      </button>

      {/* Sub-menu */}
      {open && (
        <div className="mt-1 flex flex-col gap-0.5">
          <LoadingLink href="/account" className={subItemClass(inAccount("/account"))}>
            {t("profile")}
          </LoadingLink>
          {canSteward && (
            <LoadingLink href="/stewards" className={subItemClass(inAccount("/stewards"))}>
              {t("stewards")}
            </LoadingLink>
          )}
          {canAdmin && (
            <LoadingLink href="/admin" className={subItemClass(isAdminActive)}>
              {t("admin")}
            </LoadingLink>
          )}
          {canAttendance && (
            <LoadingLink href="/admin/attendance" className={subItemClass(inAccount("/admin/attendance"))}>
              {t("attendance")}
            </LoadingLink>
          )}
          <form action={logoutAction}>
            <button type="submit" className={subItemClass(false)}>
              {t("signOut")}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
