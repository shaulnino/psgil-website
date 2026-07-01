"use client";

import { useRef, useMemo, useState } from "react";
import { useFormStatus } from "react-dom";
import { upsertVerdictAction } from "@/app/stewards/actions";
import { Button } from "@/components/ui/button";
import type { DriverVerdictWithDriver } from "@/lib/stewards/repository";
import type { Verdict, VerdictDecision } from "@/lib/stewards/types";

const DECISIONS: { value: VerdictDecision; label: string; color: string }[] = [
  { value: "Racing Incident",   label: "Racing Incident",   color: "text-status-info" },
  { value: "No Further Action", label: "No Further Action", color: "text-status-success" },
  { value: "Penalty Imposed",   label: "Penalty Imposed",   color: "text-status-warning" },
  { value: "Driver Reprimand",  label: "Driver Reprimand",  color: "text-brass-ink" },
  { value: "Other",             label: "Other",             color: "text-meta" },
];

type Driver = { id: string; name: string };

type Entry = {
  key: string; // local key for React list
  driverId: string;
  driverName: string;
  licensePoints: string;
  timePenaltySeconds: string;
  warningText: string;
};

function buildEntries(
  involvedDrivers: Driver[],
  existingDriverVerdicts: DriverVerdictWithDriver[],
): Entry[] {
  if (existingDriverVerdicts.length > 0) {
    return existingDriverVerdicts.map((dv) => ({
      key: dv.id,
      driverId: dv.driverId,
      driverName: dv.driver?.name ?? dv.driverId,
      licensePoints: dv.license_points != null ? String(dv.license_points) : "",
      timePenaltySeconds: dv.time_penalty_seconds != null ? String(dv.time_penalty_seconds) : "",
      warningText: dv.warning_text ?? "",
    }));
  }
  return involvedDrivers.map((d) => ({
    key: `init_${d.id}`,
    driverId: d.id,
    driverName: d.name,
    licensePoints: "",
    timePenaltySeconds: "",
    warningText: "",
  }));
}

export default function VerdictForm({
  caseId,
  involvedDrivers,
  allDrivers,
  existingVerdict,
  existingDriverVerdicts,
}: {
  caseId: string;
  involvedDrivers: Driver[];
  allDrivers: Driver[];
  existingVerdict: Verdict | null;
  existingDriverVerdicts: DriverVerdictWithDriver[];
}) {
  const [entries, setEntries] = useState<Entry[]>(() =>
    buildEntries(involvedDrivers, existingDriverVerdicts),
  );
  const [decision, setDecision] = useState<VerdictDecision | "">(existingVerdict?.verdict_decision ?? "");
  const [fullText, setFullText] = useState(existingVerdict?.verdict_full_text ?? "");
  const formRef = useRef<HTMLFormElement>(null);

  // Auto-generate verdict summary from decision + per-driver penalties
  const autoSummary = useMemo(() => {
    const parts: string[] = [];
    let hasPenalties = false;
    for (const e of entries) {
      const chips: string[] = [];
      if (e.licensePoints)      { chips.push(`+${e.licensePoints} pts`);       hasPenalties = true; }
      if (e.timePenaltySeconds) { chips.push(`+${e.timePenaltySeconds}s`);     hasPenalties = true; }
      if (e.warningText)        { chips.push("Warning");                        hasPenalties = true; }
      if (chips.length > 0) parts.push(`${e.driverName}: ${chips.join(", ")}`);
    }
    // If no decision selected, infer from penalties; only fall back to "Decision pending" if truly nothing is set
    const effectiveDecision = decision || (hasPenalties ? "Penalty Imposed" : "");
    const decisionLabel = effectiveDecision || "Decision pending";
    if (parts.length === 0) return decisionLabel;
    return `${decisionLabel} — ${parts.join(" | ")}`;
  }, [entries, decision]);

  const serialised = JSON.stringify(
    entries.map((e) => ({
      driverId: e.driverId,
      licensePoints: e.licensePoints !== "" ? e.licensePoints : null,
      timePenaltySeconds: e.timePenaltySeconds !== "" ? e.timePenaltySeconds : null,
      warningText: e.warningText || null,
    })),
  );

  const updateEntry = (key: string, field: keyof Entry, value: string) => {
    setEntries((prev) =>
      prev.map((e) => (e.key === key ? { ...e, [field]: value } : e)),
    );
  };

  const removeEntry = (key: string) => {
    setEntries((prev) => prev.filter((e) => e.key !== key));
  };

  const addDriver = (driverId: string) => {
    const driver = allDrivers.find((d) => d.id === driverId);
    if (!driver) return;
    if (entries.some((e) => e.driverId === driverId)) return;
    setEntries((prev) => [
      ...prev,
      {
        key: `added_${driverId}_${Date.now()}`,
        driverId,
        driverName: driver.name,
        licensePoints: "",
        timePenaltySeconds: "",
        warningText: "",
      },
    ]);
  };

  const inputCls =
    "w-full rounded-[2px] border border-[color:var(--isl-hairline)] bg-paper px-3 py-2 text-sm text-ink placeholder:text-faint focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--isl-oxblood)] transition";

  return (
    <form ref={formRef} action={upsertVerdictAction} className="space-y-5">
      <input type="hidden" name="case_id" value={caseId} />
      <input type="hidden" name="driver_verdicts_json" value={serialised} />

      {/* ── Per-driver penalty blocks ── */}
      <div className="space-y-3">
        {entries.map((entry) => (
          <div
            key={entry.key}
            className="overflow-hidden rounded-[2px] border border-[color:var(--isl-hairline)] bg-cream"
          >
            {/* driver header */}
            <div className="flex items-center justify-between border-b border-[color:var(--isl-hairline)] bg-sink px-4 py-2.5">
              <span className="text-sm font-semibold text-ink">{entry.driverName}</span>
              {entries.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeEntry(entry.key)}
                  className="rounded-[2px] px-2 py-0.5 text-[10px] uppercase tracking-[0.08em] text-status-danger transition hover:bg-cream"
                >
                  Remove
                </button>
              )}
            </div>

            {/* penalty inputs */}
            <div className="grid gap-3 p-4 md:grid-cols-3">
              <label className="block">
                <span className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.2em] text-brass-ink">
                  License points
                </span>
                <input
                  type="number"
                  min={0}
                  value={entry.licensePoints}
                  onChange={(e) => updateEntry(entry.key, "licensePoints", e.target.value)}
                  placeholder="e.g. 2"
                  className={inputCls}
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.2em] text-brass-ink">
                  Time penalty (s)
                </span>
                <input
                  type="number"
                  step="0.1"
                  min={0}
                  value={entry.timePenaltySeconds}
                  onChange={(e) => updateEntry(entry.key, "timePenaltySeconds", e.target.value)}
                  placeholder="e.g. 5"
                  className={inputCls}
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.2em] text-meta">
                  Warning text
                </span>
                <input
                  type="text"
                  value={entry.warningText}
                  onChange={(e) => updateEntry(entry.key, "warningText", e.target.value)}
                  placeholder="Optional"
                  className={inputCls}
                  dir="auto"
                />
              </label>
            </div>
          </div>
        ))}
      </div>

      {/* Add extra driver */}
      {allDrivers.filter((d) => !entries.some((e) => e.driverId === d.id)).length > 0 && (
        <div className="flex items-center gap-2">
          <select
            className="rounded-[2px] border border-[color:var(--isl-hairline)] bg-paper px-3 py-2 text-sm text-ink-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--isl-oxblood)]"
            onChange={(e) => {
              if (e.target.value) {
                addDriver(e.target.value);
                e.target.value = "";
              }
            }}
            defaultValue=""
          >
            <option value="" disabled>
              + Add another driver…
            </option>
            {allDrivers
              .filter((d) => !entries.some((e) => e.driverId === d.id))
              .map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
          </select>
        </div>
      )}

      {/* ── Case-level fields ── */}
      <div className="grid gap-3 border-t border-[color:var(--isl-hairline)] pt-5 md:grid-cols-2">
        {/* Decision */}
        <div className="md:col-span-2">
          <span className="mb-2 block text-xs text-ink-2">Decision type</span>
          <div className="flex flex-wrap gap-2">
            {DECISIONS.map((d) => (
              <button
                key={d.value}
                type="button"
                onClick={() => setDecision(decision === d.value ? "" : d.value)}
                className={`rounded-[2px] border px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.08em] transition-colors ${
                  decision === d.value
                    ? "border-ink bg-ink text-bone"
                    : "border-[color:var(--isl-hairline)] text-meta hover:border-ink hover:text-ink hover:bg-cream"
                }`}
              >
                {d.label}
              </button>
            ))}
          </div>
          <input type="hidden" name="verdict_decision" value={decision} />
        </div>

        {/* Auto-generated summary — read-only preview */}
        <div className="md:col-span-2">
          <span className="mb-1.5 block text-xs text-ink-2">
            Verdict summary{" "}
            <span className="ms-1 rounded-[2px] border border-brass px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.2em] text-brass-ink">
              auto
            </span>
          </span>
          <div className="flex items-center gap-2 rounded-[2px] border border-[color:var(--isl-hairline)] bg-cream px-3 py-2.5 text-sm text-ink">
            <span className="shrink-0 text-brass-ink">⚙</span>
            <span dir="auto">{autoSummary}</span>
          </div>
          <input type="hidden" name="verdict_summary" value={autoSummary} />
        </div>
        <label className="block md:col-span-2">
          <span className="mb-1 block text-xs text-ink-2">Full verdict text <span className="text-status-danger">*</span></span>
          <textarea
            name="verdict_full_text"
            required
            rows={5}
            value={fullText}
            onChange={(e) => setFullText(e.target.value)}
            dir="auto"
            className={`${inputCls} resize-y`}
          />
        </label>
        <div className="flex flex-wrap items-center gap-3 md:col-span-2">
          {/* Save as draft — is_published stays off */}
          <SaveButton />
          {/* Publish immediately — submits is_published=on via button name/value */}
          <PublishButton />
        </div>
      </div>
    </form>
  );
}

function SaveButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="secondary" disabled={pending}>
      {pending ? "Saving…" : "Save Draft"}
    </Button>
  );
}

function PublishButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" name="is_published" value="on" variant="primary" disabled={pending}>
      {pending ? "Publishing…" : "Save & Publish Verdict"}
    </Button>
  );
}
