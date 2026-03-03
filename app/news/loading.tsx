import Section from "@/components/Section";

export default function NewsLoading() {
  return (
    <main className="bg-[#0B0B0E] text-white">
      <Section title="News" description="Loading latest articles..." pageHeader>
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, idx) => (
            <div
              key={idx}
              className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] animate-pulse"
            >
              <div className="h-44 bg-white/10" />
              <div className="space-y-3 p-5">
                <div className="h-3 w-24 rounded bg-white/10" />
                <div className="h-6 w-3/4 rounded bg-white/10" />
                <div className="h-4 w-full rounded bg-white/10" />
                <div className="h-4 w-5/6 rounded bg-white/10" />
              </div>
            </div>
          ))}
        </div>
      </Section>
    </main>
  );
}

