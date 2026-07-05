import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import Section from "@/components/Section";
import LoadingLink from "@/components/LoadingLink";
import LoginForm from "./LoginForm";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("account.login");
  return { title: `${t("title")} | F1ISL` };
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const t = await getTranslations("account.login");
  const { next } = await searchParams;
  const safeNext = next && next.startsWith("/") && !next.startsWith("//") ? next : undefined;

  return (
    <main className="text-ink-2">
      <Section title={t("title")} description={t("subtitle")} pageHeader>
        <div className="mx-auto max-w-md rounded-[2px] border border-[color:var(--isl-hairline)] bg-cream p-6 md:p-8">
          <LoginForm next={safeNext} />
          <p className="mt-6 text-center text-sm text-meta">
            {t("noAccount")}{" "}
            <LoadingLink href="/register" className="text-oxblood hover:text-oxblood-deep">
              {t("registerLink")}
            </LoadingLink>
          </p>
        </div>
      </Section>
    </main>
  );
}
