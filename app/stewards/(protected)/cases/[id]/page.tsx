import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import {
  addInternalCommentAction,
  editInternalCommentAction,
  publishVerdictAction,
  submitCaseResponseAction,
  updateCaseStatusAction,
} from "@/app/stewards/actions";
import FormActionButton from "@/app/stewards/components/FormActionButton";
import DeleteCaseForm from "@/app/stewards/(protected)/cases/DeleteCaseForm";
import EvidencePasteBox from "@/app/stewards/(protected)/cases/EvidencePasteBox";
import SubmissionToast from "@/app/stewards/(protected)/cases/SubmissionToast";
import ViewToggle from "@/app/stewards/(protected)/cases/ViewToggle";
import VerdictForm from "@/app/stewards/(protected)/cases/[id]/VerdictForm";
import DeleteCommentForm from "@/app/stewards/(protected)/cases/[id]/DeleteCommentForm";
import { can, canCommentInternally, requireStewardUser } from "@/lib/stewards/auth";
import { isDriverRole } from "@/lib/accounts/types";
import {
  getCaseById,
  getAppealByCaseAndUser,
  isAppealWindowOpen,
  listAppealsForOriginalCase,
  listUsers,
} from "@/lib/stewards/repository";
import AppealSubmitModal from "@/app/stewards/components/AppealSubmitModal";
import type { AttachmentRef, CaseStatus, VerdictDecision } from "@/lib/stewards/types";
import { fmtDate, fmtDateTime } from "@/app/stewards/lib/dates";

const STATUSES: CaseStatus[] = [
  "Open", "Waiting for Response", "Under Review",
  "Verdict Ready", "Closed", "Archived",
];

const STATUS_STYLE: Record<CaseStatus, string> = {
  "Open":                  "text-status-info border-status-info",
  "Waiting for Response":  "text-status-info border-status-info",
  "Under Review":          "text-status-warning border-status-warning",
  "Verdict Ready":         "text-brass-ink border-brass",
  "Closed":                "text-status-success border-status-success",
  "Archived":              "text-meta border-[color:var(--isl-hairline-strong)]",
};

export default async function StewardCaseDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ submitted?: string; view?: "driver" | "steward"; error?: string; edit_comment?: string }>;
}) {
  const t = await getTranslations("stewards");
  const user = await requireStewardUser();
  const { id } = await params;
  const query = await searchParams;
  const data = await getCaseById(id);
  if (!data) notFound();

  const { caseItem, complainant, involvedDrivers, responses, internalComments, verdict, driverVerdicts } = data;
  const [allUsers, myAppeal, appealsForCase] = await Promise.all([
    listUsers(),
    getAppealByCaseAndUser(id, user.id),
    listAppealsForOriginalCase(id),
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
    !myAppeal &&
    (caseItem.complainantId === user.id || caseItem.involvedDriverIds.includes(user.id));
  // Only involved drivers submit statements — the complainant's side is already the
  // complaint itself, so they are excluded even if they listed themselves as involved.
  const participantIds = [...new Set(caseItem.involvedDriverIds)].filter(
    (id) => id !== caseItem.complainantId,
  );
  const isInvolved =
    caseItem.involvedDriverIds.includes(user.id) && caseItem.complainantId !== user.id;
  const alreadyResponded = responses.some((r) => r.userId === user.id);
  const hasDriverRole = isDriverRole(user.roles);
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

  const editCommentId = query.edit_comment ?? null;

  const appealErrorMsg =
    query.error === "appeal-exists"
      ? t("cases.detail.appealExists")
      : null;

  return (
    <div className="space-y-5">
      {query.submitted === "1" && <SubmissionToast />}
      {appealErrorMsg && (
        <div className="rounded-[2px] border border-status-warning bg-cream px-4 py-3 text-sm text-ink">
          {appealErrorMsg}
        </div>
      )}

      {/* ── CASE HEADER STRIP ─────────────────────────────────── */}
      <div className="steward-panel relative overflow-hidden rounded-[2px] p-6">

        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline gap-3">
              <span className="num text-lg font-semibold text-brass-ink">#{caseItem.caseNumber ?? "–"}</span>
              <h1 className="font-display text-3xl font-bold leading-[1.05] tracking-[0.005em] text-ink">
                {caseItem.title}
              </h1>
            </div>

            {/* meta row */}
            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-meta">
              <span>{caseItem.season}</span>
              <span className="text-faint">·</span>
              <span>{caseItem.round}</span>
              <span className="text-faint">·</span>
              <span>{t(`cases.session.${caseItem.weekendSession}`)}</span>
              {caseItem.weekendSession === "Race" && caseItem.incidentLapNumber && (
                <>
                  <span className="text-faint">·</span>
                  <span>{t("cases.detail.lap")} <span className="num">{caseItem.incidentLapNumber}</span></span>
                </>
              )}
              {caseItem.weekendSession === "Qualifying" && caseItem.qualifyingTime && (
                <>
                  <span className="text-faint">·</span>
                  <span className="num">{caseItem.qualifyingTime} {t("cases.detail.remaining")}</span>
                </>
              )}
              <span className="text-faint">·</span>
              <span className="num">{fmtDate(caseItem.createdAt)}</span>
            </div>

            {/* status badge row */}
            <div className="mt-3">
              <span className={`inline-flex items-center rounded-[2px] border px-3 py-1 font-isl-body text-[11px] font-semibold uppercase tracking-[0.12em] leading-none ${STATUS_STYLE[caseItem.status] ?? STATUS_STYLE["Open"]}`}>
                {t(`cases.status.${caseItem.status}`)}
              </span>
            </div>

            {/* parties row — prominent */}
            <div className="mt-4 flex flex-wrap gap-3">
              {/* complainant */}
              <div className="flex items-center gap-2.5 rounded-[2px] border border-brass bg-cream px-4 py-2.5">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[2px] border border-brass text-xs font-bold text-brass-ink">↑</span>
                <div>
                  <p className="font-isl-body text-[10px] font-semibold uppercase tracking-[0.2em] text-brass-ink">{t("cases.parties.complainant")}</p>
                  <p className="text-sm font-semibold text-ink">{complainant?.name ?? t("cases.parties.unknown")}</p>
                </div>
              </div>

              {/* involved drivers */}
              {involvedDrivers.map((d) => (
                <div key={d.id} className="flex items-center gap-2.5 rounded-[2px] border border-[color:var(--isl-hairline)] bg-cream px-4 py-2.5">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[2px] border border-[color:var(--isl-hairline-strong)] text-xs font-bold text-ink-2">▣</span>
                  <div>
                    <p className="font-isl-body text-[10px] font-semibold uppercase tracking-[0.2em] text-meta">{t("cases.parties.involved")}</p>
                    <p className="text-sm font-semibold text-ink">{d.name}</p>
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
                idleLabel={t("cases.detail.removeCase")}
                className="rounded-[2px] border border-status-danger px-3 py-1.5 text-xs text-status-danger transition hover:bg-cream"
              />
            )}
          </div>
        </div>
      </div>

      {/* ── DRIVER VIEW: TIMELINE ──────────────────────────────── */}
      {view === "driver" && (
        <div className="relative ps-10">
          {/* vertical timeline spine */}
          <div className="absolute start-3.5 top-0 h-full w-px bg-[color:var(--isl-hairline-strong)]" />

          {/* ── STEP 1: COMPLAINT ──────────────────────────────── */}
          <TimelineStep number={1} label={t("cases.timeline.complaint")} done={stepDone(1)}>
            <div className="grid gap-5 md:grid-cols-[200px_1fr]">
              {/* left: parties */}
              <div className="space-y-3">
                <div>
                  <p className="font-isl-body text-[10px] font-semibold uppercase tracking-[0.2em] text-brass-ink">{t("cases.parties.complainant")}</p>
                  <p className="mt-1 text-sm font-medium text-ink">{complainant?.name ?? t("cases.parties.unknown")}</p>
                </div>
                <div>
                  <p className="font-isl-body text-[10px] font-semibold uppercase tracking-[0.2em] text-brass-ink">{t("cases.parties.involvedDrivers")}</p>
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    {involvedDrivers.map((d) => (
                      <span key={d.id} className="rounded-[2px] border border-[color:var(--isl-hairline)] bg-cream px-2 py-0.5 text-xs text-ink-2">
                        {d.name}
                      </span>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="font-isl-body text-[10px] font-semibold uppercase tracking-[0.2em] text-brass-ink">{t("cases.detail.session")}</p>
                  <p className="mt-1 text-sm text-ink-2">{t(`cases.session.${caseItem.weekendSession}`)}</p>
                </div>
              </div>

              {/* right: description */}
              <div>
                <p className="font-isl-body text-[10px] font-semibold uppercase tracking-[0.2em] text-brass-ink">{t("cases.detail.incidentDescription")}</p>
                <p className="mt-2 whitespace-pre-wrap leading-relaxed text-ink-2" dir="auto" lang="he">
                  {caseItem.description}
                </p>
              </div>
            </div>

            {/* evidence gallery */}
            {(caseItem.attachments.length > 0 || caseItem.links.length > 0) && (
              <div className="mt-5 border-t border-[color:var(--isl-hairline)] pt-4">
                <p className="mb-3 font-isl-body text-[10px] font-semibold uppercase tracking-[0.2em] text-brass-ink">{t("cases.detail.evidence")}</p>
                <EvidenceGallery attachments={caseItem.attachments} links={caseItem.links} />
              </div>
            )}
          </TimelineStep>

          {/* ── STEP 2: DRIVER STATEMENTS ──────────────────────── */}
          <TimelineStep number={2} label={t("cases.timeline.driverStatements")} done={stepDone(2)}>
            <p className="mb-4 text-xs text-meta">
              {t("cases.statements.intro")}
            </p>

            <div className="space-y-3">
              {participantIds.map((pid) => {
                const driver = involvedDrivers.find((d) => d.id === pid) ?? null;
                const driverName = driver?.name ?? pid;
                const statement = responses.find((r) => r.userId === pid);
                const isMe = pid === user.id;

                return (
                  <div key={pid} className="overflow-hidden rounded-[2px] border border-[color:var(--isl-hairline)] bg-paper">
                    {/* driver row header */}
                    <div className="flex items-center justify-between gap-2 border-b border-[color:var(--isl-hairline)] bg-cream px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-ink">{driverName}</span>
                        {isMe && (
                          <span className="rounded-[2px] border border-[color:var(--isl-hairline)] bg-cream px-2 py-0.5 text-[10px] text-meta">
                            {t("cases.statements.you")}
                          </span>
                        )}
                      </div>
                      {statement ? (
                        <span className="flex items-center gap-1 text-[10px] text-status-success">
                          <span>✓</span> {t("cases.statements.submitted")} <span className="num">{fmtDate(statement.createdAt)}</span>
                        </span>
                      ) : (
                        <span className="text-[10px] text-faint">{t("cases.statements.pending")}</span>
                      )}
                    </div>

                    {/* statement body */}
                    {statement ? (
                      <div className="px-4 py-3 space-y-3">
                        <p className="whitespace-pre-wrap leading-relaxed text-ink-2" dir="auto" lang="he">
                          {statement.text}
                        </p>
                        {(statement.attachments.length > 0 || statement.links.length > 0) && (
                          <div className="border-t border-[color:var(--isl-hairline)] pt-3">
                            <p className="mb-2 font-isl-body text-[10px] font-semibold uppercase tracking-[0.2em] text-brass-ink">{t("cases.detail.evidence")}</p>
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
                            dir="auto"
                            placeholder={t("cases.statements.placeholder")}
                            className="w-full rounded-[2px] border border-[color:var(--isl-hairline)] bg-paper px-3 py-2.5 leading-relaxed text-ink placeholder:text-faint focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--isl-oxblood)]"
                          />
                          {/* Evidence — same capabilities as complaint form */}
                          <div className="rounded-[2px] border border-[color:var(--isl-hairline)] bg-cream p-4">
                            <h4 className="font-isl-body text-xs font-semibold uppercase tracking-[0.2em] text-brass-ink">
                              {t("cases.detail.evidence")} <span className="font-normal normal-case tracking-normal text-meta">{t("cases.statements.optional")}</span>
                            </h4>
                            <p className="mt-1 text-xs text-meta">{t("cases.statements.evidenceHint")}</p>
                            <div className="mt-3 grid gap-4 md:grid-cols-2">
                              <EvidencePasteBox />
                              <div className="space-y-3">
                                <label className="block">
                                  <span className="mb-1 block text-xs text-ink-2">{t("cases.form.evidenceUrl")}</span>
                                  <input
                                    type="url"
                                    name="evidence_items"
                                    inputMode="url"
                                    dir="ltr"
                                    placeholder={t("cases.form.evidenceUrlPlaceholder")}
                                    className="w-full rounded-[2px] border border-[color:var(--isl-hairline)] bg-paper px-3 py-2 text-sm text-ink placeholder:text-faint focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--isl-oxblood)]"
                                  />
                                </label>
                              </div>
                            </div>
                          </div>
                          <FormActionButton
                            idleLabel={t("cases.statements.submit")}
                            loadingLabel={t("cases.statements.submitting")}
                            className="w-fit rounded-[2px] bg-ink px-5 py-2 text-sm font-semibold text-bone transition hover:opacity-90"
                          />
                        </form>
                      </div>
                    ) : (
                      <div className="px-4 py-3">
                        <p className="text-sm text-faint italic">{t("cases.statements.none")}</p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </TimelineStep>

          {/* ── STEP 3: VERDICT ────────────────────────────────── */}
          <TimelineStep number={3} label={t("cases.timeline.verdict")} done={stepDone(3)} isLast>
            {verdict?.is_published ? (
              <div className="space-y-4">
                {/* per-driver penalty blocks */}
                {driverVerdicts.length > 0 && (
                  <div className="space-y-3">
                    {driverVerdicts.map((dv) => (
                      <div key={dv.id} className="overflow-hidden rounded-[2px] border border-[color:var(--isl-hairline)] bg-paper">
                        <div className="border-b border-[color:var(--isl-hairline)] bg-cream px-4 py-2">
                          <span className="text-sm font-semibold text-ink">{dv.driver?.name ?? dv.driverId}</span>
                        </div>
                        <div className="flex flex-wrap gap-2 px-4 py-3">
                          {dv.license_points != null && dv.license_points > 0 && (
                            <span className="inline-flex items-center gap-1.5 rounded-[2px] border border-status-danger px-3 py-1.5 text-xs font-bold text-status-danger">
                              ● <span className="num">+{dv.license_points}</span> {t("cases.verdict.licensePoints", { count: dv.license_points })}
                            </span>
                          )}
                          {dv.time_penalty_seconds != null && dv.time_penalty_seconds > 0 && (
                            <span className="inline-flex items-center gap-1.5 rounded-[2px] border border-status-info px-3 py-1.5 text-xs font-bold text-status-info">
                              ⏱ <span className="num">+{dv.time_penalty_seconds}s</span> {t("cases.verdict.timePenalty")}
                            </span>
                          )}
                          {dv.warning_text && (
                            <span className="inline-flex items-center gap-1.5 rounded-[2px] border border-status-warning px-3 py-1.5 text-xs font-bold text-status-warning">
                              ⚠ {t("cases.verdict.warningIssued")}
                            </span>
                          )}
                          {dv.license_points == null && dv.time_penalty_seconds == null && !dv.warning_text && (
                            <span className="text-xs text-faint italic">{t("cases.verdict.noPenaltiesDriver")}</span>
                          )}
                        </div>
                        {dv.warning_text && (
                          <p className="border-t border-[color:var(--isl-hairline)] px-4 py-2 text-xs text-ink-2" dir="auto">{dv.warning_text}</p>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {verdict.verdict_decision && (
                  <DecisionBadge decision={verdict.verdict_decision} large />
                )}
                <p className="text-lg font-bold text-ink">{verdict.verdict_summary}</p>
                <div className="rounded-[2px] border border-[color:var(--isl-hairline)] bg-cream p-4">
                  <p className="whitespace-pre-wrap leading-relaxed text-ink-2" dir="auto" lang="he">
                    {verdict.verdict_full_text}
                  </p>
                </div>
                <p className="text-xs text-meta">
                  {t("cases.verdict.published")} <span className="num">{fmtDateTime(verdict.published_at)}</span>
                </p>

                {/* ── Appeal entry point ── */}
                <div className="border-t border-[color:var(--isl-hairline)] pt-4">
                  {myAppeal ? (
                    <Link
                      href={`/stewards/appeals/${myAppeal.id}`}
                      className="inline-flex items-center gap-2 rounded-[2px] border border-brass px-4 py-1.5 text-xs font-bold uppercase tracking-[0.12em] text-brass-ink transition hover:bg-cream"
                    >
                      {myAppeal.status === "Closed" ? t("cases.appeal.viewResult") : t("cases.appeal.statusLink", { status: t(`cases.appealStatus.${myAppeal.status}`) })}
                    </Link>
                  ) : canAppeal ? (
                    <div className="flex flex-wrap items-center gap-3">
                      <AppealSubmitModal
                        caseId={caseItem.id}
                        caseTitle={caseItem.title}
                        hoursRemaining={appealHoursRemaining}
                      />
                      <span className="text-xs text-meta">
                        {t("cases.appeal.windowClosesIn")}<span className="num">{appealHoursRemaining}h</span>{t("cases.appeal.onePerPerson")}
                      </span>
                    </div>
                  ) : (
                    <p className="text-xs text-faint italic">{t("cases.appeal.windowClosed")}</p>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-3 rounded-[2px] border border-[color:var(--isl-hairline)] bg-cream px-4 py-4">
                <span className="text-2xl opacity-40">⚖️</span>
                <div>
                  <p className="text-sm font-medium text-ink-2">{t("cases.verdict.noneYet")}</p>
                  <p className="mt-0.5 text-xs text-meta">{t("cases.verdict.reviewing")}</p>
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
          <section className="steward-panel rounded-[2px] p-5">
            <h3 className="font-display text-base font-bold uppercase tracking-[0.12em] text-ink">{t("cases.stewardView.complaint")}</h3>
            <p className="mt-3 whitespace-pre-wrap leading-relaxed text-ink-2" dir="auto" lang="he">
              {caseItem.description}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <div className="flex items-center gap-1.5 rounded-[2px] border border-brass bg-cream px-2.5 py-1.5">
                <span className="font-isl-body text-[9px] font-semibold uppercase tracking-[0.2em] text-brass-ink">{t("cases.stewardView.complainantTag")}</span>
                <span className="text-xs font-semibold text-ink">{complainant?.name ?? caseItem.complainantId}</span>
              </div>
              {involvedDrivers.map((d) => (
                <div key={d.id} className="flex items-center gap-1.5 rounded-[2px] border border-[color:var(--isl-hairline)] bg-cream px-2.5 py-1.5">
                  <span className="font-isl-body text-[9px] font-semibold uppercase tracking-[0.2em] text-meta">{t("cases.stewardView.involvedTag")}</span>
                  <span className="text-xs font-semibold text-ink-2">{d.name}</span>
                </div>
              ))}
            </div>
            {(caseItem.attachments.length > 0 || caseItem.links.length > 0) && (
              <div className="mt-4 border-t border-[color:var(--isl-hairline)] pt-4">
                <EvidenceGallery attachments={caseItem.attachments} links={caseItem.links} />
              </div>
            )}
          </section>

          {/* Statements */}
          <section className="steward-panel rounded-[2px] p-5">
            <h3 className="font-display text-base font-bold uppercase tracking-[0.12em] text-ink">{t("cases.stewardView.driverStatements")}</h3>
            <div className="mt-3 space-y-3">
              {participantIds.map((pid) => {
                const driver = involvedDrivers.find((d) => d.id === pid) ?? null;
                const driverName = driver?.name ?? pid;
                const statement = responses.find((r) => r.userId === pid);
                return (
                  <div key={pid} className="overflow-hidden rounded-[2px] border border-[color:var(--isl-hairline)]">
                    <div className="flex items-center justify-between gap-2 border-b border-[color:var(--isl-hairline)] bg-cream px-3 py-2">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-ink">{driverName}</span>
                      </div>
                      {statement
                        ? <span className="text-[10px] text-status-success">✓ <span className="num">{fmtDate(statement.createdAt)}</span></span>
                        : <span className="text-[10px] text-faint">{t("cases.statements.pending")}</span>}
                    </div>
                    {statement ? (
                      <div className="px-3 py-3 space-y-3">
                        <p className="whitespace-pre-wrap text-sm text-ink-2" dir="auto" lang="he">{statement.text}</p>
                        {(statement.attachments.length > 0 || statement.links.length > 0) && (
                          <div className="border-t border-[color:var(--isl-hairline)] pt-3">
                            <p className="mb-2 font-isl-body text-[10px] font-semibold uppercase tracking-[0.2em] text-brass-ink">{t("cases.detail.evidence")}</p>
                            <EvidenceGallery attachments={statement.attachments} links={statement.links} />
                          </div>
                        )}
                      </div>
                    ) : (
                      <p className="px-3 py-3 text-sm italic text-faint">{t("cases.statements.none")}</p>
                    )}
                  </div>
                );
              })}
            </div>
          </section>

          {/* Verdict */}
          <section className="steward-panel rounded-[2px] p-5">
            <h3 className="font-display text-base font-bold uppercase tracking-[0.12em] text-ink">{t("cases.stewardView.verdict")}</h3>

            {/* Read-only display when published */}
            {verdict?.is_published && (
              <div className="mt-4 space-y-3">
                {driverVerdicts.map((dv) => (
                  <div key={dv.id} className="overflow-hidden rounded-[2px] border border-[color:var(--isl-hairline)]">
                    <div className="border-b border-[color:var(--isl-hairline)] bg-cream px-3 py-2">
                      <span className="text-sm font-semibold text-ink">{dv.driver?.name ?? dv.driverId}</span>
                    </div>
                    <div className="flex flex-wrap gap-2 px-3 py-2.5">
                      {dv.license_points != null && dv.license_points > 0 && (
                        <span className="rounded-[2px] border border-status-danger px-2.5 py-0.5 text-xs font-bold text-status-danger"><span className="num">+{dv.license_points}</span> {t("cases.verdict.ptsShort")}</span>
                      )}
                      {dv.time_penalty_seconds != null && dv.time_penalty_seconds > 0 && (
                        <span className="rounded-[2px] border border-status-info px-2.5 py-0.5 text-xs font-bold text-status-info num">+{dv.time_penalty_seconds}s</span>
                      )}
                      {dv.warning_text && (
                        <span className="rounded-[2px] border border-status-warning px-2.5 py-0.5 text-xs font-bold text-status-warning">⚠ {dv.warning_text}</span>
                      )}
                      {dv.license_points == null && dv.time_penalty_seconds == null && !dv.warning_text && (
                        <span className="text-xs italic text-faint">{t("cases.verdict.noPenalties")}</span>
                      )}
                    </div>
                  </div>
                ))}
                {verdict.verdict_decision && <DecisionBadge decision={verdict.verdict_decision} />}
                <p className="font-semibold text-ink">{verdict.verdict_summary}</p>
                <p className="whitespace-pre-wrap text-sm text-ink-2" dir="auto" lang="he">{verdict.verdict_full_text}</p>
              </div>
            )}
            {!verdict?.is_published && !canEditVerdict && (
              <p className="mt-3 text-sm text-meta">{t("cases.verdict.noPublished")}</p>
            )}

            {/* One-click publish for a saved draft verdict */}
            {canEditVerdict && verdict && !verdict.is_published && (
              <form action={publishVerdictAction} className="mt-4">
                <input type="hidden" name="case_id" value={caseItem.id} />
                <FormActionButton
                  idleLabel={t("cases.verdict.publishBtn")}
                  loadingLabel={t("cases.verdict.publishingBtn")}
                  className="rounded-[2px] bg-ink px-5 py-2 text-sm font-semibold text-bone transition hover:opacity-90"
                />
              </form>
            )}

            {/* Edit form */}
            {canEditVerdict && (
              <div className="mt-5 border-t border-[color:var(--isl-hairline)] pt-5">
                <VerdictForm
                  caseId={caseItem.id}
                  involvedDrivers={involvedDrivers.map((d) => ({ id: d.id, name: d.name }))}
                  allDrivers={allUsers.filter((u) => isDriverRole(u.roles)).map((u) => ({ id: u.id, name: u.name }))}
                  existingVerdict={verdict}
                  existingDriverVerdicts={driverVerdicts}
                />
              </div>
            )}

            {/* ── Appeal status / submit ───────────────────────────── */}
            {verdict?.is_published && (
              <div className="mt-5 border-t border-[color:var(--isl-hairline)] pt-5">
                {appealsForCase.length > 0 && (
                  <div className="mb-4 space-y-2">
                    <span className="font-isl-body text-xs font-semibold uppercase tracking-[0.2em] text-meta">
                      {t("cases.appeal.onThisCase")} (<span className="num">{appealsForCase.length}</span>)
                    </span>
                    <ul className="flex flex-col gap-2">
                      {appealsForCase.map((a) => {
                        const submitter = allUsers.find((u) => u.id === a.submittedByUserId);
                        return (
                          <li key={a.id} className="flex flex-wrap items-center gap-2">
                            <Link
                              href={`/stewards/appeals/${a.id}`}
                              className="rounded-[2px] border border-brass px-3 py-1 text-xs font-semibold text-brass-ink transition hover:bg-cream"
                            >
                              {a.status === "Closed" ? t("cases.appeal.viewResultShort") : t("cases.appeal.statusShort", { status: t(`cases.appealStatus.${a.status}`) })}
                            </Link>
                            <span className="text-xs text-meta">
                              {t("cases.appeal.by", { name: submitter?.name ?? a.submittedByUserId })}
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                )}

                {canAppeal && (
                  <div className="flex flex-wrap items-center gap-3">
                    <AppealSubmitModal
                      caseId={caseItem.id}
                      caseTitle={caseItem.title}
                      hoursRemaining={appealHoursRemaining}
                    />
                    <span className="text-xs text-meta">
                      {t("cases.appeal.windowLabel")}<span className="num">{appealHoursRemaining}h</span>{t("cases.appeal.remainingSuffix")}
                    </span>
                  </div>
                )}

                {!myAppeal && !appealWindowOpen && verdict?.is_published && (
                  <p className="text-xs text-faint italic">{t("cases.appeal.windowClosed")}</p>
                )}
              </div>
            )}
          </section>

          {/* Status control */}
          {canEditVerdict && (
            <section className="steward-panel rounded-[2px] p-5">
              <h3 className="font-display text-base font-bold uppercase tracking-[0.12em] text-ink">{t("cases.stewardView.caseStatus")}</h3>
              <form action={updateCaseStatusAction} className="mt-3 flex flex-wrap items-center gap-3">
                <input type="hidden" name="case_id" value={caseItem.id} />
                <select name="status" defaultValue={caseItem.status} className="rounded-[2px] border border-[color:var(--isl-hairline)] bg-paper px-3 py-2 text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--isl-oxblood)]">
                  {STATUSES.map((s) => <option key={s} value={s}>{t(`cases.status.${s}`)}</option>)}
                </select>
                <FormActionButton idleLabel={t("cases.stewardView.updateStatus")} loadingLabel={t("cases.stewardView.updatingStatus")} className="rounded-[2px] border border-hairline-strong bg-transparent px-4 py-2 text-sm font-semibold text-ink transition hover:border-ink hover:bg-cream disabled:opacity-50" />
              </form>
            </section>
          )}

          {/* Internal discussion */}
          {canInternal && (
            <section className="steward-panel rounded-[2px] border border-oxblood p-5">
              <h3 className="font-display text-base font-bold uppercase tracking-[0.12em] text-ink">{t("cases.internal.title")}</h3>
              <p className="mt-1 text-xs text-meta">{t("cases.internal.visibility")}</p>
              <div className="mt-4 space-y-3">
                {internalComments.map((c) => {
                  const isAuthor = c.authorId === user.id;
                  const isAdmin = user.roles.includes("admin");
                  const isEditing = editCommentId === c.id;
                  return (
                    <article key={c.id} className="steward-soft rounded-[2px] p-3">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-xs text-meta">
                          {c.author?.name ?? c.authorId} · <span className="num">{fmtDateTime(c.createdAt)}</span>
                          {c.updatedAt !== c.createdAt && (
                            <span className="ms-1.5 text-faint">{t("cases.internal.edited")}</span>
                          )}
                        </p>
                        <div className="flex shrink-0 items-center gap-1">
                          {isAuthor && !isEditing && (
                            <a
                              href={`/stewards/cases/${caseItem.id}?view=steward&edit_comment=${c.id}`}
                              className="rounded-[2px] px-1.5 py-0.5 text-[10px] text-meta transition hover:bg-cream hover:text-oxblood"
                            >
                              {t("cases.internal.edit")}
                            </a>
                          )}
                          {isEditing && (
                            <a
                              href={`/stewards/cases/${caseItem.id}?view=steward`}
                              className="rounded-[2px] px-1.5 py-0.5 text-[10px] text-meta transition hover:bg-cream hover:text-ink"
                            >
                              {t("cases.internal.cancel")}
                            </a>
                          )}
                          {(isAuthor || isAdmin) && (
                            <DeleteCommentForm commentId={c.id} caseId={caseItem.id} />
                          )}
                        </div>
                      </div>

                      {isEditing ? (
                        <form action={editInternalCommentAction} className="mt-2 grid gap-2">
                          <input type="hidden" name="comment_id" value={c.id} />
                          <input type="hidden" name="case_id" value={caseItem.id} />
                          <textarea
                            name="text"
                            rows={3}
                            required
                            lang="he"
                            dir="auto"
                            defaultValue={c.text}
                            className="w-full rounded-[2px] border border-[color:var(--isl-hairline)] bg-paper px-3 py-2 text-sm text-ink placeholder:text-faint focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--isl-oxblood)]"
                          />
                          <FormActionButton
                            idleLabel={t("cases.internal.save")}
                            loadingLabel={t("cases.internal.saving")}
                            className="w-fit rounded-[2px] border border-brass px-4 py-1.5 text-xs font-semibold text-brass-ink transition hover:bg-cream disabled:opacity-50"
                          />
                        </form>
                      ) : (
                        <p className="mt-2 whitespace-pre-wrap text-ink-2" dir="auto" lang="he">{c.text}</p>
                      )}
                    </article>
                  );
                })}
                {internalComments.length === 0 && <p className="text-sm text-meta">{t("cases.internal.none")}</p>}
              </div>
              <form action={addInternalCommentAction} className="mt-4 grid gap-3">
                <input type="hidden" name="case_id" value={caseItem.id} />
                <label className="block"><span className="mb-1 block text-xs text-ink-2">{t("cases.internal.addComment")}</span><textarea name="text" rows={4} required lang="he" dir="auto" className="w-full rounded-[2px] border border-[color:var(--isl-hairline)] bg-paper px-3 py-2 text-ink placeholder:text-faint focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--isl-oxblood)]" /></label>
                <FormActionButton idleLabel={t("cases.internal.postComment")} loadingLabel={t("cases.internal.posting")} className="w-fit rounded-[2px] bg-ink px-5 py-2.5 text-sm font-semibold text-bone transition hover:opacity-90 disabled:opacity-50" />
              </form>
            </section>
          )}
        </div>
      )}

      {/* back link */}
      <div className="pt-2">
        <Link href={`/stewards/cases?view=${view}`} className="text-xs text-meta transition hover:text-oxblood">
          {t("cases.detail.backToCases")}
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
        className={`absolute -start-[26px] top-1 flex h-6 w-6 items-center justify-center rounded-[2px] border text-[11px] font-bold num
          ${done
            ? "border-brass bg-cream text-brass-ink"
            : "border-[color:var(--isl-hairline)] bg-cream text-faint"
          }`}
      >
        {number}
      </div>

      {/* label */}
      <p className={`mb-3 font-isl-body text-[10px] font-semibold uppercase tracking-[0.2em] ${done ? "text-brass-ink" : "text-faint"}`}>
        {label}
      </p>

      {/* content card */}
      <div className="steward-panel rounded-[2px] p-5">
        {children}
      </div>
    </div>
  );
}

/* ── EVIDENCE GALLERY ──────────────────────────────────────── */
async function EvidenceGallery({
  attachments,
  links,
}: {
  attachments: AttachmentRef[];
  links: string[];
}) {
  const t = await getTranslations("stewards");
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
                className="group relative block overflow-hidden rounded-[2px] border border-[color:var(--isl-hairline)] transition duration-200 hover:border-[color:var(--isl-hairline-strong)]"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={a.url} alt={a.name} className="h-36 w-52 object-cover transition duration-300 group-hover:scale-105" />
                <div className="absolute inset-x-0 bottom-0 bg-[color:var(--isl-ink)]/70 px-2 py-1.5">
                  <p className="truncate text-[10px] text-bone">{a.name}</p>
                </div>
                <div className="absolute inset-0 flex items-center justify-center opacity-0 transition-opacity group-hover:opacity-100">
                  <span className="rounded-[2px] bg-[color:var(--isl-ink)]/70 px-2 py-1 text-[10px] text-bone">{t("cases.evidence.fullSize")}</span>
                </div>
              </a>
            ) : (
              <a
                key={a.url}
                href={a.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 rounded-[2px] border border-[color:var(--isl-hairline)] bg-cream px-3 py-2 text-xs text-oxblood transition hover:text-oxblood-deep"
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
                  className="flex max-w-xs items-center gap-1.5 rounded-[2px] border border-[color:var(--isl-hairline)] bg-cream px-3 py-1.5 text-xs text-oxblood transition hover:text-oxblood-deep"
                >
                  <span>🔗</span>
                  <span className="truncate">{link}</span>
                </a>
              </li>
            ) : (
              <li key={i} className="rounded-[2px] border border-[color:var(--isl-hairline)] bg-cream px-3 py-1.5 text-xs text-ink-2">
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
  "Racing Incident":   "border-status-info    text-status-info",
  "No Further Action": "border-status-success text-status-success",
  "Penalty Imposed":   "border-status-danger  text-status-danger",
  "Driver Reprimand":  "border-status-warning text-status-warning",
  "Other":             "border-[color:var(--isl-hairline-strong)] text-meta",
};

async function DecisionBadge({ decision, large }: { decision: VerdictDecision; large?: boolean }) {
  const t = await getTranslations("stewards");
  return (
    <span className={`inline-flex items-center rounded-[2px] border font-isl-body font-semibold uppercase tracking-[0.12em] leading-none ${large ? "px-4 py-1.5 text-sm" : "px-3 py-1 text-[11px]"} ${DECISION_STYLE[decision]}`}>
      {t(`cases.decision.${decision}`)}
    </span>
  );
}
