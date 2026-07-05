"use client";

import { useTranslations } from "next-intl";
import LoadingLink from "@/components/LoadingLink";

/**
 * Header entry point for accounts (PW-2b): "Account" when signed in, otherwise
 * "Sign in". The public site stays fully browsable either way — this only
 * links to the personalized area.
 */
export default function AccountMenu({ authed, className = "" }: { authed: boolean; className?: string }) {
  const t = useTranslations("account.menu");
  return (
    <LoadingLink
      href={authed ? "/account" : "/login"}
      className={`font-isl-body text-sm font-medium text-meta transition-colors hover:text-ink ${className}`}
    >
      {authed ? t("account") : t("signIn")}
    </LoadingLink>
  );
}
