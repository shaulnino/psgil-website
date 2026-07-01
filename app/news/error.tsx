"use client";

import Section from "@/components/Section";
import { Button } from "@/components/ui/button";

export default function NewsError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="bg-bone text-ink">
      <Section title="News Unavailable" description="Something went wrong while loading news." pageHeader>
        <div className="rounded-[2px] border border-[color:var(--isl-hairline)] bg-cream p-6 text-sm text-ink-2">
          Please try again in a moment.
          <div className="mt-4">
            <Button type="button" onClick={reset} size="sm">
              Retry
            </Button>
          </div>
        </div>
      </Section>
    </main>
  );
}

