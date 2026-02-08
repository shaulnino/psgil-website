"use client";

import Section from "@/components/Section";
import ZoomableImage from "@/components/ZoomableImage";

/* ------------------------------------------------------------------ */
/*  Table sections – swap image paths here (or read from a sheet)      */
/* ------------------------------------------------------------------ */

const tableSections = [
  {
    title: "Drivers Main Championship standings",
    subtitle: "Current points table after the latest round.",
    image: {
      src: "/statistics/drivers-main-champ.png",
      alt: "Drivers Main Championship standings table",
    },
  },
  {
    title: "Constructors Main Championship standings",
    subtitle: "Team standings in the Main Championship.",
    image: {
      src: "/statistics/constructors-main-champ.png",
      alt: "Constructors Main Championship standings table",
    },
  },
  {
    title: "Drivers Wild Championship standings",
    subtitle: "Points table for the Wild Championship.",
    image: {
      src: "/statistics/drivers-wild-champ.png",
      alt: "Drivers Wild Championship standings table",
    },
  },
  {
    title: "Constructors Wild Championship standings",
    subtitle: "Team standings in the Wild Championship.",
    image: {
      src: "/statistics/constructors-wild-champ.png",
      alt: "Constructors Wild Championship standings table",
    },
  },
];

export default function TablesPage() {
  return (
    <main className="bg-[#0B0B0E] text-white">
      <Section
        title="Tables"
        description="Official championship standings, updated after each round."
      >
        <div className="flex flex-col gap-12">
          {tableSections.map((section) => (
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
        </div>
      </Section>
    </main>
  );
}
