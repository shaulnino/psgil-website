import Link from "next/link";
import { logoutStewardAction } from "@/app/stewards/actions";
import FormActionButton from "@/app/stewards/components/FormActionButton";
import { requireStewardUser } from "@/lib/stewards/auth";

export default async function StewardProtectedLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const user = await requireStewardUser();

  return (
    <main className="stewards-ui bg-[#0B0B0E] text-white">
      <section className="border-b border-white/10 bg-[#111119]">
        <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-3 px-6 py-4">
          <div>
            <h1 className="font-display text-2xl font-semibold tracking-wide">Steward System</h1>
            <p className="text-sm text-white/70">Signed in as {user.name} ({user.roles.join(", ")})</p>
          </div>
          <form action={logoutStewardAction}>
            <FormActionButton
              idleLabel="Sign out"
              loadingLabel="Signing out..."
              className="rounded-full border border-white/20 px-4 py-2 text-sm font-semibold text-white/90 transition hover:border-white/40"
            />
          </form>
        </div>
      </section>

      <nav className="border-b border-white/10 bg-[#0f0f14]">
        <div className="mx-auto flex w-full max-w-6xl flex-wrap gap-2 px-6 py-3 text-sm">
          <Link href="/stewards" className="rounded-full px-3 py-1.5 transition hover:bg-[#D4AF37]/10 hover:text-[#f3d98a]">Dashboard</Link>
          <Link href="/stewards/cases" className="rounded-full px-3 py-1.5 transition hover:bg-[#D4AF37]/10 hover:text-[#f3d98a]">Cases</Link>
          <Link href="/stewards/penalties" className="rounded-full px-3 py-1.5 transition hover:bg-[#D4AF37]/10 hover:text-[#f3d98a]">Penalties</Link>
          {user.roles.includes("admin") && (
            <Link href="/stewards/admin" className="rounded-full px-3 py-1.5 transition hover:bg-[#D4AF37]/10 hover:text-[#f3d98a]">Admin</Link>
          )}
        </div>
      </nav>

      <div className="mx-auto w-full max-w-6xl px-6 py-8">{children}</div>
    </main>
  );
}
