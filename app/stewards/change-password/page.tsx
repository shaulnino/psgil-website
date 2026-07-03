import { requireStewardUserForPasswordChange } from "@/lib/stewards/auth";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { forcedChangePasswordAction } from "@/app/stewards/actions";
import ChangePasswordForm from "./ChangePasswordForm";

type SearchParams = Promise<{ error?: string }>;

export default async function ChangePasswordPage({ searchParams }: { searchParams: SearchParams }) {
  const user = await requireStewardUserForPasswordChange();
  // If they somehow land here without needing to change, send them home
  if (!user.mustChangePassword) redirect("/stewards");

  const t = await getTranslations("stewards");
  const params = await searchParams;
  const errorMsg =
    params.error === "mismatch"   ? t("auth.forced.errorMismatch") :
    params.error === "too-short"  ? t("auth.forced.errorTooShort") :
    null;

  return (
    <main className="stewards-ui min-h-screen bg-bone px-6 py-16 text-ink flex items-center justify-center">
      <div className="w-full max-w-md space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <p className="font-isl-body text-[0.75rem] font-semibold uppercase tracking-[0.2em] text-brass-ink">{t("auth.forced.eyebrow")}</p>
          <h1 className="font-display text-3xl font-bold tracking-[0.005em] leading-[1.05] text-ink">{t("auth.forced.title")}</h1>
          <p className="text-sm text-ink-2">
            {t.rich("auth.forced.welcome", {
              name: () => <span className="text-ink font-medium">{user.name}</span>,
            })}
          </p>
        </div>

        {/* Card */}
        <div className="steward-panel rounded-[2px] p-6 space-y-5">
          {/* Info banner */}
          <div className="flex items-start gap-3 rounded-[2px] border border-brass bg-cream px-4 py-3">
            <span className="mt-0.5 text-brass-ink text-base">🔒</span>
            <p className="text-sm text-ink-2 leading-relaxed">
              {t("auth.forced.banner")}
            </p>
          </div>

          {errorMsg && (
            <div className="rounded-[2px] border border-status-danger px-4 py-3 text-sm text-status-danger">
              {errorMsg}
            </div>
          )}

          <ChangePasswordForm action={forcedChangePasswordAction} requireCurrent={false} />
        </div>

        <p className="text-center text-xs text-faint">
          {t("auth.forced.footnote")}
        </p>
      </div>
    </main>
  );
}
