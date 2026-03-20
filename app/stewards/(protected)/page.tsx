import Link from "next/link";
import { requireStewardUser } from "@/lib/stewards/auth";
import { listCases } from "@/lib/stewards/repository";

export default async function StewardDashboardPage() {
  const user = await requireStewardUser();
  const cases = await listCases();
  const total = cases.length;
  const open = cases.filter((c) => c.status === "Open" || c.status === "Under Review").length;
  const waiting = cases.filter((c) => c.status === "Waiting for Response").length;
  const closed = cases.filter((c) => c.status === "Closed").length;

  return (
    <div className="space-y-6">
      <section className="steward-panel rounded-2xl p-5">
        <h2 className="font-display text-2xl font-semibold">Dashboard</h2>
        <p className="mt-1 text-white/70">Internal steward workflow for complaints, responses, deliberation, and verdicts.</p>
      </section>
      <section className="grid gap-4 md:grid-cols-4">
        <MetricCard label="Total Cases" value={String(total)} />
        <MetricCard label="Open / Under Review" value={String(open)} />
        <MetricCard label="Waiting for Response" value={String(waiting)} />
        <MetricCard label="Closed" value={String(closed)} />
      </section>
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
          {user.roles.includes("admin") && (
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
