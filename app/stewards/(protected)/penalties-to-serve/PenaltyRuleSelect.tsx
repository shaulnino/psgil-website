"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

type Rule = { id: string; penaltyType: string; penaltyLabel: string; penaltyDescription: string };

const inputCls =
  "w-full rounded-[2px] border border-[color:var(--isl-hairline)] bg-paper px-3 py-2 text-sm text-ink placeholder:text-faint focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--isl-oxblood)]";

const labelCls =
  "mb-1 block text-xs font-semibold uppercase tracking-wider text-brass-ink";

export default function PenaltyRuleSelect({ rules }: { rules: Rule[] }) {
  const t = useTranslations("stewards");
  const [selected, setSelected] = useState<string>("");
  const isCustom = selected === "__custom__";

  const rule = rules.find((r) => r.id === selected);

  return (
    <div className="md:col-span-2 grid gap-3 md:grid-cols-2">
      {/* Dropdown — spans full width */}
      <label className="block md:col-span-2">
        <span className={labelCls}>
          {t("penaltiesToServe.ruleSelect.penaltyType")}
        </span>
        <select
          value={selected}
          onChange={(e) => setSelected(e.target.value)}
          required
          className={inputCls}
        >
          <option value="">{t("penaltiesToServe.ruleSelect.selectPenalty")}</option>
          {rules.map((r) => (
            <option key={r.id} value={r.id}>
              {r.penaltyLabel}
              {r.penaltyDescription ? ` — ${r.penaltyDescription}` : ""}
            </option>
          ))}
          <option value="__custom__">{t("penaltiesToServe.ruleSelect.customOther")}</option>
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
              {t("penaltiesToServe.ruleSelect.penaltyLabel")}
            </span>
            <input name="penalty_label" required placeholder={t("penaltiesToServe.ruleSelect.penaltyLabelPlaceholder")} className={inputCls} />
          </label>
          <label className="block">
            <span className={labelCls}>
              {t("penaltiesToServe.ruleSelect.typeInternalKey")}
            </span>
            <input name="penalty_type" placeholder={t("penaltiesToServe.ruleSelect.typePlaceholder")} className={inputCls} />
          </label>
          <label className="block md:col-span-2">
            <span className={labelCls}>
              {t("penaltiesToServe.ruleSelect.description")}
            </span>
            <input name="penalty_description" placeholder={t("penaltiesToServe.ruleSelect.descriptionPlaceholder")} className={inputCls} />
          </label>
        </>
      )}
    </div>
  );
}
