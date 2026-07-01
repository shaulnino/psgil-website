import FormActionButton from "@/app/stewards/components/FormActionButton";
import { can, requireStewardUser } from "@/lib/stewards/auth";
import { aggregateDriverPenalties, listHistoricalCases, listUsers } from "@/lib/stewards/repository";
import HistoricalPenaltyForm from "@/app/stewards/(protected)/admin/HistoricalPenaltyForm";
import EditHistoricalCaseModal from "./EditHistoricalCaseModal";
import { fetchCsv, parseCsv } from "@/lib/csv";
import { GLOBAL_CSV_URLS } from "@/lib/seasonConfig";
import { mapRaceEvents } from "@/lib/scheduleData";

export type SeasonRoundOption = {
  value: string;
  label: string;
  rounds: { value: string; label: string }[];
};

async function getAllSeasonRoundOptions(): Promise<SeasonRoundOption[]> {
  try {
    const csv = await fetchCsv(GLOBAL_CSV_URLS.schedule);
    const events = mapRaceEvents(parseCsv<Record<string, string>>(csv));
    const bySeason = new Map<string, { value: string; label: string }[]>();
    for (const e of events) {
      const season = (e.season ?? "").trim();
      if (!season) continue;
      const raceNo = (e.race_number ?? "").trim().padStart(2, "0");
      const label = `Race ${raceNo}${e.race_name ? ` - ${e.race_name}` : ""}${e.league ? ` (${e.league})` : ""}`;
      const curr = bySeason.get(season) ?? [];
      if (!curr.some((x) => x.value === label)) curr.push({ value: label, label });
      bySeason.set(season, curr);
    }
    return [...bySeason.entries()]
      .sort((a, b) => (parseInt(b[0].replace(/\D/g, ""), 10) || 0) - (parseInt(a[0].replace(/\D/g, ""), 10) || 0))
      .map(([season, rounds]) => ({ value: season, label: `Season ${season.replace(/^S/i, "")}`, rounds }));
  } catch {
    return [];
  }
}

type SearchParams = Promise<{ season?: string; driver?: string; sort?: "points" | "seconds" | "warnings" | "cases" }>;

export default async function StewardPenaltiesPage({ searchParams }: { searchParams: SearchParams }) {
  const user = await requireStewardUser();
  const isAdmin = can(user, "manage_penalties");
  const params = await searchParams;
  const seasonFilter = (params.season ?? "").trim().toLowerCase();
  const driverFilter = (params.driver ?? "").trim().toLowerCase();
  const sort = params.sort ?? "points";
  const [rows, allUsers, historicalCases, seasonRoundOptions] = await Promise.all([
    aggregateDriverPenalties(),
    isAdmin ? listUsers() : Promise.resolve([]),
    isAdmin ? listHistoricalCases() : Promise.resolve([]),
    isAdmin ? getAllSeasonRoundOptions() : Promise.resolve([]),
  ]);
  const memberDrivers = allUsers.filter((u) => u.roles.includes("member"));

  // Distinct seasons and drivers from actual data for dropdown options
  const seasonOptions = [...new Set(rows.map((r) => r.season))]
    .sort((a, b) => (parseInt(b.replace(/\D/g, ""), 10) || 0) - (parseInt(a.replace(/\D/g, ""), 10) || 0));
  const driverOptions = [...new Map(rows.map((r) => [r.driverId, r.driverName])).entries()]
    .sort((a, b) => a[1].localeCompare(b[1]));

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
      <section className="steward-panel rounded-[2px] p-5">
        <h2 className="font-display text-2xl font-bold tracking-[0.005em] leading-[1.05] text-ink">Penalty Tracking</h2>
        <p className="mt-1 text-ink-2">Aggregated from published verdicts with composable penalties.</p>
        <form className="mt-4 grid gap-3 md:grid-cols-4">
          <label className="block">
            <span className="mb-1 block text-sm text-ink-2">Season</span>
            <select name="season" defaultValue={params.season ?? ""} className="w-full rounded-[2px] border border-[color:var(--isl-hairline)] bg-paper px-3 py-2 text-sm text-ink placeholder:text-faint focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--isl-oxblood)]">
              <option value="">All seasons</option>
              {seasonOptions.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-sm text-ink-2">Driver</span>
            <select name="driver" defaultValue={params.driver ?? ""} className="w-full rounded-[2px] border border-[color:var(--isl-hairline)] bg-paper px-3 py-2 text-sm text-ink placeholder:text-faint focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--isl-oxblood)]">
              <option value="">All drivers</option>
              {driverOptions.map(([id, name]) => (
                <option key={id} value={name}>{name}</option>
              ))}
            </select>
          </label>
          <label className="block"><span className="mb-1 block text-sm text-ink-2">Sort by</span><select name="sort" defaultValue={sort} className="w-full rounded-[2px] border border-[color:var(--isl-hairline)] bg-paper px-3 py-2 text-ink placeholder:text-faint focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--isl-oxblood)]"><option value="points">License points</option><option value="seconds">Time penalties</option><option value="warnings">Warnings</option><option value="cases">Cases</option></select></label>
          <div className="flex items-end"><FormActionButton idleLabel="Apply" loadingLabel="Applying..." className="rounded-[2px] bg-ink px-5 py-2.5 text-sm font-medium uppercase tracking-[0.08em] text-bone transition-opacity hover:opacity-90" spinnerClassName="border-bone/30 border-t-bone" /></div>
        </form>
      </section>
      <section className="steward-panel overflow-hidden rounded-[2px]">
        <div className="overflow-x-auto">
          <table className="steward-table min-w-full text-left text-sm">
            <thead className="text-meta"><tr><th className="px-4 py-3 font-isl-body text-[0.75rem] font-semibold uppercase tracking-[0.2em]">Driver</th><th className="px-4 py-3 font-isl-body text-[0.75rem] font-semibold uppercase tracking-[0.2em]">Season</th><th className="px-4 py-3 font-isl-body text-[0.75rem] font-semibold uppercase tracking-[0.2em]">License Points</th><th className="px-4 py-3 font-isl-body text-[0.75rem] font-semibold uppercase tracking-[0.2em]">Time Penalty (s)</th><th className="px-4 py-3 font-isl-body text-[0.75rem] font-semibold uppercase tracking-[0.2em]">Warnings</th><th className="px-4 py-3 font-isl-body text-[0.75rem] font-semibold uppercase tracking-[0.2em]">Cases</th></tr></thead>
            <tbody>
              {filtered.map((row) => (
                <tr key={`${row.driverId}:${row.season}`} className="border-t border-[color:var(--isl-hairline)]">
                  <td className="px-4 py-3 text-ink">{row.driverName}</td><td className="px-4 py-3 num text-ink-2">{row.season}</td><td className="px-4 py-3 num text-ink-2">{row.totalLicensePoints}</td><td className="px-4 py-3 num text-ink-2">{row.totalTimePenaltySeconds}</td><td className="px-4 py-3 num text-ink-2">{row.totalWarningsCount}</td><td className="px-4 py-3 num text-ink-2">{row.totalCases}</td>
                </tr>
              ))}
              {filtered.length === 0 && <tr><td className="px-4 py-5 text-meta" colSpan={6}>No penalty data yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>

      {isAdmin && historicalCases.length > 0 && (
        <section className="steward-panel overflow-hidden rounded-[2px]">
          <div className="px-5 py-4 border-b border-[color:var(--isl-hairline)]">
            <h3 className="text-base font-display font-bold tracking-[0.005em] leading-[1.05] text-ink">Historical Entries</h3>
            <p className="mt-0.5 text-xs text-meta">Manually recorded historical penalties. Click Edit to update.</p>
          </div>
          <div className="overflow-x-auto">
            <table className="steward-table min-w-full text-left text-sm">
              <thead className="text-meta">
                <tr>
                  <th className="px-4 py-3 font-isl-body text-[0.75rem] font-semibold uppercase tracking-[0.2em]">Case</th>
                  <th className="px-4 py-3 font-isl-body text-[0.75rem] font-semibold uppercase tracking-[0.2em]">Season</th>
                  <th className="px-4 py-3 font-isl-body text-[0.75rem] font-semibold uppercase tracking-[0.2em]">Round</th>
                  <th className="px-4 py-3 font-isl-body text-[0.75rem] font-semibold uppercase tracking-[0.2em]">Session</th>
                  <th className="px-4 py-3 font-isl-body text-[0.75rem] font-semibold uppercase tracking-[0.2em]">Drivers</th>
                  <th className="px-4 py-3 font-isl-body text-[0.75rem] font-semibold uppercase tracking-[0.2em]">Decision</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {historicalCases.map(({ caseItem, verdict, driverVerdicts }) => (
                  <tr key={caseItem.id} className="border-t border-[color:var(--isl-hairline)]">
                    <td className="px-4 py-3 text-ink max-w-[200px] truncate">{caseItem.title}</td>
                    <td className="px-4 py-3 num text-ink-2">{caseItem.season}</td>
                    <td className="px-4 py-3 num text-ink-2">{caseItem.round}</td>
                    <td className="px-4 py-3 text-ink-2">{caseItem.weekendSession}</td>
                    <td className="px-4 py-3 text-meta text-xs">
                      {driverVerdicts.map((dv) => {
                        const name = allUsers.find((u) => u.id === dv.driverId)?.name ?? dv.driverId;
                        const chips = [
                          dv.license_points ? `${dv.license_points}pts` : null,
                          dv.time_penalty_seconds ? `${dv.time_penalty_seconds}s` : null,
                          dv.warning_text ? "warn" : null,
                        ].filter(Boolean).join(", ");
                        return (
                          <div key={dv.id}>{name}{chips ? ` — ${chips}` : ""}</div>
                        );
                      })}
                    </td>
                    <td className="px-4 py-3 text-faint text-xs">{verdict?.verdict_decision ?? "—"}</td>
                    <td className="px-4 py-3">
                      <EditHistoricalCaseModal
                        caseItem={caseItem}
                        verdict={verdict}
                        driverVerdicts={driverVerdicts}
                        drivers={memberDrivers}
                        seasonRoundOptions={seasonRoundOptions}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {isAdmin && <HistoricalPenaltyForm drivers={memberDrivers} seasonRoundOptions={seasonRoundOptions} />}
    </div>
  );
}
