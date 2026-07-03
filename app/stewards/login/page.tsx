import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { loginStewardAction } from "@/app/stewards/actions";
import { getCurrentStewardUser } from "@/lib/stewards/auth";
import FormActionButton from "@/app/stewards/components/FormActionButton";
import ForgotPasswordTip from "./ForgotPasswordTip";

type SearchParams = Promise<{ error?: string; next?: string }>;

export default async function StewardLoginPage({ searchParams }: { searchParams: SearchParams }) {
  const user = await getCurrentStewardUser();
  if (user?.isActive) redirect("/stewards");

  const t = await getTranslations("stewards");
  const params = await searchParams;

  return (
    <main className="stewards-ui min-h-[70vh] bg-bone px-6 py-16 text-ink">
      <div className="steward-panel mx-auto w-full max-w-md rounded-[2px] p-6">
        <h1 className="font-display font-bold tracking-[0.005em] leading-[1.05] text-3xl text-ink">{t("auth.login.title")}</h1>
        <p className="mt-2 text-sm text-meta">{t("auth.login.subtitle")}</p>

        {params.error && (
          <div className="mt-4 rounded-[2px] border border-status-danger bg-cream px-4 py-3 text-sm text-status-danger">
            {t("auth.login.error")}
          </div>
        )}

        <form action={loginStewardAction} className="mt-6 space-y-4">
          <label className="block">
            <span className="mb-1 block text-sm text-ink-2">{t("auth.login.emailLabel")}</span>
            <input
              type="email"
              name="email"
              required
              className="w-full rounded-[2px] border border-[color:var(--isl-hairline)] bg-paper px-3 py-2 text-ink placeholder:text-faint focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--isl-oxblood)] transition"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm text-ink-2">{t("auth.login.passwordLabel")}</span>
            <input
              type="password"
              name="password"
              required
              className="w-full rounded-[2px] border border-[color:var(--isl-hairline)] bg-paper px-3 py-2 text-ink placeholder:text-faint focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--isl-oxblood)] transition"
            />
          </label>
          <label className="flex cursor-pointer items-center gap-2.5 select-none">
            <input
              type="checkbox"
              name="remember_me"
              className="h-4 w-4 rounded-[2px] border border-[color:var(--isl-hairline)] bg-paper accent-[color:var(--isl-oxblood)] cursor-pointer"
            />
            <span className="text-sm text-meta">{t("auth.login.rememberMe")}</span>
          </label>
          <FormActionButton
            idleLabel={t("auth.login.submit")}
            loadingLabel={t("auth.login.submitting")}
            className="w-full justify-center rounded-[2px] bg-ink px-4 py-2.5 font-semibold text-bone transition hover:bg-oxblood"
          />
        </form>

        <div className="mt-5 border-t border-[color:var(--isl-hairline)] pt-4 text-center">
          <ForgotPasswordTip />
        </div>
      </div>
    </main>
  );
}
