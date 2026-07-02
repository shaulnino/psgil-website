import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { fmtDateTime } from "@/app/stewards/lib/dates";
import { notFound } from "next/navigation";
import { can, canCommentInternally, requireStewardUser } from "@/lib/stewards/auth";
import {
  addAppealInternalCommentAction,
  publishAppealVerdictAction,
  updateAppealStatusAction,
} from "@/app/stewards/actions";
import FormActionButton from "@/app/stewards/components/FormActionButton";
import { getAppealById, listUsers } from "@/lib/stewards/repository";
import type { AppealStatus, AttachmentRef } from "@/lib/stewards/types";
import AppealVerdictForm from "./AppealVerdictForm";
import DeleteAppealForm from "./DeleteAppealForm";

const APPEAL_STATUSES: AppealStatus[] = ["Submitted", "Under Review", "Verdict Ready", "Closed"];

const STATUS_STYLE: Record<AppealStatus, string> = {
  "Submitted":     "border-status-info text-status-info",
  "Under Review":  "border-status-warning text-status-warning",
  "Verdict Ready": "border-brass text-brass-ink",
  "Closed":        "border-status-success text-status-success",
};

const STATUS_KEY: Record<AppealStatus, string> = {
  "Submitted":     "submitted",
  "Under Review":  "underReview",
  "Verdict Ready": "verdictReady",
  "Closed":        "closed",
};

export default async function AppealDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ submitted?: string }>;
}) {
  const t = await getTranslations("stewards");
  const user = await requireStewardUser();
  const { id } = await params;
  const query = await searchParams;

  const data = await getAppealById(id);
  if (!data) notFound();

  const { appeal, originalCase, submittedBy, internalComments, verdict, driverVerdicts } = data;
  const allUsers = await listUsers();

  const canInternal = canCommentInternally(user.roles);
  const canEditVerdict = can(user, "edit_verdict");
  const canAdmin = can(user, "manage_users");
  const isAppealer = user.id === appeal.submittedByUserId;
  const isChanged = verdict?.is_published && verdict.outcomeType === "changed_decision";
  const isUpheld = verdict?.is_published && verdict.outcomeType === "no_change";

  const originalCaseDrivers = originalCase
    ? allUsers
        .filter((u) =>
          u.id === originalCase.complainantId ||
          originalCase.involvedDriverIds.includes(u.id),
        )
        .map((u) => ({ id: u.id, name: u.name }))
    : [];

  return (
    <div className="space-y-5">
      {query.submitted === "1" && (
        <div className="rounded-[2px] border border-status-success px-4 py-3 text-sm text-status-success">
          {t("appeals.submittedBanner")}
        </div>
      )}

      {/* Header */}
      <div className="steward-panel relative overflow-hidden rounded-[2px] p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <p className="font-isl-body text-[0.75rem] font-semibold uppercase tracking-[0.2em] text-brass-ink">{t("appeals.eyebrow")}</p>
            <h1 className="font-display mt-1 text-2xl font-bold tracking-[0.005em] leading-[1.05] text-ink">
              {t("appeals.headingPrefix")} <span className="num">#{originalCase?.caseNumber ?? "–"}</span>
            </h1>
            <p className="mt-1 text-sm text-meta">{originalCase?.title}</p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className={`inline-flex items-center rounded-[2px] border px-3 py-1 text-[11px] font-bold uppercase tracking-widest ${STATUS_STYLE[appeal.status]}`}>
                {t(`appeals.status.${STATUS_KEY[appeal.status]}`)}
              </span>
              {isChanged && (
                <span className="inline-flex items-center rounded-[2px] border border-oxblood px-3 py-1 text-[11px] font-bold uppercase tracking-widest text-oxblood">
                  {t("appeals.decisionChangedBadge")}
                </span>
              )}
              {isUpheld && (
                <span className="inline-flex items-center rounded-[2px] border border-status-success px-3 py-1 text-[11px] font-bold uppercase tracking-widest text-status-success">
                  {t("appeals.upheldBadge")}
                </span>
              )}
            </div>
          </div>
          {canAdmin && <DeleteAppealForm appealId={appeal.id} />}
        </div>
      </div>

      {/* Meta */}
      <div className="grid gap-4 md:grid-cols-3">
        <div className="steward-panel rounded-[2px] p-4">
          <p className="text-[10px] font-bold uppercase tracking-widest text-meta">{t("appeals.metaAppellant")}</p>
          <p className="mt-1 text-sm font-semibold text-ink">{submittedBy?.name ?? appeal.submittedByUserId}</p>
        </div>
        <div className="steward-panel rounded-[2px] p-4">
          <p className="text-[10px] font-bold uppercase tracking-widest text-meta">{t("appeals.metaFiled")}</p>
          <p className="num mt-1 text-sm text-ink-2">{fmtDateTime(appeal.submittedAt)}</p>
        </div>
        <div className="steward-panel rounded-[2px] p-4">
          <p className="text-[10px] font-bold uppercase tracking-widest text-meta">{t("appeals.metaOriginalCase")}</p>
          {originalCase && (
            <Link href={`/stewards/cases/${originalCase.id}?view=driver`}
              className="mt-1 block text-sm text-oxblood hover:text-oxblood-deep transition truncate">
              <span className="num">#{originalCase.caseNumber}</span> — {originalCase.title}
            </Link>
          )}
        </div>
      </div>

      {/* Appeal details */}
      <section className="steward-panel rounded-[2px] p-5">
        <h2 className="font-display text-base font-bold uppercase tracking-wider text-ink">{t("appeals.sectionAppeal")}</h2>
        <div className="mt-3 rounded-[2px] border border-[color:var(--isl-hairline)] bg-cream p-4">
          <p className="whitespace-pre-wrap text-sm text-ink-2 leading-relaxed">{appeal.description}</p>
        </div>

        {(appeal.attachments.length > 0 || appeal.links.length > 0) && (
          <div className="mt-4 border-t border-[color:var(--isl-hairline)] pt-4">
            <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-brass-ink">{t("appeals.evidenceHeading")}</p>
            <AppealEvidenceGallery attachments={appeal.attachments} links={appeal.links} />
          </div>
        )}
      </section>

      {/* Verdict */}
      <section className="steward-panel rounded-[2px] p-5">
        <h2 className="font-display text-base font-bold uppercase tracking-wider text-ink">{t("appeals.sectionVerdict")}</h2>

        {verdict?.is_published ? (
          <div className="mt-4 space-y-4">
            {/* Outcome badge */}
            <div className={`inline-flex items-center rounded-[2px] border px-4 py-1.5 text-sm font-bold uppercase tracking-wider ${
              isChanged
                ? "border-oxblood text-oxblood"
                : "border-status-success text-status-success"
            }`}>
              {isChanged ? t("appeals.decisionChangedBadge") : t("appeals.upheldBadge")}
            </div>

            {/* Driver verdicts (only for changed decision) */}
            {isChanged && driverVerdicts.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wider text-meta">{t("appeals.newPenaltiesHeading")}</p>
                {driverVerdicts.map((dv) => (
                  <div key={dv.id} className="overflow-hidden rounded-[2px] border border-[color:var(--isl-hairline)]">
                    <div className="border-b border-[color:var(--isl-hairline)] bg-cream px-3 py-2">
                      <span className="text-sm font-semibold text-ink">{dv.driver?.name ?? dv.driverId}</span>
                    </div>
                    <div className="flex flex-wrap gap-2 px-3 py-2.5">
                      {dv.license_points != null && dv.license_points > 0 && (
                        <span className="rounded-[2px] border border-status-danger px-2.5 py-0.5 text-xs font-bold text-status-danger"><span className="num">+{dv.license_points}</span> {t("appeals.ptsSuffix")}</span>
                      )}
                      {dv.time_penalty_seconds != null && dv.time_penalty_seconds > 0 && (
                        <span className="rounded-[2px] border border-status-info px-2.5 py-0.5 text-xs font-bold text-status-info"><span className="num">+{dv.time_penalty_seconds}s</span></span>
                      )}
                      {dv.warning_text && (
                        <span className="rounded-[2px] border border-status-warning px-2.5 py-0.5 text-xs font-bold text-status-warning">⚠ {dv.warning_text}</span>
                      )}
                      {dv.license_points == null && dv.time_penalty_seconds == null && !dv.warning_text && (
                        <span className="text-xs italic text-faint">{t("appeals.noPenalties")}</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {verdict.verdict_summary && (
              <p className="font-semibold text-ink">{verdict.verdict_summary}</p>
            )}
            {verdict.verdict_full_text && (
              <p className="whitespace-pre-wrap text-sm text-ink-2">{verdict.verdict_full_text}</p>
            )}
            <p className="num text-xs text-faint">{t("appeals.publishedPrefix")} {fmtDateTime(verdict.published_at)}</p>
          </div>
        ) : (
          <>
            {!canEditVerdict && (
              <p className="mt-3 text-sm text-meta">{t("appeals.reviewingNotice")}</p>
            )}
            {canEditVerdict && !verdict?.is_published && verdict && (
              <form action={publishAppealVerdictAction} className="mt-4">
                <input type="hidden" name="appeal_id" value={appeal.id} />
                <FormActionButton
                  idleLabel={t("appeals.publishVerdictIdle")}
                  loadingLabel={t("appeals.publishVerdictLoading")}
                  spinnerClassName="border-bone/40 border-t-bone"
                  className="rounded-[2px] bg-ink text-bone px-5 py-2 text-sm font-semibold uppercase tracking-[0.08em] transition hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--isl-oxblood)]"
                />
              </form>
            )}
            {canEditVerdict && (
              <div className="mt-5 border-t border-[color:var(--isl-hairline)] pt-5">
                <AppealVerdictForm
                  appealId={appeal.id}
                  originalCaseDrivers={originalCaseDrivers}
                  existingVerdict={verdict}
                  existingDriverVerdicts={driverVerdicts}
                />
              </div>
            )}
          </>
        )}
      </section>

      {/* Status control for stewards */}
      {canEditVerdict && !verdict?.is_published && (
        <section className="steward-panel rounded-[2px] p-5">
          <h3 className="font-display text-base font-bold uppercase tracking-wider text-ink">{t("appeals.statusSectionHeading")}</h3>
          <form action={updateAppealStatusAction} className="mt-3 flex flex-wrap items-center gap-3">
            <input type="hidden" name="appeal_id" value={appeal.id} />
            <select name="status" defaultValue={appeal.status} className="rounded-[2px] border border-[color:var(--isl-hairline)] bg-paper text-ink px-3 py-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--isl-oxblood)]">
              {APPEAL_STATUSES.map((s) => <option key={s} value={s}>{t(`appeals.status.${STATUS_KEY[s]}`)}</option>)}
            </select>
            <FormActionButton idleLabel={t("appeals.updateStatusIdle")} loadingLabel={t("appeals.updateStatusLoading")}
              spinnerClassName="border-ink/30 border-t-ink"
              className="rounded-[2px] border border-hairline-strong text-ink px-4 py-2 text-sm font-semibold uppercase tracking-[0.08em] transition hover:border-ink hover:bg-cream disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--isl-oxblood)]" />
          </form>
        </section>
      )}

      {/* Internal discussion */}
      {canInternal && (
        <section className="steward-panel rounded-[2px] border-s-2 border-s-oxblood p-5">
          <h3 className="font-display text-base font-bold uppercase tracking-wider text-ink">{t("appeals.internalHeading")}</h3>
          <p className="mt-1 text-xs text-meta">{t("appeals.internalVisibility")}</p>
          <div className="mt-4 space-y-3">
            {internalComments.map((c) => (
              <article key={c.id} className="steward-soft rounded-[2px] p-3">
                <p className="text-xs text-meta">{c.author?.name ?? c.authorId} · <span className="num">{fmtDateTime(c.createdAt)}</span></p>
                <p className="mt-2 whitespace-pre-wrap text-ink-2">{c.text}</p>
              </article>
            ))}
            {internalComments.length === 0 && <p className="text-sm text-meta">{t("appeals.internalEmpty")}</p>}
          </div>
          <form action={addAppealInternalCommentAction} className="mt-4 grid gap-3">
            <input type="hidden" name="appeal_id" value={appeal.id} />
            <label className="block">
              <span className="mb-1 block text-xs text-ink-2">{t("appeals.addCommentLabel")}</span>
              <textarea name="text" rows={3} required dir="auto" className="w-full rounded-[2px] border border-[color:var(--isl-hairline)] bg-paper text-ink placeholder:text-faint px-3 py-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--isl-oxblood)]" />
            </label>
            <FormActionButton idleLabel={t("appeals.postCommentIdle")} loadingLabel={t("appeals.postCommentLoading")}
              spinnerClassName="border-ink/30 border-t-ink"
              className="w-fit rounded-[2px] border border-hairline-strong text-ink px-5 py-2.5 text-sm font-semibold uppercase tracking-[0.08em] transition hover:border-ink hover:bg-cream disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--isl-oxblood)]" />
          </form>
        </section>
      )}

      <div className="pt-2 flex items-center gap-4">
        {originalCase && (
          <Link href={`/stewards/cases/${originalCase.id}`}
            className="text-xs text-meta hover:text-oxblood transition">
            {t("appeals.backToCase")}
          </Link>
        )}
        <Link href="/stewards/appeals" className="text-xs text-meta hover:text-oxblood transition">
          {t("appeals.backToAll")}
        </Link>
      </div>
    </div>
  );
}

/* ── Evidence gallery ──────────────────────────────────────── */
function AppealEvidenceGallery({ attachments, links }: { attachments: AttachmentRef[]; links: string[] }) {
  const isImage = (url: string) => /\.(png|jpe?g|gif|webp|bmp|svg)(\?.*)?$/i.test(url);
  const isUrl   = (s: string)   => /^https?:\/\//i.test(s);
  return (
    <div className="space-y-3">
      {attachments.length > 0 && (
        <div className="flex flex-wrap gap-3">
          {attachments.map((a) =>
            isImage(a.url) ? (
              <a key={a.url} href={a.url} target="_blank" rel="noopener noreferrer"
                className="group relative block overflow-hidden rounded-[2px] border border-[color:var(--isl-hairline)] transition hover:border-oxblood">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={a.url} alt={a.name} className="h-36 w-52 object-cover transition group-hover:scale-105" />
                <div className="absolute inset-x-0 bottom-0 bg-[color:var(--isl-ink)]/70 px-2 py-1.5">
                  <p className="truncate text-[10px] text-bone">{a.name}</p>
                </div>
              </a>
            ) : (
              <a key={a.url} href={a.url} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-2 rounded-[2px] border border-[color:var(--isl-hairline)] bg-paper px-3 py-2 text-xs text-oxblood transition hover:border-oxblood hover:text-oxblood-deep">
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
                <a href={link} target="_blank" rel="noopener noreferrer"
                  className="flex max-w-xs items-center gap-1.5 rounded-[2px] border border-[color:var(--isl-hairline)] bg-paper px-3 py-1.5 text-xs text-oxblood transition hover:border-oxblood hover:text-oxblood-deep">
                  🔗 <span className="truncate">{link}</span>
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
