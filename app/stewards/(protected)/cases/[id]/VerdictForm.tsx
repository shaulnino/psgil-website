"use client";

import { useRef, useMemo, useState } from "react";
import { useFormStatus } from "react-dom";
import { upsertVerdictAction } from "@/app/stewards/actions";
import type { DriverVerdictWithDriver } from "@/lib/stewards/repository";
import type { Verdict, VerdictDecision } from "@/lib/stewards/types";

const DECISIONS: { value: VerdictDecision; label: string; color: string }[] = [
  { value: "Racing Incident",   label: "Racing Incident",   color: "text-sky-300" },
  { value: "No Further Action", label: "No Further Action", color: "text-emerald-300" },
  { value: "Penalty Imposed",   label: "Penalty Imposed",   color: "text-orange-300" },
  { value: "Driver Reprimand",  label: "Driver Reprimand",  color: "text-amber-300" },
  { value: "Other",             label: "Other",             color: "text-white/60" },
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
    "w-full rounded-lg border border-white/15 bg-black/30 px-3 py-2 text-sm text-white/90 placeholder:text-white/30 focus:border-[#D4AF37]/50 focus:outline-none transition";

  return (
    <form ref={formRef} action={upsertVerdictAction} className="space-y-5">
      <input type="hidden" name="case_id" value={caseId} />
      <input type="hidden" name="driver_verdicts_json" value={serialised} />

      {/* ── Per-driver penalty blocks ── */}
      <div className="space-y-3">
        {entries.map((entry) => (
          <div
            key={entry.key}
            className="overflow-hidden rounded-xl border border-[#D4AF37]/20 bg-black/20"
          >
            {/* driver header */}
            <div className="flex items-center justify-between border-b border-white/10 bg-[#D4AF37]/8 px-4 py-2.5">
              <span className="text-sm font-semibold text-[#f4d98a]">{entry.driverName}</span>
              {entries.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeEntry(entry.key)}
                  className="rounded px-2 py-0.5 text-[10px] text-red-300/60 transition hover:bg-red-500/15 hover:text-red-200"
                >
                  Remove
                </button>
              )}
            </div>

            {/* penalty inputs */}
            <div className="grid gap-3 p-4 md:grid-cols-3">
              <label className="block">
                <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-orange-300/80">
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
                <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-blue-300/80">
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
                <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-white/50">
                  Warning text
                </span>
                <input
                  type="text"
                  value={entry.warningText}
                  onChange={(e) => updateEntry(entry.key, "warningText", e.target.value)}
                  placeholder="Optional"
                  className={inputCls}
                  lang="he"
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
            className="rounded-lg border border-white/15 bg-black/30 px-3 py-2 text-sm text-white/70"
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
      <div className="grid gap-3 border-t border-white/10 pt-5 md:grid-cols-2">
        {/* Decision */}
        <div className="md:col-span-2">
          <span className="mb-2 block text-xs text-white/70">Decision type</span>
          <div className="flex flex-wrap gap-2">
            {DECISIONS.map((d) => (
              <button
                key={d.value}
                type="button"
                onClick={() => setDecision(decision === d.value ? "" : d.value)}
                className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                  decision === d.value
                    ? "border-[#D4AF37]/70 bg-[#D4AF37]/20 text-[#f4d98a]"
                    : "border-white/15 bg-white/5 text-white/50 hover:border-white/30 hover:text-white/80"
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
          <span className="mb-1.5 block text-xs text-white/70">
            Verdict summary{" "}
            <span className="ml-1 rounded-full border border-[#D4AF37]/40 bg-[#D4AF37]/10 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-[#D4AF37]/80">
              auto
            </span>
          </span>
          <div className="flex items-center gap-2 rounded-lg border border-[#D4AF37]/25 bg-[#D4AF37]/5 px-3 py-2.5 text-sm text-white/85">
            <span className="shrink-0 text-[#D4AF37]/50">⚙</span>
            <span dir="auto">{autoSummary}</span>
          </div>
          <input type="hidden" name="verdict_summary" value={autoSummary} />
        </div>
        <label className="block md:col-span-2">
          <span className="mb-1 block text-xs text-white/70">Full verdict text <span className="text-red-400">*</span></span>
          <textarea
            name="verdict_full_text"
            required
            rows={5}
            value={fullText}
            onChange={(e) => setFullText(e.target.value)}
            lang="he"
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
    <button
      type="submit"
      disabled={pending}
      className="rounded-full border border-white/20 bg-white/8 px-5 py-2.5 text-sm font-semibold transition hover:bg-white/15 disabled:opacity-60"
    >
      {pending ? "Saving…" : "Save Draft"}
    </button>
  );
}

function PublishButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      name="is_published"
      value="on"
      disabled={pending}
      className="rounded-full bg-emerald-600 px-5 py-2.5 text-sm font-semibold shadow-[0_0_14px_rgba(16,185,129,0.25)] transition hover:bg-emerald-500 disabled:opacity-60"
    >
      {pending ? "Publishing…" : "Save & Publish Verdict"}
    </button>
  );
}
