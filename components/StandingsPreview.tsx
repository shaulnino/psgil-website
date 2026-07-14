"use client";

import Image from "next/image";
import { useTranslations } from "next-intl";
import LoadingLink from "@/components/LoadingLink";

/* ------------------------------------------------------------------ */
/*  StandingsPreview – compact homepage preview of the current-season  */
/*  Drivers' + Constructors' championships (top 5 each).               */
/*  Data (rows, ordering, points, logos) is resolved server-side and   */
/*  passed in — this component only renders and links to /statistics.  */
/* ------------------------------------------------------------------ */

export type StandingsPreviewRow = {
  position: string;
  /** Localized display name (driver name, or constructor/team name). */
  name: string;
  points: string;
  /** Resolved logo src (already falls back to the site mark). */
  logo: string;
  /** Team name — used as the logo's accessible label on driver rows. */
  teamName: string;
};

export type StandingsPreviewProps = {
  drivers: StandingsPreviewRow[];
  /** Empty array => constructors panel hidden, drivers panel spans full width. */
  constructors: StandingsPreviewRow[];
};

function isRemote(src: string): boolean {
  return src.startsWith("http");
}

function Chevron() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 20 20"
      fill="currentColor"
      className="h-3 w-3 rtl:-scale-x-100"
      aria-hidden="true"
    >
      <path
        fillRule="evenodd"
        d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function PreviewRowItem({
  row,
  isFirst,
  isLast,
  logoDecorative,
}: {
  row: StandingsPreviewRow;
  isFirst: boolean;
  isLast: boolean;
  /** When true the name already conveys the team, so the logo is decorative. */
  logoDecorative: boolean;
}) {
  return (
    <li
      className={`flex items-center gap-3 py-2 ${
        !isLast ? "border-b border-[color:var(--isl-hairline)]" : ""
      }`}
    >
      <span
        className={`num flex h-6 w-6 shrink-0 items-center justify-center rounded-[2px] text-sm font-bold ${
          isFirst ? "border border-brass text-brass-ink" : "text-ink-2"
        }`}
      >
        {row.position}
      </span>
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[2px] border border-[color:var(--isl-hairline)] bg-white p-0.5">
        <Image
          src={row.logo}
          alt={logoDecorative ? "" : row.teamName}
          width={28}
          height={28}
          className="h-full w-full object-contain"
          unoptimized={!isRemote(row.logo)}
        />
      </span>
      <span className="min-w-0 flex-1 truncate text-sm font-semibold text-ink">
        {row.name}
      </span>
      <span className="num ms-auto shrink-0 text-sm font-semibold text-ink">
        {row.points || "0"}
      </span>
    </li>
  );
}

function StandingsPanel({
  title,
  rows,
  href,
  ariaLabel,
  logoDecorative,
}: {
  title: string;
  rows: StandingsPreviewRow[];
  href: string;
  ariaLabel: string;
  logoDecorative: boolean;
}) {
  const t = useTranslations("home.standingsPreview");
  return (
    <LoadingLink
      href={href}
      aria-label={ariaLabel}
      className="group isl-chamfer bg-hairline-strong p-px outline-none transition-colors hover:bg-oxblood focus-visible:bg-oxblood"
    >
      <div className="isl-chamfer flex h-full flex-col bg-cream p-5">
        <div className="flex items-baseline justify-between gap-2">
          <h3 className="font-display text-lg font-bold tracking-[0.005em] text-ink">
            {title}
          </h3>
          <span className="font-isl-body text-[0.62rem] font-semibold uppercase tracking-[0.16em] text-meta">
            {t("points")}
          </span>
        </div>
        <div className="isl-gold-rule mb-3 mt-2 max-w-[90px]" />

        <ul className="flex flex-col">
          {rows.map((row, i) => (
            <PreviewRowItem
              key={`${row.position}-${row.name}-${i}`}
              row={row}
              isFirst={i === 0}
              isLast={i === rows.length - 1}
              logoDecorative={logoDecorative}
            />
          ))}
        </ul>

        <span className="mt-4 inline-flex items-center gap-1.5 font-isl-body text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-oxblood transition-all group-hover:gap-2.5">
          {t("viewFull")}
          <Chevron />
        </span>
      </div>
    </LoadingLink>
  );
}

export default function StandingsPreview({
  drivers,
  constructors,
}: StandingsPreviewProps) {
  const t = useTranslations("home.standingsPreview");

  // No drivers standings for the active season → render nothing (no layout shift).
  if (drivers.length === 0) return null;

  const hasConstructors = constructors.length > 0;

  return (
    <div className={`grid gap-4 ${hasConstructors ? "md:grid-cols-2" : ""}`}>
      <StandingsPanel
        title={t("driversTitle")}
        rows={drivers}
        href="/statistics#drivers-standings"
        ariaLabel={t("driversAria")}
        logoDecorative={false}
      />
      {hasConstructors && (
        <StandingsPanel
          title={t("constructorsTitle")}
          rows={constructors}
          href="/statistics#constructors-standings"
          ariaLabel={t("constructorsAria")}
          logoDecorative
        />
      )}
    </div>
  );
}
