import Section from "@/components/Section";

export default function NewsLoading() {
  return (
    <main className="bg-bone text-ink">
      <Section title="News" description="Loading latest articles..." pageHeader>
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, idx) => (
            <div
              key={idx}
              className="overflow-hidden rounded-[2px] border border-[color:var(--isl-hairline)] bg-paper animate-pulse"
            >
              <div className="h-44 bg-sink" />
              <div className="space-y-3 p-5">
                <div className="h-3 w-24 rounded-[2px] bg-cream" />
                <div className="h-6 w-3/4 rounded-[2px] bg-cream" />
                <div className="h-4 w-full rounded-[2px] bg-cream" />
                <div className="h-4 w-5/6 rounded-[2px] bg-cream" />
              </div>
            </div>
          ))}
        </div>
      </Section>
    </main>
  );
}

