type SectionProps = {
  id?: string;
  title?: string;
  description?: string;
  /** Optional element rendered to the right of the title row. */
  headerRight?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  /** Render as a premium page-level header (h1) with accent rule. */
  pageHeader?: boolean;
  /** Apply broadcast module styling to the section h2 title (homepage sections). */
  brandTitle?: boolean;
  /** Optional language-neutral module index (e.g. "01") shown as a race-control tag. */
  index?: string;
};

export default function Section({ id, title, description, headerRight, children, className = "", pageHeader, brandTitle, index }: SectionProps) {
  const emphasizeTitle = pageHeader || brandTitle;

  /* Race-control module index tag — a small mono gold marker above the title. */
  const IndexTag = index ? (
    <span className="mb-3 inline-flex items-center gap-2 font-isl-body text-[0.7rem] font-semibold uppercase tracking-[0.24em] text-brass-ink">
      <span className="num text-oxblood">{index}</span>
      <span className="h-[10px] w-px bg-[color:var(--isl-hairline-strong)]" />
    </span>
  ) : null;

  return (
    <section id={id} className={`${pageHeader ? "relative py-14 md:py-20" : "py-12 md:py-16"} ${className}`}>
      <div className="relative mx-auto w-full max-w-6xl px-6">
        {(title || description || headerRight) && (
          <div className={pageHeader ? "mb-12" : "mb-10"}>
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div className="max-w-2xl">
                {title && pageHeader ? (
                  <>
                    {IndexTag && <div>{IndexTag}</div>}
                    <h1 className="font-display text-4xl font-bold tracking-[0.005em] leading-[1.05] text-ink md:text-5xl">
                      {title}
                    </h1>
                    <div className="isl-gold-rule mt-4 max-w-[220px]" />
                  </>
                ) : title && brandTitle ? (
                  <>
                    {IndexTag && <div>{IndexTag}</div>}
                    <h2 className="font-display text-3xl font-bold tracking-[0.005em] leading-[1.05] text-ink md:text-4xl">
                      {title}
                    </h2>
                    <div className="isl-gold-rule mt-3 max-w-[160px]" />
                  </>
                ) : title ? (
                  <h2 className="font-display text-3xl font-bold tracking-[0.005em] leading-[1.05] text-ink md:text-4xl">
                    {title}
                  </h2>
                ) : null}
                {description && (
                  <p className={
                    emphasizeTitle
                      ? "mt-4 text-base text-ink-2 md:text-lg"
                      : "mt-3 text-base text-ink-2"
                  }>
                    {description}
                  </p>
                )}
              </div>
              {headerRight}
            </div>
          </div>
        )}
        {children}
      </div>
    </section>
  );
}
