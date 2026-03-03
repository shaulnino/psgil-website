import Section from "@/components/Section";

export default function NewsArticleLoading() {
  return (
    <main className="bg-[#0B0B0E] text-white">
      <Section className="pt-8 md:pt-12">
        <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] animate-pulse">
          <div className="h-64 bg-white/10 md:h-80" />
          <div className="space-y-4 p-6 md:p-8">
            <div className="h-3 w-40 rounded bg-white/10" />
            <div className="h-10 w-3/4 rounded bg-white/10" />
            <div className="h-4 w-full rounded bg-white/10" />
            <div className="h-4 w-11/12 rounded bg-white/10" />
            <div className="h-4 w-4/5 rounded bg-white/10" />
          </div>
        </div>
      </Section>
    </main>
  );
}

