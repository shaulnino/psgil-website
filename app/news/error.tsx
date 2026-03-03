"use client";

import Section from "@/components/Section";

export default function NewsError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="bg-[#0B0B0E] text-white">
      <Section title="News Unavailable" description="Something went wrong while loading news." pageHeader>
        <div className="rounded-2xl border border-red-400/25 bg-red-500/10 p-6 text-sm text-red-100">
          Please try again in a moment.
          <div className="mt-4">
            <button
              type="button"
              onClick={reset}
              className="inline-flex items-center rounded-full bg-[#7020B0] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#7f2fc0]"
            >
              Retry
            </button>
          </div>
        </div>
      </Section>
    </main>
  );
}

