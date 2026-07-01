"use client";

import { useEffect, useMemo, useState } from "react";
import type { WeekendSession } from "@/lib/stewards/types";

type RoundOption = { value: string; label: string };
type SeasonOption = { value: string; label: string; rounds: RoundOption[] };

export default function SeasonRoundSelectors({ options }: { options: SeasonOption[] }) {
  const firstSeason = options[0]?.value ?? "";
  const [season, setSeason] = useState(firstSeason);
  const [session, setSession] = useState<WeekendSession>("Race");

  useEffect(() => setSeason(firstSeason), [firstSeason]);
  const rounds = useMemo(
    () => options.find((o) => o.value === season)?.rounds ?? [],
    [options, season],
  );

  return (
    <>
      <label className="block">
        <span className="mb-1 block text-sm text-ink-2">Season <span className="text-status-danger">*</span></span>
        <select name="season" required value={season} onChange={(e) => setSeason(e.target.value)} className="w-full rounded-[2px] border border-[color:var(--isl-hairline)] bg-paper px-3 py-2 text-ink placeholder:text-faint focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--isl-oxblood)]">
          {options.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
      </label>
      <label className="block">
        <span className="mb-1 block text-sm text-ink-2">Round <span className="text-status-danger">*</span></span>
        <select name="round" required disabled={rounds.length === 0} className="w-full rounded-[2px] border border-[color:var(--isl-hairline)] bg-paper px-3 py-2 text-ink placeholder:text-faint focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--isl-oxblood)]">
          {rounds.length ? rounds.map((r) => <option key={r.value} value={r.value}>{r.label}</option>) : <option value="">No rounds available</option>}
        </select>
      </label>
      <label className="block md:col-span-2">
        <span className="mb-1 block text-sm text-ink-2">Weekend session <span className="text-status-danger">*</span></span>
        <select name="weekend_session" required value={session} onChange={(e) => setSession(e.target.value as WeekendSession)} className="w-full rounded-[2px] border border-[color:var(--isl-hairline)] bg-paper px-3 py-2 text-ink placeholder:text-faint focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--isl-oxblood)]">
          <option value="Race">Race</option>
          <option value="Sprint">Sprint</option>
          <option value="Qualifying">Qualifying</option>
        </select>
      </label>
      {session === "Race" || session === "Sprint" ? (
        <label className="block md:col-span-2">
          <span className="mb-1 block text-sm text-ink-2">Incident lap number <span className="text-status-danger">*</span></span>
          <input type="number" name="incident_lap_number" min={1} required className="w-full rounded-[2px] border border-[color:var(--isl-hairline)] bg-paper px-3 py-2 text-ink placeholder:text-faint focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--isl-oxblood)]" />
        </label>
      ) : (
        <label className="block md:col-span-2">
          <span className="mb-1 block text-sm text-ink-2">Time left to qualifying session <span className="text-status-danger">*</span></span>
          <input type="text" name="qualifying_time" required dir="ltr" placeholder="e.g. 15:32" className="w-full rounded-[2px] border border-[color:var(--isl-hairline)] bg-paper px-3 py-2 text-ink placeholder:text-faint focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--isl-oxblood)]" />
        </label>
      )}
    </>
  );
}
