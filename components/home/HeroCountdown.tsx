"use client";

import { useState, useEffect, useRef } from "react";

/**
 * Compact, SSR-safe race countdown chip (d:h:m:s).
 *
 * Shared by the homepage Races cards and the hero race panel. Starts `null` so
 * the server render and the first client render match (the value is
 * time-dependent — computing it during SSR would mismatch on hydration); the
 * live value fills in immediately after mount. Calls `onReachedZero` once when
 * the target time passes so callers can transition to a live state.
 */
export default function HeroCountdown({
  targetMs,
  onReachedZero,
  className,
}: {
  targetMs: number;
  onReachedZero?: () => void;
  /** Container class override (defaults to the cream broadcast chip). */
  className?: string;
}) {
  const [now, setNow] = useState<number | null>(null);
  const calledRef = useRef(false);

  useEffect(() => {
    // Update only from callbacks (never synchronously in the effect body): a
    // leading rAF fills the first value ~immediately, then a 1s interval ticks.
    const tick = () => setNow(Date.now());
    const raf = requestAnimationFrame(tick);
    const id = setInterval(tick, 1_000);
    return () => {
      cancelAnimationFrame(raf);
      clearInterval(id);
    };
  }, []);

  const total = now === null ? null : Math.max(0, targetMs - now);

  useEffect(() => {
    if (total !== null && total <= 0 && !calledRef.current && onReachedZero) {
      calledRef.current = true;
      onReachedZero();
    }
  }, [total, onReachedZero]);

  if (total !== null && total <= 0) return null;

  const t = total ?? 0;
  const days = Math.floor(t / 86_400_000);
  const hours = Math.floor((t / 3_600_000) % 24);
  const minutes = Math.floor((t / 60_000) % 60);
  const seconds = Math.floor((t / 1_000) % 60);

  const pad = (v: number) => String(v).padStart(2, "0");

  return (
    <div
      dir="ltr"
      className={
        className ??
        "inline-flex h-[34px] items-center gap-1.5 rounded-[2px] border border-[color:var(--isl-hairline)] bg-cream px-3 transition-colors hover:border-[color:var(--isl-hairline-strong)]"
      }
    >
      {[
        { v: days, l: "d" },
        { v: hours, l: "h" },
        { v: minutes, l: "m" },
        { v: seconds, l: "s" },
      ].map((unit, i) => (
        <div key={unit.l} className="flex items-center gap-1">
          {i > 0 && <span className="num text-[11px] font-bold text-faint">:</span>}
          <div className="flex items-baseline gap-px">
            <span className="num text-[13px] font-semibold leading-none text-brass-ink">
              {total === null ? "––" : pad(unit.v)}
            </span>
            <span className="text-[9px] font-medium uppercase text-meta">{unit.l}</span>
          </div>
        </div>
      ))}
    </div>
  );
}
