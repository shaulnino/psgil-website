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
    <main className="stewards-ui flex min-h-[80vh] items-center justify-center px-6 py-16 text-ink">
      <div className="isl-corner-ticks relative mx-auto w-full max-w-md">
      <div className="steward-panel rounded-[2px] p-7">
        {/* Race-control access header */}
        <div className="flex flex-col items-center text-center">
          <span className="inline-flex h-12 w-12 items-center justify-center rounded-[2px] border border-brass text-brass-ink">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-6 w-6">
              <path fillRule="evenodd" d="M10 1a4.5 4.5 0 00-4.5 4.5V9H5a2 2 0 00-2 2v6a2 2 0 002 2h10a2 2 0 002-2v-6a2 2 0 00-2-2h-.5V5.5A4.5 4.5 0 0010 1zm3 8V5.5a3 3 0 10-6 0V9h6z" clipRule="evenodd" />
            </svg>
          </span>
          <h1 className="mt-4 font-display font-bold tracking-[0.005em] leading-[1.05] text-3xl text-ink">{t("auth.login.title")}</h1>
          <div className="isl-gold-rule mt-3 w-24" />
          <p className="mt-3 text-sm text-meta">{t("auth.login.subtitle")}</p>
        </div>

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
            className="w-full justify-center rounded-[2px] bg-oxblood px-4 py-2.5 font-semibold uppercase tracking-[0.08em] text-bone transition hover:bg-oxblood-deep"
          />
        </form>

        <div className="mt-5 border-t border-[color:var(--isl-hairline)] pt-4 text-center">
          <ForgotPasswordTip />
        </div>
      </div>
      </div>
    </main>
  );
}
