"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

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
      <div className="relative flex items-center rounded-full border border-steward-gold/40 bg-black/40 p-0.5 backdrop-blur-sm">
        {/* animated gold slider */}
        <span
          aria-hidden="true"
          className="pointer-events-none absolute left-0 top-0.5 h-[calc(100%-4px)] rounded-full bg-gradient-to-r from-steward-gold to-steward-cream shadow-[0_0_10px_rgba(143,132,112,0.22)] transition-[width,transform] duration-300 ease-in-out"
          style={sliderStyle}
        />
        <Link
          ref={driverRef}
          href={driverHref}
          className={`relative z-10 rounded-full px-4 py-1.5 text-xs font-bold tracking-wide transition-colors duration-200 ${
            view === "driver" ? "text-black" : "text-white/70 hover:text-white"
          }`}
        >
          Driver
        </Link>
        <Link
          ref={stewardRef}
          href={stewardHref}
          className={`relative z-10 rounded-full px-4 py-1.5 text-xs font-bold tracking-wide transition-colors duration-200 ${
            view === "steward" ? "text-black" : "text-white/70 hover:text-white"
          }`}
        >
          Steward
        </Link>
      </div>
    </div>
  );
}
