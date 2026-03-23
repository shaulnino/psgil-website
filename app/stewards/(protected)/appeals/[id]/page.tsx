import Link from "next/link";
import { notFound } from "next/navigation";
import { canCommentInternally, requireStewardUser } from "@/lib/stewards/auth";
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
  "Submitted":     "bg-amber-400/20 text-amber-200 border-amber-400/60",
  "Under Review":  "bg-purple-400/20 text-purple-200 border-purple-400/60",
  "Verdict Ready": "bg-emerald-400/20 text-emerald-200 border-emerald-400/60",
  "Closed":        "bg-green-500/20 text-green-200 border-green-500/60",
};

export default async function AppealDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ submitted?: string }>;
}) {
  const user = await requireStewardUser();
  const { id } = await params;
  const query = await searchParams;

  const data = await getAppealById(id);
  if (!data) notFound();

  const { appeal, originalCase, submittedBy, internalComments, verdict, driverVerdicts } = data;
  const allUsers = await listUsers();

  const canInternal = canCommentInternally(user.roles);
  const canEditVerdict = user.roles.includes("steward") || user.roles.includes("admin");
  const canAdmin = user.roles.includes("admin");
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
        <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
          ✓ Your appeal has been submitted. The stewards will review it shortly.
        </div>
      )}

      {/* Header */}
      <div className="steward-panel relative overflow-hidden rounded-2xl p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-bold uppercase tracking-widest text-[#D4AF37]/60">Appeal</p>
            <h1 className="font-display mt-1 text-2xl font-bold text-[#f4d98a]">
              Appeal — Case #{originalCase?.caseNumber ?? "–"}
            </h1>
            <p className="mt-1 text-sm text-white/60">{originalCase?.title}</p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className={`inline-flex items-center rounded-full border px-3 py-1 text-[11px] font-bold uppercase tracking-widest ${STATUS_STYLE[appeal.status]}`}>
                {appeal.status}
              </span>
              {isChanged && (
                <span className="inline-flex items-center rounded-full border border-purple-400/60 bg-purple-400/15 px-3 py-1 text-[11px] font-bold uppercase tracking-widest text-purple-200">
                  ⚡ Decision Changed
                </span>
              )}
              {isUpheld && (
                <span className="inline-flex items-center rounded-full border border-emerald-400/50 bg-emerald-400/12 px-3 py-1 text-[11px] font-bold uppercase tracking-widest text-emerald-200">
                  ✓ Original Decision Upheld
                </span>
              )}
            </div>
          </div>
          {canAdmin && <DeleteAppealForm appealId={appeal.id} />}
        </div>
      </div>

      {/* Meta */}
      <div className="grid gap-4 md:grid-cols-3">
        <div className="steward-panel rounded-2xl p-4">
          <p className="text-[10px] font-bold uppercase tracking-widest text-white/40">Appellant</p>
          <p className="mt-1 text-sm font-semibold text-white/90">{submittedBy?.name ?? appeal.submittedByUserId}</p>
        </div>
        <div className="steward-panel rounded-2xl p-4">
          <p className="text-[10px] font-bold uppercase tracking-widest text-white/40">Filed</p>
          <p className="mt-1 text-sm text-white/80">{new Date(appeal.submittedAt).toLocaleString()}</p>
        </div>
        <div className="steward-panel rounded-2xl p-4">
          <p className="text-[10px] font-bold uppercase tracking-widest text-white/40">Original Case</p>
          {originalCase && (
            <Link href={`/stewards/cases/${originalCase.id}?view=driver`}
              className="mt-1 block text-sm text-[#d4afff] hover:text-white transition truncate">
              #{originalCase.caseNumber} — {originalCase.title}
            </Link>
          )}
        </div>
      </div>

      {/* Appeal details */}
      <section className="steward-panel rounded-2xl p-5">
        <h2 className="text-base font-semibold uppercase tracking-wider text-[#D4AF37]">1 · Appeal</h2>
        <div className="mt-3 rounded-xl border border-white/10 bg-black/20 p-4">
          <p className="whitespace-pre-wrap text-sm text-white/85 leading-relaxed">{appeal.description}</p>
        </div>

        {(appeal.attachments.length > 0 || appeal.links.length > 0) && (
          <div className="mt-4 border-t border-white/10 pt-4">
            <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-[#D4AF37]/60">Evidence</p>
            <AppealEvidenceGallery attachments={appeal.attachments} links={appeal.links} />
          </div>
        )}
      </section>

      {/* Verdict */}
      <section className="steward-panel rounded-2xl p-5">
        <h2 className="text-base font-semibold uppercase tracking-wider text-[#D4AF37]">2 · Appeal Verdict</h2>

        {verdict?.is_published ? (
          <div className="mt-4 space-y-4">
            {/* Outcome badge */}
            <div className={`inline-flex items-center rounded-full border px-4 py-1.5 text-sm font-bold uppercase tracking-wider ${
              isChanged
                ? "border-purple-400/70 bg-purple-400/20 text-purple-200"
                : "border-emerald-400/60 bg-emerald-400/15 text-emerald-200"
            }`}>
              {isChanged ? "⚡ Decision Changed" : "✓ Original Decision Upheld"}
            </div>

            {/* Driver verdicts (only for changed decision) */}
            {isChanged && driverVerdicts.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wider text-white/50">New Penalties</p>
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
              </div>
            )}

            {verdict.verdict_summary && (
              <p className="font-semibold text-white/90">{verdict.verdict_summary}</p>
            )}
            {verdict.verdict_full_text && (
              <p className="whitespace-pre-wrap text-sm text-white/70">{verdict.verdict_full_text}</p>
            )}
            <p className="text-xs text-white/30">Published {verdict.published_at ? new Date(verdict.published_at).toLocaleString() : ""}</p>
          </div>
        ) : (
          <>
            {!canEditVerdict && (
              <p className="mt-3 text-sm text-white/50">The stewards are reviewing this appeal. A decision will be published shortly.</p>
            )}
            {canEditVerdict && !verdict?.is_published && verdict && (
              <form action={publishAppealVerdictAction} className="mt-4">
                <input type="hidden" name="appeal_id" value={appeal.id} />
                <FormActionButton
                  idleLabel="Publish Appeal Verdict"
                  loadingLabel="Publishing…"
                  className="rounded-full bg-emerald-600 px-5 py-2 text-sm font-semibold shadow-[0_0_14px_rgba(16,185,129,0.25)] transition hover:bg-emerald-500"
                />
              </form>
            )}
            {canEditVerdict && (
              <div className="mt-5 border-t border-white/10 pt-5">
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
        <section className="steward-panel rounded-2xl p-5">
          <h3 className="text-base font-semibold uppercase tracking-wider text-[#D4AF37]">Appeal Status</h3>
          <form action={updateAppealStatusAction} className="mt-3 flex flex-wrap items-center gap-3">
            <input type="hidden" name="appeal_id" value={appeal.id} />
            <select name="status" defaultValue={appeal.status} className="rounded-lg border border-white/15 bg-black/30 px-3 py-2">
              {APPEAL_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            <FormActionButton idleLabel="Update Status" loadingLabel="Updating…"
              className="rounded-full border border-white/25 bg-white/8 px-4 py-2 text-sm font-semibold transition hover:border-[#D4AF37]/50 hover:bg-[#D4AF37]/15 hover:text-[#f4d98a] disabled:opacity-50" />
          </form>
        </section>
      )}

      {/* Internal discussion */}
      {canInternal && (
        <section className="steward-panel rounded-2xl border border-[#7020B0]/40 p-5">
          <h3 className="text-base font-semibold uppercase tracking-wider text-[#D4AF37]">3 · Internal Discussion</h3>
          <p className="mt-1 text-xs text-white/50">Visible to stewards and admins only.</p>
          <div className="mt-4 space-y-3">
            {internalComments.map((c) => (
              <article key={c.id} className="steward-soft rounded-lg p-3">
                <p className="text-xs text-white/55">{c.author?.name ?? c.authorId} · {new Date(c.createdAt).toLocaleString()}</p>
                <p className="mt-2 whitespace-pre-wrap text-white/85">{c.text}</p>
              </article>
            ))}
            {internalComments.length === 0 && <p className="text-sm text-white/50">No internal discussion yet.</p>}
          </div>
          <form action={addAppealInternalCommentAction} className="mt-4 grid gap-3">
            <input type="hidden" name="appeal_id" value={appeal.id} />
            <label className="block">
              <span className="mb-1 block text-xs text-white/70">Add comment</span>
              <textarea name="text" rows={3} required className="w-full rounded-lg border border-white/15 bg-black/30 px-3 py-2" />
            </label>
            <FormActionButton idleLabel="Post Comment" loadingLabel="Posting…"
              className="w-fit rounded-full border border-[#7020B0]/60 bg-[#7020B0]/20 px-5 py-2.5 text-sm font-semibold transition hover:border-[#7020B0] hover:bg-[#7020B0]/40 hover:shadow-[0_0_14px_rgba(112,32,176,0.35)] disabled:opacity-50" />
          </form>
        </section>
      )}

      <div className="pt-2 flex items-center gap-4">
        {originalCase && (
          <Link href={`/stewards/cases/${originalCase.id}`}
            className="text-xs text-white/40 hover:text-[#D4AF37] transition">
            ← Back to original case
          </Link>
        )}
        <Link href="/stewards/appeals" className="text-xs text-white/40 hover:text-[#D4AF37] transition">
          ← All appeals
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
                className="group relative block overflow-hidden rounded-xl border border-[#D4AF37]/25 shadow-md transition hover:border-[#D4AF37]/70">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={a.url} alt={a.name} className="h-36 w-52 object-cover transition group-hover:scale-105" />
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent px-2 py-1.5">
                  <p className="truncate text-[10px] text-white/70">{a.name}</p>
                </div>
              </a>
            ) : (
              <a key={a.url} href={a.url} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-2 rounded-lg border border-white/15 bg-black/30 px-3 py-2 text-xs text-[#d4afff] transition hover:border-[#D4AF37]/50 hover:text-white">
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
                  className="flex max-w-xs items-center gap-1.5 rounded-lg border border-white/15 bg-black/30 px-3 py-1.5 text-xs text-[#d4afff] transition hover:border-[#D4AF37]/50 hover:text-white">
                  🔗 <span className="truncate">{link}</span>
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
