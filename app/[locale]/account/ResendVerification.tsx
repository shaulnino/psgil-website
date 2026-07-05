"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { resendVerificationAction } from "@/lib/auth/actions";

export default function ResendVerification() {
  const t = useTranslations("account.account");
  const [pending, startTransition] = useTransition();
  const [sent, setSent] = useState(false);

  if (sent) return <span className="text-sm text-[color:var(--isl-success)]">{t("resent")}</span>;

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => startTransition(async () => {
        await resendVerificationAction();
        setSent(true);
      })}
      className="text-sm font-medium text-oxblood underline-offset-2 hover:text-oxblood-deep hover:underline disabled:opacity-50"
    >
      {t("resend")}
    </button>
  );
}
