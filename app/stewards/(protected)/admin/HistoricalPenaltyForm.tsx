"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import { addHistoricalPenaltyAction } from "@/app/stewards/actions";

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

const inputCls =
  "w-full rounded-lg border border-white/15 bg-black/30 px-3 py-2 text-sm text-white/90 focus:border-[#D4AF37]/50 focus:outline-none transition";

export default function HistoricalPenaltyForm({
  drivers,
  seasonRoundOptions = [],
}: {
  drivers: Driver[];
  seasonRoundOptions?: SeasonRoundOption[];
}) {
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
    <section className="steward-panel rounded-2xl p-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold">Add Historical Penalty</h3>
          <p className="mt-0.5 text-sm text-white/55">
            Record penalties from before the system was live. Creates a closed case + published verdict directly.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="shrink-0 rounded-full border border-[#D4AF37]/50 bg-[#D4AF37]/10 px-4 py-2 text-sm font-semibold text-[#f4d98a] transition hover:border-[#D4AF37]/80 hover:bg-[#D4AF37]/20"
        >
          {open ? "Close" : "+ Add Entry"}
        </button>
      </div>

      {open && (
        <form action={handleSubmit} className="mt-5 space-y-5">
          {/* Context */}
          <div className="grid gap-3 md:grid-cols-3">
            <label className="block">
              <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-white/60">Season <span className="text-red-400">*</span></span>
              {seasonRoundOptions.length > 0 ? (
                <select
                  name="season"
                  required
                  value={selectedSeason}
                  onChange={(e) => setSelectedSeason(e.target.value)}
                  className={inputCls}
                >
                  <option value="">Select season…</option>
                  {seasonRoundOptions.map((s) => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                  ))}
                </select>
              ) : (
                <input name="season" required placeholder="e.g. S6" className={inputCls} />
              )}
            </label>
            <label className="block">
              <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-white/60">Round <span className="text-red-400">*</span></span>
              {seasonRoundOptions.length > 0 ? (
                <select name="round" required disabled={!selectedSeason} className={inputCls}>
                  <option value="">{selectedSeason ? "Select round…" : "Select season first"}</option>
                  {roundOptions.map((r) => (
                    <option key={r.value} value={r.value}>{r.label}</option>
                  ))}
                </select>
              ) : (
                <input name="round" required placeholder="e.g. Race 03 – Monaco" className={inputCls} />
              )}
            </label>
            <label className="block">
              <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-white/60">Session</span>
              <select name="weekendSession" className={inputCls}>
                {SESSIONS.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </label>
          </div>

          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-white/60">Incident description (optional)</span>
            <textarea name="description" rows={2} placeholder="Brief description of the incident…" className={inputCls} />
          </label>

          {/* Verdict decision */}
          <div>
            <span className="mb-2 block text-xs font-semibold uppercase tracking-wider text-white/60">Verdict decision</span>
            <div className="flex flex-wrap gap-2">
              {DECISIONS.map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setDecision(decision === d ? "" : d)}
                  className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${
                    decision === d
                      ? "border-[#D4AF37] bg-[#D4AF37]/20 text-[#f4d98a]"
                      : "border-white/15 bg-white/5 text-white/60 hover:border-white/30"
                  }`}
                >
                  {d}
                </button>
              ))}
            </div>
          </div>

          {/* Per-driver entries */}
          <div>
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-white/60">Drivers &amp; Penalties <span className="text-red-400">*</span></span>
              <button type="button" onClick={addEntry} className="rounded-full border border-white/20 px-3 py-0.5 text-xs text-white/60 hover:border-white/40 hover:text-white transition">
                + Add driver
              </button>
            </div>
            <div className="space-y-3">
              {entries.map((entry, i) => (
                <div key={i} className="rounded-xl border border-white/10 bg-white/3 p-4">
                  <div className="mb-3 flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-widest text-[#D4AF37]/70">Driver {i + 1}</span>
                    {entries.length > 1 && (
                      <button type="button" onClick={() => removeEntry(i)} className="text-xs text-red-400/70 hover:text-red-300 transition">Remove</button>
                    )}
                  </div>
                  <div className="grid gap-3 md:grid-cols-2">
                    <label className="block md:col-span-2">
                      <span className="mb-1 block text-xs text-white/50">Driver <span className="text-red-400">*</span></span>
                      <select
                        value={entry.driverId}
                        onChange={(e) => updateEntry(i, "driverId", e.target.value)}
                        required
                        className={inputCls}
                      >
                        <option value="">Select driver…</option>
                        {drivers.map((d) => (
                          <option key={d.id} value={d.id}>{d.name}</option>
                        ))}
                      </select>
                    </label>
                    <label className="block">
                      <span className="mb-1 block text-xs text-white/50">License points</span>
                      <input
                        type="number" min={0} max={12} step={1}
                        value={entry.licensePoints}
                        onChange={(e) => updateEntry(i, "licensePoints", e.target.value)}
                        placeholder="e.g. 2"
                        className={inputCls}
                      />
                    </label>
                    <label className="block">
                      <span className="mb-1 block text-xs text-white/50">Time penalty (seconds)</span>
                      <input
                        type="number" min={0} step={1}
                        value={entry.timePenaltySeconds}
                        onChange={(e) => updateEntry(i, "timePenaltySeconds", e.target.value)}
                        placeholder="e.g. 10"
                        className={inputCls}
                      />
                    </label>
                    <label className="block md:col-span-2">
                      <span className="mb-1 block text-xs text-white/50">Warning text (leave blank if none)</span>
                      <input
                        value={entry.warningText}
                        onChange={(e) => updateEntry(i, "warningText", e.target.value)}
                        placeholder="e.g. Unsportsmanlike conduct warning"
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
            <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-white/60">Verdict full explanation (optional)</span>
            <textarea name="verdict_full_text" rows={3} placeholder="Steward reasoning or notes…" className={inputCls} />
          </label>

          <div className="flex items-center gap-3 pt-1">
            <SubmitBtn />
            <button type="button" onClick={() => setOpen(false)} className="rounded-full border border-white/15 px-5 py-2 text-sm text-white/60 hover:border-white/30 hover:text-white transition">
              Cancel
            </button>
          </div>
        </form>
      )}
    </section>
  );
}

function SubmitBtn() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-full bg-[#7020B0] px-6 py-2 text-sm font-semibold shadow-[0_0_14px_rgba(112,32,176,0.3)] transition hover:bg-[#7c2ac3] disabled:opacity-60"
    >
      {pending ? "Saving…" : "Save Historical Penalty"}
    </button>
  );
}
