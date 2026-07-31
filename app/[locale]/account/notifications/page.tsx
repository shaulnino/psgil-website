import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import Section from "@/components/Section";
import { requireUser } from "@/lib/auth/session";
import { getPreferences } from "@/lib/notifications/repository";
import NotificationPrefsForm from "@/components/notifications/NotificationPrefsForm";
import PushControls from "@/components/notifications/PushControls";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("notifications");
  return { title: `${t("prefs.title")} | F1ISL` };
}

export default async function NotificationSettingsPage() {
  const user = await requireUser("/account/notifications");
  const t = await getTranslations("notifications");
  const prefs = await getPreferences(user.id);

  return (
    <Section title={t("prefs.title")} description={t("prefs.description")} pageHeader>
      <div className="mb-6">
        <PushControls />
      </div>
      <NotificationPrefsForm initial={prefs} />
    </Section>
  );
}
