"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";

type View = "driver" | "steward";

export default function ViewToggle({
  view,
  driverHref,
  stewardHref,
}: {
  view: View;
  driverHref: string;
  stewardHref: string;
}) {
  const t = useTranslations("stewards");
  const driverRef = useRef<HTMLAnchorElement | null>(null);
  const stewardRef = useRef<HTMLAnchorElement | null>(null);
  const [sliderStyle, setSliderStyle] = useState<React.CSSProperties>({});

  useEffect(() => {
    const el = view === "driver" ? driverRef.current : stewardRef.current;
    if (!el || !el.parentElement) return;
    const parent = el.parentElement;
    const pRect = parent.getBoundingClientRect();
    const eRect = el.getBoundingClientRect();
    setSliderStyle({
      width: eRect.width,
      transform: `translateX(${eRect.left - pRect.left}px)`,
    });
  }, [view]);

  return (
    <div className="flex items-center">
      <div className="relative flex items-center rounded-[2px] border border-[color:var(--isl-hairline)] bg-cream p-0.5">
        {/* animated slider */}
        <span
          aria-hidden="true"
          className="pointer-events-none absolute left-0 top-0.5 h-[calc(100%-4px)] rounded-[2px] bg-ink transition-[width,transform] duration-300 ease-in-out"
          style={sliderStyle}
        />
        <Link
          ref={driverRef}
          href={driverHref}
          className={`relative z-10 rounded-[2px] px-4 py-1.5 text-xs font-bold tracking-wide transition-colors duration-200 ${
            view === "driver" ? "text-bone" : "text-ink-2 hover:text-ink"
          }`}
        >
          {t("cases.view.driver")}
        </Link>
        <Link
          ref={stewardRef}
          href={stewardHref}
          className={`relative z-10 rounded-[2px] px-4 py-1.5 text-xs font-bold tracking-wide transition-colors duration-200 ${
            view === "steward" ? "text-bone" : "text-ink-2 hover:text-ink"
          }`}
        >
          {t("cases.view.steward")}
        </Link>
      </div>
    </div>
  );
}
