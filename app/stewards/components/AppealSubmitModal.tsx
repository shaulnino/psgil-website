"use client";

import { useState, useRef } from "react";
import { useFormStatus } from "react-dom";
import Modal from "@/app/stewards/components/Modal";
import { submitAppealAction } from "@/app/stewards/actions";
import { Button } from "@/components/ui/button";

function SubmitBtn() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} variant="primary" size="md">
      {pending ? "Submitting appeal…" : "Submit Appeal"}
    </Button>
  );
}

type Props = {
  caseId: string;
  caseTitle: string;
  hoursRemaining: number;
};

export default function AppealSubmitModal({ caseId, caseTitle, hoursRemaining }: Props) {
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
        Submit Appeal
      </button>

      {/* Step 1 — Confirmation warning */}
      <Modal open={step === "confirm"} onClose={() => setStep("closed")}>
        <div className="w-full max-w-md rounded-[2px] border border-[color:var(--isl-hairline)] bg-paper">
          <div className="border-b border-[color:var(--isl-hairline)] px-6 py-4 flex items-center justify-between">
            <div>
              <p className="font-isl-body text-[0.75rem] font-semibold uppercase tracking-[0.2em] text-status-warning">Before you continue</p>
              <p className="mt-0.5 text-sm font-semibold text-ink">Important — Appeal Cost</p>
            </div>
            <button type="button" onClick={() => setStep("closed")}
              className="flex h-11 w-11 items-center justify-center rounded-[2px] border border-[color:var(--isl-hairline)] bg-paper text-lg leading-none text-ink-2 transition-colors hover:border-ink hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--isl-oxblood)]">✕</button>
          </div>

          <div className="px-6 py-5 space-y-4">
            <div className="rounded-[2px] border border-status-warning bg-cream px-4 py-4">
              <p className="text-sm font-semibold text-status-warning mb-2">⚠ Unsuccessful appeals are penalised</p>
              <p className="text-sm text-ink-2 leading-relaxed">
                If your appeal is <strong className="text-ink">not upheld</strong>, you will receive an additional{" "}
                <strong className="text-status-warning num">1 license point</strong> as a penalty for an unsuccessful appeal.
              </p>
            </div>
            <p className="text-sm text-ink-2 leading-relaxed">
              You are appealing the verdict in <strong className="text-ink">Case: {caseTitle}</strong>.
              The appeal window closes in approximately <strong className="text-ink num">{hoursRemaining} hours</strong>.
            </p>
            <p className="text-sm text-ink-2">
              Do you understand and wish to proceed with submitting an appeal?
            </p>

            <div className="flex items-center gap-3 pt-1">
              <Button
                type="button"
                onClick={() => setStep("form")}
                variant="primary"
                size="md"
              >
                Yes, I understand — Continue
              </Button>
              <Button
                type="button"
                onClick={() => setStep("closed")}
                variant="secondary"
                size="md"
              >
                Cancel
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
              <p className="font-isl-body text-[0.75rem] font-semibold uppercase tracking-[0.2em] text-brass-ink">File an Appeal</p>
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
                Appeal window closes in ~{hoursRemaining}h. Unsuccessful appeals cost 1 license point.
              </p>
            </div>

            <label className="block">
              <span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.08em] text-meta">
                Appeal Description <span className="text-status-danger">*</span>
              </span>
              <textarea name="description" required rows={5} dir="auto"
                placeholder="Explain the grounds for your appeal. Be clear and specific about what was incorrect in the original verdict…"
                className="w-full rounded-[2px] border border-[color:var(--isl-hairline)] bg-paper px-3 py-2.5 text-sm text-ink placeholder:text-faint focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--isl-oxblood)]" />
            </label>

            {/* Evidence */}
            <div className="rounded-[2px] border border-brass bg-cream p-4">
              <h4 className="text-xs font-semibold uppercase tracking-[0.08em] text-brass-ink">
                Evidence <span className="text-status-danger">*</span>
              </h4>
              <p className="mt-1 text-xs text-meta">
                At least one piece of evidence is required. Upload files or add links/notes below.
              </p>
              <div className="mt-3 space-y-3">
                <label className="block">
                  <span className="mb-1 block text-xs text-ink-2">Links / notes (one per line)</span>
                  <textarea name="evidence_items" rows={3} dir="auto"
                    placeholder="Paste links or add notes…"
                    className="w-full rounded-[2px] border border-[color:var(--isl-hairline)] bg-paper px-3 py-2 text-sm text-ink placeholder:text-faint focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--isl-oxblood)]" />
                </label>
                <label className="block">
                  <span className="mb-1 block text-xs text-ink-2">Attach files</span>
                  <input type="file" name="attachment_files" multiple
                    className="w-full text-xs text-ink-2 file:me-3 file:rounded-[2px] file:border file:border-brass file:bg-cream file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-brass-ink hover:file:bg-paper" />
                </label>
              </div>
            </div>

            <div className="flex items-center gap-3 pt-1">
              <SubmitBtn />
              <Button type="button" onClick={() => setStep("confirm")} variant="secondary" size="md">
                Back
              </Button>
            </div>
          </form>
        </div>
      </Modal>
    </>
  );
}
