"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth/session";
import {
  createNotification,
  getPreferences,
  savePreferences,
} from "@/lib/notifications/repository";
import { applyPreset, type PreferencePreset } from "@/lib/notifications/preferences";
import {
  NOTIFICATION_CATEGORIES,
  type ChannelPrefs,
  type NotificationCategory,
  type NotificationPreferences,
} from "@/lib/notifications/types";

export type PrefsState = { error?: string; ok?: boolean } | undefined;

const bool = (v: FormDataEntryValue | null) => v === "on" || v === "true" || v === "1";

function revalidatePrefs() {
  for (const p of [
    "/account/notifications",
    "/en/account/notifications",
    "/notifications",
    "/en/notifications",
  ]) {
    revalidatePath(p);
  }
}

/**
 * Persist the signed-in user's notification preferences. A hidden `preset` field
 * lets the UI apply a preset server-side (recommended/all/importantOnly/pushOff);
 * otherwise the explicit per-category toggles are read from the form.
 */
export async function saveNotificationPreferencesAction(
  _prev: PrefsState,
  formData: FormData,
): Promise<PrefsState> {
  const user = await getCurrentUser();
  if (!user || !user.isActive) return { error: "You must be signed in." };

  const preset = String(formData.get("preset") ?? "").trim();
  if (preset) {
    const valid: PreferencePreset[] = ["recommended", "all", "importantOnly", "pushOff"];
    if (!valid.includes(preset as PreferencePreset)) return { error: "Unknown preset." };
    await savePreferences(applyPreset(user.id, preset as PreferencePreset));
    revalidatePrefs();
    return { ok: true };
  }

  const current = await getPreferences(user.id);
  const categories = { ...current.categories };
  for (const c of NOTIFICATION_CATEGORIES) {
    const entry: ChannelPrefs = {
      inApp: bool(formData.get(`cat.${c}.inApp`)),
      push: bool(formData.get(`cat.${c}.push`)),
    };
    categories[c as NotificationCategory] = entry;
  }

  const next: NotificationPreferences = {
    ...current,
    pushGlobal: bool(formData.get("pushGlobal")),
    pauseOptional: bool(formData.get("pauseOptional")),
    articleAnnouncementsPushOnly: bool(formData.get("articleAnnouncementsPushOnly")),
    categories,
  };

  await savePreferences(next);
  revalidatePrefs();
  return { ok: true };
}

/**
 * Create a self-service test notification (in-app). Bypasses preference gating so
 * the user always sees it land in the bell — useful to verify the centre works.
 */
export async function sendTestNotificationAction(
  _prev: PrefsState,
  _formData: FormData,
): Promise<PrefsState> {
  const user = await getCurrentUser();
  if (!user || !user.isActive) return { error: "You must be signed in." };
  await createNotification({
    userId: user.id,
    type: "test",
    params: {},
    dedupeKey: `test:${Date.now()}`,
  });
  return { ok: true };
}
