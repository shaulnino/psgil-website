"use client";

import { useState } from "react";

type Rule = { id: string; penaltyType: string; penaltyLabel: string; penaltyDescription: string };

const inputCls =
  "w-full rounded-lg border border-white/15 bg-black/30 px-3 py-2 text-sm text-white/90 focus:border-steward-gold/50 focus:outline-none transition";

export default function PenaltyRuleSelect({ rules }: { rules: Rule[] }) {
  const [selected, setSelected] = useState<string>("");
  const isCustom = selected === "__custom__";

  const rule = rules.find((r) => r.id === selected);

  return (
    <div className="md:col-span-2 grid gap-3 md:grid-cols-2">
      {/* Dropdown — spans full width */}
      <label className="block md:col-span-2">
        <span className="mb-1 block text-xs font-semibold uppercase tracking-wider text-white/60">
          Penalty type *
        </span>
        <select
          value={selected}
          onChange={(e) => setSelected(e.target.value)}
          required
          className={inputCls}
        >
          <option value="">Select penalty…</option>
          {rules.map((r) => (
            <option key={r.id} value={r.id}>
              {r.penaltyLabel}
              {r.penaltyDescription ? ` — ${r.penaltyDescription}` : ""}
            </option>
          ))}
          <option value="__custom__">Custom / Other…</option>
        </select>
      </label>

      {/* Hidden fields for form submission — populated from selected rule */}
      {!isCustom && rule && (
        <>
          <input type="hidden" name="penalty_label" value={rule.penaltyLabel} />
          <input type="hidden" name="penalty_type"  value={rule.penaltyType} />
          <input type="hidden" name="penalty_description" value={rule.penaltyDescription} />
        </>
      )}

      {/* Custom free-text inputs */}
      {isCustom && (
        <>
          <label className="block">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wider text-white/60">
              Penalty label *
            </span>
            <input name="penalty_label" required placeholder="e.g. Qualifying Ban" className={inputCls} />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wider text-white/60">
              Type (internal key)
            </span>
            <input name="penalty_type" placeholder="e.g. qualifying_ban" className={inputCls} />
          </label>
          <label className="block md:col-span-2">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wider text-white/60">
              Description
            </span>
            <input name="penalty_description" placeholder="Brief explanation" className={inputCls} />
          </label>
        </>
      )}
    </div>
  );
}
