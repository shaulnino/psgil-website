"use client";

import { useEffect, useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import LoadingLink from "@/components/LoadingLink";
import NewsCategoryTag from "@/components/NewsCategoryTag";
import NewsImage from "@/components/NewsImage";
import type { NewsArticle } from "@/lib/newsData";
import { formatNewsDate } from "@/lib/newsData";

type NewsCarouselProps = {
  articles: NewsArticle[];
};

const AUTO_ADVANCE_MS = 6000;

export default function NewsCarousel({ articles }: NewsCarouselProps) {
  const t = useTranslations("news");
  const locale = useLocale();
  const [index, setIndex] = useState(0);
  const [isHovered, setIsHovered] = useState(false);
  const [touchStartX, setTouchStartX] = useState<number | null>(null);

  const total = articles.length;
  const active = useMemo(() => articles[index] ?? null, [articles, index]);

  useEffect(() => {
    setIndex(0);
  }, [total]);

  useEffect(() => {
    if (total <= 1 || isHovered) return;
    const timer = window.setInterval(() => {
      setIndex((prev) => (prev + 1) % total);
    }, AUTO_ADVANCE_MS);
    return () => window.clearInterval(timer);
  }, [isHovered, total]);

  if (total === 0 || !active) {
    return (
      <div className="rounded-[2px] border border-[color:var(--isl-hairline)] bg-paper p-6 text-sm text-ink-2">
        {t("carousel.empty")}
      </div>
    );
  }

  const prev = () => setIndex((v) => (v - 1 + total) % total);
  const next = () => setIndex((v) => (v + 1) % total);

  return (
    <div
      className="relative rounded-[2px] border border-brass bg-cream"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onTouchStart={(e) => setTouchStartX(e.touches[0]?.clientX ?? null)}
      onTouchEnd={(e) => {
        const endX = e.changedTouches[0]?.clientX;
        if (touchStartX === null || typeof endX !== "number") return;
        const delta = endX - touchStartX;
        if (Math.abs(delta) > 40) {
          if (delta < 0) next();
          if (delta > 0) prev();
        }
        setTouchStartX(null);
      }}
    >
      <LoadingLink href={`/news/${encodeURIComponent(active.slug)}`} className="group block">
        <div className="grid gap-0 md:grid-cols-2">
          <div className="relative h-60 overflow-hidden rounded-t-[2px] border-b border-brass md:h-full md:rounded-none md:border-b-0 md:border-e md:border-brass">
            <NewsImage
              src={active.coverImageUrl}
              alt={active.title}
              loading="lazy"
              className="h-full w-full object-cover"
            />
          </div>
          <div className="flex flex-col justify-between p-6 md:p-7">
            <div>
              {total > 1 && (
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-meta">
                  <span className="num">{t("carousel.storyOf", { current: index + 1, total })}</span>
                </p>
              )}
              <div className="flex flex-wrap items-center gap-2">
                <p className="num-date text-xs font-semibold uppercase tracking-[0.16em] text-meta">
                  {formatNewsDate(active.date, locale)}
                </p>
                <NewsCategoryTag category={active.category} />
              </div>
              <h3 className="mt-3 font-display text-2xl font-bold tracking-[0.005em] leading-[1.05] text-ink">
                {active.title}
              </h3>
              <p className="mt-3 text-sm leading-6 text-ink-2">
                {active.excerpt}
              </p>
            </div>
            <span className="mt-6 inline-flex w-fit items-center rounded-[2px] border-b border-transparent text-sm font-medium uppercase tracking-[0.08em] text-ink group-hover:border-oxblood">
              {t("carousel.read")}
            </span>
          </div>
        </div>
      </LoadingLink>

      {total > 1 && (
        <>
          <button
            type="button"
            onClick={prev}
            className="absolute start-3 top-1/2 -translate-y-1/2 rounded-[2px] border border-[color:var(--isl-hairline)] bg-paper p-2 text-ink transition-colors hover:border-ink"
            aria-label={t("carousel.prevAria")}
          >
            <svg className="h-4 w-4 rtl:scale-x-[-1]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 18l-6-6 6-6" />
            </svg>
          </button>
          <button
            type="button"
            onClick={next}
            className="absolute end-3 top-1/2 -translate-y-1/2 rounded-[2px] border border-[color:var(--isl-hairline)] bg-paper p-2 text-ink transition-colors hover:border-ink"
            aria-label={t("carousel.nextAria")}
          >
            <svg className="h-4 w-4 rtl:scale-x-[-1]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 6l6 6-6 6" />
            </svg>
          </button>
          <div className="flex items-center justify-center gap-2 py-2">
            {articles.map((article, i) => (
              <button
                key={article.id}
                type="button"
                onClick={() => setIndex(i)}
                className={`h-2.5 w-2.5 rounded-full transition-colors ${
                  i === index ? "bg-oxblood" : "bg-sink hover:bg-ink-2"
                }`}
                aria-label={t("carousel.goToAria", { index: i + 1 })}
              />
            ))}
          </div>
        </>
      )}

    </div>
  );
}
