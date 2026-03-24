import Link from "next/link";
import { createComplaintAction } from "@/app/stewards/actions";
import { can, canCreateComplaint, hasRole, requireStewardUser } from "@/lib/stewards/auth";
import { getCaseById, listCases, listUsers } from "@/lib/stewards/repository";
import { fetchCsv, parseCsv } from "@/lib/csv";
import { GLOBAL_CSV_URLS } from "@/lib/seasonConfig";
import { mapRaceEvents, toIsraelTimestamp } from "@/lib/scheduleData";
import AttachmentFilePicker from "@/app/stewards/(protected)/cases/AttachmentFilePicker";
import EvidencePasteBox from "@/app/stewards/(protected)/cases/EvidencePasteBox";
import CreateComplaintPanel from "@/app/stewards/(protected)/cases/CreateComplaintPanel";
import DeleteCaseForm from "@/app/stewards/(protected)/cases/DeleteCaseForm";
import InvolvedDriversPicker from "@/app/stewards/(protected)/cases/InvolvedDriversPicker";
import SeasonRoundSelectors from "@/app/stewards/(protected)/cases/SeasonRoundSelectors";
import SubmitComplaintButton from "@/app/stewards/(protected)/cases/SubmitComplaintButton";
import ViewToggle from "@/app/stewards/(protected)/cases/ViewToggle";

type SearchParams = Promise<{ error?: string; view?: "driver" | "steward"; open?: string }>;

export default async function StewardCasesPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const error = params.error ?? "";
  const forceOpen = params.open === "1";
  const user = await requireStewardUser();
  const isAdmin = can(user, "manage_users");
  const hasDriverRole = hasRole(user, "member");
  const hasStewardRole = can(user, "view_internal_discussion");
  const hasDual = hasDriverRole && hasStewardRole;
  const view: "driver" | "steward" = hasDual
    ? params.view === "driver"
      ? "driver"
      : "steward"
    : hasDriverRole
      ? "driver"
      : "steward";

  const cases = await listCases();
  const users = await listUsers();
  const memberOptions = users
    .filter((u) => u.roles.includes("member"))
    .map((u) => ({ id: u.id, name: u.name, email: u.email }));
  const seasonRoundOptions = await getSeasonRoundOptions();

  const myCases   = cases.filter((c) => c.complainantId === user.id || c.involvedDriverIds.includes(user.id));
  const openMy    = myCases.filter((c) => c.status !== "Closed" && c.status !== "Archived");
  const closedMy  = myCases.filter((c) => c.status === "Closed" || c.status === "Archived");
  const otherCases = cases.filter((c) => c.complainantId !== user.id && !c.involvedDriverIds.includes(user.id));

  const openDetails  = await Promise.all(openMy.map((c) => getCaseById(c.id)));
  const otherDetails = await Promise.all(closedMy.map((c) => getCaseById(c.id)));
  const allOtherDetails = await Promise.all(otherCases.map((c) => getCaseById(c.id)));

  return (
    <div className="space-y-6">
      <section className="steward-panel rounded-2xl p-5">
        <h2 className="font-display text-2xl font-semibold">Cases</h2>
        <p className="mt-1 text-white/70">Complaints are visible immediately to all authorized module users.</p>
      </section>

      {canCreateComplaint(user.roles) && view === "driver" && (
        <CreateComplaintPanel initiallyOpen={forceOpen || error === "missing-fields" || error === "evidence-required"}>
          {seasonRoundOptions.length === 0 ? (
            <div className="flex items-start gap-3 rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-4">
              <span className="mt-0.5 text-lg leading-none">⏱</span>
              <div>
                <p className="font-semibold text-amber-200">Complaint window closed</p>
                <p className="mt-1 text-sm text-amber-200/70">
                  Complaints can only be submitted within <strong>48 hours</strong> of a race starting.
                  No races from the last 3 days are on the schedule — check back after the next race.
                </p>
              </div>
            </div>
          ) : (
          <>
          <p className="text-xs text-white/60"><span className="text-red-400">*</span> indicates mandatory fields.</p>
          {(error === "missing-fields" || error === "evidence-required") && (
            <div className="mt-3 rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-100">
              {error === "evidence-required"
                ? "At least one evidence item is required: upload attachment or add text/link in Evidence box."
                : "All mandatory fields must be filled before submit."}
            </div>
          )}
          <form action={createComplaintAction} className="mt-4 grid gap-3 md:grid-cols-2">
            <SeasonRoundSelectors options={seasonRoundOptions} />
            <InvolvedDriversPicker options={memberOptions} />
            <label className="block md:col-span-2">
              <span className="mb-1 block text-sm text-white/80">Description <span className="text-red-400">*</span></span>
              <textarea name="description" required rows={5} lang="he" dir="rtl" className="w-full rounded-lg border border-white/15 bg-black/30 px-3 py-2 text-right" />
            </label>
            <div className="md:col-span-2 rounded-xl border border-steward-gold/25 bg-black/20 p-4">
              <h4 className="text-sm font-semibold uppercase tracking-wide text-steward-gold">Evidence <span className="text-red-400">*</span></h4>
              <p className="mt-1 text-xs text-white/60">Attach files, paste screenshots, or add links/notes. At least one item is required.</p>
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                {/* screenshot paste + drag-drop zone */}
                <EvidencePasteBox />
                <div className="space-y-3">
                  <AttachmentFilePicker />
                  <label className="block">
                    <span className="mb-1 block text-sm text-white/80">Links / notes (one per line)</span>
                    <textarea name="evidence_items" rows={4} lang="he" dir="rtl" className="w-full rounded-lg border border-white/15 bg-black/30 px-3 py-2 text-right" />
                  </label>
                </div>
              </div>
            </div>
            <div className="md:col-span-2"><SubmitComplaintButton /></div>
          </form>
          </>
          )}
        </CreateComplaintPanel>
      )}

      {view === "driver" ? (
        <div className="relative">
          {hasDual && (
            <div className="absolute -top-5 right-5 z-10">
              <ViewToggle
                view={view}
                driverHref="/stewards/cases?view=driver"
                stewardHref="/stewards/cases?view=steward"
              />
            </div>
          )}
        <section className="steward-panel space-y-3 rounded-2xl p-5 pt-8">
          <h3 className="text-lg font-semibold">My Open Cases</h3>
          {openDetails.length === 0 && <div className="steward-soft rounded-lg px-4 py-3 text-sm text-white/60">No open cases currently involve you.</div>}
          {openDetails.map((entry) => entry && (
            <Link key={entry.caseItem.id} href={`/stewards/cases/${entry.caseItem.id}?view=driver`} className="steward-soft group flex items-center justify-between gap-3 rounded-xl px-4 py-3 transition hover:border-steward-gold/50">
              <div>
                <p className="font-semibold text-white/90 group-hover:text-white">
                  <span className="mr-2 font-mono text-steward-gold/70">#{entry.caseItem.caseNumber ?? "–"}</span>
                  {entry.caseItem.title}
                </p>
                <p className="mt-0.5 text-xs text-white/50">{entry.caseItem.season} · {entry.caseItem.round} · {entry.caseItem.weekendSession}</p>
              </div>
              <div className="flex items-center gap-3">
                <StatusChip status={entry.caseItem.status} />
                <span className="text-xs text-steward-gold/70 group-hover:text-steward-gold">Open →</span>
              </div>
            </Link>
          ))}

          <div className="border-t border-white/10 pt-3">
            <h3 className="text-lg font-semibold">My Closed Cases</h3>
          </div>
          {otherDetails.length === 0 && <div className="steward-soft rounded-lg px-4 py-3 text-sm text-white/60">No closed cases found.</div>}
          {otherDetails.map((entry) => entry && (
            <Link key={entry.caseItem.id} href={`/stewards/cases/${entry.caseItem.id}?view=driver`} className="steward-soft group flex items-center justify-between gap-3 rounded-xl px-4 py-3 transition hover:border-steward-gold/50">
              <div>
                <p className="font-semibold text-white/70 group-hover:text-white/90">
                  <span className="mr-2 font-mono text-steward-gold/50">#{entry.caseItem.caseNumber ?? "–"}</span>
                  {entry.caseItem.title}
                </p>
                <p className="mt-0.5 text-xs text-white/40">{entry.caseItem.season} · {entry.caseItem.round} · {entry.caseItem.weekendSession}</p>
              </div>
              <div className="flex items-center gap-3">
                <StatusChip status={entry.caseItem.status} />
                <span className="text-xs text-white/30 group-hover:text-white/60">Open →</span>
              </div>
            </Link>
          ))}

          {allOtherDetails.length > 0 && (
            <>
              <div className="border-t border-white/10 pt-3">
                <h3 className="text-lg font-semibold">All Cases</h3>
                <p className="text-xs text-white/50">Cases you are not directly involved in</p>
              </div>
              {allOtherDetails.map((entry) => entry && (
                <Link key={entry.caseItem.id} href={`/stewards/cases/${entry.caseItem.id}?view=driver`} className="steward-soft group flex items-center justify-between gap-3 rounded-xl px-4 py-3 opacity-80 transition hover:border-steward-gold/40 hover:opacity-100">
                  <div>
                    <p className="font-semibold text-white/65 group-hover:text-white/90">
                      <span className="mr-2 font-mono text-steward-gold/45">#{entry.caseItem.caseNumber ?? "–"}</span>
                      {entry.caseItem.title}
                    </p>
                    <p className="mt-0.5 text-xs text-white/35">{entry.caseItem.season} · {entry.caseItem.round} · {entry.caseItem.weekendSession}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <StatusChip status={entry.caseItem.status} />
                    <span className="text-xs text-white/25 group-hover:text-white/50">View →</span>
                  </div>
                </Link>
              ))}
            </>
          )}
        </section>
        </div>
      ) : (
        <div className="relative">
          {hasDual && (
            <div className="absolute -top-5 right-5 z-10">
              <ViewToggle
                view={view}
                driverHref="/stewards/cases?view=driver"
                stewardHref="/stewards/cases?view=steward"
              />
            </div>
          )}
        <section className="steward-panel overflow-hidden rounded-2xl pt-8">
          <div className="overflow-x-auto">
            <table className="steward-table min-w-full text-left text-sm">
              <thead className="bg-white/5 text-white/80">
                <tr>
                  <th className="px-4 py-3 w-12 text-center">#</th><th className="px-4 py-3">Case</th><th className="px-4 py-3">Season</th><th className="px-4 py-3">Round</th><th className="px-4 py-3">Session</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Created</th>{isAdmin && <th className="px-4 py-3">Actions</th>}
                </tr>
              </thead>
              <tbody>
                {cases.map((item) => {
                  const needsReview   = item.status === "Under Review";
                  const verdictReady  = item.status === "Verdict Ready";
                  const rowCls = needsReview
                    ? "border-t border-purple-500/40 bg-purple-500/10"
                    : verdictReady
                      ? "border-t border-emerald-500/30 bg-emerald-500/8"
                      : "border-t border-white/10";
                  return (
                  <tr key={item.id} className={rowCls}>
                    <td className="px-4 py-3 text-center font-mono text-sm text-steward-gold/60 w-12">
                      {item.caseNumber ?? "–"}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Link href={`/stewards/cases/${item.id}?view=steward`} className="text-[#d4afff] hover:text-white">{item.title}</Link>
                        {needsReview && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-purple-500/25 border border-purple-400/60 px-2 py-0.5 text-[9px] font-bold uppercase tracking-widest text-purple-200">
                            <span className="relative flex h-1.5 w-1.5"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-purple-300 opacity-70" /><span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-purple-300" /></span>
                            Review Now
                          </span>
                        )}
                        {verdictReady && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/20 border border-emerald-400/50 px-2 py-0.5 text-[9px] font-bold uppercase tracking-widest text-emerald-200">
                            <span className="relative flex h-1.5 w-1.5"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-300 opacity-70" /><span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-300" /></span>
                            Publish Verdict
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">{item.season}</td>
                    <td className="px-4 py-3">{item.round}</td>
                    <td className="px-4 py-3">{item.weekendSession}</td>
                    <td className="px-4 py-3"><StatusChip status={item.status} /></td>
                    <td className="px-4 py-3">{new Date(item.createdAt).toLocaleString()}</td>
                    {isAdmin && <td className="px-4 py-3"><DeleteCaseForm caseId={item.id} redirectTo="/stewards/cases?view=steward" className="rounded-full border border-red-500/50 px-3 py-1.5 text-xs text-red-200 hover:bg-red-500/15" /></td>}
                  </tr>
                  );
                })}
                {cases.length === 0 && <tr><td className="px-4 py-5 text-white/60" colSpan={isAdmin ? 8 : 7}>No cases yet.</td></tr>}
              </tbody>
            </table>
          </div>
        </section>
        </div>
      )}
    </div>
  );
}


const STATUS_CHIP: Record<string, string> = {
  "Open":                 "bg-amber-400/20 text-amber-200 border-amber-400/50",
  "Waiting for Response": "bg-blue-400/20  text-blue-200  border-blue-400/50",
  "Under Review":         "bg-purple-400/20 text-purple-200 border-purple-400/50",
  "Verdict Ready":        "bg-emerald-400/20 text-emerald-200 border-emerald-400/50",
  "Closed":               "bg-green-500/20 text-green-200 border-green-500/50",
  "Archived":             "bg-white/10 text-white/50 border-white/20",
};

function StatusChip({ status }: { status: string }) {
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${STATUS_CHIP[status] ?? STATUS_CHIP["Open"]}`}>
      {status}
    </span>
  );
}

const COMPLAINT_WINDOW_MS = 3 * 24 * 60 * 60 * 1000; // 3 days

type SeasonRoundOption = { value: string; label: string; rounds: { value: string; label: string }[] };

/**
 * Returns only rounds whose race start time falls within the complaint window
 * (between now-3days and now).  When no races are in-window the array is empty.
 */
async function getSeasonRoundOptions(): Promise<SeasonRoundOption[]> {
  try {
    const csv = await fetchCsv(GLOBAL_CSV_URLS.schedule);
    const events = mapRaceEvents(parseCsv<Record<string, string>>(csv));

    const now = Date.now();
    const windowStart = now - COMPLAINT_WINDOW_MS;

    // Keep only events whose start timestamp is within [windowStart, now]
    const eligible = events.filter((e) => {
      if (!(e.season ?? "").trim()) return false;
      const ts = toIsraelTimestamp(e.date, e.start_time ?? undefined);
      if (ts === null) return false;
      return ts >= windowStart && ts <= now;
    });

    const bySeason = new Map<string, { value: string; label: string }[]>();
    for (const e of eligible) {
      const season = e.season.trim();
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
