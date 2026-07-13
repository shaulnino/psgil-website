import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import Section from "@/components/Section";
import { Button } from "@/components/ui/button";
import { requireUser } from "@/lib/auth/session";
import { logoutAction } from "@/lib/auth/actions";
import { isDriverRole } from "@/lib/accounts/types";
import { fetchUpcomingRaces } from "@/lib/attendance/races";
import { listAttendanceForDriver } from "@/lib/attendance/repository";
import type { AttendanceStatus } from "@/lib/attendance/types";
import ProfileForm from "./ProfileForm";
import PasswordForm from "./PasswordForm";
import DriverPhotoForm from "./DriverPhotoForm";
import AttendanceSection, { type AttendanceRaceView } from "./AttendanceSection";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("account.account");
  return { title: `${t("title")} | F1ISL` };
}

const cardClass = "rounded-[2px] border border-[color:var(--isl-hairline)] bg-cream p-6 md:p-8";
const sectionHeading = "font-display text-lg font-bold tracking-[0.02em] text-ink";

export default async function AccountPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ saved?: string; pw?: string; photo?: string }>;
}) {
  const user = await requireUser("/account");
  const t = await getTranslations("account.account");
  const tAtt = await getTranslations("attendance");
  const { locale } = await params;
  const sp = await searchParams;

  const flash = sp.saved
    ? t("saved")
    : sp.pw
      ? t("passwordChanged")
      : sp.photo
        ? t("photoUpdated")
        : null;
  const showDriverPhoto = isDriverRole(user.roles);
  const showAttendance = isDriverRole(user.roles) && !!user.driverId;

  let attendanceRaces: AttendanceRaceView[] = [];
  if (showAttendance) {
    const [upcoming, myRsvps] = await Promise.all([
      fetchUpcomingRaces(),
      listAttendanceForDriver(user.driverId!),
    ]);
    const statusByRace = new Map<string, AttendanceStatus>(
      myRsvps.map((r) => [r.raceId, r.status]),
    );
    attendanceRaces = upcoming.map((race) => {
      const name = locale === "he" ? race.nameHe : race.name;
      const meta = [race.date, race.startTime, race.league].filter(Boolean).join(" · ");
      return {
        raceId: race.raceId,
        label: race.raceCount > 1 ? `${name} (${tAtt("doubleHeader")})` : name,
        dateLabel: meta,
        currentStatus: statusByRace.get(race.raceId) ?? null,
      };
    });
  }

  return (
    <main className="text-ink-2">
      <Section title={t("title")} pageHeader>
        <div className="mx-auto max-w-2xl space-y-6">
          {flash && (
            <p className="rounded-[2px] border border-[color:var(--isl-success)] bg-[color:var(--isl-success)]/10 px-4 py-3 text-sm text-ink">
              {flash}
            </p>
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

          {showAttendance && (
            <div className={cardClass}>
              <h2 className={sectionHeading}>{tAtt("heading")}</h2>
              <div className="mt-4">
                <AttendanceSection races={attendanceRaces} />
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
