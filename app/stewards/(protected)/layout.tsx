import { logoutStewardAction } from "@/app/stewards/actions";
import FormActionButton from "@/app/stewards/components/FormActionButton";
import StewardNav from "@/app/stewards/components/StewardNav";
import ChangePasswordModal from "@/app/stewards/components/ChangePasswordModal";
import { can, requireStewardUser } from "@/lib/stewards/auth";

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
          <div className="flex items-center gap-2">
            <ChangePasswordModal />
            <form action={logoutStewardAction}>
              <FormActionButton
                idleLabel="Sign out"
                loadingLabel="Signing out..."
                className="rounded-full border border-white/20 px-4 py-2 text-sm font-semibold text-white/90 transition hover:border-white/40"
              />
            </form>
          </div>
        </div>
      </section>

      <StewardNav items={[
        { href: "/stewards",                    label: "Dashboard" },
        { href: "/stewards/cases",              label: "Cases" },
        { href: "/stewards/appeals",            label: "Appeals" },
        { href: "/stewards/penalties",          label: "Penalties" },
        { href: "/stewards/penalties-to-serve", label: "Penalties to Serve" },
        ...(can(user, "manage_users") ? [{ href: "/stewards/admin", label: "Admin" }] : []),
      ]} />

      <div className="mx-auto w-full max-w-6xl px-6 py-8">{children}</div>
    </main>
  );
}
