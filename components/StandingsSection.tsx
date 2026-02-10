"use client";

import { useState, useEffect } from "react";
import StandingsTable from "@/components/StandingsTable";
import ZoomableImage from "@/components/ZoomableImage";
import type { StandingsRow } from "@/lib/resultsData";

/* ------------------------------------------------------------------ */
/*  StandingsSection – Table ↔ Image toggle with PNG fallback          */
/* ------------------------------------------------------------------ */

type StandingsSectionProps = {
  title: string;
  subtitle: string;
  image: { src: string; alt: string };
  standingsData: StandingsRow[];
  type: "drivers" | "constructors";
};

export default function StandingsSection({
  title,
  subtitle,
  image,
  standingsData,
  type,
}: StandingsSectionProps) {
  /* ---------- "not applicable" detection ---------- */
  const naRow = standingsData.find(
    (r) => r.competition_status === "not_applicable",
  );
  const isNotApplicable = !!naRow;
  const notApplicableNote = naRow?.competition_note || "";

  // Usable rows = everything that isn't a "not_applicable" placeholder
  const usableData = isNotApplicable
    ? []
    : standingsData;

  const hasTableData = usableData.length > 0;
  const hasImage = !!image.src;
  const [showImage, setShowImage] = useState(!hasTableData && hasImage);

  // Reset view when the underlying data or image changes (e.g. season switch)
  useEffect(() => {
    if (hasTableData) {
      setShowImage(false);        // prefer table
    } else if (hasImage) {
      setShowImage(true);         // fall back to image
    } else {
      setShowImage(false);        // show "not uploaded" placeholder
    }
  }, [hasTableData, hasImage, usableData, image.src]);

  return (
    <div>
      {/* Header + toggle */}
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="font-display text-xl font-semibold text-white md:text-2xl">
            {title}
          </h2>
          <p className="mt-1 text-sm text-white/60">{subtitle}</p>
        </div>

        {/* Only show toggle when BOTH table data AND an image exist */}
        {hasTableData && hasImage && !isNotApplicable && (
          <button
            onClick={() => setShowImage((v) => !v)}
            className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-[11px] font-medium uppercase tracking-wider text-white/50 transition hover:border-[#7020B0]/40 hover:text-white/80"
          >
            {showImage ? (
              <>
                <span>📊</span> Show table
              </>
            ) : (
              <>
                <span>🖼️</span> Show image
              </>
            )}
          </button>
        )}
      </div>

      {/* Content */}
      {isNotApplicable ? (
        /* Gold "not applicable" note */
        <div className="rounded-2xl border border-[#D4AF37]/20 bg-[#D4AF37]/5 px-5 py-6">
          <p className="text-sm font-medium leading-relaxed text-[#D4AF37]/90">
            {notApplicableNote}
          </p>
        </div>
      ) : showImage && hasImage ? (
        <div className="rounded-2xl border border-white/10 bg-[linear-gradient(140deg,_rgba(255,255,255,0.06),_rgba(255,255,255,0.02))] p-4 transition hover:border-[#7020B0]/40">
          <ZoomableImage
            src={image.src}
            alt={image.alt}
            width={1600}
            height={900}
            sizes="100vw"
            quality={100}
            triggerClassName="group relative overflow-hidden rounded-xl border border-white/10 bg-[#0B0B0E] transition hover:border-[#7020B0]/40 cursor-pointer"
            imageClassName="h-auto w-full object-contain transition duration-200 group-hover:scale-[1.01]"
          />
        </div>
      ) : hasTableData ? (
        <StandingsTable standings={usableData} type={type} />
      ) : (
        <div className="flex items-center justify-center rounded-2xl border border-white/10 bg-white/5 py-12">
          <p className="text-sm text-white/50">
            Results not uploaded yet.
          </p>
        </div>
      )}
    </div>
  );
}
