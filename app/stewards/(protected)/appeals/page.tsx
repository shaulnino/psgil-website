import Link from "next/link";
import { fmtDate } from "@/app/stewards/lib/dates";
import { can, requireStewardUser } from "@/lib/stewards/auth";
import { listAppeals } from "@/lib/stewards/repository";
import type { AppealStatus } from "@/lib/stewards/types";

const STATUS_STYLE: Record<AppealStatus, string> = {
  "Submitted":     "text-status-info border-status-info",
  "Under Review":  "text-status-warning border-status-warning",
  "Verdict Ready": "text-brass-ink border-brass",
  "Closed":        "text-status-success border-status-success",
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
      <section className="steward-panel rounded-[2px] p-5">
        <h2 className="font-display font-bold tracking-[0.005em] leading-[1.05] text-ink text-2xl">Appeals</h2>
        <p className="mt-1 text-ink-2">
          {canSeeAll
            ? "All appeals filed against published case verdicts."
            : "Appeals you have submitted."}
        </p>
      </section>

      {/* Active appeals */}
      <section className="steward-panel overflow-hidden rounded-[2px]">
        <div className="border-b border-[color:var(--isl-hairline)] px-5 py-4">
          <h3 className="text-base font-semibold text-ink">Active Appeals</h3>
        </div>
        {active.length === 0 ? (
          <p className="px-5 py-6 text-sm text-meta">No active appeals.</p>
        ) : (
          <div className="divide-y divide-[color:var(--isl-hairline)]">
            {active.map(({ appeal, originalCase, submittedBy }) => (
              <Link key={appeal.id} href={`/stewards/appeals/${appeal.id}`}
                className="group flex items-center justify-between gap-4 px-5 py-4 transition hover:bg-cream">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-ink truncate">
                      Appeal — Case #{originalCase?.caseNumber ?? "–"}
                    </span>
                    {appeal.status === "Submitted" && (
                      <span className="inline-flex items-center gap-1 rounded-[2px] border border-status-warning px-2 py-0.5 text-[9px] font-bold uppercase tracking-widest text-status-warning">
                        <span className="h-1.5 w-1.5 rounded-full bg-status-warning animate-[f1-tick_1s_step-end_infinite]" />
                        Needs Review
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 text-xs text-meta truncate">
                    {originalCase?.title} · Appellant: {submittedBy?.name ?? "—"}
                  </p>
                  <p className="num text-xs text-faint">{fmtDate(appeal.submittedAt)}</p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className={`inline-flex items-center rounded-[2px] border px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-widest ${STATUS_STYLE[appeal.status]}`}>
                    {appeal.status}
                  </span>
                  <span className="text-xs text-oxblood group-hover:text-oxblood-deep">Open →</span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* Closed appeals */}
      {closed.length > 0 && (
        <section className="steward-panel overflow-hidden rounded-[2px]">
          <div className="border-b border-[color:var(--isl-hairline)] px-5 py-4">
            <h3 className="text-base font-semibold text-ink-2">Closed Appeals</h3>
          </div>
          <div className="divide-y divide-[color:var(--isl-hairline)]">
            {closed.map(({ appeal, originalCase, submittedBy, verdict }) => {
              const changed = verdict?.outcomeType === "changed_decision";
              return (
                <Link key={appeal.id} href={`/stewards/appeals/${appeal.id}`}
                  className="group flex items-center justify-between gap-4 px-5 py-4 opacity-75 transition hover:bg-cream hover:opacity-100">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-ink-2 group-hover:text-ink truncate">
                        Appeal — Case #{originalCase?.caseNumber ?? "–"}
                      </span>
                      {changed ? (
                        <span className="rounded-[2px] border border-brass px-2 py-0.5 text-[9px] font-bold uppercase tracking-widest text-brass-ink">⚡ Decision Changed</span>
                      ) : verdict?.is_published ? (
                        <span className="rounded-[2px] border border-status-success px-2 py-0.5 text-[9px] font-bold uppercase tracking-widest text-status-success">✓ Upheld</span>
                      ) : null}
                    </div>
                    <p className="mt-0.5 text-xs text-meta truncate">
                      {originalCase?.title} · {submittedBy?.name ?? "—"}
                    </p>
                  </div>
                  <span className="text-xs text-meta group-hover:text-oxblood shrink-0">View →</span>
                </Link>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
