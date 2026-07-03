type SectionProps = {
  id?: string;
  title?: string;
  description?: string;
  /** Optional element rendered to the right of the title row. */
  headerRight?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  /** Render as a premium page-level header (h1) with gradient text, accent underline, and radial glow. */
  pageHeader?: boolean;
  /** Apply brand gradient styling to the section h2 title (for homepage sections). */
  brandTitle?: boolean;
};

export default function Section({ id, title, description, headerRight, children, className = "", pageHeader, brandTitle }: SectionProps) {
  const emphasizeTitle = pageHeader || brandTitle;

  return (
    <section id={id} className={`${pageHeader ? "relative py-14 md:py-20" : "py-12 md:py-16"} ${className}`}>
      <div className="relative mx-auto w-full max-w-6xl px-6">
        {(title || description || headerRight) && (
          <div className={pageHeader ? "mb-12" : "mb-10"}>
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="max-w-2xl">
                {title && pageHeader ? (
                  <>
                    <h1 className="font-display text-4xl font-bold tracking-[0.005em] leading-[1.05] text-ink md:text-5xl">
                      {title}
                    </h1>
                    <div className="mt-3 h-[2px] w-36 bg-oxblood" />
                  </>
                ) : title && brandTitle ? (
                  <>
                    <h2 className="font-display text-3xl font-bold tracking-[0.005em] leading-[1.05] text-ink md:text-4xl">
                      {title}
                    </h2>
                    <div className="mt-2.5 h-[2px] w-[120px] bg-oxblood" />
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
