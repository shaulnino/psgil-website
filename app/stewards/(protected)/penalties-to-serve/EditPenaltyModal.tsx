"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import { editPenaltyToServeAction } from "@/app/stewards/actions";
import Modal from "@/app/stewards/components/Modal";
import { Button } from "@/components/ui/button";
import type { PenaltyToServe } from "@/lib/stewards/types";

type Rule = { id: string; penaltyType: string; penaltyLabel: string; penaltyDescription: string };

const inputCls =
  "w-full rounded-[2px] border border-[color:var(--isl-hairline)] bg-paper px-3 py-2 text-sm text-ink placeholder:text-faint focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--isl-oxblood)]";

function SaveBtn() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} size="md">
      {pending ? "Saving…" : "Save Changes"}
    </Button>
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
      <Button
        type="button"
        variant="secondary"
        size="sm"
        onClick={() => setOpen(true)}
      >
        Edit
      </Button>

      <Modal open={open} onClose={() => setOpen(false)}>
          <div className="w-full max-w-md rounded-[2px] border border-[color:var(--isl-hairline)] bg-paper flex flex-col">
            {/* Header */}
            <div className="border-b border-[color:var(--isl-hairline)] px-6 py-4 flex items-center justify-between shrink-0">
              <div>
                <p className="font-isl-body text-[0.75rem] font-semibold uppercase tracking-[0.2em] text-brass-ink">Edit Penalty</p>
                <p className="mt-0.5 text-sm font-semibold text-ink">{penalty.penaltyLabel}</p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close"
                className="flex h-11 w-11 items-center justify-center rounded-[2px] border border-[color:var(--isl-hairline)] text-meta transition-colors hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--isl-oxblood)]"
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
                <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-meta">Penalty type *</span>
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
                    <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-meta">Penalty label *</span>
                    <input name="penalty_label" required defaultValue={penalty.penaltyLabel} className={inputCls} />
                  </label>
                  <label className="block">
                    <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-meta">Type (internal key)</span>
                    <input name="penalty_type" defaultValue={penalty.penaltyType} placeholder="e.g. qualifying_ban" className={inputCls} />
                  </label>
                  <label className="block">
                    <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-meta">Description</span>
                    <input name="penalty_description" defaultValue={penalty.penaltyDescription} placeholder="Brief explanation" className={inputCls} />
                  </label>
                </>
              )}

              <label className="block">
                <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-meta">Admin notes</span>
                <textarea name="admin_notes" rows={2} dir="auto" defaultValue={penalty.adminNotes ?? ""} placeholder="Reason or context…" className={inputCls} />
              </label>

              <div className="flex items-center gap-3 pt-1">
                <SaveBtn />
                <Button
                  type="button"
                  variant="secondary"
                  size="md"
                  onClick={() => setOpen(false)}
                >
                  Cancel
                </Button>
              </div>
            </form>
          </div>
      </Modal>
    </>
  );
}
