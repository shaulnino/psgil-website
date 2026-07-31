import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import Section from "@/components/Section";
import { requireUser } from "@/lib/auth/session";
import NotificationHistory from "@/components/notifications/NotificationHistory";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("notifications");
  return { title: `${t("page.title")} | F1ISL` };
}

export default async function NotificationsPage() {
  await requireUser("/notifications");
  const t = await getTranslations("notifications");

  return (
    <Section title={t("page.title")} description={t("page.description")} pageHeader>
      <NotificationHistory />
    </Section>
  );
}
