import Section from "@/components/Section";

export default function NewsArticleLoading() {
  return (
    <main className="text-ink">
      <Section className="pt-8 md:pt-12">
        <div className="overflow-hidden rounded-[2px] border border-[color:var(--isl-hairline)] bg-cream animate-pulse">
          <div className="h-64 bg-sink md:h-80" />
          <div className="space-y-4 p-6 md:p-8">
            <div className="h-3 w-40 rounded-[2px] bg-sink" />
            <div className="h-10 w-3/4 rounded-[2px] bg-sink" />
            <div className="h-4 w-full rounded-[2px] bg-sink" />
            <div className="h-4 w-11/12 rounded-[2px] bg-sink" />
            <div className="h-4 w-4/5 rounded-[2px] bg-sink" />
          </div>
        </div>
      </Section>
    </main>
  );
}

