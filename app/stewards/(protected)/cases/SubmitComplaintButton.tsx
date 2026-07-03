"use client";

import { useTranslations } from "next-intl";

import FormActionButton from "@/app/stewards/components/FormActionButton";

export default function SubmitComplaintButton() {
  const t = useTranslations("stewards");
  return (
    <FormActionButton
      idleLabel={t("cases.submit.idle")}
      loadingLabel={t("cases.submit.loading")}
      className="rounded-[2px] bg-ink px-5 py-2.5 text-sm font-medium uppercase tracking-[0.08em] text-bone transition-colors hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--isl-oxblood)]"
      spinnerClassName="border-bone/30 border-t-bone"
    />
  );
}
