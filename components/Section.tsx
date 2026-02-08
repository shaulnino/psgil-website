type SectionProps = {
  id?: string;
  title?: string;
  description?: string;
  /** Optional element rendered to the right of the title row. */
  headerRight?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
};

export default function Section({ id, title, description, headerRight, children, className = "" }: SectionProps) {
  return (
    <section id={id} className={`py-12 md:py-16 ${className}`}>
      <div className="mx-auto w-full max-w-6xl px-6">
        {(title || description || headerRight) && (
          <div className="mb-10">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="max-w-2xl">
                {title && (
                  <h2 className="font-display text-2xl font-semibold tracking-wide text-white md:text-3xl">
                    {title}
                  </h2>
                )}
                {description && <p className="mt-3 text-base text-white/70">{description}</p>}
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
