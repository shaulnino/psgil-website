"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import { useTranslations } from "next-intl";
import { editHistoricalCaseAction } from "@/app/stewards/actions";
import Modal from "@/app/stewards/components/Modal";
import { Button } from "@/components/ui/button";
import type { DriverVerdict, StewardCase, VerdictDecision, Verdict } from "@/lib/stewards/types";

const DECISIONS: VerdictDecision[] = [
  "Racing Incident", "No Further Action", "Penalty Imposed", "Driver Reprimand", "Other",
];
const DECISION_KEY: Record<VerdictDecision, string> = {
  "Racing Incident": "racingIncident",
  "No Further Action": "noFurtherAction",
  "Penalty Imposed": "penaltyImposed",
  "Driver Reprimand": "driverReprimand",
  "Other": "other",
};
const SESSIONS = ["Race", "Sprint", "Qualifying"] as const;

const inputCls =
  "w-full rounded-[2px] border border-[color:var(--isl-hairline)] bg-paper px-3 py-2 text-sm text-ink placeholder:text-faint focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--isl-oxblood)]";

type Driver = { id: string; name: string };
type SeasonRoundOption = { value: string; label: string; rounds: { value: string; label: string }[] };
type Entry = { driverId: string; licensePoints: string; timePenaltySeconds: string; warningText: string };

function SaveBtn() {
  const { pending } = useFormStatus();
  const t = useTranslations("stewards");
  return (
    <Button type="submit" variant="primary" size="md" disabled={pending}>
      {pending ? t("penalties.editHistorical.saving") : t("penalties.editHistorical.save")}
    </Button>
  );
}

export default function EditHistoricalCaseModal({
  caseItem, verdict, driverVerdicts, drivers, seasonRoundOptions = [],
}: {
  caseItem: StewardCase;
  verdict: Verdict | null;
  driverVerdicts: DriverVerdict[];
  drivers: Driver[];
  seasonRoundOptions?: SeasonRoundOption[];
}) {
  const t = useTranslations("stewards");
  const [open, setOpen] = useState(false);
  const [decision, setDecision] = useState<string>(verdict?.verdict_decision ?? "");
  const [selectedSeason, setSelectedSeason] = useState(caseItem.season);
  const roundOptions = seasonRoundOptions.find((s) => s.value === selectedSeason)?.rounds ?? [];
  const [entries, setEntries] = useState<Entry[]>(
    driverVerdicts.length > 0
      ? driverVerdicts.map((dv) => ({
          driverId: dv.driverId,
          licensePoints: dv.license_points != null ? String(dv.license_points) : "",
          timePenaltySeconds: dv.time_penalty_seconds != null ? String(dv.time_penalty_seconds) : "",
          warningText: dv.warning_text ?? "",
        }))
      : caseItem.involvedDriverIds.map((id) => ({
          driverId: id, licensePoints: "", timePenaltySeconds: "", warningText: "",
        })),
  );

  const addEntry = () =>
    setEntries((p) => [...p, { driverId: "", licensePoints: "", timePenaltySeconds: "", warningText: "" }]);
  const removeEntry = (i: number) => setEntries((p) => p.filter((_, idx) => idx !== i));
  const updateEntry = (i: number, field: keyof Entry, val: string) =>
    setEntries((p) => p.map((e, idx) => (idx === i ? { ...e, [field]: val } : e)));

  const handleSubmit = async (fd: FormData) => {
    fd.set("driver_entries_json", JSON.stringify(entries));
    fd.set("verdict_decision", decision);
    await editHistoricalCaseAction(fd);
    setOpen(false);
  };

  return (
    <>
      <Button type="button" variant="secondary" size="sm" onClick={() => setOpen(true)}>
        {t("penalties.editHistorical.editButton")}
      </Button>

      <Modal open={open} onClose={() => setOpen(false)}>
          <div className="w-full max-w-lg rounded-[2px] border border-[color:var(--isl-hairline)] bg-paper flex flex-col">
            {/* Header */}
            <div className="border-b border-[color:var(--isl-hairline)] px-6 py-4 flex items-center justify-between shrink-0">
              <div>
                <p className="font-isl-body text-[0.75rem] font-semibold uppercase tracking-[0.2em] text-brass-ink">{t("penalties.editHistorical.heading")}</p>
                <p className="mt-0.5 text-sm font-semibold text-ink truncate max-w-xs">{caseItem.title}</p>
              </div>
              <button type="button" onClick={() => setOpen(false)}
                aria-label={t("penalties.editHistorical.close")}
                className="flex h-11 w-11 items-center justify-center rounded-[2px] border border-[color:var(--isl-hairline)] text-ink-2 transition-colors hover:text-oxblood focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--isl-oxblood)] text-lg leading-none">✕</button>
            </div>

            {/* Form */}
            <form action={handleSubmit} className="px-6 py-5 space-y-4">
              <input type="hidden" name="case_id" value={caseItem.id} />

              {/* Context */}
              <div className="grid gap-3 md:grid-cols-3">
                <label className="block">
                  <span className="mb-1 block text-xs font-semibold uppercase tracking-wider text-ink-2">{t("penalties.editHistorical.seasonLabel")}</span>
                  {seasonRoundOptions.length > 0 ? (
                    <select name="season" required value={selectedSeason}
                      onChange={(e) => setSelectedSeason(e.target.value)} className={inputCls}>
                      <option value="">{t("penalties.editHistorical.selectSeason")}</option>
                      {seasonRoundOptions.map((s) => (
                        <option key={s.value} value={s.value}>{s.label}</option>
                      ))}
                    </select>
                  ) : (
                    <input name="season" required defaultValue={caseItem.season} className={inputCls} />
                  )}
                </label>
                <label className="block">
                  <span className="mb-1 block text-xs font-semibold uppercase tracking-wider text-ink-2">{t("penalties.editHistorical.roundLabel")}</span>
                  {seasonRoundOptions.length > 0 ? (
                    <select name="round" required disabled={!selectedSeason} className={inputCls}
                      defaultValue={caseItem.round}>
                      <option value="">{selectedSeason ? t("penalties.editHistorical.selectRound") : t("penalties.editHistorical.selectSeasonFirst")}</option>
                      {roundOptions.map((r) => (
                        <option key={r.value} value={r.value}>{r.label}</option>
                      ))}
                    </select>
                  ) : (
                    <input name="round" required defaultValue={caseItem.round} className={inputCls} />
                  )}
                </label>
                <label className="block">
                  <span className="mb-1 block text-xs font-semibold uppercase tracking-wider text-ink-2">{t("penalties.editHistorical.sessionLabel")}</span>
                  <select name="weekendSession" defaultValue={caseItem.weekendSession} className={inputCls}>
                    {SESSIONS.map((s) => <option key={s} value={s}>{t(`penalties.session.${s}`)}</option>)}
                  </select>
                </label>
              </div>

              <label className="block">
                <span className="mb-1 block text-xs font-semibold uppercase tracking-wider text-ink-2">{t("penalties.editHistorical.description")}</span>
                <textarea name="description" rows={2} dir="auto" defaultValue={caseItem.description} className={inputCls} />
              </label>

              {/* Verdict decision */}
              <div>
                <span className="mb-2 block text-xs font-semibold uppercase tracking-wider text-ink-2">{t("penalties.editHistorical.verdictDecision")}</span>
                <div className="flex flex-wrap gap-2">
                  {DECISIONS.map((d) => (
                    <button key={d} type="button"
                      onClick={() => setDecision(decision === d ? "" : d)}
                      className={`rounded-[2px] border px-3 py-1 text-xs font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--isl-oxblood)] ${
                        decision === d
                          ? "border-ink bg-ink text-bone"
                          : "border-[color:var(--isl-hairline)] bg-cream text-ink-2 hover:border-[color:var(--isl-hairline-strong)]"
                      }`}>
                      {t(`penalties.decision.${DECISION_KEY[d]}`)}
                    </button>
                  ))}
                </div>
              </div>

              {/* Per-driver entries */}
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wider text-ink-2">{t("penalties.editHistorical.driversAndPenalties")}</span>
                  <button type="button" onClick={addEntry}
                    className="rounded-[2px] border border-[color:var(--isl-hairline)] px-3 py-0.5 text-xs text-ink-2 transition-colors hover:border-[color:var(--isl-hairline-strong)] hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--isl-oxblood)]">
                    {t("penalties.editHistorical.addDriver")}
                  </button>
                </div>
                <div className="space-y-3">
                  {entries.map((entry, i) => (
                    <div key={i} className="rounded-[2px] border border-[color:var(--isl-hairline)] bg-cream p-3">
                      <div className="mb-2 flex items-center justify-between">
                        <span className="font-isl-body text-[0.75rem] font-semibold uppercase tracking-[0.2em] text-brass-ink">{t("penalties.editHistorical.driverN")} <span className="num">{i + 1}</span></span>
                        {entries.length > 1 && (
                          <button type="button" onClick={() => removeEntry(i)}
                            className="text-xs text-status-danger transition-colors hover:text-oxblood-deep focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--isl-oxblood)]">{t("penalties.editHistorical.remove")}</button>
                        )}
                      </div>
                      <div className="grid gap-2 md:grid-cols-2">
                        <label className="block md:col-span-2">
                          <span className="mb-1 block text-xs text-meta">{t("penalties.editHistorical.driverRequired")}</span>
                          <select value={entry.driverId} required
                            onChange={(e) => updateEntry(i, "driverId", e.target.value)}
                            className={inputCls}>
                            <option value="">{t("penalties.editHistorical.selectDriver")}</option>
                            {drivers.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                          </select>
                        </label>
                        <label className="block">
                          <span className="mb-1 block text-xs text-meta">{t("penalties.editHistorical.licensePoints")}</span>
                          <input type="number" min={0} max={12} step={1}
                            value={entry.licensePoints}
                            onChange={(e) => updateEntry(i, "licensePoints", e.target.value)}
                            placeholder={t("penalties.editHistorical.licensePointsPlaceholder")} className={inputCls} />
                        </label>
                        <label className="block">
                          <span className="mb-1 block text-xs text-meta">{t("penalties.editHistorical.timePenalty")}</span>
                          <input type="number" min={0} step={1}
                            value={entry.timePenaltySeconds}
                            onChange={(e) => updateEntry(i, "timePenaltySeconds", e.target.value)}
                            placeholder={t("penalties.editHistorical.timePenaltyPlaceholder")} className={inputCls} />
                        </label>
                        <label className="block md:col-span-2">
                          <span className="mb-1 block text-xs text-meta">{t("penalties.editHistorical.warningText")}</span>
                          <input value={entry.warningText} dir="auto"
                            onChange={(e) => updateEntry(i, "warningText", e.target.value)}
                            placeholder={t("penalties.editHistorical.warningTextPlaceholder")} className={inputCls} />
                        </label>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Full text */}
              <label className="block">
                <span className="mb-1 block text-xs font-semibold uppercase tracking-wider text-ink-2">{t("penalties.editHistorical.verdictExplanation")}</span>
                <textarea name="verdict_full_text" rows={2} dir="auto"
                  defaultValue={verdict?.verdict_full_text ?? ""}
                  placeholder={t("penalties.editHistorical.verdictExplanationPlaceholder")} className={inputCls} />
              </label>

              <div className="flex items-center gap-3 pt-1">
                <SaveBtn />
                <Button type="button" variant="secondary" size="md" onClick={() => setOpen(false)}>
                  {t("penalties.editHistorical.cancel")}
                </Button>
              </div>
            </form>
          </div>
      </Modal>
    </>
  );
}
