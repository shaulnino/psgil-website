"use client";

import { useState } from "react";

type Rule = { id: string; penaltyType: string; penaltyLabel: string; penaltyDescription: string };

const inputCls =
  "w-full rounded-[2px] border border-[color:var(--isl-hairline)] bg-paper px-3 py-2 text-sm text-ink placeholder:text-faint focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--isl-oxblood)]";

const labelCls =
  "mb-1 block text-xs font-semibold uppercase tracking-wider text-brass-ink";

export default function PenaltyRuleSelect({ rules }: { rules: Rule[] }) {
  const [selected, setSelected] = useState<string>("");
  const isCustom = selected === "__custom__";

  const rule = rules.find((r) => r.id === selected);

  return (
    <div className="md:col-span-2 grid gap-3 md:grid-cols-2">
      {/* Dropdown — spans full width */}
      <label className="block md:col-span-2">
        <span className={labelCls}>
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
            <span className={labelCls}>
              Penalty label *
            </span>
            <input name="penalty_label" required placeholder="e.g. Qualifying Ban" className={inputCls} />
          </label>
          <label className="block">
            <span className={labelCls}>
              Type (internal key)
            </span>
            <input name="penalty_type" placeholder="e.g. qualifying_ban" className={inputCls} />
          </label>
          <label className="block md:col-span-2">
            <span className={labelCls}>
              Description
            </span>
            <input name="penalty_description" placeholder="Brief explanation" className={inputCls} />
          </label>
        </>
      )}
    </div>
  );
}
