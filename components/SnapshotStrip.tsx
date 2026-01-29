type SnapshotStat = {
  label: string;
  value: string;
};

export default function SnapshotStrip({ stats }: { stats: SnapshotStat[] }) {
  return (
    <div className="mx-auto mt-4 w-full max-w-6xl px-6">
      <div className="grid gap-6 rounded-2xl border border-white/10 bg-white/5 px-6 py-6 backdrop-blur md:grid-cols-4">
        {stats.map((stat) => (
          <div key={stat.label} className="flex flex-col gap-1">
            <span className="text-sm uppercase tracking-[0.2em] text-white/50">{stat.label}</span>
            <span className="font-display text-2xl font-semibold text-white md:text-3xl">
              {stat.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
