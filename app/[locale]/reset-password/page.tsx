import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import Section from "@/components/Section";
import LoadingLink from "@/components/LoadingLink";
import ResetPasswordForm from "./ResetPasswordForm";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("account.reset");
  return { title: `${t("title")} | F1ISL` };
}

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const t = await getTranslations("account.reset");
  const { token } = await searchParams;

  return (
    <main className="text-ink-2">
      <Section title={t("title")} description={t("subtitle")} pageHeader>
        <div className="mx-auto max-w-md rounded-[2px] border border-[color:var(--isl-hairline)] bg-cream p-6 md:p-8">
          {typeof token === "string" && token ? (
            <ResetPasswordForm token={token} />
          ) : (
            <div className="space-y-4">
              <p className="text-[color:var(--isl-danger)]">{t("invalid")}</p>
              <LoadingLink href="/forgot-password" className="text-oxblood hover:text-oxblood-deep">
                {t("requestNew")}
              </LoadingLink>
            </div>
          )}
        </div>
      </Section>
    </main>
  );
}
