"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import { upsertAppealVerdictAction } from "@/app/stewards/actions";
import type { AppealVerdict, AppealDriverVerdict, StewardUser } from "@/lib/stewards/types";

const inputCls =
  "w-full rounded-lg border border-white/15 bg-black/30 px-3 py-2 text-sm text-white/90 focus:border-steward-gold/50 focus:outline-none transition";

type Driver = { id: string; name: string };
type Entry = { driverId: string; licensePoints: string; timePenaltySeconds: string; warningText: string };

function SaveBtn({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending}
      className="rounded-full bg-[#7020B0] px-5 py-2 text-sm font-semibold transition hover:bg-[#7c2ac3] disabled:opacity-50">
      {pending ? "Saving…" : label}
    </button>
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
        <span className="mb-2 block text-xs font-semibold uppercase tracking-wider text-white/60">
          Appeal Outcome *
        </span>
        <div className="flex flex-wrap gap-2">
          {[
            { value: "no_change", label: "No Change — Original Decision Upheld" },
            { value: "changed_decision", label: "Changed Decision" },
          ].map(({ value, label }) => (
            <button
              key={value}
              type="button"
              onClick={() => setOutcome(outcome === value ? "" : value)}
              className={`rounded-full border px-4 py-1.5 text-xs font-semibold transition ${
                outcome === value
                  ? value === "no_change"
                    ? "border-emerald-400/70 bg-emerald-400/20 text-emerald-200"
                    : "border-purple-400/70 bg-purple-400/20 text-purple-200"
                  : "border-white/15 bg-white/5 text-white/60 hover:border-white/30"
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
            <span className="text-xs font-semibold uppercase tracking-wider text-white/60">
              New Penalties per Driver
            </span>
            <button type="button" onClick={addEntry}
              className="rounded-full border border-white/20 px-3 py-0.5 text-xs text-white/60 hover:border-white/40 hover:text-white transition">
              + Add driver
            </button>
          </div>
          <div className="space-y-3">
            {entries.map((entry, i) => (
              <div key={i} className="rounded-xl border border-white/10 bg-white/3 p-3">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-widest text-steward-gold/70">Driver {i + 1}</span>
                  {entries.length > 1 && (
                    <button type="button" onClick={() => removeEntry(i)}
                      className="text-xs text-red-400/70 hover:text-red-300 transition">Remove</button>
                  )}
                </div>
                <div className="grid gap-2 md:grid-cols-2">
                  <label className="block md:col-span-2">
                    <span className="mb-1 block text-xs text-white/50">Driver *</span>
                    <select value={entry.driverId} required
                      onChange={(e) => updateEntry(i, "driverId", e.target.value)} className={inputCls}>
                      <option value="">Select driver…</option>
                      {originalCaseDrivers.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                    </select>
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-xs text-white/50">License points</span>
                    <input type="number" min={0} max={12} step={1}
                      value={entry.licensePoints}
                      onChange={(e) => updateEntry(i, "licensePoints", e.target.value)}
                      placeholder="e.g. 2" className={inputCls} />
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-xs text-white/50">Time penalty (s)</span>
                    <input type="number" min={0} step={1}
                      value={entry.timePenaltySeconds}
                      onChange={(e) => updateEntry(i, "timePenaltySeconds", e.target.value)}
                      placeholder="e.g. 10" className={inputCls} />
                  </label>
                  <label className="block md:col-span-2">
                    <span className="mb-1 block text-xs text-white/50">Warning text</span>
                    <input value={entry.warningText}
                      onChange={(e) => updateEntry(i, "warningText", e.target.value)}
                      placeholder="Leave blank if none" className={inputCls} />
                  </label>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Summary */}
      <label className="block">
        <span className="mb-1 block text-xs font-semibold uppercase tracking-wider text-white/60">
          Verdict Summary
        </span>
        <input name="verdict_summary" defaultValue={existingVerdict?.verdict_summary ?? ""}
          placeholder="Brief summary of the appeal decision…" className={inputCls} />
      </label>

      {/* Full text */}
      <label className="block">
        <span className="mb-1 block text-xs font-semibold uppercase tracking-wider text-white/60">
          Full Reasoning (optional)
        </span>
        <textarea name="verdict_full_text" rows={3}
          defaultValue={existingVerdict?.verdict_full_text ?? ""}
          placeholder="Detailed steward reasoning…" className={inputCls} />
      </label>

      <div className="flex items-center gap-3 pt-1">
        <SaveBtn label="Save Draft" />
      </div>
    </form>
  );
}
