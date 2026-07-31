type SnapshotStat = {
  label: string;
  value: string;
  hint?: string;
};

export default function SnapshotStrip({ stats }: { stats: SnapshotStat[] }) {
  return (
    <div className="mx-auto mt-4 w-full max-w-6xl px-6">
      <div className="grid gap-6 rounded-[2px] border border-[color:var(--isl-hairline)] bg-cream px-6 py-6 md:grid-cols-4">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="group/stat relative flex flex-col items-center gap-1 text-center"
          >
            {stat.hint ? (
              <span className="cursor-help font-isl-body text-[0.75rem] font-semibold uppercase tracking-[0.2em] text-brass-ink">
                {stat.label}
                <span
                  role="tooltip"
                  className="pointer-events-none absolute bottom-full left-1/2 z-50 mb-2 w-max max-w-[220px] -translate-x-1/2 whitespace-normal rounded-[2px] border border-[color:var(--isl-hairline)] bg-paper px-2.5 py-1.5 text-[11px] font-medium normal-case leading-snug tracking-normal text-ink opacity-0 shadow-lg transition-opacity duration-150 group-hover/stat:opacity-100"
                >
                  {stat.hint}
                </span>
              </span>
            ) : (
              <span className="font-isl-body text-[0.75rem] font-semibold uppercase tracking-[0.2em] text-brass-ink">
                {stat.label}
              </span>
            )}
            <span className="num font-display text-3xl font-bold text-oxblood md:text-4xl">
              {stat.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
