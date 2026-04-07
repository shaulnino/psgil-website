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
import { DriverCasesList, StewardCasesTable } from "@/app/stewards/(protected)/cases/CasesListClient";
import type { CaseRow, StewardCaseRow } from "@/app/stewards/(protected)/cases/CasesListClient";

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

  const openDetails     = await Promise.all(openMy.map((c) => getCaseById(c.id)));
  const closedDetails   = await Promise.all(closedMy.map((c) => getCaseById(c.id)));
  const allOtherDetails = await Promise.all(otherCases.map((c) => getCaseById(c.id)));

  // Serialise to plain objects for the client components
  const toRow = (entry: Awaited<ReturnType<typeof getCaseById>>, href: string): CaseRow | null => {
    if (!entry) return null;
    const c = entry.caseItem;
    return { id: c.id, caseNumber: c.caseNumber ?? null, title: c.title, season: c.season, round: c.round, weekendSession: c.weekendSession, status: c.status, createdAt: c.createdAt, href };
  };

  const openRows   = openDetails.flatMap((e) => { const r = toRow(e, `/stewards/cases/${e?.caseItem.id}?view=driver`); return r ? [r] : []; });
  const closedRows = closedDetails.flatMap((e) => { const r = toRow(e, `/stewards/cases/${e?.caseItem.id}?view=driver`); return r ? [r] : []; });
  const otherRows  = allOtherDetails.flatMap((e) => { const r = toRow(e, `/stewards/cases/${e?.caseItem.id}?view=driver`); return r ? [r] : []; });

  const stewardRows: StewardCaseRow[] = cases.map((item) => ({
    id: item.id,
    caseNumber: item.caseNumber ?? null,
    title: item.title,
    season: item.season,
    round: item.round,
    weekendSession: item.weekendSession,
    status: item.status,
    createdAt: item.createdAt,
    href: `/stewards/cases/${item.id}?view=steward`,
    needsReview: item.status === "Under Review",
    verdictReady: item.status === "Verdict Ready",
    isAdmin,
  }));

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
          <section className="steward-panel rounded-2xl p-5 pt-8">
            <DriverCasesList
              openCases={openRows}
              closedCases={closedRows}
              otherCases={otherRows}
            />
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
            <StewardCasesTable
              cases={stewardRows}
              isAdmin={isAdmin}
            />
          </section>
        </div>
      )}
    </div>
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
