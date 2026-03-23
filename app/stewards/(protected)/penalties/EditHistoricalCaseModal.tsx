"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import { editHistoricalCaseAction } from "@/app/stewards/actions";
import Modal from "@/app/stewards/components/Modal";
import type { DriverVerdict, StewardCase, VerdictDecision, Verdict } from "@/lib/stewards/types";

const DECISIONS: VerdictDecision[] = [
  "Racing Incident", "No Further Action", "Penalty Imposed", "Driver Reprimand", "Other",
];
const SESSIONS = ["Race", "Qualifying"] as const;

const inputCls =
  "w-full rounded-lg border border-white/15 bg-black/30 px-3 py-2 text-sm text-white/90 focus:border-[#D4AF37]/50 focus:outline-none transition";

type Driver = { id: string; name: string };
type SeasonRoundOption = { value: string; label: string; rounds: { value: string; label: string }[] };
type Entry = { driverId: string; licensePoints: string; timePenaltySeconds: string; warningText: string };

function SaveBtn() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending}
      className="rounded-full bg-[#7020B0] px-5 py-2 text-sm font-semibold transition hover:bg-[#7c2ac3] disabled:opacity-50">
      {pending ? "Saving…" : "Save Changes"}
    </button>
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
      <button type="button" onClick={() => setOpen(true)}
        className="rounded-full border border-[#D4AF37]/40 bg-[#D4AF37]/10 px-3 py-1 text-xs font-semibold text-[#f4d98a] transition hover:border-[#D4AF37]/70 hover:bg-[#D4AF37]/20">
        Edit
      </button>

      <Modal open={open} onClose={() => setOpen(false)}>
          <div className="w-full max-w-lg rounded-2xl border border-[#D4AF37]/30 bg-[#13131f] shadow-[0_24px_60px_rgba(0,0,0,0.6)] flex flex-col">
            {/* Header */}
            <div className="border-b border-white/10 px-6 py-4 flex items-center justify-between shrink-0">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-[#D4AF37]/70">Edit Historical Entry</p>
                <p className="mt-0.5 text-sm font-semibold text-white/90 truncate max-w-xs">{caseItem.title}</p>
              </div>
              <button type="button" onClick={() => setOpen(false)}
                className="text-white/40 hover:text-white transition text-lg leading-none">✕</button>
            </div>

            {/* Form */}
            <form action={handleSubmit} className="px-6 py-5 space-y-4">
              <input type="hidden" name="case_id" value={caseItem.id} />

              {/* Context */}
              <div className="grid gap-3 md:grid-cols-3">
                <label className="block">
                  <span className="mb-1 block text-xs font-semibold uppercase tracking-wider text-white/60">Season *</span>
                  {seasonRoundOptions.length > 0 ? (
                    <select name="season" required value={selectedSeason}
                      onChange={(e) => setSelectedSeason(e.target.value)} className={inputCls}>
                      <option value="">Select season…</option>
                      {seasonRoundOptions.map((s) => (
                        <option key={s.value} value={s.value}>{s.label}</option>
                      ))}
                    </select>
                  ) : (
                    <input name="season" required defaultValue={caseItem.season} className={inputCls} />
                  )}
                </label>
                <label className="block">
                  <span className="mb-1 block text-xs font-semibold uppercase tracking-wider text-white/60">Round *</span>
                  {seasonRoundOptions.length > 0 ? (
                    <select name="round" required disabled={!selectedSeason} className={inputCls}
                      defaultValue={caseItem.round}>
                      <option value="">{selectedSeason ? "Select round…" : "Select season first"}</option>
                      {roundOptions.map((r) => (
                        <option key={r.value} value={r.value}>{r.label}</option>
                      ))}
                    </select>
                  ) : (
                    <input name="round" required defaultValue={caseItem.round} className={inputCls} />
                  )}
                </label>
                <label className="block">
                  <span className="mb-1 block text-xs font-semibold uppercase tracking-wider text-white/60">Session</span>
                  <select name="weekendSession" defaultValue={caseItem.weekendSession} className={inputCls}>
                    {SESSIONS.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </label>
              </div>

              <label className="block">
                <span className="mb-1 block text-xs font-semibold uppercase tracking-wider text-white/60">Description</span>
                <textarea name="description" rows={2} defaultValue={caseItem.description} className={inputCls} />
              </label>

              {/* Verdict decision */}
              <div>
                <span className="mb-2 block text-xs font-semibold uppercase tracking-wider text-white/60">Verdict decision</span>
                <div className="flex flex-wrap gap-2">
                  {DECISIONS.map((d) => (
                    <button key={d} type="button"
                      onClick={() => setDecision(decision === d ? "" : d)}
                      className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${
                        decision === d
                          ? "border-[#D4AF37] bg-[#D4AF37]/20 text-[#f4d98a]"
                          : "border-white/15 bg-white/5 text-white/60 hover:border-white/30"
                      }`}>
                      {d}
                    </button>
                  ))}
                </div>
              </div>

              {/* Per-driver entries */}
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wider text-white/60">Drivers & Penalties *</span>
                  <button type="button" onClick={addEntry}
                    className="rounded-full border border-white/20 px-3 py-0.5 text-xs text-white/60 hover:border-white/40 hover:text-white transition">
                    + Add driver
                  </button>
                </div>
                <div className="space-y-3">
                  {entries.map((entry, i) => (
                    <div key={i} className="rounded-xl border border-white/10 bg-white/3 p-3">
                      <div className="mb-2 flex items-center justify-between">
                        <span className="text-xs font-bold uppercase tracking-widest text-[#D4AF37]/70">Driver {i + 1}</span>
                        {entries.length > 1 && (
                          <button type="button" onClick={() => removeEntry(i)}
                            className="text-xs text-red-400/70 hover:text-red-300 transition">Remove</button>
                        )}
                      </div>
                      <div className="grid gap-2 md:grid-cols-2">
                        <label className="block md:col-span-2">
                          <span className="mb-1 block text-xs text-white/50">Driver *</span>
                          <select value={entry.driverId} required
                            onChange={(e) => updateEntry(i, "driverId", e.target.value)}
                            className={inputCls}>
                            <option value="">Select driver…</option>
                            {drivers.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
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

              {/* Full text */}
              <label className="block">
                <span className="mb-1 block text-xs font-semibold uppercase tracking-wider text-white/60">Verdict explanation (optional)</span>
                <textarea name="verdict_full_text" rows={2}
                  defaultValue={verdict?.verdict_full_text ?? ""}
                  placeholder="Steward reasoning or notes…" className={inputCls} />
              </label>

              <div className="flex items-center gap-3 pt-1">
                <SaveBtn />
                <button type="button" onClick={() => setOpen(false)}
                  className="rounded-full border border-white/15 px-5 py-2 text-sm text-white/60 transition hover:border-white/30 hover:text-white">
                  Cancel
                </button>
              </div>
            </form>
          </div>
      </Modal>
    </>
  );
}
