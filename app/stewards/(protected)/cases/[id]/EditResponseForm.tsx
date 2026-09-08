"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { editCaseResponseAction } from "@/app/stewards/actions";
import FormActionButton from "@/app/stewards/components/FormActionButton";
import EvidencePasteBox from "@/app/stewards/(protected)/cases/EvidencePasteBox";
import type { AttachmentRef } from "@/lib/stewards/types";

const inputClass =
  "w-full rounded-[2px] border border-[color:var(--isl-hairline)] bg-paper px-3 py-2 text-ink placeholder:text-faint focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--isl-oxblood)]";

export default function EditResponseForm({
  caseId,
  responseId,
  text,
  links,
  attachments,
}: {
  caseId: string;
  responseId: string;
  text: string;
  links: string[];
  attachments: AttachmentRef[];
}) {
  const t = useTranslations("stewards");
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-[11px] font-semibold uppercase tracking-[0.12em] text-oxblood transition hover:opacity-80"
      >
        {t("cases.edit.editStatement")}
      </button>
    );
  }

  return (
    <form action={editCaseResponseAction} className="grid gap-3 rounded-[2px] border border-[color:var(--isl-hairline)] bg-cream p-3">
      <input type="hidden" name="case_id" value={caseId} />
      <input type="hidden" name="response_id" value={responseId} />

      <label className="block">
        <span className="mb-1 block text-sm text-ink-2">{t("cases.edit.statementText")}</span>
        <textarea name="text" defaultValue={text} required rows={4} dir="auto" className={inputClass} />
      </label>

      {attachments.length > 0 && (
        <div>
          <p className="mb-2 text-xs text-meta">{t("cases.edit.keepAttachments")}</p>
          <div className="flex flex-col gap-1.5">
            {attachments.map((a) => (
              <label key={a.url} className="flex items-center gap-2 text-sm text-ink-2">
                <input
                  type="checkbox"
                  name="keep_attachment_urls"
                  value={a.url}
                  defaultChecked
                  className="h-4 w-4 accent-[color:var(--isl-oxblood)]"
                />
                <span className="truncate">{a.name}</span>
              </label>
            ))}
          </div>
        </div>
      )}

      <label className="block">
        <span className="mb-1 block text-sm text-ink-2">{t("cases.edit.links")}</span>
        <textarea
          name="links"
          defaultValue={links.join("\n")}
          rows={2}
          dir="ltr"
          placeholder={t("cases.edit.linksPlaceholder")}
          className={inputClass}
        />
      </label>

      <div className="grid gap-4">
        <EvidencePasteBox />
      </div>

      <div className="flex items-center gap-3">
        <FormActionButton
          idleLabel={t("cases.edit.save")}
          loadingLabel={t("cases.edit.saving")}
          className="rounded-[2px] bg-ink px-4 py-1.5 text-sm font-semibold text-bone transition hover:opacity-90"
        />
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-xs font-semibold uppercase tracking-[0.12em] text-meta transition hover:text-ink"
        >
          {t("cases.edit.cancel")}
        </button>
      </div>
    </form>
  );
}
