import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import Section from "@/components/Section";
import { Button } from "@/components/ui/button";
import { requireUser } from "@/lib/auth/session";
import { logoutAction } from "@/lib/auth/actions";
import { can } from "@/lib/stewards/auth";
import { isDriverRole } from "@/lib/accounts/types";
import LoadingLink from "@/components/LoadingLink";
import { fetchCsv, parseCsv } from "@/lib/csv";
import { mapDrivers, mapTeams } from "@/lib/driversData";
import { GLOBAL_CSV_URLS } from "@/lib/seasonConfig";
import { fetchNextRaceWindow } from "@/lib/attendance/races";
import { getAttendance, listAttendanceForRace } from "@/lib/attendance/repository";
import { formatIsraelDateTime } from "@/lib/attendance/format";
import { buildAttendanceRoster, type AttendanceRoster as AttendanceRosterData } from "@/lib/attendance/roster";
import PasswordForm from "./PasswordForm";
import DriverPhotoForm from "./DriverPhotoForm";
import AttendanceSection, { type AttendanceNextRaceView } from "./AttendanceSection";
import AttendanceRoster from "./AttendanceRoster";

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
  searchParams: Promise<{ pw?: string; photo?: string }>;
}) {
  const user = await requireUser("/account");
  const t = await getTranslations("account.account");
  const tAtt = await getTranslations("attendance");
  const { locale } = await params;
  const sp = await searchParams;

  const flash = sp.pw ? t("passwordChanged") : sp.photo ? t("photoUpdated") : null;
  const showDriverPhoto = isDriverRole(user.roles);
  const canRsvp = isDriverRole(user.roles) && !!user.driverId;
  const canSteward = can(user, "view_steward_area");
  const canAdmin = can(user, "manage_users");

  // Attendance targets the current next race. The "who's racing" roster is
  // visible to any signed-in user; the RSVP controls only to linked drivers.
  let attendanceHasRace = false;
  let attendanceRace: AttendanceNextRaceView | null = null;
  let attendanceRoster: AttendanceRosterData | null = null;

  const raceWindow = await fetchNextRaceWindow();
  if (raceWindow.race) {
    attendanceHasRace = true;
    const [records, driversCsv, teamsCsv, myRec] = await Promise.all([
      listAttendanceForRace(raceWindow.race.raceId),
      fetchCsv(GLOBAL_CSV_URLS.drivers).catch(() => ""),
      fetchCsv(GLOBAL_CSV_URLS.teams).catch(() => ""),
      canRsvp ? getAttendance(raceWindow.race.raceId, user.driverId!) : Promise.resolve(null),
    ]);

    attendanceRoster = buildAttendanceRoster(
      records,
      driversCsv ? mapDrivers(parseCsv(driversCsv)) : [],
      teamsCsv ? mapTeams(parseCsv(teamsCsv)) : [],
      locale,
    );

    if (canRsvp) {
      const name = locale === "he" ? raceWindow.race.nameHe : raceWindow.race.name;
      const label = raceWindow.race.raceCount > 1 ? `${name} (${tAtt("doubleHeader")})` : name;
      const dateLabel = [raceWindow.race.date, raceWindow.race.startTime, raceWindow.race.league]
        .filter(Boolean)
        .join(" · ");
      let notice: string | null = null;
      if (raceWindow.state === "before" && raceWindow.opensTs != null) {
        notice = tAtt("opensNotice", { when: formatIsraelDateTime(raceWindow.opensTs, locale) });
      } else if (raceWindow.state === "closed") {
        notice = tAtt("closedNotice");
      } else if (raceWindow.state === "open" && raceWindow.closesTs != null) {
        notice = tAtt("closesNotice", { when: formatIsraelDateTime(raceWindow.closesTs, locale) });
      }
      attendanceRace = {
        raceId: raceWindow.race.raceId,
        label,
        dateLabel,
        currentStatus: myRec?.status ?? null,
        editable: raceWindow.state === "open",
        notice,
      };
    }
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

          {(canSteward || canAdmin) && (
            <div className={cardClass}>
              <h2 className={sectionHeading}>{t("modulesHeading")}</h2>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {canSteward && (
                  <LoadingLink
                    href="/stewards"
                    className="group flex flex-col rounded-[2px] border border-[color:var(--isl-hairline-strong)] bg-sink p-4 transition-colors hover:border-ink"
                  >
                    <span className="font-display text-base font-bold text-ink">{t("stewardModule")}</span>
                    <span className="mt-0.5 text-sm text-meta">{t("stewardModuleDesc")}</span>
                  </LoadingLink>
                )}
                {canAdmin && (
                  <LoadingLink
                    href="/admin"
                    className="group flex flex-col rounded-[2px] border border-[color:var(--isl-hairline-strong)] bg-sink p-4 transition-colors hover:border-ink"
                  >
                    <span className="font-display text-base font-bold text-ink">{t("adminModule")}</span>
                    <span className="mt-0.5 text-sm text-meta">{t("adminModuleDesc")}</span>
                  </LoadingLink>
                )}
              </div>
            </div>
          )}

          <div className={cardClass}>
            <h2 className={sectionHeading}>{t("profile")}</h2>
            <dl className="mt-4 space-y-2 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-meta">{t("name")}</dt>
                <dd className="text-ink-2">{user.name}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-meta">{t("email")}</dt>
                <dd className="text-ink-2">{user.email}</dd>
              </div>
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

          {attendanceHasRace && (
            <div className={cardClass}>
              <h2 className={sectionHeading}>{tAtt("heading")}</h2>
              {canRsvp && (
                <div className="mt-4">
                  <AttendanceSection race={attendanceRace} />
                </div>
              )}
              {attendanceRoster && (
                <div className={canRsvp ? "mt-6 border-t border-[color:var(--isl-hairline)] pt-6" : "mt-4"}>
                  <AttendanceRoster roster={attendanceRoster} />
                </div>
              )}
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
