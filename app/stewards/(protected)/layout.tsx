import { getTranslations } from "next-intl/server";
import { logoutStewardAction } from "@/app/stewards/actions";
import FormActionButton from "@/app/stewards/components/FormActionButton";
import StewardNav from "@/app/stewards/components/StewardNav";
import ChangePasswordModal from "@/app/stewards/components/ChangePasswordModal";
import StewardLocaleToggle from "@/app/stewards/components/StewardLocaleToggle";
import { can, requireStewardUser } from "@/lib/stewards/auth";

export default async function StewardProtectedLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const user = await requireStewardUser();
  // Steward portal language is a per-user preference (Phase 9e). i18n/request.ts
  // resolves the request locale + messages from this same preference, so
  // getTranslations() below and all child components already render in it; here
  // we only need it for the dir/lang wrapper + the toggle's current state.
  const locale = user.locale === "he" ? "he" : "en";
  const t = await getTranslations("stewards");
  const dir = locale === "he" ? "rtl" : "ltr";
  const rolesDisplay = user.roles.map((r) => t(`shell.role.${r}`)).join(", ");

  return (
    <main dir={dir} lang={locale} className="stewards-ui bg-bone text-ink">
      <section className="border-b border-[color:var(--isl-hairline)] bg-paper">
        <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-3 px-6 py-4">
          <div>
            <h1 className="font-display text-2xl font-bold tracking-[0.005em] leading-[1.05] text-ink">{t("shell.title")}</h1>
            <p className="text-sm text-ink-2">{t("shell.signedInAs", { name: user.name, roles: rolesDisplay })}</p>
          </div>
          <div className="flex items-center gap-2">
            <StewardLocaleToggle locale={locale} />
            <ChangePasswordModal />
            <form action={logoutStewardAction}>
              <FormActionButton
                idleLabel={t("shell.signOut")}
                loadingLabel={t("shell.signingOut")}
                className="rounded-[2px] border border-[color:var(--isl-hairline)] px-4 py-2 text-sm font-semibold text-ink-2 transition-colors hover:border-ink hover:text-ink"
                spinnerClassName="border-[color:var(--isl-hairline-strong)] border-t-ink"
              />
            </form>
          </div>
        </div>
      </section>

      <StewardNav items={[
        { href: "/stewards",                    label: t("shell.nav.dashboard") },
        { href: "/stewards/cases",              label: t("shell.nav.cases") },
        { href: "/stewards/appeals",            label: t("shell.nav.appeals") },
        { href: "/stewards/penalties",          label: t("shell.nav.penalties") },
        { href: "/stewards/penalties-to-serve", label: t("shell.nav.penaltiesToServe") },
        ...(can(user, "manage_users") ? [{ href: "/stewards/admin", label: t("shell.nav.admin") }] : []),
      ]} />

      <div className="mx-auto w-full max-w-6xl px-6 py-8">{children}</div>
    </main>
  );
}
