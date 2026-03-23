import Link from "next/link";
import { requireStewardUser } from "@/lib/stewards/auth";
import { listCases, listPenaltiesToServe, listUsers } from "@/lib/stewards/repository";

export default async function StewardDashboardPage() {
  const user = await requireStewardUser();
  const isAdmin = user.roles.includes("admin");

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
      <section className="steward-panel rounded-2xl p-5">
        <h2 className="font-display text-2xl font-semibold">Dashboard</h2>
        <p className="mt-1 text-white/70">Internal steward workflow for complaints, responses, deliberation, and verdicts.</p>
      </section>

      {/* Admin alert: penalties awaiting confirmation */}
      {isAdmin && awaitingConfirmation.length > 0 && (
        <section className="rounded-xl border border-amber-500/40 bg-amber-500/8 px-4 py-3 flex items-center gap-3">
          <span className="relative flex h-2.5 w-2.5 shrink-0">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-60" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-amber-400" />
          </span>
          <div className="flex-1 text-sm text-amber-100">
            <strong>{awaitingConfirmation.length}</strong> {awaitingConfirmation.length === 1 ? "penalty" : "penalties"} awaiting service confirmation after a completed race.
          </div>
          <Link href="/stewards/penalties-to-serve" className="shrink-0 rounded-full bg-amber-500/20 border border-amber-400/50 px-3 py-1 text-xs font-semibold text-amber-200 transition hover:bg-amber-500/30">
            Review
          </Link>
        </section>
      )}

      <section className="grid gap-4 md:grid-cols-4">
        <MetricCard label="Total Cases" value={String(total)} />
        <MetricCard label="Open / Under Review" value={String(open)} />
        <MetricCard label="Waiting for Response" value={String(waiting)} />
        <MetricCard label="Closed" value={String(closed)} />
      </section>

      {activePenalties.length > 0 && (
        <section className="steward-panel rounded-2xl p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-semibold">Penalties to Serve</h3>
              <p className="mt-0.5 text-xs text-white/50">Upcoming race-service penalties</p>
            </div>
            <Link href="/stewards/penalties-to-serve" className="rounded-full border border-white/20 px-3 py-1.5 text-xs transition hover:border-white/40">
              View all
            </Link>
          </div>
          <div className="mt-3 space-y-1.5">
            {activePenalties.slice(0, 3).map((p) => {
              const driver = allUsers.find((u) => u.id === p.driverId);
              return (
                <div key={p.id} className="flex items-center justify-between gap-3 rounded-lg border border-white/8 bg-white/3 px-3 py-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-sm text-white/80 shrink-0">{p.penaltyLabel}</span>
                    <span className="text-xs text-white/40">·</span>
                    <span className="text-xs font-medium text-white/60 truncate">{driver?.name ?? p.driverId}</span>
                  </div>
                  <span className="text-xs text-[#f4d98a]/80 shrink-0">{p.assignedRaceLabel ?? "Unassigned"}</span>
                </div>
              );
            })}
          </div>
        </section>
      )}

      <section className="steward-panel rounded-2xl p-5">
        <h3 className="text-lg font-semibold">Quick links</h3>
        <div className="mt-3 flex flex-wrap gap-2">
          <Link href="/stewards/cases" className="rounded-full bg-[#7020B0] px-4 py-2 text-sm">Open Cases</Link>
          {user.roles.includes("member") && (
            <Link
              href="/stewards/cases?open=1"
              className="rounded-full border border-[#D4AF37]/50 bg-[#D4AF37]/10 px-4 py-2 text-sm font-semibold text-[#f4d98a] transition hover:border-[#D4AF37]/80 hover:bg-[#D4AF37]/20"
            >
              + Create Complaint
            </Link>
          )}
          <Link href="/stewards/penalties" className="rounded-full border border-white/20 px-4 py-2 text-sm">Penalty Tracking</Link>
          <Link href="/stewards/penalties-to-serve" className="rounded-full border border-white/20 px-4 py-2 text-sm">Penalties to Serve</Link>
          {isAdmin && (
            <Link href="/stewards/admin" className="rounded-full border border-white/20 px-4 py-2 text-sm">User & Role Admin</Link>
          )}
        </div>
      </section>
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="steward-panel rounded-2xl p-4">
      <p className="text-xs uppercase tracking-wider text-white/60">{label}</p>
      <p className="mt-2 text-2xl font-semibold">{value}</p>
    </div>
  );
}
