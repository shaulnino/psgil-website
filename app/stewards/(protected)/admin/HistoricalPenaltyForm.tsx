"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
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

const inputCls =
  "w-full rounded-[2px] border border-[color:var(--isl-hairline)] bg-paper px-3 py-2 text-sm text-ink placeholder:text-faint focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--isl-oxblood)] transition-colors";

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
    <section className="steward-panel rounded-[2px] p-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="font-display font-bold tracking-[0.005em] leading-[1.05] text-ink text-lg">Add Historical Penalty</h3>
          <p className="mt-0.5 text-sm text-ink-2">
            Record penalties from before the system was live. Creates a closed case + published verdict directly.
          </p>
        </div>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={() => setOpen((v) => !v)}
          className="shrink-0"
        >
          {open ? "Close" : "+ Add Entry"}
        </Button>
      </div>

      {open && (
        <form action={handleSubmit} className="mt-5 space-y-5">
          {/* Context */}
          <div className="grid gap-3 md:grid-cols-3">
            <label className="block">
              <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-meta">Season <span className="text-status-danger">*</span></span>
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
              <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-meta">Round <span className="text-status-danger">*</span></span>
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
              <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-meta">Session</span>
              <select name="weekendSession" className={inputCls}>
                {SESSIONS.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </label>
          </div>

          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-meta">Incident description (optional)</span>
            <textarea name="description" rows={2} dir="auto" placeholder="Brief description of the incident…" className={inputCls} />
          </label>

          {/* Verdict decision */}
          <div>
            <span className="mb-2 block text-xs font-semibold uppercase tracking-wider text-meta">Verdict decision</span>
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
                  {d}
                </button>
              ))}
            </div>
          </div>

          {/* Per-driver entries */}
          <div>
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-meta">Drivers &amp; Penalties <span className="text-status-danger">*</span></span>
              <button type="button" onClick={addEntry} className="rounded-[2px] border border-[color:var(--isl-hairline)] px-3 py-0.5 text-xs text-ink-2 hover:bg-cream hover:text-ink transition-colors">
                + Add driver
              </button>
            </div>
            <div className="space-y-3">
              {entries.map((entry, i) => (
                <div key={i} className="rounded-[2px] border border-[color:var(--isl-hairline)] bg-cream p-4">
                  <div className="mb-3 flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-widest text-brass-ink">Driver <span className="num">{i + 1}</span></span>
                    {entries.length > 1 && (
                      <button type="button" onClick={() => removeEntry(i)} className="text-xs text-status-danger hover:text-oxblood-deep transition-colors">Remove</button>
                    )}
                  </div>
                  <div className="grid gap-3 md:grid-cols-2">
                    <label className="block md:col-span-2">
                      <span className="mb-1 block text-xs text-meta">Driver <span className="text-status-danger">*</span></span>
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
                      <span className="mb-1 block text-xs text-meta">License points</span>
                      <input
                        type="number" min={0} max={12} step={1}
                        value={entry.licensePoints}
                        onChange={(e) => updateEntry(i, "licensePoints", e.target.value)}
                        placeholder="e.g. 2"
                        className={inputCls}
                      />
                    </label>
                    <label className="block">
                      <span className="mb-1 block text-xs text-meta">Time penalty (seconds)</span>
                      <input
                        type="number" min={0} step={1}
                        value={entry.timePenaltySeconds}
                        onChange={(e) => updateEntry(i, "timePenaltySeconds", e.target.value)}
                        placeholder="e.g. 10"
                        className={inputCls}
                      />
                    </label>
                    <label className="block md:col-span-2">
                      <span className="mb-1 block text-xs text-meta">Warning text (leave blank if none)</span>
                      <input
                        value={entry.warningText}
                        onChange={(e) => updateEntry(i, "warningText", e.target.value)}
                        dir="auto"
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
            <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-meta">Verdict full explanation (optional)</span>
            <textarea name="verdict_full_text" rows={3} dir="auto" placeholder="Steward reasoning or notes…" className={inputCls} />
          </label>

          <div className="flex items-center gap-3 pt-1">
            <SubmitBtn />
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
              Cancel
            </Button>
          </div>
        </form>
      )}
    </section>
  );
}

function SubmitBtn() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="primary" disabled={pending}>
      {pending ? "Saving…" : "Save Historical Penalty"}
    </Button>
  );
}
