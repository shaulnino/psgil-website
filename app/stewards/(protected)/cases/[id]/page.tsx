import Link from "next/link";
import { notFound } from "next/navigation";
import {
  addInternalCommentAction,
  publishVerdictAction,
  submitCaseResponseAction,
  updateCaseStatusAction,
} from "@/app/stewards/actions";
import FormActionButton from "@/app/stewards/components/FormActionButton";
import AttachmentFilePicker from "@/app/stewards/(protected)/cases/AttachmentFilePicker";
import DeleteCaseForm from "@/app/stewards/(protected)/cases/DeleteCaseForm";
import EvidencePasteBox from "@/app/stewards/(protected)/cases/EvidencePasteBox";
import SubmissionToast from "@/app/stewards/(protected)/cases/SubmissionToast";
import ViewToggle from "@/app/stewards/(protected)/cases/ViewToggle";
import VerdictForm from "@/app/stewards/(protected)/cases/[id]/VerdictForm";
import { can, canCommentInternally, hasRole, requireStewardUser } from "@/lib/stewards/auth";
import { getCaseById, getAppealByOriginalCaseId, isAppealWindowOpen, listUsers } from "@/lib/stewards/repository";
import AppealSubmitModal from "@/app/stewards/components/AppealSubmitModal";
import type { AttachmentRef, CaseStatus, VerdictDecision } from "@/lib/stewards/types";

const STATUSES: CaseStatus[] = [
  "Open", "Waiting for Response", "Under Review",
  "Verdict Ready", "Closed", "Archived",
];

const STATUS_STYLE: Record<CaseStatus, string> = {
  "Open":                  "bg-amber-400/20 text-amber-200 border-amber-400/60",
  "Waiting for Response":  "bg-blue-400/20  text-blue-200  border-blue-400/60",
  "Under Review":          "bg-purple-400/20 text-purple-200 border-purple-400/60",
  "Verdict Ready":         "bg-emerald-400/20 text-emerald-200 border-emerald-400/60",
  "Closed":                "bg-green-500/20 text-green-200 border-green-500/60",
  "Archived":              "bg-white/10 text-white/50 border-white/20",
};

export default async function StewardCaseDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ submitted?: string; view?: "driver" | "steward" }>;
}) {
  const user = await requireStewardUser();
  const { id } = await params;
  const query = await searchParams;
  const data = await getCaseById(id);
  if (!data) notFound();

  const { caseItem, complainant, involvedDrivers, responses, internalComments, verdict, driverVerdicts } = data;
  const [allUsers, existingAppeal] = await Promise.all([
    listUsers(),
    getAppealByOriginalCaseId(id),
  ]);
  const appealWindowOpen = isAppealWindowOpen(caseItem.closedAt, verdict?.published_at);
  const appealAnchor = caseItem.closedAt ?? verdict?.published_at ?? null;
  const appealHoursRemaining = appealAnchor
    ? Math.max(0, Math.ceil((new Date(appealAnchor).getTime() + 36 * 60 * 60 * 1000 - Date.now()) / (60 * 60 * 1000)))
    : 0;
  const canAppeal =
    verdict?.is_published &&
    caseItem.status === "Closed" &&
    appealWindowOpen &&
    !existingAppeal &&
    (caseItem.complainantId === user.id || caseItem.involvedDriverIds.includes(user.id));
  // Only involved drivers submit statements — complainant's side is already the complaint itself
  const participantIds = [...new Set(caseItem.involvedDriverIds)];
  const isInvolved = caseItem.involvedDriverIds.includes(user.id);
  const alreadyResponded = responses.some((r) => r.userId === user.id);
  const hasDriverRole = hasRole(user, "member");
  const hasStewardRole = can(user, "view_internal_discussion");
  const hasDual = hasDriverRole && hasStewardRole;
  const view: "driver" | "steward" = hasDual
    ? query.view === "driver" ? "driver" : "steward"
    : hasDriverRole ? "driver" : "steward";

  const canInternal    = view === "steward" && canCommentInternally(user.roles);
  const canEditVerdict = view === "steward" && can(user, "edit_verdict");
  const canRemoveCase  = view === "steward" && can(user, "delete_case");

  const stepDone = (step: 1 | 2 | 3) => {
    if (step === 1) return true;
    if (step === 2) return responses.length > 0;
    if (step === 3) return !!verdict?.is_published;
    return false;
  };

  return (
    <div className="space-y-5">
      {query.submitted === "1" && <SubmissionToast />}

      {/* ── CASE HEADER STRIP ─────────────────────────────────── */}
      <div className="steward-panel relative overflow-hidden rounded-2xl p-6">
        {/* gold accent top-bar already handled by steward-panel::after */}

        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline gap-3">
              <span className="font-mono text-lg font-semibold text-[#D4AF37]/60">#{caseItem.caseNumber ?? "–"}</span>
              <h1 className="font-display text-3xl font-bold leading-tight tracking-wide text-[#f4d98a] drop-shadow-[0_0_14px_rgba(212,175,55,0.25)]">
                {caseItem.title}
              </h1>
            </div>

            {/* meta row */}
            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-white/60">
              <span>{caseItem.season}</span>
              <span className="text-white/25">·</span>
              <span>{caseItem.round}</span>
              <span className="text-white/25">·</span>
              <span>{caseItem.weekendSession}</span>
              {caseItem.weekendSession === "Race" && caseItem.incidentLapNumber && (
                <>
                  <span className="text-white/25">·</span>
                  <span>Lap {caseItem.incidentLapNumber}</span>
                </>
              )}
              {caseItem.weekendSession === "Qualifying" && caseItem.qualifyingTime && (
                <>
                  <span className="text-white/25">·</span>
                  <span>{caseItem.qualifyingTime} remaining</span>
                </>
              )}
              <span className="text-white/25">·</span>
              <span>{new Date(caseItem.createdAt).toLocaleDateString()}</span>
            </div>

            {/* status badge row */}
            <div className="mt-3">
              <span className={`inline-flex items-center rounded-full border px-3 py-1 text-[11px] font-bold uppercase tracking-widest ${STATUS_STYLE[caseItem.status] ?? STATUS_STYLE["Open"]}`}>
                {caseItem.status}
              </span>
            </div>

            {/* parties row — prominent */}
            <div className="mt-4 flex flex-wrap gap-3">
              {/* complainant */}
              <div className="flex items-center gap-2.5 rounded-xl border border-[#D4AF37]/40 bg-[#D4AF37]/10 px-4 py-2.5">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-[#D4AF37]/50 bg-[#D4AF37]/20 text-xs font-bold text-[#f4d98a]">↑</span>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-[#D4AF37]/70">Complainant</p>
                  <p className="text-sm font-semibold text-[#f4d98a]">{complainant?.name ?? "Unknown"}</p>
                </div>
              </div>

              {/* involved drivers */}
              {involvedDrivers.map((d) => (
                <div key={d.id} className="flex items-center gap-2.5 rounded-xl border border-white/20 bg-white/5 px-4 py-2.5">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-white/25 bg-white/10 text-xs font-bold text-white/70">▣</span>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-white/45">Involved</p>
                    <p className="text-sm font-semibold text-white/90">{d.name}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* right: toggle + admin remove */}
          <div className="flex flex-col items-end gap-3">
            {hasDual && (
              <ViewToggle
                view={view}
                driverHref={`/stewards/cases/${caseItem.id}?view=driver`}
                stewardHref={`/stewards/cases/${caseItem.id}?view=steward`}
              />
            )}
            {canRemoveCase && (
              <DeleteCaseForm
                caseId={caseItem.id}
                redirectTo="/stewards/cases?view=steward"
                idleLabel="Remove Case"
                className="rounded-full border border-red-500/40 px-3 py-1.5 text-xs text-red-300 transition hover:bg-red-500/15"
              />
            )}
          </div>
        </div>
      </div>

      {/* ── DRIVER VIEW: TIMELINE ──────────────────────────────── */}
      {view === "driver" && (
        <div className="relative pl-10">
          {/* vertical timeline spine */}
          <div className="absolute left-3.5 top-0 h-full w-px bg-gradient-to-b from-[#D4AF37]/60 via-[#D4AF37]/20 to-transparent" />

          {/* ── STEP 1: COMPLAINT ──────────────────────────────── */}
          <TimelineStep number={1} label="Complaint" done={stepDone(1)}>
            <div className="grid gap-5 md:grid-cols-[200px_1fr]">
              {/* left: parties */}
              <div className="space-y-3">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-[#D4AF37]/70">Complainant</p>
                  <p className="mt-1 text-sm font-medium text-white/90">{complainant?.name ?? "Unknown"}</p>
                </div>
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-[#D4AF37]/70">Involved drivers</p>
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    {involvedDrivers.map((d) => (
                      <span key={d.id} className="rounded-full border border-white/20 bg-white/5 px-2 py-0.5 text-xs text-white/80">
                        {d.name}
                      </span>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-[#D4AF37]/70">Session</p>
                  <p className="mt-1 text-sm text-white/70">{caseItem.weekendSession}</p>
                </div>
              </div>

              {/* right: description */}
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-widest text-[#D4AF37]/70">Incident description</p>
                <p className="mt-2 whitespace-pre-wrap leading-relaxed text-white/85" dir="auto" lang="he">
                  {caseItem.description}
                </p>
              </div>
            </div>

            {/* evidence gallery */}
            {(caseItem.attachments.length > 0 || caseItem.links.length > 0) && (
              <div className="mt-5 border-t border-white/10 pt-4">
                <p className="mb-3 text-[10px] font-semibold uppercase tracking-widest text-[#D4AF37]/70">Evidence</p>
                <EvidenceGallery attachments={caseItem.attachments} links={caseItem.links} />
              </div>
            )}
          </TimelineStep>

          {/* ── STEP 2: DRIVER STATEMENTS ──────────────────────── */}
          <TimelineStep number={2} label="Driver Statements" done={stepDone(2)}>
            <p className="mb-4 text-xs text-white/45">
              Each driver involved in this incident submits one statement. Statements are final once submitted.
            </p>

            <div className="space-y-3">
              {participantIds.map((pid) => {
                const driver = involvedDrivers.find((d) => d.id === pid) ?? null;
                const driverName = driver?.name ?? pid;
                const statement = responses.find((r) => r.userId === pid);
                const isMe = pid === user.id;

                return (
                  <div key={pid} className="overflow-hidden rounded-xl border border-white/10 bg-black/20">
                    {/* driver row header */}
                    <div className="flex items-center justify-between gap-2 border-b border-white/8 bg-white/3 px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-white/85">{driverName}</span>
                        {isMe && (
                          <span className="rounded-full border border-white/20 bg-white/5 px-2 py-0.5 text-[10px] text-white/50">
                            you
                          </span>
                        )}
                      </div>
                      {statement ? (
                        <span className="flex items-center gap-1 text-[10px] text-emerald-400/80">
                          <span>✓</span> Submitted {new Date(statement.createdAt).toLocaleDateString()}
                        </span>
                      ) : (
                        <span className="text-[10px] text-white/35">Pending</span>
                      )}
                    </div>

                    {/* statement body */}
                    {statement ? (
                      <div className="px-4 py-3 space-y-3">
                        <p className="whitespace-pre-wrap leading-relaxed text-white/85" dir="auto" lang="he">
                          {statement.text}
                        </p>
                        {(statement.attachments.length > 0 || statement.links.length > 0) && (
                          <div className="border-t border-white/10 pt-3">
                            <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-[#D4AF37]/60">Evidence</p>
                            <EvidenceGallery attachments={statement.attachments} links={statement.links} />
                          </div>
                        )}
                      </div>
                    ) : isMe ? (
                      <div className="px-4 py-4">
                        <form action={submitCaseResponseAction} className="space-y-4">
                          <input type="hidden" name="case_id" value={caseItem.id} />
                          <textarea
                            name="text"
                            required
                            rows={4}
                            lang="he"
                            dir="rtl"
                            placeholder="Write your statement here. This cannot be edited once submitted."
                            className="w-full rounded-lg border border-white/15 bg-black/30 px-3 py-2.5 text-right leading-relaxed text-white/85 placeholder:text-white/25 focus:border-[#D4AF37]/50 focus:outline-none transition"
                          />
                          {/* Evidence — same capabilities as complaint form */}
                          <div className="rounded-xl border border-[#D4AF37]/20 bg-black/20 p-4">
                            <h4 className="text-xs font-semibold uppercase tracking-wide text-[#D4AF37]/80">
                              Evidence <span className="font-normal normal-case text-white/40">(optional)</span>
                            </h4>
                            <p className="mt-1 text-xs text-white/50">Attach files, paste screenshots, or add links to support your statement.</p>
                            <div className="mt-3 grid gap-4 md:grid-cols-2">
                              <EvidencePasteBox />
                              <div className="space-y-3">
                                <AttachmentFilePicker />
                                <label className="block">
                                  <span className="mb-1 block text-xs text-white/70">Links / notes (one per line)</span>
                                  <textarea
                                    name="evidence_items"
                                    rows={3}
                                    lang="he"
                                    dir="rtl"
                                    className="w-full rounded-lg border border-white/15 bg-black/30 px-3 py-2 text-right text-sm"
                                  />
                                </label>
                              </div>
                            </div>
                          </div>
                          <FormActionButton
                            idleLabel="Submit Statement"
                            loadingLabel="Submitting..."
                            className="w-fit rounded-full bg-[#7020B0] px-5 py-2 text-sm font-semibold shadow-[0_0_14px_rgba(112,32,176,0.3)] transition hover:bg-[#7c2ac3]"
                          />
                        </form>
                      </div>
                    ) : (
                      <div className="px-4 py-3">
                        <p className="text-sm text-white/35 italic">No statement submitted yet.</p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </TimelineStep>

          {/* ── STEP 3: VERDICT ────────────────────────────────── */}
          <TimelineStep number={3} label="Verdict" done={stepDone(3)} isLast>
            {verdict?.is_published ? (
              <div className="space-y-4">
                {/* per-driver penalty blocks */}
                {driverVerdicts.length > 0 && (
                  <div className="space-y-3">
                    {driverVerdicts.map((dv) => (
                      <div key={dv.id} className="overflow-hidden rounded-xl border border-white/10 bg-black/20">
                        <div className="border-b border-white/8 bg-[#D4AF37]/8 px-4 py-2">
                          <span className="text-sm font-semibold text-[#f4d98a]">{dv.driver?.name ?? dv.driverId}</span>
                        </div>
                        <div className="flex flex-wrap gap-2 px-4 py-3">
                          {dv.license_points != null && dv.license_points > 0 && (
                            <span className="inline-flex items-center gap-1.5 rounded-full border border-orange-400/50 bg-orange-400/15 px-3 py-1.5 text-xs font-bold text-orange-200">
                              ● +{dv.license_points} License Point{dv.license_points !== 1 ? "s" : ""}
                            </span>
                          )}
                          {dv.time_penalty_seconds != null && dv.time_penalty_seconds > 0 && (
                            <span className="inline-flex items-center gap-1.5 rounded-full border border-blue-400/50 bg-blue-400/15 px-3 py-1.5 text-xs font-bold text-blue-200">
                              ⏱ +{dv.time_penalty_seconds}s Time Penalty
                            </span>
                          )}
                          {dv.warning_text && (
                            <span className="inline-flex items-center gap-1.5 rounded-full border border-white/25 bg-white/8 px-3 py-1.5 text-xs font-bold text-white/70">
                              ⚠ Warning Issued
                            </span>
                          )}
                          {dv.license_points == null && dv.time_penalty_seconds == null && !dv.warning_text && (
                            <span className="text-xs text-white/40 italic">No penalties for this driver</span>
                          )}
                        </div>
                        {dv.warning_text && (
                          <p className="border-t border-white/8 px-4 py-2 text-xs text-white/60" dir="auto">{dv.warning_text}</p>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {verdict.verdict_decision && (
                  <DecisionBadge decision={verdict.verdict_decision} large />
                )}
                <p className="text-lg font-bold text-white">{verdict.verdict_summary}</p>
                <div className="rounded-xl border border-emerald-400/20 bg-emerald-400/5 p-4">
                  <p className="whitespace-pre-wrap leading-relaxed text-white/85" dir="auto" lang="he">
                    {verdict.verdict_full_text}
                  </p>
                </div>
                <p className="text-xs text-white/40">
                  Published {verdict.published_at ? new Date(verdict.published_at).toLocaleString() : "–"}
                </p>

                {/* ── Appeal entry point ── */}
                <div className="border-t border-white/10 pt-4">
                  {existingAppeal ? (
                    <Link
                      href={`/stewards/appeals/${existingAppeal.id}`}
                      className="inline-flex items-center gap-2 rounded-full border border-[#D4AF37]/40 bg-[#D4AF37]/10 px-4 py-1.5 text-xs font-bold uppercase tracking-wider text-[#f4d98a] transition hover:border-[#D4AF37]/70 hover:bg-[#D4AF37]/20"
                    >
                      {existingAppeal.status === "Closed" ? "View Appeal Result →" : `Appeal ${existingAppeal.status} →`}
                    </Link>
                  ) : canAppeal ? (
                    <div className="flex flex-wrap items-center gap-3">
                      <AppealSubmitModal
                        caseId={caseItem.id}
                        caseTitle={caseItem.title}
                        hoursRemaining={appealHoursRemaining}
                      />
                      <span className="text-xs text-white/40">
                        Appeal window closes in ~{appealHoursRemaining}h
                      </span>
                    </div>
                  ) : (
                    <p className="text-xs text-white/30 italic">Appeal window closed.</p>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/3 px-4 py-4">
                <span className="text-2xl opacity-30">⚖️</span>
                <div>
                  <p className="text-sm font-medium text-white/60">No verdict published yet</p>
                  <p className="mt-0.5 text-xs text-white/40">The stewards are reviewing the incident.</p>
                </div>
              </div>
            )}
          </TimelineStep>
        </div>
      )}

      {/* ── STEWARD VIEW ───────────────────────────────────────── */}
      {view === "steward" && (
        <div className="space-y-5">

          {/* Complaint */}
          <section className="steward-panel rounded-2xl p-5">
            <h3 className="text-base font-semibold uppercase tracking-wider text-[#D4AF37]">1 · Complaint</h3>
            <p className="mt-3 whitespace-pre-wrap leading-relaxed text-white/85" dir="auto" lang="he">
              {caseItem.description}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <div className="flex items-center gap-1.5 rounded-lg border border-[#D4AF37]/40 bg-[#D4AF37]/10 px-2.5 py-1.5">
                <span className="text-[9px] font-bold uppercase tracking-widest text-[#D4AF37]/60">↑ Complainant</span>
                <span className="text-xs font-semibold text-[#f4d98a]">{complainant?.name ?? caseItem.complainantId}</span>
              </div>
              {involvedDrivers.map((d) => (
                <div key={d.id} className="flex items-center gap-1.5 rounded-lg border border-white/15 bg-white/5 px-2.5 py-1.5">
                  <span className="text-[9px] font-bold uppercase tracking-widest text-white/35">▣ Involved</span>
                  <span className="text-xs font-semibold text-white/80">{d.name}</span>
                </div>
              ))}
            </div>
            {(caseItem.attachments.length > 0 || caseItem.links.length > 0) && (
              <div className="mt-4 border-t border-white/10 pt-4">
                <EvidenceGallery attachments={caseItem.attachments} links={caseItem.links} />
              </div>
            )}
          </section>

          {/* Statements */}
          <section className="steward-panel rounded-2xl p-5">
            <h3 className="text-base font-semibold uppercase tracking-wider text-[#D4AF37]">2 · Driver Statements</h3>
            <div className="mt-3 space-y-3">
              {participantIds.map((pid) => {
                const driver = involvedDrivers.find((d) => d.id === pid) ?? null;
                const driverName = driver?.name ?? pid;
                const statement = responses.find((r) => r.userId === pid);
                return (
                  <div key={pid} className="overflow-hidden rounded-xl border border-white/10">
                    <div className="flex items-center justify-between gap-2 border-b border-white/8 bg-white/3 px-3 py-2">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-white/80">{driverName}</span>
                      </div>
                      {statement
                        ? <span className="text-[10px] text-emerald-400/70">✓ {new Date(statement.createdAt).toLocaleDateString()}</span>
                        : <span className="text-[10px] text-white/30">Pending</span>}
                    </div>
                    {statement ? (
                      <div className="px-3 py-3 space-y-3">
                        <p className="whitespace-pre-wrap text-sm text-white/85" dir="auto" lang="he">{statement.text}</p>
                        {(statement.attachments.length > 0 || statement.links.length > 0) && (
                          <div className="border-t border-white/10 pt-3">
                            <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-[#D4AF37]/60">Evidence</p>
                            <EvidenceGallery attachments={statement.attachments} links={statement.links} />
                          </div>
                        )}
                      </div>
                    ) : (
                      <p className="px-3 py-3 text-sm italic text-white/35">No statement submitted yet.</p>
                    )}
                  </div>
                );
              })}
            </div>
          </section>

          {/* Verdict */}
          <section className="steward-panel rounded-2xl p-5">
            <h3 className="text-base font-semibold uppercase tracking-wider text-[#D4AF37]">3 · Verdict</h3>

            {/* Read-only display when published */}
            {verdict?.is_published && (
              <div className="mt-4 space-y-3">
                {driverVerdicts.map((dv) => (
                  <div key={dv.id} className="overflow-hidden rounded-xl border border-white/10">
                    <div className="border-b border-white/8 bg-[#D4AF37]/8 px-3 py-2">
                      <span className="text-sm font-semibold text-[#f4d98a]">{dv.driver?.name ?? dv.driverId}</span>
                    </div>
                    <div className="flex flex-wrap gap-2 px-3 py-2.5">
                      {dv.license_points != null && dv.license_points > 0 && (
                        <span className="rounded-full border border-orange-400/50 bg-orange-400/15 px-2.5 py-0.5 text-xs font-bold text-orange-200">+{dv.license_points} pts</span>
                      )}
                      {dv.time_penalty_seconds != null && dv.time_penalty_seconds > 0 && (
                        <span className="rounded-full border border-blue-400/50 bg-blue-400/15 px-2.5 py-0.5 text-xs font-bold text-blue-200">+{dv.time_penalty_seconds}s</span>
                      )}
                      {dv.warning_text && (
                        <span className="rounded-full border border-white/25 bg-white/8 px-2.5 py-0.5 text-xs font-bold text-white/70">⚠ {dv.warning_text}</span>
                      )}
                      {dv.license_points == null && dv.time_penalty_seconds == null && !dv.warning_text && (
                        <span className="text-xs italic text-white/35">No penalties</span>
                      )}
                    </div>
                  </div>
                ))}
                {verdict.verdict_decision && <DecisionBadge decision={verdict.verdict_decision} />}
                <p className="font-semibold text-white">{verdict.verdict_summary}</p>
                <p className="whitespace-pre-wrap text-sm text-white/75" dir="auto" lang="he">{verdict.verdict_full_text}</p>
              </div>
            )}
            {!verdict?.is_published && !canEditVerdict && (
              <p className="mt-3 text-sm text-white/50">No published verdict yet.</p>
            )}

            {/* One-click publish for a saved draft verdict */}
            {canEditVerdict && verdict && !verdict.is_published && (
              <form action={publishVerdictAction} className="mt-4">
                <input type="hidden" name="case_id" value={caseItem.id} />
                <FormActionButton
                  idleLabel="Publish Verdict"
                  loadingLabel="Publishing…"
                  className="rounded-full bg-emerald-600 px-5 py-2 text-sm font-semibold shadow-[0_0_14px_rgba(16,185,129,0.25)] transition hover:bg-emerald-500"
                />
              </form>
            )}

            {/* Edit form */}
            {canEditVerdict && (
              <div className="mt-5 border-t border-white/10 pt-5">
                <VerdictForm
                  caseId={caseItem.id}
                  involvedDrivers={involvedDrivers.map((d) => ({ id: d.id, name: d.name }))}
                  allDrivers={allUsers.filter((u) => u.roles.includes("member")).map((u) => ({ id: u.id, name: u.name }))}
                  existingVerdict={verdict}
                  existingDriverVerdicts={driverVerdicts}
                />
              </div>
            )}

            {/* ── Appeal status / submit ───────────────────────────── */}
            {verdict?.is_published && (
              <div className="mt-5 border-t border-white/10 pt-5">
                {/* Existing appeal */}
                {existingAppeal && (
                  <div className="flex items-center gap-3 flex-wrap">
                    <span className="text-xs text-white/50">Appeal:</span>
                    <Link
                      href={`/stewards/appeals/${existingAppeal.id}`}
                      className="rounded-full border border-[#D4AF37]/40 bg-[#D4AF37]/10 px-3 py-1 text-xs font-semibold text-[#f4d98a] transition hover:border-[#D4AF37]/70 hover:bg-[#D4AF37]/20"
                    >
                      {existingAppeal.status === "Closed"
                        ? "View Appeal Result →"
                        : `Appeal ${existingAppeal.status} →`}
                    </Link>
                  </div>
                )}

                {/* Eligible to appeal */}
                {canAppeal && (
                  <div className="flex flex-wrap items-center gap-3">
                    <AppealSubmitModal
                      caseId={caseItem.id}
                      caseTitle={caseItem.title}
                      hoursRemaining={appealHoursRemaining}
                    />
                    <span className="text-xs text-white/40">
                      Appeal window: ~{appealHoursRemaining}h remaining
                    </span>
                  </div>
                )}

                {/* Window expired, no appeal */}
                {!existingAppeal && !appealWindowOpen && verdict?.is_published && (
                  <p className="text-xs text-white/30 italic">Appeal window closed.</p>
                )}
              </div>
            )}
          </section>

          {/* Status control */}
          {canEditVerdict && (
            <section className="steward-panel rounded-2xl p-5">
              <h3 className="text-base font-semibold uppercase tracking-wider text-[#D4AF37]">Case Status</h3>
              <form action={updateCaseStatusAction} className="mt-3 flex flex-wrap items-center gap-3">
                <input type="hidden" name="case_id" value={caseItem.id} />
                <select name="status" defaultValue={caseItem.status} className="rounded-lg border border-white/15 bg-black/30 px-3 py-2">
                  {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
                <FormActionButton idleLabel="Update Status" loadingLabel="Updating..." className="rounded-full border border-white/25 bg-white/8 px-4 py-2 text-sm font-semibold transition hover:border-[#D4AF37]/50 hover:bg-[#D4AF37]/15 hover:text-[#f4d98a] hover:shadow-[0_0_12px_rgba(212,175,55,0.18)] disabled:opacity-50" />
              </form>
            </section>
          )}

          {/* Internal discussion */}
          {canInternal && (
            <section className="steward-panel rounded-2xl border border-[#7020B0]/40 p-5">
              <h3 className="text-base font-semibold uppercase tracking-wider text-[#D4AF37]">4 · Internal Discussion</h3>
              <p className="mt-1 text-xs text-white/50">Visible to stewards and admins only.</p>
              <div className="mt-4 space-y-3">
                {internalComments.map((c) => (
                  <article key={c.id} className="steward-soft rounded-lg p-3">
                    <p className="text-xs text-white/55">{c.author?.name ?? c.authorId} · {new Date(c.createdAt).toLocaleString()}</p>
                    <p className="mt-2 whitespace-pre-wrap text-white/85" dir="auto" lang="he">{c.text}</p>
                  </article>
                ))}
                {internalComments.length === 0 && <p className="text-sm text-white/50">No internal discussion yet.</p>}
              </div>
              <form action={addInternalCommentAction} className="mt-4 grid gap-3">
                <input type="hidden" name="case_id" value={caseItem.id} />
                <label className="block"><span className="mb-1 block text-xs text-white/70">Add comment</span><textarea name="text" rows={4} required lang="he" dir="rtl" className="w-full rounded-lg border border-white/15 bg-black/30 px-3 py-2 text-right" /></label>
                <FormActionButton idleLabel="Post Comment" loadingLabel="Posting..." className="w-fit rounded-full border border-[#7020B0]/60 bg-[#7020B0]/20 px-5 py-2.5 text-sm font-semibold transition hover:border-[#7020B0] hover:bg-[#7020B0]/40 hover:shadow-[0_0_14px_rgba(112,32,176,0.35)] disabled:opacity-50" />
              </form>
            </section>
          )}
        </div>
      )}

      {/* back link */}
      <div className="pt-2">
        <Link href={`/stewards/cases?view=${view}`} className="text-xs text-white/40 hover:text-[#D4AF37] transition">
          ← Back to Cases
        </Link>
      </div>
    </div>
  );
}

/* ── TIMELINE STEP ─────────────────────────────────────────── */
function TimelineStep({
  number,
  label,
  done,
  isLast = false,
  children,
}: {
  number: number;
  label: string;
  done: boolean;
  isLast?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className={`relative mb-6 ${isLast ? "" : "pb-2"}`}>
      {/* circle on spine */}
      <div
        className={`absolute -left-[26px] top-1 flex h-6 w-6 items-center justify-center rounded-full border text-[11px] font-bold
          ${done
            ? "border-[#D4AF37]/80 bg-[#D4AF37]/20 text-[#f4d98a]"
            : "border-white/20 bg-white/5 text-white/40"
          }`}
      >
        {number}
      </div>

      {/* label */}
      <p className={`mb-3 text-[10px] font-bold uppercase tracking-widest ${done ? "text-[#D4AF37]/80" : "text-white/35"}`}>
        {label}
      </p>

      {/* content card */}
      <div className="steward-panel rounded-2xl p-5">
        {children}
      </div>
    </div>
  );
}

/* ── EVIDENCE GALLERY ──────────────────────────────────────── */
function EvidenceGallery({
  attachments,
  links,
}: {
  attachments: AttachmentRef[];
  links: string[];
}) {
  const isImage = (url: string) => /\.(png|jpe?g|gif|webp|bmp|svg)(\?.*)?$/i.test(url);
  const isUrl   = (s: string)   => /^https?:\/\//i.test(s);

  return (
    <div className="space-y-3">
      {attachments.length > 0 && (
        <div className="flex flex-wrap gap-3">
          {attachments.map((a) =>
            isImage(a.url) ? (
              <a
                key={a.url}
                href={a.url}
                target="_blank"
                rel="noopener noreferrer"
                className="group relative block overflow-hidden rounded-xl border border-[#D4AF37]/25 shadow-md transition duration-200 hover:border-[#D4AF37]/70 hover:shadow-[0_0_18px_rgba(212,175,55,0.28)]"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={a.url} alt={a.name} className="h-36 w-52 object-cover transition duration-300 group-hover:scale-105" />
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent px-2 py-1.5">
                  <p className="truncate text-[10px] text-white/70">{a.name}</p>
                </div>
                <div className="absolute inset-0 flex items-center justify-center opacity-0 transition-opacity group-hover:opacity-100">
                  <span className="rounded-full bg-black/60 px-2 py-1 text-[10px] text-white/90">⤢ Full size</span>
                </div>
              </a>
            ) : (
              <a
                key={a.url}
                href={a.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 rounded-lg border border-white/15 bg-black/30 px-3 py-2 text-xs text-[#d4afff] transition hover:border-[#D4AF37]/50 hover:text-white"
              >
                📎 {a.name}
              </a>
            )
          )}
        </div>
      )}

      {links.length > 0 && (
        <ul className="flex flex-wrap gap-2">
          {links.map((link, i) =>
            isUrl(link) ? (
              <li key={i}>
                <a
                  href={link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex max-w-xs items-center gap-1.5 rounded-lg border border-white/15 bg-black/30 px-3 py-1.5 text-xs text-[#d4afff] transition hover:border-[#D4AF37]/50 hover:text-white"
                >
                  <span>🔗</span>
                  <span className="truncate">{link}</span>
                </a>
              </li>
            ) : (
              <li key={i} className="rounded-lg border border-white/10 bg-black/20 px-3 py-1.5 text-xs text-white/65">
                {link}
              </li>
            )
          )}
        </ul>
      )}
    </div>
  );
}

/* ── DECISION BADGE ────────────────────────────────────────── */
const DECISION_STYLE: Record<VerdictDecision, string> = {
  "Racing Incident":   "border-sky-400/50     bg-sky-400/15     text-sky-200",
  "No Further Action": "border-emerald-400/50 bg-emerald-400/15 text-emerald-200",
  "Penalty Imposed":   "border-orange-400/50  bg-orange-400/15  text-orange-200",
  "Driver Reprimand":  "border-amber-400/50   bg-amber-400/15   text-amber-200",
  "Other":             "border-white/25       bg-white/8        text-white/65",
};

function DecisionBadge({ decision, large }: { decision: VerdictDecision; large?: boolean }) {
  return (
    <span className={`inline-flex items-center rounded-full border font-bold uppercase tracking-widest ${large ? "px-4 py-1.5 text-sm" : "px-3 py-1 text-[11px]"} ${DECISION_STYLE[decision]}`}>
      {decision}
    </span>
  );
}
