import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * ISL StatTile — a label + a large tabular-mono number (the timing-tower
 * figure). The `.num` utility forces JetBrains-tower behaviour and keeps the
 * digits LTR even inside an RTL page.
 */
export function StatTile({
  label,
  value,
  sub,
  className,
}: {
  label: string;
  value: React.ReactNode;
  sub?: string;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-1", className)}>
      <span className="font-isl-body text-[0.75rem] font-semibold uppercase tracking-[0.2em] text-meta">
        {label}
      </span>
      <span className="num text-3xl font-semibold leading-none text-ink">{value}</span>
      {sub ? <span className="font-isl-body text-xs text-meta">{sub}</span> : null}
    </div>
  );
}
