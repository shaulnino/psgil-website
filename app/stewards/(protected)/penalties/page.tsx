import FormActionButton from "@/app/stewards/components/FormActionButton";
import { requireStewardUser } from "@/lib/stewards/auth";
import { aggregateDriverPenalties, listUsers } from "@/lib/stewards/repository";
import HistoricalPenaltyForm from "@/app/stewards/(protected)/admin/HistoricalPenaltyForm";

type SearchParams = Promise<{ season?: string; driver?: string; sort?: "points" | "seconds" | "warnings" | "cases" }>;

export default async function StewardPenaltiesPage({ searchParams }: { searchParams: SearchParams }) {
  const user = await requireStewardUser();
  const isAdmin = user.roles.includes("admin");
  const params = await searchParams;
  const seasonFilter = (params.season ?? "").trim().toLowerCase();
  const driverFilter = (params.driver ?? "").trim().toLowerCase();
  const sort = params.sort ?? "points";
  const [rows, allUsers] = await Promise.all([
    aggregateDriverPenalties(),
    isAdmin ? listUsers() : Promise.resolve([]),
  ]);
  const memberDrivers = allUsers.filter((u) => u.roles.includes("member"));
  const filtered = rows
    .filter((r) => (!seasonFilter || r.season.toLowerCase().includes(seasonFilter)) && (!driverFilter || r.driverName.toLowerCase().includes(driverFilter)))
    .sort((a, b) => {
      if (sort === "seconds") return b.totalTimePenaltySeconds - a.totalTimePenaltySeconds;
      if (sort === "warnings") return b.totalWarningsCount - a.totalWarningsCount;
      if (sort === "cases") return b.totalCases - a.totalCases;
      return b.totalLicensePoints - a.totalLicensePoints;
    });

  return (
    <div className="space-y-6">
      <section className="steward-panel rounded-2xl p-5">
        <h2 className="font-display text-2xl font-semibold">Penalty Tracking</h2>
        <p className="mt-1 text-white/70">Aggregated from published verdicts with composable penalties.</p>
        <form className="mt-4 grid gap-3 md:grid-cols-4">
          <label className="block"><span className="mb-1 block text-sm text-white/80">Season filter</span><input name="season" defaultValue={params.season ?? ""} className="w-full rounded-lg border border-white/15 bg-black/30 px-3 py-2" /></label>
          <label className="block"><span className="mb-1 block text-sm text-white/80">Driver filter</span><input name="driver" defaultValue={params.driver ?? ""} className="w-full rounded-lg border border-white/15 bg-black/30 px-3 py-2" /></label>
          <label className="block"><span className="mb-1 block text-sm text-white/80">Sort by</span><select name="sort" defaultValue={sort} className="w-full rounded-lg border border-white/15 bg-black/30 px-3 py-2"><option value="points">License points</option><option value="seconds">Time penalties</option><option value="warnings">Warnings</option><option value="cases">Cases</option></select></label>
          <div className="flex items-end"><FormActionButton idleLabel="Apply" loadingLabel="Applying..." className="rounded-full bg-[#7020B0] px-5 py-2.5 text-sm font-semibold" /></div>
        </form>
      </section>
      <section className="steward-panel overflow-hidden rounded-2xl">
        <div className="overflow-x-auto">
          <table className="steward-table min-w-full text-left text-sm">
            <thead className="bg-white/5 text-white/80"><tr><th className="px-4 py-3">Driver</th><th className="px-4 py-3">Season</th><th className="px-4 py-3">License Points</th><th className="px-4 py-3">Time Penalty (s)</th><th className="px-4 py-3">Warnings</th><th className="px-4 py-3">Cases</th></tr></thead>
            <tbody>
              {filtered.map((row) => (
                <tr key={`${row.driverId}:${row.season}`} className="border-t border-white/10">
                  <td className="px-4 py-3">{row.driverName}</td><td className="px-4 py-3">{row.season}</td><td className="px-4 py-3">{row.totalLicensePoints}</td><td className="px-4 py-3">{row.totalTimePenaltySeconds}</td><td className="px-4 py-3">{row.totalWarningsCount}</td><td className="px-4 py-3">{row.totalCases}</td>
                </tr>
              ))}
              {filtered.length === 0 && <tr><td className="px-4 py-5 text-white/60" colSpan={6}>No penalty data yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>

      {isAdmin && <HistoricalPenaltyForm drivers={memberDrivers} />}
    </div>
  );
}
