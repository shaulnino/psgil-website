import Section from "@/components/Section";
import Button from "@/components/Button";

export default function ArticlesPage() {
  return (
    <main className="bg-[#0B0B0E] text-white">
      <Section title="Articles" description="Coming soon. Race recaps and highlights are coming.">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-sm text-white/70">
          The PSGiL editorial hub is in progress. Expect race reports and highlights soon.
          <div className="mt-4">
            <Button href="/" variant="ghost" size="sm">
              Back to home
            </Button>
          </div>
        </div>
      </Section>
    </main>
  );
}
