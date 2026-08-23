"use client";

import { useState, useRef } from "react";
import { useFormStatus } from "react-dom";
import { useTranslations } from "next-intl";
import Modal from "@/app/stewards/components/Modal";
import EvidencePasteBox from "@/app/stewards/(protected)/cases/EvidencePasteBox";
import { submitAppealAction } from "@/app/stewards/actions";
import { Button } from "@/components/ui/button";

function SubmitBtn() {
  const { pending } = useFormStatus();
  const t = useTranslations("stewards");
  return (
    <Button type="submit" disabled={pending} variant="primary" size="md">
      {pending ? t("appeals.submitLoading") : t("appeals.submitIdle")}
    </Button>
  );
}

type Props = {
  caseId: string;
  caseTitle: string;
  hoursRemaining: number;
};

export default function AppealSubmitModal({ caseId, caseTitle, hoursRemaining }: Props) {
  const t = useTranslations("stewards");
  const [step, setStep] = useState<"closed" | "confirm" | "form">("closed");
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <>
      {/* Trigger */}
      <button
        type="button"
        onClick={() => setStep("confirm")}
        className="rounded-[2px] border border-status-warning px-4 py-1.5 text-xs font-bold uppercase tracking-[0.08em] text-status-warning transition-colors hover:bg-cream focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--isl-oxblood)]"
      >
        {t("appeals.submitIdle")}
      </button>

      {/* Step 1 — Confirmation warning */}
      <Modal open={step === "confirm"} onClose={() => setStep("closed")}>
        <div className="w-full max-w-md rounded-[2px] border border-[color:var(--isl-hairline)] bg-paper">
          <div className="border-b border-[color:var(--isl-hairline)] px-6 py-4 flex items-center justify-between">
            <div>
              <p className="font-isl-body text-[0.75rem] font-semibold uppercase tracking-[0.2em] text-status-warning">{t("appeals.confirmEyebrow")}</p>
              <p className="mt-0.5 text-sm font-semibold text-ink">{t("appeals.confirmTitle")}</p>
            </div>
            <button type="button" onClick={() => setStep("closed")}
              className="flex h-11 w-11 items-center justify-center rounded-[2px] border border-[color:var(--isl-hairline)] bg-paper text-lg leading-none text-ink-2 transition-colors hover:border-ink hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--isl-oxblood)]">✕</button>
          </div>

          <div className="px-6 py-5 space-y-4">
            <div className="rounded-[2px] border border-status-warning bg-cream px-4 py-4">
              <p className="text-sm font-semibold text-status-warning mb-2">{t("appeals.confirmPenaltyHeading")}</p>
              <p className="text-sm text-ink-2 leading-relaxed">
                {t.rich("appeals.confirmPenaltyBody", {
                  notUpheld: (chunks) => <strong className="text-ink">{chunks}</strong>,
                  points: (chunks) => <strong className="text-status-warning num">{chunks}</strong>,
                })}
              </p>
            </div>
            <p className="text-sm text-ink-2 leading-relaxed">
              {t.rich("appeals.confirmContextBody", {
                caseTitle,
                hoursRemaining,
                caseStrong: (chunks) => <strong className="text-ink">{chunks}</strong>,
                hoursStrong: (chunks) => <strong className="text-ink num">{chunks}</strong>,
              })}
            </p>
            <p className="text-sm text-ink-2">
              {t("appeals.confirmProceed")}
            </p>

            <div className="flex items-center gap-3 pt-1">
              <Button
                type="button"
                onClick={() => setStep("form")}
                variant="primary"
                size="md"
              >
                {t("appeals.confirmContinue")}
              </Button>
              <Button
                type="button"
                onClick={() => setStep("closed")}
                variant="secondary"
                size="md"
              >
                {t("appeals.confirmCancel")}
              </Button>
            </div>
          </div>
        </div>
      </Modal>

      {/* Step 2 — Appeal form */}
      <Modal open={step === "form"} onClose={() => setStep("closed")}>
        <div className="w-full max-w-lg rounded-[2px] border border-[color:var(--isl-hairline)] bg-paper">
          <div className="border-b border-[color:var(--isl-hairline)] px-6 py-4 flex items-center justify-between">
            <div>
              <p className="font-isl-body text-[0.75rem] font-semibold uppercase tracking-[0.2em] text-brass-ink">{t("appeals.formEyebrow")}</p>
              <p className="mt-0.5 text-sm font-semibold text-ink truncate max-w-xs">{caseTitle}</p>
            </div>
            <button type="button" onClick={() => setStep("closed")}
              className="flex h-11 w-11 items-center justify-center rounded-[2px] border border-[color:var(--isl-hairline)] bg-paper text-lg leading-none text-ink-2 transition-colors hover:border-ink hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--isl-oxblood)]">✕</button>
          </div>

          <form ref={formRef} action={submitAppealAction} className="px-6 py-5 space-y-5">
            <input type="hidden" name="case_id" value={caseId} />

            <div className="flex items-center gap-2 rounded-[2px] border border-status-warning bg-cream px-3 py-2">
              <span className="text-status-warning text-xs">⚠</span>
              <p className="text-xs text-ink-2">
                {t("appeals.formWindowWarning", { hoursRemaining })}
              </p>
            </div>

            <label className="block">
              <span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.08em] text-meta">
                {t("appeals.descriptionLabel")} <span className="text-status-danger">*</span>
              </span>
              <textarea name="description" required rows={5} dir="auto"
                placeholder={t("appeals.descriptionPlaceholder")}
                className="w-full rounded-[2px] border border-[color:var(--isl-hairline)] bg-paper px-3 py-2.5 text-sm text-ink placeholder:text-faint focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--isl-oxblood)]" />
            </label>

            {/* Evidence */}
            <div className="rounded-[2px] border border-brass bg-cream p-4">
              <h4 className="text-xs font-semibold uppercase tracking-[0.08em] text-brass-ink">
                {t("appeals.evidenceLabel")} <span className="text-status-danger">*</span>
              </h4>
              <p className="mt-1 text-xs text-meta">
                {t("appeals.evidenceHelper")}
              </p>
              <div className="mt-3 space-y-3">
                <EvidencePasteBox />
                <label className="block">
                  <span className="mb-1 block text-xs text-ink-2">{t("appeals.evidenceUrlLabel")}</span>
                  <input type="url" name="evidence_items" inputMode="url" dir="ltr"
                    placeholder={t("appeals.evidenceUrlPlaceholder")}
                    className="w-full rounded-[2px] border border-[color:var(--isl-hairline)] bg-paper px-3 py-2 text-sm text-ink placeholder:text-faint focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--isl-oxblood)]" />
                </label>
              </div>
            </div>

            <div className="flex items-center gap-3 pt-1">
              <SubmitBtn />
              <Button type="button" onClick={() => setStep("confirm")} variant="secondary" size="md">
                {t("appeals.formBack")}
              </Button>
            </div>
          </form>
        </div>
      </Modal>
    </>
  );
}
