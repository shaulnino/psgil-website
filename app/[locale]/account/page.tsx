import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import Section from "@/components/Section";
import { Button } from "@/components/ui/button";
import { requireUser } from "@/lib/auth/session";
import { logoutAction } from "@/lib/auth/actions";
import { isDriverRole } from "@/lib/accounts/types";
import ProfileForm from "./ProfileForm";
import PasswordForm from "./PasswordForm";
import ResendVerification from "./ResendVerification";
import DriverPhotoForm from "./DriverPhotoForm";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("account.account");
  return { title: `${t("title")} | F1ISL` };
}

const cardClass = "rounded-[2px] border border-[color:var(--isl-hairline)] bg-cream p-6 md:p-8";
const sectionHeading = "font-display text-lg font-bold tracking-[0.02em] text-ink";

export default async function AccountPage({
  searchParams,
}: {
  searchParams: Promise<{ welcome?: string; saved?: string; pw?: string; photo?: string }>;
}) {
  const user = await requireUser("/account");
  const t = await getTranslations("account.account");
  const sp = await searchParams;

  const flash = sp.welcome
    ? t("welcome")
    : sp.saved
      ? t("saved")
      : sp.pw
        ? t("passwordChanged")
        : sp.photo
          ? t("photoUpdated")
          : null;
  const showDriverPhoto = isDriverRole(user.roles);

  return (
    <main className="text-ink-2">
      <Section title={t("title")} pageHeader>
        <div className="mx-auto max-w-2xl space-y-6">
          {flash && (
            <p className="rounded-[2px] border border-[color:var(--isl-success)] bg-[color:var(--isl-success)]/10 px-4 py-3 text-sm text-ink">
              {flash}
            </p>
          )}

          {user.status === "pending" && (
            <p className="rounded-[2px] border border-[color:var(--isl-warning)] bg-[color:var(--isl-warning)]/10 px-4 py-3 text-sm text-ink">
              {t("pendingBanner")}
            </p>
          )}

          {!user.emailVerified && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-[2px] border border-[color:var(--isl-warning)] bg-[color:var(--isl-warning)]/10 px-4 py-3 text-sm text-ink">
              <span>{t("unverifiedBanner")}</span>
              <ResendVerification />
            </div>
          )}

          <div className={cardClass}>
            <h2 className={sectionHeading}>{t("profile")}</h2>
            <div className="mt-4">
              <ProfileForm name={user.name} email={user.email} />
            </div>
            <dl className="mt-6 space-y-2 border-t border-[color:var(--isl-hairline)] pt-4 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-meta">{t("roles")}</dt>
                <dd className="text-ink-2">{user.roles.join(", ") || "—"}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-meta">{t("driverLink")}</dt>
                <dd className="text-ink-2">{user.driverId ?? t("notLinked")}</dd>
              </div>
            </dl>
          </div>

          {showDriverPhoto && (
            <div className={cardClass}>
              <h2 className={sectionHeading}>{t("photoHeading")}</h2>
              <div className="mt-4">
                {user.driverId ? (
                  <DriverPhotoForm currentPhotoUrl={user.driverPhotoUrl} />
                ) : (
                  <p className="text-sm text-meta">{t("photoNotLinked")}</p>
                )}
              </div>
            </div>
          )}

          <div className={cardClass}>
            <h2 className={sectionHeading}>{t("security")}</h2>
            <div className="mt-4">
              <PasswordForm />
            </div>
          </div>

          <form action={logoutAction}>
            <Button type="submit" variant="ghost">
              {t("signOut")}
            </Button>
          </form>
        </div>
      </Section>
    </main>
  );
}
