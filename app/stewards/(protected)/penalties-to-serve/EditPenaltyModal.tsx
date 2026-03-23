"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import { editPenaltyToServeAction } from "@/app/stewards/actions";
import Modal from "@/app/stewards/components/Modal";
import type { PenaltyToServe } from "@/lib/stewards/types";

type Rule = { id: string; penaltyType: string; penaltyLabel: string; penaltyDescription: string };

const inputCls =
  "w-full rounded-lg border border-white/15 bg-black/30 px-3 py-2 text-sm text-white/90 focus:border-[#D4AF37]/50 focus:outline-none transition";

function SaveBtn() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-full bg-[#7020B0] px-5 py-2 text-sm font-semibold transition hover:bg-[#7c2ac3] disabled:opacity-50"
    >
      {pending ? "Saving…" : "Save Changes"}
    </button>
  );
}

export default function EditPenaltyModal({ penalty, rules }: { penalty: PenaltyToServe; rules: Rule[] }) {
  const [open, setOpen] = useState(false);

  // Find if current label matches a known rule
  const matchedRule = rules.find((r) => r.penaltyLabel === penalty.penaltyLabel || r.penaltyType === penalty.penaltyType);
  const [selected, setSelected] = useState<string>(matchedRule?.id ?? "__custom__");
  const isCustom = selected === "__custom__";
  const chosenRule = rules.find((r) => r.id === selected);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-full border border-[#D4AF37]/40 bg-[#D4AF37]/10 px-3 py-1 text-xs font-semibold text-[#f4d98a] transition hover:border-[#D4AF37]/70 hover:bg-[#D4AF37]/20"
      >
        Edit
      </button>

      <Modal open={open} onClose={() => setOpen(false)}>
          <div className="w-full max-w-md rounded-2xl border border-[#D4AF37]/30 bg-[#13131f] shadow-[0_24px_60px_rgba(0,0,0,0.6)] flex flex-col">
            {/* Header */}
            <div className="border-b border-white/10 px-6 py-4 flex items-center justify-between shrink-0">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-[#D4AF37]/70">Edit Penalty</p>
                <p className="mt-0.5 text-sm font-semibold text-white/90">{penalty.penaltyLabel}</p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="text-white/40 hover:text-white transition text-lg leading-none"
              >
                ✕
              </button>
            </div>

            {/* Form */}
            <form
              action={async (fd) => {
                await editPenaltyToServeAction(fd);
                setOpen(false);
              }}
              className="px-6 py-5 space-y-4"
            >
              <input type="hidden" name="penalty_id" value={penalty.id} />

              {/* Penalty type — dropdown from rules, or custom */}
              <div>
                <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-white/60">Penalty type *</span>
                <select value={selected} onChange={(e) => setSelected(e.target.value)} required className={inputCls}>
                  <option value="">Select penalty…</option>
                  {rules.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.penaltyLabel}{r.penaltyDescription ? ` — ${r.penaltyDescription}` : ""}
                    </option>
                  ))}
                  <option value="__custom__">Custom / Other…</option>
                </select>
              </div>

              {/* Auto-fill hidden fields from selected rule */}
              {!isCustom && chosenRule && (
                <>
                  <input type="hidden" name="penalty_label"       value={chosenRule.penaltyLabel} />
                  <input type="hidden" name="penalty_type"        value={chosenRule.penaltyType} />
                  <input type="hidden" name="penalty_description" value={chosenRule.penaltyDescription} />
                </>
              )}

              {/* Custom free-text fallback */}
              {isCustom && (
                <>
                  <label className="block">
                    <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-white/60">Penalty label *</span>
                    <input name="penalty_label" required defaultValue={penalty.penaltyLabel} className={inputCls} />
                  </label>
                  <label className="block">
                    <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-white/60">Type (internal key)</span>
                    <input name="penalty_type" defaultValue={penalty.penaltyType} placeholder="e.g. qualifying_ban" className={inputCls} />
                  </label>
                  <label className="block">
                    <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-white/60">Description</span>
                    <input name="penalty_description" defaultValue={penalty.penaltyDescription} placeholder="Brief explanation" className={inputCls} />
                  </label>
                </>
              )}

              <label className="block">
                <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-white/60">Admin notes</span>
                <textarea name="admin_notes" rows={2} defaultValue={penalty.adminNotes ?? ""} placeholder="Reason or context…" className={inputCls} />
              </label>

              <div className="flex items-center gap-3 pt-1">
                <SaveBtn />
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="rounded-full border border-white/15 px-5 py-2 text-sm text-white/60 transition hover:border-white/30 hover:text-white"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
      </Modal>
    </>
  );
}
