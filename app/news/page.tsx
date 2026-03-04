import Section from "@/components/Section";
import LoadingLink from "@/components/LoadingLink";
import NewsCategoryTag from "@/components/NewsCategoryTag";
import NewsImage from "@/components/NewsImage";
import {
  fetchArticlesWithStatus,
  formatNewsDate,
} from "@/lib/newsData";
import {
  NEWS_CATEGORY_LABEL,
  NEWS_CATEGORY_ORDER,
  type NewsCategory,
} from "@/lib/newsCategories";

export const revalidate = 300;

export default async function NewsPage() {
  const { articles, error } = await fetchArticlesWithStatus();
  const grouped = NEWS_CATEGORY_ORDER.map((category) => ({
    category,
    label: NEWS_CATEGORY_LABEL[category],
    items: articles.filter((article) => article.category === category),
  })).filter((section) => section.items.length > 0);

  const renderGrid = (category: NewsCategory, items: typeof articles) => (
    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
      {items.map((article) => (
        <LoadingLink
          key={article.id}
          href={`/news/${encodeURIComponent(article.slug)}`}
          className="group overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] transition hover:border-[#7020B0]/45 hover:shadow-[0_0_24px_rgba(112,32,176,0.18)]"
        >
          <div className="relative h-44 overflow-hidden">
            <NewsImage
              src={article.coverImageUrl}
              alt={article.title}
              className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]"
            />
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/60 via-black/15 to-transparent" />
          </div>
          <div className="p-5">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-xs font-semibold uppercase tracking-[0.15em] text-[#D4AF37]/70">
                {formatNewsDate(article.date)}
              </p>
              <NewsCategoryTag category={category} />
            </div>
            <h2 className="mt-2 font-display text-2xl font-bold tracking-wide text-white">
              {article.title}
            </h2>
            <p className="mt-2 text-sm leading-6 text-white/70">
              {article.excerpt}
            </p>
            {article.tags.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-2">
                {article.tags.map((tag) => (
                  <span
                    key={`${article.id}-${tag}`}
                    className="rounded-full border border-[#7020B0]/35 bg-[#7020B0]/10 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-[#c79eff]"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </div>
        </LoadingLink>
      ))}
    </div>
  );

  return (
    <main className="bg-[#0B0B0E] text-white">
      <Section
        title="News"
        description="Race reports, highlights, and league updates from PSGiL."
        pageHeader
      >
        {error && (
          <div className="mb-6 rounded-2xl border border-red-400/25 bg-red-500/10 p-4 text-sm text-red-100">
            {error} Showing cached or available content.
          </div>
        )}

        {articles.length === 0 ? (
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 text-sm text-white/65">
            No published news yet.
          </div>
        ) : (
          <div className="space-y-10">
            {grouped.map((section) => (
              <section key={section.category} className="space-y-5">
                <div className="space-y-2">
                  <h2 className="font-display text-2xl font-bold tracking-wide text-white md:text-3xl">
                    {section.label}
                  </h2>
                  <div className="h-[2px] w-24 rounded-full bg-gradient-to-r from-[#7020B0] to-[#D4AF37]" />
                </div>
                {renderGrid(section.category, section.items)}
              </section>
            ))}
          </div>
        )}
      </Section>
    </main>
  );
}

