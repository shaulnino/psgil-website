"use client";

import { useState, useRef } from "react";
import { useFormStatus } from "react-dom";
import Modal from "@/app/stewards/components/Modal";
import { submitAppealAction } from "@/app/stewards/actions";

function SubmitBtn() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending}
      className="rounded-full bg-[#7020B0] px-5 py-2.5 text-sm font-semibold shadow-[0_0_14px_rgba(112,32,176,0.3)] transition hover:bg-[#7c2ac3] disabled:opacity-50">
      {pending ? "Submitting appeal…" : "Submit Appeal"}
    </button>
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
        className="rounded-full border border-amber-400/50 bg-amber-400/10 px-4 py-1.5 text-xs font-bold uppercase tracking-wider text-amber-200 transition hover:border-amber-400/80 hover:bg-amber-400/20"
      >
        Submit Appeal
      </button>

      {/* Step 1 — Confirmation warning */}
      <Modal open={step === "confirm"} onClose={() => setStep("closed")}>
        <div className="w-full max-w-md rounded-2xl border border-[#D4AF37]/30 bg-[#13131f] shadow-[0_24px_60px_rgba(0,0,0,0.7)]">
          <div className="border-b border-white/10 px-6 py-4 flex items-center justify-between">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-amber-400/70">Before you continue</p>
              <p className="mt-0.5 text-sm font-semibold text-white/90">Important — Appeal Cost</p>
            </div>
            <button type="button" onClick={() => setStep("closed")}
              className="text-lg leading-none text-white/40 hover:text-white transition">✕</button>
          </div>

          <div className="px-6 py-5 space-y-4">
            <div className="rounded-xl border border-amber-400/25 bg-amber-400/8 px-4 py-4">
              <p className="text-sm font-semibold text-amber-200 mb-2">⚠ Unsuccessful appeals are penalised</p>
              <p className="text-sm text-white/70 leading-relaxed">
                If your appeal is <strong className="text-white/90">not upheld</strong>, you will receive an additional{" "}
                <strong className="text-amber-200">1 license point</strong> as a penalty for an unsuccessful appeal.
              </p>
            </div>
            <p className="text-sm text-white/65 leading-relaxed">
              You are appealing the verdict in <strong className="text-white/90">Case: {caseTitle}</strong>.
              The appeal window closes in approximately <strong className="text-white/90">{hoursRemaining} hours</strong>.
            </p>
            <p className="text-sm text-white/65">
              Do you understand and wish to proceed with submitting an appeal?
            </p>

            <div className="flex items-center gap-3 pt-1">
              <button
                type="button"
                onClick={() => setStep("form")}
                className="rounded-full bg-[#7020B0] px-5 py-2.5 text-sm font-semibold shadow-[0_0_14px_rgba(112,32,176,0.3)] transition hover:bg-[#7c2ac3]"
              >
                Yes, I understand — Continue
              </button>
              <button
                type="button"
                onClick={() => setStep("closed")}
                className="rounded-full border border-white/15 px-4 py-2.5 text-sm text-white/60 transition hover:border-white/30 hover:text-white"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      </Modal>

      {/* Step 2 — Appeal form */}
      <Modal open={step === "form"} onClose={() => setStep("closed")}>
        <div className="w-full max-w-lg rounded-2xl border border-[#D4AF37]/30 bg-[#13131f] shadow-[0_24px_60px_rgba(0,0,0,0.7)]">
          <div className="border-b border-white/10 px-6 py-4 flex items-center justify-between">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-[#D4AF37]/70">File an Appeal</p>
              <p className="mt-0.5 text-sm font-semibold text-white/90 truncate max-w-xs">{caseTitle}</p>
            </div>
            <button type="button" onClick={() => setStep("closed")}
              className="text-lg leading-none text-white/40 hover:text-white transition">✕</button>
          </div>

          <form ref={formRef} action={submitAppealAction} className="px-6 py-5 space-y-5">
            <input type="hidden" name="case_id" value={caseId} />

            <div className="flex items-center gap-2 rounded-xl border border-amber-400/25 bg-amber-400/6 px-3 py-2">
              <span className="text-amber-300 text-xs">⚠</span>
              <p className="text-xs text-amber-200/80">
                Appeal window closes in ~{hoursRemaining}h. Unsuccessful appeals cost 1 license point.
              </p>
            </div>

            <label className="block">
              <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-white/60">
                Appeal Description <span className="text-red-400">*</span>
              </span>
              <textarea name="description" required rows={5}
                placeholder="Explain the grounds for your appeal. Be clear and specific about what was incorrect in the original verdict…"
                className="w-full rounded-lg border border-white/15 bg-black/30 px-3 py-2.5 text-sm text-white/90 focus:border-[#D4AF37]/50 focus:outline-none transition placeholder:text-white/25" />
            </label>

            {/* Evidence */}
            <div className="rounded-xl border border-[#D4AF37]/20 bg-black/20 p-4">
              <h4 className="text-xs font-semibold uppercase tracking-wide text-[#D4AF37]">
                Evidence <span className="text-red-400">*</span>
              </h4>
              <p className="mt-1 text-xs text-white/50">
                At least one piece of evidence is required. Upload files or add links/notes below.
              </p>
              <div className="mt-3 space-y-3">
                <label className="block">
                  <span className="mb-1 block text-xs text-white/60">Links / notes (one per line)</span>
                  <textarea name="evidence_items" rows={3}
                    placeholder="Paste links or add notes…"
                    className="w-full rounded-lg border border-white/15 bg-black/30 px-3 py-2 text-sm text-white/90 focus:border-[#D4AF37]/50 focus:outline-none transition placeholder:text-white/25" />
                </label>
                <label className="block">
                  <span className="mb-1 block text-xs text-white/60">Attach files</span>
                  <input type="file" name="attachment_files" multiple
                    className="w-full text-xs text-white/60 file:mr-3 file:rounded-full file:border file:border-[#D4AF37]/30 file:bg-[#D4AF37]/10 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-[#f4d98a] hover:file:bg-[#D4AF37]/20" />
                </label>
              </div>
            </div>

            <div className="flex items-center gap-3 pt-1">
              <SubmitBtn />
              <button type="button" onClick={() => setStep("confirm")}
                className="rounded-full border border-white/15 px-4 py-2.5 text-sm text-white/60 transition hover:border-white/30 hover:text-white">
                Back
              </button>
            </div>
          </form>
        </div>
      </Modal>
    </>
  );
}
