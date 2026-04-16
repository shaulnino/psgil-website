import Link from "next/link";
import { fmtDate } from "@/app/stewards/lib/dates";
import { can, requireStewardUser } from "@/lib/stewards/auth";
import { listAppeals } from "@/lib/stewards/repository";
import type { AppealStatus } from "@/lib/stewards/types";

const STATUS_STYLE: Record<AppealStatus, string> = {
  "Submitted":     "bg-amber-400/20 text-amber-200 border-amber-400/60",
  "Under Review":  "bg-purple-400/20 text-purple-200 border-purple-400/60",
  "Verdict Ready": "bg-emerald-400/20 text-emerald-200 border-emerald-400/60",
  "Closed":        "bg-green-500/20 text-green-200 border-green-500/60",
};

export default async function AppealsListPage() {
  const user = await requireStewardUser();
  const canSeeAll = can(user, "view_internal_discussion");
  const all = await listAppeals();

  // Members only see appeals they submitted
  const appeals = canSeeAll
    ? all
    : all.filter((a) => a.appeal.submittedByUserId === user.id);

  const active = appeals.filter((a) => a.appeal.status !== "Closed");
  const closed = appeals.filter((a) => a.appeal.status === "Closed");

  return (
    <div className="space-y-6">
      <section className="steward-panel rounded-2xl p-5">
        <h2 className="font-display text-2xl font-semibold">Appeals</h2>
        <p className="mt-1 text-white/70">
          {canSeeAll
            ? "All appeals filed against published case verdicts."
            : "Appeals you have submitted."}
        </p>
      </section>

      {/* Active appeals */}
      <section className="steward-panel overflow-hidden rounded-2xl">
        <div className="border-b border-white/10 px-5 py-4">
          <h3 className="text-base font-semibold">Active Appeals</h3>
        </div>
        {active.length === 0 ? (
          <p className="px-5 py-6 text-sm text-white/50">No active appeals.</p>
        ) : (
          <div className="divide-y divide-white/8">
            {active.map(({ appeal, originalCase, submittedBy }) => (
              <Link key={appeal.id} href={`/stewards/appeals/${appeal.id}`}
                className="group flex items-center justify-between gap-4 px-5 py-4 transition hover:bg-steward-gold/5">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-white/90 group-hover:text-white truncate">
                      Appeal — Case #{originalCase?.caseNumber ?? "–"}
                    </span>
                    {appeal.status === "Submitted" && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/20 border border-amber-400/50 px-2 py-0.5 text-[9px] font-bold uppercase tracking-widest text-amber-200">
                        <span className="relative flex h-1.5 w-1.5"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-300 opacity-70" /><span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-amber-300" /></span>
                        Needs Review
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 text-xs text-white/50 truncate">
                    {originalCase?.title} · Appellant: {submittedBy?.name ?? "—"}
                  </p>
                  <p className="text-xs text-white/35">{fmtDate(appeal.submittedAt)}</p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-widest ${STATUS_STYLE[appeal.status]}`}>
                    {appeal.status}
                  </span>
                  <span className="text-xs text-steward-gold/60 group-hover:text-steward-gold">Open →</span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* Closed appeals */}
      {closed.length > 0 && (
        <section className="steward-panel overflow-hidden rounded-2xl">
          <div className="border-b border-white/10 px-5 py-4">
            <h3 className="text-base font-semibold text-white/60">Closed Appeals</h3>
          </div>
          <div className="divide-y divide-white/8">
            {closed.map(({ appeal, originalCase, submittedBy, verdict }) => {
              const changed = verdict?.outcomeType === "changed_decision";
              return (
                <Link key={appeal.id} href={`/stewards/appeals/${appeal.id}`}
                  className="group flex items-center justify-between gap-4 px-5 py-4 opacity-75 transition hover:bg-steward-gold/4 hover:opacity-100">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-white/70 group-hover:text-white/90 truncate">
                        Appeal — Case #{originalCase?.caseNumber ?? "–"}
                      </span>
                      {changed ? (
                        <span className="rounded-full border border-purple-400/50 bg-purple-400/12 px-2 py-0.5 text-[9px] font-bold uppercase tracking-widest text-purple-300">⚡ Decision Changed</span>
                      ) : verdict?.is_published ? (
                        <span className="rounded-full border border-emerald-400/40 bg-emerald-400/8 px-2 py-0.5 text-[9px] font-bold uppercase tracking-widest text-emerald-300">✓ Upheld</span>
                      ) : null}
                    </div>
                    <p className="mt-0.5 text-xs text-white/40 truncate">
                      {originalCase?.title} · {submittedBy?.name ?? "—"}
                    </p>
                  </div>
                  <span className="text-xs text-white/30 group-hover:text-white/60 shrink-0">View →</span>
                </Link>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
