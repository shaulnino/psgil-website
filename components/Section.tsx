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
  const useGradient = pageHeader || brandTitle;

  return (
    <section id={id} className={`${pageHeader ? "relative py-14 md:py-20" : "py-12 md:py-16"} ${className}`}>
      {pageHeader && (
        <div className="pointer-events-none absolute inset-x-0 top-0 h-[280px] overflow-hidden">
          <div className="absolute left-1/2 top-0 h-[280px] w-[600px] -translate-x-1/2 rounded-full bg-[#7020B0]/[0.07] blur-[100px]" />
        </div>
      )}
      <div className="relative mx-auto w-full max-w-6xl px-6">
        {(title || description || headerRight) && (
          <div className={pageHeader ? "mb-12" : "mb-10"}>
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="max-w-2xl">
                {title && pageHeader ? (
                  <>
                    <h1 className="font-display text-4xl font-bold tracking-wider md:text-5xl">
                      <span className="bg-gradient-to-r from-[#7020B0] via-[#a855f7] to-[#D4AF37] bg-clip-text text-transparent drop-shadow-[0_0_24px_rgba(112,32,176,0.25)]">
                        {title}
                      </span>
                    </h1>
                    <div className="mt-3 h-[3px] w-36 rounded-full bg-gradient-to-r from-[#7020B0] to-[#D4AF37] shadow-[0_0_8px_rgba(112,32,176,0.4)]" />
                  </>
                ) : title && brandTitle ? (
                  <>
                    <h2 className="font-display text-3xl font-bold tracking-wider text-white md:text-4xl">
                      <span className="bg-gradient-to-r from-[#7020B0] via-[#a855f7] to-[#D4AF37] bg-clip-text text-transparent drop-shadow-[0_0_20px_rgba(112,32,176,0.2)]">
                        {title}
                      </span>
                    </h2>
                    <div className="mt-2.5 h-[2px] w-[120px] rounded-full bg-gradient-to-r from-[#7020B0] to-[#D4AF37] shadow-[0_0_6px_rgba(112,32,176,0.3)]" />
                  </>
                ) : title ? (
                  <h2 className="font-display text-3xl font-semibold tracking-wide text-white md:text-4xl">
                    {title}
                  </h2>
                ) : null}
                {description && (
                  <p className={
                    useGradient
                      ? "mt-4 text-base tracking-wide text-white/85 md:text-lg"
                      : "mt-3 text-base text-white/70"
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
