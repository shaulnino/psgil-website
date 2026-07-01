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
    <main className="stewards-ui bg-bone text-ink">
      <section className="border-b border-[color:var(--isl-hairline)] bg-paper">
        <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-3 px-6 py-4">
          <div>
            <h1 className="font-display text-2xl font-bold tracking-[0.005em] leading-[1.05] text-ink">Steward System</h1>
            <p className="text-sm text-ink-2">Signed in as {user.name} ({user.roles.join(", ")})</p>
          </div>
          <div className="flex items-center gap-2">
            <ChangePasswordModal />
            <form action={logoutStewardAction}>
              <FormActionButton
                idleLabel="Sign out"
                loadingLabel="Signing out..."
                className="rounded-[2px] border border-[color:var(--isl-hairline)] px-4 py-2 text-sm font-semibold text-ink-2 transition-colors hover:border-ink hover:text-ink"
                spinnerClassName="border-[color:var(--isl-hairline-strong)] border-t-ink"
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
