import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import Section from "@/components/Section";
import VerifyClient from "./VerifyClient";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("account.verify");
  return { title: `${t("title")} | F1ISL` };
}

export default async function VerifyPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const t = await getTranslations("account.verify");
  const { token } = await searchParams;

  return (
    <main className="text-ink-2">
      <Section title={t("title")} pageHeader>
        <div className="mx-auto max-w-md rounded-[2px] border border-[color:var(--isl-hairline)] bg-cream p-6 md:p-8">
          <VerifyClient token={typeof token === "string" ? token : ""} />
        </div>
      </Section>
    </main>
  );
}
