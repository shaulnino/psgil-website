"use client";

import { useActionState, useState } from "react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import {
  saveNotificationPreferencesAction,
  sendTestNotificationAction,
  type PrefsState,
} from "@/lib/notifications/actions";
import { applyPreset, type PreferencePreset } from "@/lib/notifications/preferences";
import {
  NOTIFICATION_CATEGORIES,
  type NotificationCategory,
  type NotificationPreferences,
} from "@/lib/notifications/types";

const PRESETS: PreferencePreset[] = ["recommended", "importantOnly", "all", "pushOff"];

/** Categories that contain mandatory (always-in-app) types — we surface a note. */
const HAS_MANDATORY: Record<NotificationCategory, boolean> = {
  attendance: true,
  race: true,
  steward: true,
  articles: false,
  results: false,
  admin: false,
};

function Toggle({
  name,
  checked,
  onChange,
  label,
}: {
  name: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <label className="inline-flex cursor-pointer items-center gap-2">
      <input
        type="checkbox"
        name={name}
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4 shrink-0 accent-[color:var(--isl-oxblood)]"
      />
      <span className="text-xs font-medium text-ink-2">{label}</span>
    </label>
  );
}

export default function NotificationPrefsForm({ initial }: { initial: NotificationPreferences }) {
  const t = useTranslations("notifications");
  const [prefs, setPrefs] = useState<NotificationPreferences>(initial);

  const [saveState, saveAction, saving] = useActionState<PrefsState, FormData>(
    saveNotificationPreferencesAction,
    undefined,
  );
  const [testState, testAction, testing] = useActionState<PrefsState, FormData>(
    sendTestNotificationAction,
    undefined,
  );

  const setCategory = (c: NotificationCategory, channel: "inApp" | "push", v: boolean) =>
    setPrefs((p) => ({
      ...p,
      categories: { ...p.categories, [c]: { ...p.categories[c], [channel]: v } },
    }));

  const card = "rounded-[2px] border border-[color:var(--isl-hairline)] bg-cream p-5 md:p-6";
  const heading = "font-isl-display text-lg font-bold tracking-[0.02em] text-ink";

  return (
    <div className="space-y-6">
      {/* Presets */}
      <div className={card}>
        <h2 className={heading}>{t("prefs.presetsTitle")}</h2>
        <div className="mt-4 flex flex-wrap gap-2">
          {PRESETS.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setPrefs(applyPreset(prefs.userId, p))}
              className="rounded-[2px] border border-[color:var(--isl-hairline)] bg-paper px-3 py-1.5 text-xs font-semibold text-ink transition-colors hover:border-ink"
            >
              {t(`prefs.preset.${p}`)}
            </button>
          ))}
        </div>
      </div>

      <form action={saveAction} className="space-y-6">
        {/* General */}
        <div className={card}>
          <h2 className={heading}>{t("prefs.globalTitle")}</h2>
          <div className="mt-4 space-y-4">
            <SwitchRow
              name="pushGlobal"
              checked={prefs.pushGlobal}
              onChange={(v) => setPrefs((p) => ({ ...p, pushGlobal: v }))}
              label={t("prefs.pushGlobal")}
              hint={t("prefs.pushGlobalHint")}
            />
            <SwitchRow
              name="pauseOptional"
              checked={prefs.pauseOptional}
              onChange={(v) => setPrefs((p) => ({ ...p, pauseOptional: v }))}
              label={t("prefs.pauseOptional")}
              hint={t("prefs.pauseOptionalHint")}
            />
            <SwitchRow
              name="articleAnnouncementsPushOnly"
              checked={prefs.articleAnnouncementsPushOnly}
              onChange={(v) => setPrefs((p) => ({ ...p, articleAnnouncementsPushOnly: v }))}
              label={t("prefs.articleAnnouncementsPushOnly")}
              hint={t("prefs.articleAnnouncementsPushOnlyHint")}
            />
          </div>
        </div>

        {/* Categories */}
        <div className={card}>
          <h2 className={heading}>{t("prefs.categoriesTitle")}</h2>
          <ul className="mt-4 divide-y divide-[color:var(--isl-hairline)]">
            {NOTIFICATION_CATEGORIES.map((c) => (
              <li key={c} className="flex flex-col gap-2 py-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0 sm:me-4">
                  <p className="text-sm font-semibold text-ink">{t(`prefs.category.${c}`)}</p>
                  <p className="mt-0.5 text-xs text-meta">{t(`prefs.categoryHint.${c}`)}</p>
                  {HAS_MANDATORY[c] && (
                    <p className="mt-1 text-[10px] font-medium uppercase tracking-[0.12em] text-brass-ink">
                      {t("prefs.mandatoryNote")}
                    </p>
                  )}
                </div>
                <div className="flex shrink-0 items-center gap-4">
                  <Toggle
                    name={`cat.${c}.inApp`}
                    checked={prefs.categories[c].inApp}
                    onChange={(v) => setCategory(c, "inApp", v)}
                    label={t("prefs.channelInApp")}
                  />
                  <Toggle
                    name={`cat.${c}.push`}
                    checked={prefs.categories[c].push}
                    onChange={(v) => setCategory(c, "push", v)}
                    label={t("prefs.channelPush")}
                  />
                </div>
              </li>
            ))}
          </ul>
        </div>

        <div className="flex items-center gap-4">
          <button
            type="submit"
            disabled={saving}
            className="rounded-[2px] bg-oxblood px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-oxblood-deep disabled:opacity-60"
          >
            {saving ? t("prefs.saving") : t("prefs.save")}
          </button>
          {saveState?.ok && <span className="text-sm text-brass-ink">{t("prefs.saved")}</span>}
          {saveState?.error && <span className="text-sm text-oxblood">{t("prefs.error")}</span>}
        </div>
      </form>

      {/* Test */}
      <div className={card}>
        <h2 className={heading}>{t("prefs.testTitle")}</h2>
        <p className="mt-1 text-sm text-meta">{t("prefs.testDescription")}</p>
        <form action={testAction} className="mt-4 flex items-center gap-4">
          <button
            type="submit"
            disabled={testing}
            className="rounded-[2px] border border-[color:var(--isl-hairline)] bg-paper px-4 py-2 text-sm font-medium text-ink transition-colors hover:border-ink disabled:opacity-60"
          >
            {t("prefs.sendTest")}
          </button>
          {testState?.ok && <span className="text-sm text-brass-ink">{t("prefs.testSent")}</span>}
        </form>
      </div>
    </div>
  );
}

function SwitchRow({
  name,
  checked,
  onChange,
  label,
  hint,
}: {
  name: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  hint: string;
}) {
  return (
    <label className="flex cursor-pointer items-start justify-between gap-4">
      <span className="min-w-0">
        <span className="block text-sm font-medium text-ink">{label}</span>
        <span className="mt-0.5 block text-xs text-meta">{hint}</span>
      </span>
      <input
        type="checkbox"
        name={name}
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className={cn("mt-1 h-4 w-4 shrink-0 accent-[color:var(--isl-oxblood)]")}
      />
    </label>
  );
}
