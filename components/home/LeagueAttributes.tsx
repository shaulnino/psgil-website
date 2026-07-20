import type { LucideIcon } from "lucide-react";

export type LeagueAttribute = {
  Icon: LucideIcon;
  label: string;
};

/**
 * Compact league-attribute row — small line-icon + label items (not cards).
 * Restrained: one gold icon per attribute, hairline dividers, no fills.
 */
export default function LeagueAttributes({ items }: { items: LeagueAttribute[] }) {
  if (items.length === 0) return null;
  return (
    <ul className="flex flex-wrap items-center gap-x-5 gap-y-3">
      {items.map(({ Icon, label }) => (
        <li key={label} className="inline-flex items-center gap-2 select-none">
          <Icon className="h-4 w-4 shrink-0 text-brass-ink" aria-hidden />
          <span className="font-isl-body text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-2">
            {label}
          </span>
        </li>
      ))}
    </ul>
  );
}
