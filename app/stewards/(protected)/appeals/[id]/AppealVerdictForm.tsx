"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import { useTranslations } from "next-intl";
import { upsertAppealVerdictAction } from "@/app/stewards/actions";
import { Button } from "@/components/ui/button";
import type { AppealVerdict, AppealDriverVerdict, StewardUser } from "@/lib/stewards/types";

const inputCls =
  "w-full rounded-[2px] border border-[color:var(--isl-hairline)] bg-paper px-3 py-2 text-sm text-ink placeholder:text-faint focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--isl-oxblood)]";

type Driver = { id: string; name: string };
type Entry = { driverId: string; licensePoints: string; timePenaltySeconds: string; warningText: string };

function SaveBtn({ label }: { label: string }) {
  const { pending } = useFormStatus();
  const t = useTranslations("stewards");
  return (
    <Button type="submit" disabled={pending}>
      {pending ? t("appeals.verdictSaving") : label}
    </Button>
  );
}

export default function AppealVerdictForm({
  appealId,
  originalCaseDrivers,
  existingVerdict,
  existingDriverVerdicts,
}: {
  appealId: string;
  originalCaseDrivers: Driver[];
  existingVerdict: AppealVerdict | null;
  existingDriverVerdicts: (AppealDriverVerdict & { driver: StewardUser | null })[];
}) {
  const t = useTranslations("stewards");
  const [outcome, setOutcome] = useState<string>(existingVerdict?.outcomeType ?? "");
  const [entries, setEntries] = useState<Entry[]>(
    existingDriverVerdicts.length > 0
      ? existingDriverVerdicts.map((dv) => ({
          driverId: dv.driverId,
          licensePoints: dv.license_points != null ? String(dv.license_points) : "",
          timePenaltySeconds: dv.time_penalty_seconds != null ? String(dv.time_penalty_seconds) : "",
          warningText: dv.warning_text ?? "",
        }))
      : originalCaseDrivers.map((d) => ({
          driverId: d.id, licensePoints: "", timePenaltySeconds: "", warningText: "",
        })),
  );

  const addEntry = () =>
    setEntries((p) => [...p, { driverId: "", licensePoints: "", timePenaltySeconds: "", warningText: "" }]);
  const removeEntry = (i: number) => setEntries((p) => p.filter((_, idx) => idx !== i));
  const updateEntry = (i: number, field: keyof Entry, val: string) =>
    setEntries((p) => p.map((e, idx) => idx === i ? { ...e, [field]: val } : e));

  const handleDraft = async (fd: FormData) => {
    fd.set("driver_entries_json", JSON.stringify(entries));
    fd.set("outcome_type", outcome);
    fd.set("is_published", "false");
    await upsertAppealVerdictAction(fd);
  };

  return (
    <form action={handleDraft} className="space-y-5">
      <input type="hidden" name="appeal_id" value={appealId} />

      {/* Outcome */}
      <div>
        <span className="mb-2 block font-isl-body text-[0.75rem] font-semibold uppercase tracking-[0.2em] text-oxblood">
          {t("appeals.outcomeLabel")}
        </span>
        <div className="flex flex-wrap gap-2">
          {[
            { value: "no_change", label: t("appeals.outcomeNoChange") },
            { value: "changed_decision", label: t("appeals.outcomeChanged") },
          ].map(({ value, label }) => (
            <button
              key={value}
              type="button"
              onClick={() => setOutcome(outcome === value ? "" : value)}
              className={`rounded-[2px] border px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.08em] transition-colors ${
                outcome === value
                  ? "border-ink bg-ink text-bone"
                  : "border-[color:var(--isl-hairline)] text-ink-2 hover:bg-cream"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Per-driver override (only for changed_decision) */}
      {outcome === "changed_decision" && (
        <div>
          <div className="mb-2 flex items-center justify-between">
            <span className="font-isl-body text-[0.75rem] font-semibold uppercase tracking-[0.2em] text-oxblood">
              {t("appeals.newPenaltiesPerDriver")}
            </span>
            <button type="button" onClick={addEntry}
              className="rounded-[2px] border border-[color:var(--isl-hairline)] px-3 py-0.5 text-xs text-ink-2 transition-colors hover:border-ink hover:text-ink">
              {t("appeals.addDriver")}
            </button>
          </div>
          <div className="space-y-3">
            {entries.map((entry, i) => (
              <div key={i} className="rounded-[2px] border border-[color:var(--isl-hairline)] bg-cream p-3">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-[0.2em] text-brass-ink">{t("appeals.driverEntryLabel")} <span className="num">{i + 1}</span></span>
                  {entries.length > 1 && (
                    <button type="button" onClick={() => removeEntry(i)}
                      className="text-xs text-status-danger transition-colors hover:text-oxblood-deep">{t("appeals.removeDriver")}</button>
                  )}
                </div>
                <div className="grid gap-2 md:grid-cols-2">
                  <label className="block md:col-span-2">
                    <span className="mb-1 block text-xs text-meta">{t("appeals.driverField")}</span>
                    <select value={entry.driverId} required
                      onChange={(e) => updateEntry(i, "driverId", e.target.value)} className={inputCls}>
                      <option value="">{t("appeals.selectDriver")}</option>
                      {originalCaseDrivers.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                    </select>
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-xs text-meta">{t("appeals.licensePointsField")}</span>
                    <input type="number" min={0} max={12} step={1}
                      value={entry.licensePoints}
                      onChange={(e) => updateEntry(i, "licensePoints", e.target.value)}
                      placeholder={t("appeals.licensePointsPlaceholder")} className={inputCls} />
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-xs text-meta">{t("appeals.timePenaltyField")}</span>
                    <input type="number" min={0} step={1}
                      value={entry.timePenaltySeconds}
                      onChange={(e) => updateEntry(i, "timePenaltySeconds", e.target.value)}
                      placeholder={t("appeals.timePenaltyPlaceholder")} className={inputCls} />
                  </label>
                  <label className="block md:col-span-2">
                    <span className="mb-1 block text-xs text-meta">{t("appeals.warningTextField")}</span>
                    <input value={entry.warningText}
                      onChange={(e) => updateEntry(i, "warningText", e.target.value)}
                      placeholder={t("appeals.warningTextPlaceholder")} className={inputCls} />
                  </label>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Summary */}
      <label className="block">
        <span className="mb-1 block font-isl-body text-[0.75rem] font-semibold uppercase tracking-[0.2em] text-oxblood">
          {t("appeals.verdictSummaryLabel")}
        </span>
        <input name="verdict_summary" defaultValue={existingVerdict?.verdict_summary ?? ""}
          placeholder={t("appeals.verdictSummaryPlaceholder")} className={inputCls} />
      </label>

      {/* Full text */}
      <label className="block">
        <span className="mb-1 block font-isl-body text-[0.75rem] font-semibold uppercase tracking-[0.2em] text-oxblood">
          {t("appeals.verdictFullTextLabel")}
        </span>
        <textarea name="verdict_full_text" rows={3}
          defaultValue={existingVerdict?.verdict_full_text ?? ""}
          placeholder={t("appeals.verdictFullTextPlaceholder")} className={inputCls} />
      </label>

      <div className="flex items-center gap-3 pt-1">
        <SaveBtn label={t("appeals.saveDraft")} />
      </div>
    </form>
  );
}
