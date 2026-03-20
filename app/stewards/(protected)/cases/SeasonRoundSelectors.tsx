"use client";

import { useEffect, useMemo, useState } from "react";

type RoundOption = { value: string; label: string };
type SeasonOption = { value: string; label: string; rounds: RoundOption[] };

export default function SeasonRoundSelectors({ options }: { options: SeasonOption[] }) {
  const firstSeason = options[0]?.value ?? "";
  const [season, setSeason] = useState(firstSeason);
  const [session, setSession] = useState<"Qualifying" | "Race">("Race");

  useEffect(() => setSeason(firstSeason), [firstSeason]);
  const rounds = useMemo(
    () => options.find((o) => o.value === season)?.rounds ?? [],
    [options, season],
  );

  return (
    <>
      <label className="block">
        <span className="mb-1 block text-sm text-white/80">Season <span className="text-red-400">*</span></span>
        <select name="season" required value={season} onChange={(e) => setSeason(e.target.value)} className="w-full rounded-lg border border-white/15 bg-black/30 px-3 py-2">
          {options.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
      </label>
      <label className="block">
        <span className="mb-1 block text-sm text-white/80">Round <span className="text-red-400">*</span></span>
        <select name="round" required disabled={rounds.length === 0} className="w-full rounded-lg border border-white/15 bg-black/30 px-3 py-2">
          {rounds.length ? rounds.map((r) => <option key={r.value} value={r.value}>{r.label}</option>) : <option value="">No rounds available</option>}
        </select>
      </label>
      <label className="block md:col-span-2">
        <span className="mb-1 block text-sm text-white/80">Weekend session <span className="text-red-400">*</span></span>
        <select name="weekend_session" required value={session} onChange={(e) => setSession(e.target.value === "Qualifying" ? "Qualifying" : "Race")} className="w-full rounded-lg border border-white/15 bg-black/30 px-3 py-2">
          <option value="Qualifying">Qualifying</option>
          <option value="Race">Race</option>
        </select>
      </label>
      {session === "Race" ? (
        <label className="block md:col-span-2">
          <span className="mb-1 block text-sm text-white/80">Incident lap number <span className="text-red-400">*</span></span>
          <input type="number" name="incident_lap_number" min={1} required className="w-full rounded-lg border border-white/15 bg-black/30 px-3 py-2" />
        </label>
      ) : (
        <label className="block md:col-span-2">
          <span className="mb-1 block text-sm text-white/80">Time left to qualifying session <span className="text-red-400">*</span></span>
          <input type="text" name="qualifying_time" required dir="ltr" placeholder="e.g. 15:32" className="w-full rounded-lg border border-white/15 bg-black/30 px-3 py-2" />
        </label>
      )}
    </>
  );
}
