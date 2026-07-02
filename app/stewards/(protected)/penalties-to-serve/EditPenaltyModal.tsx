"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import { useTranslations } from "next-intl";
import { editPenaltyToServeAction } from "@/app/stewards/actions";
import Modal from "@/app/stewards/components/Modal";
import { Button } from "@/components/ui/button";
import type { PenaltyToServe } from "@/lib/stewards/types";

type Rule = { id: string; penaltyType: string; penaltyLabel: string; penaltyDescription: string };

const inputCls =
  "w-full rounded-[2px] border border-[color:var(--isl-hairline)] bg-paper px-3 py-2 text-sm text-ink placeholder:text-faint focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--isl-oxblood)]";

function SaveBtn() {
  const { pending } = useFormStatus();
  const t = useTranslations("stewards");
  return (
    <Button type="submit" disabled={pending} size="md">
      {pending ? t("penaltiesToServe.editModal.saving") : t("penaltiesToServe.editModal.save")}
    </Button>
  );
}

export default function EditPenaltyModal({ penalty, rules }: { penalty: PenaltyToServe; rules: Rule[] }) {
  const t = useTranslations("stewards");
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
        {t("penaltiesToServe.editModal.editButton")}
      </Button>

      <Modal open={open} onClose={() => setOpen(false)}>
          <div className="w-full max-w-md rounded-[2px] border border-[color:var(--isl-hairline)] bg-paper flex flex-col">
            {/* Header */}
            <div className="border-b border-[color:var(--isl-hairline)] px-6 py-4 flex items-center justify-between shrink-0">
              <div>
                <p className="font-isl-body text-[0.75rem] font-semibold uppercase tracking-[0.2em] text-brass-ink">{t("penaltiesToServe.editModal.heading")}</p>
                <p className="mt-0.5 text-sm font-semibold text-ink">{penalty.penaltyLabel}</p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label={t("penaltiesToServe.editModal.close")}
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
                <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-meta">{t("penaltiesToServe.editModal.penaltyType")}</span>
                <select value={selected} onChange={(e) => setSelected(e.target.value)} required className={inputCls}>
                  <option value="">{t("penaltiesToServe.editModal.selectPenalty")}</option>
                  {rules.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.penaltyLabel}{r.penaltyDescription ? ` — ${r.penaltyDescription}` : ""}
                    </option>
                  ))}
                  <option value="__custom__">{t("penaltiesToServe.editModal.customOther")}</option>
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
                    <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-meta">{t("penaltiesToServe.editModal.penaltyLabel")}</span>
                    <input name="penalty_label" required defaultValue={penalty.penaltyLabel} className={inputCls} />
                  </label>
                  <label className="block">
                    <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-meta">{t("penaltiesToServe.editModal.typeInternalKey")}</span>
                    <input name="penalty_type" defaultValue={penalty.penaltyType} placeholder={t("penaltiesToServe.editModal.typePlaceholder")} className={inputCls} />
                  </label>
                  <label className="block">
                    <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-meta">{t("penaltiesToServe.editModal.description")}</span>
                    <input name="penalty_description" defaultValue={penalty.penaltyDescription} placeholder={t("penaltiesToServe.editModal.descriptionPlaceholder")} className={inputCls} />
                  </label>
                </>
              )}

              <label className="block">
                <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-meta">{t("penaltiesToServe.editModal.adminNotes")}</span>
                <textarea name="admin_notes" rows={2} dir="auto" defaultValue={penalty.adminNotes ?? ""} placeholder={t("penaltiesToServe.editModal.adminNotesPlaceholder")} className={inputCls} />
              </label>

              <div className="flex items-center gap-3 pt-1">
                <SaveBtn />
                <Button
                  type="button"
                  variant="secondary"
                  size="md"
                  onClick={() => setOpen(false)}
                >
                  {t("penaltiesToServe.editModal.cancel")}
                </Button>
              </div>
            </form>
          </div>
      </Modal>
    </>
  );
}
