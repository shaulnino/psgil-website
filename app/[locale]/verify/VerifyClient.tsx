"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { verifyEmailAction } from "@/lib/auth/actions";
import LoadingLink from "@/components/LoadingLink";

type Status = "working" | "success" | "invalid";

export default function VerifyClient({ token }: { token: string }) {
  const t = useTranslations("account.verify");
  const [status, setStatus] = useState<Status>(token ? "working" : "invalid");

  useEffect(() => {
    if (!token) return;
    let active = true;
    verifyEmailAction(token)
      .then((r) => active && setStatus(r.ok ? "success" : "invalid"))
      .catch(() => active && setStatus("invalid"));
    return () => {
      active = false;
    };
  }, [token]);

  if (status === "working") return <p className="text-ink-2">{t("working")}</p>;

  if (status === "success") {
    return (
      <div className="space-y-4">
        <p className="text-[color:var(--isl-success)]">{t("success")}</p>
        <LoadingLink href="/account" className="text-oxblood hover:text-oxblood-deep">
          {t("goToAccount")}
        </LoadingLink>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <p className="text-[color:var(--isl-danger)]">{t("invalid")}</p>
      <p className="text-sm text-meta">{t("requestNew")}</p>
    </div>
  );
}
