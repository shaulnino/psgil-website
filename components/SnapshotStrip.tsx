type SnapshotStat = {
  label: string;
  value: string;
};

export default function SnapshotStrip({ stats }: { stats: SnapshotStat[] }) {
  return (
    <div className="mx-auto mt-4 w-full max-w-6xl px-6">
      <div className="grid gap-6 rounded-[2px] border border-[color:var(--isl-hairline)] bg-cream px-6 py-6 md:grid-cols-4">
        {stats.map((stat) => (
          <div key={stat.label} className="flex flex-col items-center gap-1 text-center">
            <span className="font-isl-body text-[0.75rem] font-semibold uppercase tracking-[0.2em] text-brass-ink">
              {stat.label}
            </span>
            <span className="num font-display text-3xl font-bold text-[#d4af37] md:text-4xl">
              {stat.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
