import Link from "next/link";
import Section from "@/components/Section";
import { siteConfig } from "@/lib/siteConfig";

export default function DriversPage() {
  return (
    <main className="bg-[#0B0B0E] text-white">
      <Section title="Drivers" description="Coming soon. Profiles and standings are on the way.">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-sm text-white/70">
          We are building the drivers hub for {siteConfig.leagueName}. Check back soon.
          <div className="mt-4">
            <Link href="/" className="text-[#7020B0] hover:text-white">
              Back to home
            </Link>
          </div>
        </div>
      </Section>
    </main>
  );
}
