import { NEWS_CATEGORY_LABEL, type NewsCategory } from "@/lib/newsCategories";

type NewsCategoryTagProps = {
  category: NewsCategory;
};

export default function NewsCategoryTag({ category }: NewsCategoryTagProps) {
  return (
    <span className="inline-flex items-center rounded-full border border-[#D4AF37]/35 bg-[#D4AF37]/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#D4AF37]">
      {NEWS_CATEGORY_LABEL[category]}
    </span>
  );
}

