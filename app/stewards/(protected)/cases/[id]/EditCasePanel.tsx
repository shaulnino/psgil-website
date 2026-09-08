"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { editCaseAction } from "@/app/stewards/actions";
import FormActionButton from "@/app/stewards/components/FormActionButton";
import EvidencePasteBox from "@/app/stewards/(protected)/cases/EvidencePasteBox";
import InvolvedDriversPicker from "@/app/stewards/(protected)/cases/InvolvedDriversPicker";
import { Button } from "@/components/ui/button";
import type { AttachmentRef, WeekendSession } from "@/lib/stewards/types";

type DriverOption = { id: string; name: string; email: string };

const inputClass =
  "w-full rounded-[2px] border border-[color:var(--isl-hairline)] bg-paper px-3 py-2 text-ink placeholder:text-faint focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--isl-oxblood)]";

export default function EditCasePanel({
  caseId,
  season,
  round,
  weekendSession,
  incidentLapNumber,
  qualifyingTime,
  description,
  involvedDriverIds,
  links,
  attachments,
  driverOptions,
}: {
  caseId: string;
  season: string;
  round: string;
  weekendSession: WeekendSession;
  incidentLapNumber: number | null;
  qualifyingTime: string | null;
  description: string;
  involvedDriverIds: string[];
  links: string[];
  attachments: AttachmentRef[];
  driverOptions: DriverOption[];
}) {
  const t = useTranslations("stewards");
  const [open, setOpen] = useState(false);
  const [session, setSession] = useState<WeekendSession>(weekendSession);
  const isRaceLike = session === "Race" || session === "Sprint";

  return (
    <div className="mt-4 border-t border-[color:var(--isl-hairline)] pt-4">
      <div className="flex items-center justify-between gap-3">
        <span className="font-isl-body text-[10px] font-semibold uppercase tracking-[0.2em] text-meta">
          {t("cases.edit.adminTools")}
        </span>
        <Button
          type="button"
          variant={open ? "secondary" : "primary"}
          size="sm"
          onClick={() => setOpen((v) => !v)}
        >
          {open ? t("cases.edit.close") : t("cases.edit.editCase")}
        </Button>
      </div>

      {open && (
        <form action={editCaseAction} className="mt-4 grid gap-3 md:grid-cols-2">
          <input type="hidden" name="case_id" value={caseId} />

          <label className="block">
            <span className="mb-1 block text-sm text-ink-2">{t("cases.edit.season")}</span>
            <input name="season" defaultValue={season} required className={inputClass} />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm text-ink-2">{t("cases.edit.round")}</span>
            <input name="round" defaultValue={round} required className={inputClass} />
          </label>

          <label className="block">
            <span className="mb-1 block text-sm text-ink-2">{t("cases.edit.session")}</span>
            <select
              name="weekend_session"
              value={session}
              onChange={(e) => setSession(e.target.value as WeekendSession)}
              className={inputClass}
            >
              <option value="Race">Race</option>
              <option value="Qualifying">Qualifying</option>
              <option value="Sprint">Sprint</option>
            </select>
          </label>
          {isRaceLike ? (
            <label className="block">
              <span className="mb-1 block text-sm text-ink-2">{t("cases.edit.incidentLap")}</span>
              <input
                type="number"
                name="incident_lap_number"
                min={1}
                defaultValue={incidentLapNumber ?? ""}
                className={inputClass}
              />
            </label>
          ) : (
            <label className="block">
              <span className="mb-1 block text-sm text-ink-2">{t("cases.edit.qualifyingTime")}</span>
              <input name="qualifying_time" defaultValue={qualifyingTime ?? ""} className={inputClass} />
            </label>
          )}

          <InvolvedDriversPicker options={driverOptions} initialSelectedIds={involvedDriverIds} />

          <label className="block md:col-span-2">
            <span className="mb-1 block text-sm text-ink-2">{t("cases.form.description")}</span>
            <textarea name="description" defaultValue={description} required rows={5} dir="auto" className={inputClass} />
          </label>

          <div className="md:col-span-2 rounded-[2px] border border-brass bg-cream p-4">
            <h4 className="font-isl-body text-[0.75rem] font-semibold uppercase tracking-[0.2em] text-brass-ink">
              {t("cases.form.evidence")}
            </h4>

            {attachments.length > 0 && (
              <div className="mt-3">
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

            <label className="mt-4 block">
              <span className="mb-1 block text-sm text-ink-2">{t("cases.edit.links")}</span>
              <textarea
                name="links"
                defaultValue={links.join("\n")}
                rows={3}
                dir="ltr"
                placeholder={t("cases.edit.linksPlaceholder")}
                className={inputClass}
              />
            </label>

            <div className="mt-4 grid gap-4">
              <EvidencePasteBox />
            </div>
          </div>

          <div className="md:col-span-2">
            <FormActionButton
              idleLabel={t("cases.edit.save")}
              loadingLabel={t("cases.edit.saving")}
              className="rounded-[2px] bg-ink px-5 py-2 text-sm font-semibold text-bone transition hover:opacity-90"
            />
          </div>
        </form>
      )}
    </div>
  );
}
