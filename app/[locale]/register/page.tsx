import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import Section from "@/components/Section";
import LoadingLink from "@/components/LoadingLink";
import RegisterForm from "./RegisterForm";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("account.register");
  return { title: `${t("title")} | F1ISL` };
}

export default async function RegisterPage() {
  const t = await getTranslations("account.register");
  return (
    <main className="text-ink-2">
      <Section title={t("title")} description={t("subtitle")} pageHeader>
        <div className="mx-auto max-w-md rounded-[2px] border border-[color:var(--isl-hairline)] bg-cream p-6 md:p-8">
          <RegisterForm />
          <p className="mt-6 text-center text-sm text-meta">
            {t("haveAccount")}{" "}
            <LoadingLink href="/login" className="text-oxblood hover:text-oxblood-deep">
              {t("signInLink")}
            </LoadingLink>
          </p>
        </div>
      </Section>
    </main>
  );
}
