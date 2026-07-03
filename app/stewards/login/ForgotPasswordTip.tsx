"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

export default function ForgotPasswordTip() {
  const t = useTranslations("stewards");
  const [open, setOpen] = useState(false);

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="text-sm text-meta transition hover:text-oxblood"
      >
        {t("auth.forgot.trigger")}
      </button>

      {open && (
        <div className="mt-3 rounded-[2px] border border-[color:var(--isl-hairline)] bg-cream px-4 py-3 text-start text-sm text-ink-2 leading-relaxed">
          <p className="font-semibold text-ink mb-1">{t("auth.forgot.heading")}</p>
          <p>
            {t("auth.forgot.body")}
          </p>
        </div>
      )}
    </div>
  );
}
