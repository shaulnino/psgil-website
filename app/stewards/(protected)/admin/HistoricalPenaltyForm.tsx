"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import { useTranslations } from "next-intl";
import { addHistoricalPenaltyAction } from "@/app/stewards/actions";
import { Button } from "@/components/ui/button";

type Driver = { id: string; name: string; email: string };
type SeasonRoundOption = { value: string; label: string; rounds: { value: string; label: string }[] };

type DriverEntry = {
  driverId: string;
  licensePoints: string;
  timePenaltySeconds: string;
  warningText: string;
};

const DECISIONS = ["Racing Incident", "No Further Action", "Penalty Imposed", "Driver Reprimand", "Other"] as const;
const SESSIONS  = ["Race", "Sprint", "Qualifying"] as const;

// value -> translation-key-segment (display only; underlying values above are unchanged)
const DECISION_KEYS: Record<(typeof DECISIONS)[number], string> = {
  "Racing Incident": "racingIncident",
  "No Further Action": "noFurtherAction",
  "Penalty Imposed": "penaltyImposed",
  "Driver Reprimand": "driverReprimand",
  "Other": "other",
};
const SESSION_KEYS: Record<(typeof SESSIONS)[number], string> = {
  "Race": "race",
  "Sprint": "sprint",
  "Qualifying": "qualifying",
};

const inputCls =
  "w-full rounded-[2px] border border-[color:var(--isl-hairline)] bg-paper px-3 py-2 text-sm text-ink placeholder:text-faint focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--isl-oxblood)] transition-colors";

export default function HistoricalPenaltyForm({
  drivers,
  seasonRoundOptions = [],
}: {
  drivers: Driver[];
  seasonRoundOptions?: SeasonRoundOption[];
}) {
  const t = useTranslations("stewards");
  const [open, setOpen] = useState(false);
  const [entries, setEntries] = useState<DriverEntry[]>([{ driverId: "", licensePoints: "", timePenaltySeconds: "", warningText: "" }]);
  const [decision, setDecision] = useState("");
  const [selectedSeason, setSelectedSeason] = useState("");

  const roundOptions = seasonRoundOptions.find((s) => s.value === selectedSeason)?.rounds ?? [];

  const addEntry = () => setEntries((prev) => [...prev, { driverId: "", licensePoints: "", timePenaltySeconds: "", warningText: "" }]);
  const removeEntry = (i: number) => setEntries((prev) => prev.filter((_, idx) => idx !== i));
  const updateEntry = (i: number, field: keyof DriverEntry, val: string) =>
    setEntries((prev) => prev.map((e, idx) => idx === i ? { ...e, [field]: val } : e));

  const handleSubmit = async (fd: FormData) => {
    fd.set("driver_entries_json", JSON.stringify(entries));
    fd.set("verdict_decision", decision);
    await addHistoricalPenaltyAction(fd);
    setEntries([{ driverId: "", licensePoints: "", timePenaltySeconds: "", warningText: "" }]);
    setDecision("");
    setSelectedSeason("");
    setOpen(false);
  };

  return (
    <section className="steward-panel rounded-[2px] p-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="font-display font-bold tracking-[0.005em] leading-[1.05] text-ink text-lg">{t("admin.historical.heading")}</h3>
          <p className="mt-0.5 text-sm text-ink-2">
            {t("admin.historical.subtitle")}
          </p>
        </div>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={() => setOpen((v) => !v)}
          className="shrink-0"
        >
          {open ? t("admin.historical.close") : t("admin.historical.addEntry")}
        </Button>
      </div>

      {open && (
        <form action={handleSubmit} className="mt-5 space-y-5">
          {/* Context */}
          <div className="grid gap-3 md:grid-cols-3">
            <label className="block">
              <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-meta">{t("admin.historical.season")} <span className="text-status-danger">*</span></span>
              {seasonRoundOptions.length > 0 ? (
                <select
                  name="season"
                  required
                  value={selectedSeason}
                  onChange={(e) => setSelectedSeason(e.target.value)}
                  className={inputCls}
                >
                  <option value="">{t("admin.historical.selectSeason")}</option>
                  {seasonRoundOptions.map((s) => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                  ))}
                </select>
              ) : (
                <input name="season" required placeholder={t("admin.historical.seasonPlaceholder")} className={inputCls} />
              )}
            </label>
            <label className="block">
              <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-meta">{t("admin.historical.round")} <span className="text-status-danger">*</span></span>
              {seasonRoundOptions.length > 0 ? (
                <select name="round" required disabled={!selectedSeason} className={inputCls}>
                  <option value="">{selectedSeason ? t("admin.historical.selectRound") : t("admin.historical.selectSeasonFirst")}</option>
                  {roundOptions.map((r) => (
                    <option key={r.value} value={r.value}>{r.label}</option>
                  ))}
                </select>
              ) : (
                <input name="round" required placeholder={t("admin.historical.roundPlaceholder")} className={inputCls} />
              )}
            </label>
            <label className="block">
              <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-meta">{t("admin.historical.session")}</span>
              <select name="weekendSession" className={inputCls}>
                {SESSIONS.map((s) => <option key={s} value={s}>{t(`admin.historical.sessionLabel.${SESSION_KEYS[s]}`)}</option>)}
              </select>
            </label>
          </div>

          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-meta">{t("admin.historical.incidentDescription")}</span>
            <textarea name="description" rows={2} dir="auto" placeholder={t("admin.historical.incidentPlaceholder")} className={inputCls} />
          </label>

          {/* Verdict decision */}
          <div>
            <span className="mb-2 block text-xs font-semibold uppercase tracking-wider text-meta">{t("admin.historical.verdictDecision")}</span>
            <div className="flex flex-wrap gap-2">
              {DECISIONS.map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setDecision(decision === d ? "" : d)}
                  className={`rounded-[2px] border px-3 py-1 text-xs font-semibold transition-colors ${
                    decision === d
                      ? "border-ink bg-ink text-bone"
                      : "border-[color:var(--isl-hairline)] text-ink-2 hover:bg-cream"
                  }`}
                >
                  {t(`admin.historical.decisionLabel.${DECISION_KEYS[d]}`)}
                </button>
              ))}
            </div>
          </div>

          {/* Per-driver entries */}
          <div>
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-meta">{t("admin.historical.driversPenalties")} <span className="text-status-danger">*</span></span>
              <button type="button" onClick={addEntry} className="rounded-[2px] border border-[color:var(--isl-hairline)] px-3 py-0.5 text-xs text-ink-2 hover:bg-cream hover:text-ink transition-colors">
                {t("admin.historical.addDriver")}
              </button>
            </div>
            <div className="space-y-3">
              {entries.map((entry, i) => (
                <div key={i} className="rounded-[2px] border border-[color:var(--isl-hairline)] bg-cream p-4">
                  <div className="mb-3 flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-widest text-brass-ink">{t("admin.historical.driverN")} <span className="num">{i + 1}</span></span>
                    {entries.length > 1 && (
                      <button type="button" onClick={() => removeEntry(i)} className="text-xs text-status-danger hover:text-oxblood-deep transition-colors">{t("admin.historical.removeDriver")}</button>
                    )}
                  </div>
                  <div className="grid gap-3 md:grid-cols-2">
                    <label className="block md:col-span-2">
                      <span className="mb-1 block text-xs text-meta">{t("admin.historical.driver")} <span className="text-status-danger">*</span></span>
                      <select
                        value={entry.driverId}
                        onChange={(e) => updateEntry(i, "driverId", e.target.value)}
                        required
                        className={inputCls}
                      >
                        <option value="">{t("admin.historical.selectDriver")}</option>
                        {drivers.map((d) => (
                          <option key={d.id} value={d.id}>{d.name}</option>
                        ))}
                      </select>
                    </label>
                    <label className="block">
                      <span className="mb-1 block text-xs text-meta">{t("admin.historical.licensePoints")}</span>
                      <input
                        type="number" min={0} max={12} step={1}
                        value={entry.licensePoints}
                        onChange={(e) => updateEntry(i, "licensePoints", e.target.value)}
                        placeholder={t("admin.historical.licensePointsPlaceholder")}
                        className={inputCls}
                      />
                    </label>
                    <label className="block">
                      <span className="mb-1 block text-xs text-meta">{t("admin.historical.timePenalty")}</span>
                      <input
                        type="number" min={0} step={1}
                        value={entry.timePenaltySeconds}
                        onChange={(e) => updateEntry(i, "timePenaltySeconds", e.target.value)}
                        placeholder={t("admin.historical.timePenaltyPlaceholder")}
                        className={inputCls}
                      />
                    </label>
                    <label className="block md:col-span-2">
                      <span className="mb-1 block text-xs text-meta">{t("admin.historical.warningText")}</span>
                      <input
                        value={entry.warningText}
                        onChange={(e) => updateEntry(i, "warningText", e.target.value)}
                        dir="auto"
                        placeholder={t("admin.historical.warningTextPlaceholder")}
                        className={inputCls}
                      />
                    </label>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Full text (optional) */}
          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-meta">{t("admin.historical.verdictFullText")}</span>
            <textarea name="verdict_full_text" rows={3} dir="auto" placeholder={t("admin.historical.verdictFullTextPlaceholder")} className={inputCls} />
          </label>

          <div className="flex items-center gap-3 pt-1">
            <SubmitBtn />
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
              {t("admin.historical.cancel")}
            </Button>
          </div>
        </form>
      )}
    </section>
  );
}

function SubmitBtn() {
  const t = useTranslations("stewards");
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="primary" disabled={pending}>
      {pending ? t("admin.historical.saving") : t("admin.historical.submit")}
    </Button>
  );
}
