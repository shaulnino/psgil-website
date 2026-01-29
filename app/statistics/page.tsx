"use client";

import Section from "@/components/Section";
import ZoomableImage from "@/components/ZoomableImage";

const statsSections = [
  {
    title: "Last Race Results",
    subtitle: "Latest race standings and outcomes.",
    image: {
      src: "/statistics/last-race.png",
      alt: "Last race results screenshot",
    },
  },
  {
    title: "Drivers Championship",
    subtitle: "Current points table after the latest round.",
    image: {
      src: "/statistics/drivers-champ.png",
      alt: "Drivers championship screenshot",
    },
  },
  {
    title: "Constructors Championship",
    subtitle: "Team standings and season momentum.",
    image: {
      src: "/statistics/constructors-champ.png",
      alt: "Constructors championship screenshot",
    },
  },
];

export default function StatisticsPage() {
  return (
    <main className="bg-[#0B0B0E] text-white">
      <Section
        title="Statistics"
        description="Full stats dashboard is coming soon. For now, here are the latest official tables."
      >
        <div className="flex flex-col gap-12">
          {statsSections.map((section) => (
            <div key={section.title}>
              <div className="mb-4">
                <h2 className="font-display text-xl font-semibold text-white md:text-2xl">
                  {section.title}
                </h2>
                <p className="mt-2 text-sm text-white/60">{section.subtitle}</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-[linear-gradient(140deg,_rgba(255,255,255,0.06),_rgba(255,255,255,0.02))] p-4 transition hover:border-[#7020B0]/40">
                <ZoomableImage
                  src={section.image.src}
                  alt={section.image.alt}
                  width={1600}
                  height={900}
                  sizes="100vw"
                  quality={100}
                  triggerClassName="group relative overflow-hidden rounded-xl border border-white/10 bg-[#0B0B0E] transition hover:border-[#7020B0]/40 cursor-pointer"
                  imageClassName="h-auto w-full object-contain transition duration-200 group-hover:scale-[1.01]"
                />
              </div>
            </div>
          ))}

          <div>
            <div className="mb-4">
              <h2 className="font-display text-xl font-semibold text-white md:text-2xl">
                All-Time Statistics
              </h2>
              <p className="mt-2 text-sm text-white/60">Historic records will arrive here.</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-sm text-white/70">
              <p className="font-medium text-white">All-Time Statistics</p>
              <p className="mt-2 text-white/60">
                Coming soon. Historic stats and records will live here.
              </p>
            </div>
          </div>
        </div>
      </Section>

    </main>
  );
}
