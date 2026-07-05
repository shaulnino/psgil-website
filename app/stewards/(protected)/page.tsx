import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { can, requireStewardUser } from "@/lib/stewards/auth";
import { isDriverRole } from "@/lib/accounts/types";
import { listCases, listPenaltiesToServe, listUsers } from "@/lib/stewards/repository";

export default async function StewardDashboardPage() {
  const user = await requireStewardUser();
  const t = await getTranslations("stewards");
  const isAdmin = can(user, "manage_users");

  const [cases, penaltiesToServe, allUsers] = await Promise.all([
    listCases(),
    listPenaltiesToServe(),
    listUsers(),
  ]);

  const total = cases.length;
  const open = cases.filter((c) => c.status === "Open" || c.status === "Under Review").length;
  const waiting = cases.filter((c) => c.status === "Waiting for Response").length;
  const closed = cases.filter((c) => c.status === "Closed").length;

  const activePenalties = penaltiesToServe.filter(
    (p) => p.status === "assigned" || p.status === "pending" || p.status === "awaiting_confirmation",
  );
  const awaitingConfirmation = penaltiesToServe.filter((p) => p.status === "awaiting_confirmation");

  return (
    <div className="space-y-6">
      <section className="steward-panel rounded-[2px] p-5">
        <h2 className="font-display text-2xl font-bold tracking-[0.005em] leading-[1.05] text-ink">{t("shell.dashboard.heading")}</h2>
        <p className="mt-1 text-ink-2">{t("shell.dashboard.subtitle")}</p>
      </section>

      {/* Admin alert: penalties awaiting confirmation */}
      {isAdmin && awaitingConfirmation.length > 0 && (
        <section className="rounded-[2px] border border-status-warning bg-paper px-4 py-3 flex items-center gap-3">
          <span className="relative flex h-2 w-2 shrink-0">
            <span className="relative inline-flex h-2 w-2 rounded-full bg-status-warning animate-[f1-tick_1s_step-end_infinite]" />
          </span>
          <div className="flex-1 text-sm text-ink-2">
            {t.rich("shell.dashboard.awaitingAlert", {
              count: awaitingConfirmation.length,
              strong: (chunks) => <strong className="num text-ink">{chunks}</strong>,
            })}
          </div>
          <Link href="/stewards/penalties-to-serve" className="shrink-0 rounded-[2px] border border-status-warning px-3 py-1 text-xs font-semibold uppercase tracking-[0.08em] text-status-warning transition-colors hover:bg-cream">
            {t("shell.dashboard.review")}
          </Link>
        </section>
      )}

      <section className="grid gap-4 md:grid-cols-4">
        <MetricCard label={t("shell.dashboard.metric.totalCases")} value={String(total)} />
        <MetricCard label={t("shell.dashboard.metric.openUnderReview")} value={String(open)} />
        <MetricCard label={t("shell.dashboard.metric.waitingForResponse")} value={String(waiting)} />
        <MetricCard label={t("shell.dashboard.metric.closed")} value={String(closed)} />
      </section>

      {activePenalties.length > 0 && (
        <section className="steward-panel rounded-[2px] p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-display font-bold tracking-[0.005em] leading-[1.05] text-ink">{t("shell.dashboard.penaltiesToServe.heading")}</h3>
              <p className="mt-0.5 text-xs text-meta">{t("shell.dashboard.penaltiesToServe.subtitle")}</p>
            </div>
            <Link href="/stewards/penalties-to-serve" className="rounded-[2px] border border-[color:var(--isl-hairline-strong)] px-3 py-1.5 text-xs uppercase tracking-[0.08em] text-ink transition-colors hover:border-ink">
              {t("shell.dashboard.penaltiesToServe.viewAll")}
            </Link>
          </div>
          <div className="mt-3 space-y-1.5">
            {activePenalties.slice(0, 3).map((p) => {
              const driver = allUsers.find((u) => u.id === p.driverId);
              return (
                <div key={p.id} className="flex flex-col gap-0.5 rounded-[2px] border border-[color:var(--isl-hairline)] bg-paper px-3 py-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-sm text-ink shrink-0">{p.penaltyLabel}</span>
                    <span className="text-xs text-faint">·</span>
                    <span className="text-xs font-medium text-ink-2 truncate">{driver?.name ?? p.driverId}</span>
                  </div>
                  <span className="text-xs text-ink-2 shrink-0">{p.assignedRaceLabel ?? t("shell.dashboard.unassigned")}</span>
                </div>
              );
            })}
          </div>
        </section>
      )}

      <section className="steward-panel rounded-[2px] p-5">
        <h3 className="text-lg font-display font-bold tracking-[0.005em] leading-[1.05] text-ink">{t("shell.dashboard.quickLinks.heading")}</h3>
        <div className="mt-3 flex flex-wrap gap-2">
          <Link href="/stewards/cases" className="rounded-[2px] bg-ink px-4 py-2 text-sm font-medium uppercase tracking-[0.08em] text-bone transition-opacity hover:opacity-90">{t("shell.dashboard.quickLinks.openCases")}</Link>
          {isDriverRole(user.roles) && (
            <Link
              href="/stewards/cases?open=1"
              className="rounded-[2px] border border-oxblood px-4 py-2 text-sm font-semibold uppercase tracking-[0.08em] text-oxblood transition-colors hover:bg-cream hover:text-oxblood-deep"
            >
              {t("shell.dashboard.quickLinks.createComplaint")}
            </Link>
          )}
          <Link href="/stewards/penalties" className="rounded-[2px] border border-[color:var(--isl-hairline-strong)] px-4 py-2 text-sm uppercase tracking-[0.08em] text-ink transition-colors hover:border-ink">{t("shell.dashboard.quickLinks.penaltyTracking")}</Link>
          <Link href="/stewards/penalties-to-serve" className="rounded-[2px] border border-[color:var(--isl-hairline-strong)] px-4 py-2 text-sm uppercase tracking-[0.08em] text-ink transition-colors hover:border-ink">{t("shell.dashboard.quickLinks.penaltiesToServe")}</Link>
          {isAdmin && (
            <Link href="/stewards/admin" className="rounded-[2px] border border-[color:var(--isl-hairline-strong)] px-4 py-2 text-sm uppercase tracking-[0.08em] text-ink transition-colors hover:border-ink">{t("shell.dashboard.quickLinks.userRoleAdmin")}</Link>
          )}
        </div>
      </section>
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="steward-panel rounded-[2px] p-4">
      <p className="font-isl-body text-[0.75rem] font-semibold uppercase tracking-[0.2em] text-oxblood">{label}</p>
      <p className="num mt-2 text-2xl font-semibold text-ink">{value}</p>
    </div>
  );
}
