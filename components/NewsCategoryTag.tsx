"use client";

import { useTranslations } from "next-intl";
import { type NewsCategory } from "@/lib/newsCategories";

type NewsCategoryTagProps = {
  category: NewsCategory;
};

export default function NewsCategoryTag({ category }: NewsCategoryTagProps) {
  const t = useTranslations("news");
  return (
    <span className="inline-flex items-center rounded-[2px] border border-brass px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-brass-ink">
      {t(`categories.${category}`)}
    </span>
  );
}
