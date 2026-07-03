"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
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
  const t = useTranslations("schedule");
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
          <h2 className="font-display text-xl font-bold tracking-[0.005em] leading-[1.05] text-ink md:text-2xl">
            {title}
          </h2>
          <p className="mt-1 text-sm text-meta">{subtitle}</p>
        </div>

        {/* Only show toggle when BOTH table data AND an image exist */}
        {hasTableData && hasImage && !isNotApplicable && (
          <button
            onClick={() => setShowImage((v) => !v)}
            className="inline-flex items-center gap-1.5 rounded-[2px] border border-[color:var(--isl-hairline)] bg-paper px-3 py-1.5 text-[11px] font-medium uppercase tracking-wider text-ink-2 transition hover:border-ink hover:text-ink"
          >
            {showImage ? (
              <>
                <span>📊</span> {t("standingsSection.showTable")}
              </>
            ) : (
              <>
                <span>🖼️</span> {t("standingsSection.showImage")}
              </>
            )}
          </button>
        )}
      </div>

      {/* Content */}
      {isNotApplicable ? (
        /* "not applicable" note */
        <div className="rounded-[2px] border border-[color:var(--isl-hairline)] bg-cream px-5 py-6">
          <p className="text-sm font-medium leading-relaxed text-ink-2">
            {notApplicableNote}
          </p>
        </div>
      ) : showImage && hasImage ? (
        <div className="rounded-[2px] border border-[color:var(--isl-hairline)] bg-cream p-4 transition hover:border-[color:var(--isl-hairline-strong)]">
          <ZoomableImage
            src={image.src}
            alt={image.alt}
            width={1600}
            height={900}
            sizes="100vw"
            quality={100}
            triggerClassName="group relative overflow-hidden rounded-[2px] border border-[color:var(--isl-hairline)] bg-paper transition hover:border-ink cursor-pointer"
            imageClassName="h-auto w-full object-contain transition duration-200 group-hover:scale-[1.01]"
          />
        </div>
      ) : hasTableData ? (
        <StandingsTable standings={usableData} type={type} />
      ) : (
        <div className="flex items-center justify-center rounded-[2px] border border-[color:var(--isl-hairline)] bg-cream py-12">
          <p className="text-sm text-meta">
            {t("standingsSection.resultsNotUploaded")}
          </p>
        </div>
      )}
    </div>
  );
}
