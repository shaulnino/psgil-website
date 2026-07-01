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

export const revalidate = 60; // 60 seconds — news articles should appear quickly after sheet edits

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
          className="group overflow-hidden rounded-[2px] border border-[color:var(--isl-hairline)] bg-cream transition-colors hover:border-oxblood"
        >
          <div className="relative h-44 overflow-hidden border-b border-[color:var(--isl-hairline)]">
            <NewsImage
              src={article.coverImageUrl}
              alt={article.title}
              className="h-full w-full object-cover"
            />
          </div>
          <div className="p-5">
            <div className="flex flex-wrap items-center gap-2">
              <p className="num text-xs font-semibold uppercase tracking-[0.16em] text-meta">
                {formatNewsDate(article.date)}
              </p>
              <NewsCategoryTag category={category} />
            </div>
            <h2 className="mt-2 font-display text-2xl font-bold tracking-[0.005em] leading-[1.05] text-ink transition-colors group-hover:text-oxblood">
              {article.title}
            </h2>
            <p className="mt-2 text-sm leading-6 text-ink-2">
              {article.excerpt}
            </p>
            {article.tags.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-2">
                {article.tags.map((tag) => (
                  <span
                    key={`${article.id}-${tag}`}
                    className="rounded-[2px] border border-[color:var(--isl-hairline)] bg-paper px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-meta"
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
    <main className="bg-bone text-ink-2">
      <Section
        title="News"
        description="Race reports, highlights, and league updates from ISL."
        pageHeader
      >
        {error && (
          <div className="mb-6 rounded-[2px] border border-[color:var(--isl-hairline)] border-s-2 border-s-status-danger bg-paper p-4 text-sm text-ink-2">
            {error} Showing cached or available content.
          </div>
        )}

        {articles.length === 0 ? (
          <div className="rounded-[2px] border border-[color:var(--isl-hairline)] bg-cream p-6 text-sm text-meta">
            No published news yet.
          </div>
        ) : (
          <div className="space-y-10">
            {grouped.map((section) => (
              <section key={section.category} className="space-y-5">
                <div className="space-y-2">
                  <h2 className="font-display text-2xl font-bold tracking-[0.005em] leading-[1.05] text-ink md:text-3xl">
                    {section.label}
                  </h2>
                  <div className="h-[2px] w-24 rounded-[2px] bg-oxblood" />
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

