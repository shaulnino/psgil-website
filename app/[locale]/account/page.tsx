import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import Section from "@/components/Section";
import { requireUser } from "@/lib/auth/session";
import { can } from "@/lib/stewards/auth";
import { isDriverRole } from "@/lib/accounts/types";
import { fetchCsv, parseCsv } from "@/lib/csv";
import { mapDrivers, mapTeams, getTeamLogo, localizedDriverName } from "@/lib/driversData";
import { GLOBAL_CSV_URLS } from "@/lib/seasonConfig";
import { fetchNextRaceWindow } from "@/lib/attendance/races";
import { getAttendance, listAttendanceForRace } from "@/lib/attendance/repository";
import { formatIsraelDateTime } from "@/lib/attendance/format";
import { buildAttendanceRoster, type AttendanceRoster as AttendanceRosterData } from "@/lib/attendance/roster";
import type { AttendanceStatus } from "@/lib/attendance/types";
import AccountHeader from "./_components/AccountHeader";
import AttendanceSelector from "./_components/AttendanceSelector";
import AttendanceSummary from "./_components/AttendanceSummary";
import DriverImageUploader from "./_components/DriverImageUploader";
import SecurityCard from "./_components/SecurityCard";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("account.account");
  return { title: `${t("title")} | F1ISL` };
}

const card = "rounded-[2px] border border-[color:var(--isl-hairline)] bg-cream p-5 md:p-6";
const sectionHeading = "font-isl-display text-lg font-bold tracking-[0.02em] text-ink";

export default async function AccountPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ photo?: string }>;
}) {
  const user = await requireUser("/account");
  const t = await getTranslations("account.account");
  const tAtt = await getTranslations("attendance");
  const { locale } = await params;
  const sp = await searchParams;

  const flash =
    sp.photo === "removed" ? t("photoRemoved") : sp.photo ? t("photoUpdated") : null;
  const showDriverPhoto = isDriverRole(user.roles);
  const canRsvp = isDriverRole(user.roles) && !!user.driverId;
  const canSteward = can(user, "view_steward_area");
  const canAdmin = can(user, "manage_users");

  // Drivers + teams CSV (best-effort) — used for the header's linked-driver line
  // and the attendance roster.
  const [driversCsv, teamsCsv] = await Promise.all([
    fetchCsv(GLOBAL_CSV_URLS.drivers).catch(() => ""),
    fetchCsv(GLOBAL_CSV_URLS.teams).catch(() => ""),
  ]);
  const drivers = driversCsv ? mapDrivers(parseCsv(driversCsv)) : [];
  const teams = teamsCsv ? mapTeams(parseCsv(teamsCsv)) : [];

  const myDriver = user.driverId ? drivers.find((d) => d.driver_id === user.driverId) ?? null : null;
  const teamName = myDriver?.team_key
    ? teams.find((tm) => tm.team_key === myDriver.team_key)?.team_name ?? null
    : null;
  const teamLogo = myDriver?.team_key ? getTeamLogo(myDriver.team_key) : null;
  const driverName = myDriver ? localizedDriverName(myDriver, locale) : user.driverId;
  const avatarUrl = user.driverPhotoUrl ?? myDriver?.photo_url ?? null;

  // Attendance: resolve the current next race + RSVP window.
  let attendanceHasRace = false;
  let raceLabel = "";
  let dateLabel = "";
  let notice: string | null = null;
  let roster: AttendanceRosterData | null = null;
  let rsvp: { raceId: string; currentStatus: AttendanceStatus | null; editable: boolean } | null = null;

  const raceWindow = await fetchNextRaceWindow();
  if (raceWindow.race) {
    attendanceHasRace = true;
    const [records, myRec] = await Promise.all([
      listAttendanceForRace(raceWindow.race.raceId),
      canRsvp ? getAttendance(raceWindow.race.raceId, user.driverId!) : Promise.resolve(null),
    ]);
    roster = buildAttendanceRoster(records, drivers, teams, locale);

    const name = locale === "he" ? raceWindow.race.nameHe : raceWindow.race.name;
    raceLabel = raceWindow.race.raceCount > 1 ? `${name} (${tAtt("doubleHeader")})` : name;
    dateLabel = [raceWindow.race.date, raceWindow.race.startTime, raceWindow.race.league]
      .filter(Boolean)
      .join(" · ");

    if (raceWindow.state === "before" && raceWindow.opensTs != null) {
      notice = tAtt("opensNotice", { when: formatIsraelDateTime(raceWindow.opensTs, locale) });
    } else if (raceWindow.state === "closed") {
      notice = tAtt("closedNotice");
    } else if (raceWindow.state === "open" && raceWindow.closesTs != null) {
      notice = tAtt("closesNotice", { when: formatIsraelDateTime(raceWindow.closesTs, locale) });
    }

    if (canRsvp) {
      rsvp = {
        raceId: raceWindow.race.raceId,
        currentStatus: myRec?.status ?? null,
        editable: raceWindow.state === "open",
      };
    }
  }

  const attendanceCard = attendanceHasRace && (
    <div className={card}>
      <h2 className={sectionHeading}>{tAtt("heading")}</h2>
      <div className="mt-4">
        <div className="text-sm font-semibold text-ink">
          <bdi>{raceLabel}</bdi>
        </div>
        {dateLabel && (
          <div className="mt-0.5 text-xs text-meta">
            <span dir="ltr">{dateLabel}</span>
          </div>
        )}
        {notice && <p className="mt-1.5 text-xs text-meta">{notice}</p>}
      </div>
      {rsvp && (
        <div className="mt-4">
          <AttendanceSelector raceId={rsvp.raceId} currentStatus={rsvp.currentStatus} editable={rsvp.editable} />
        </div>
      )}
      {roster && (
        <div className="mt-6 border-t border-[color:var(--isl-hairline)] pt-5">
          <AttendanceSummary roster={roster} />
        </div>
      )}
    </div>
  );

  const photoCard = showDriverPhoto && (
    <div className={card}>
      <h2 className={sectionHeading}>{t("photoHeading")}</h2>
      <div className="mt-4">
        {user.driverId ? (
          <DriverImageUploader currentPhotoUrl={user.driverPhotoUrl} />
        ) : (
          <p className="text-sm text-meta">{t("photoNotLinked")}</p>
        )}
      </div>
    </div>
  );

  return (
    <main className="text-ink-2">
      <Section title={t("title")} pageHeader>
        <div className="mx-auto max-w-4xl space-y-6">
          {flash && (
            <p className="rounded-[2px] border border-[color:var(--isl-success)] bg-[color:var(--isl-success)]/10 px-4 py-3 text-sm text-ink">
              {flash}
            </p>
          )}

          <AccountHeader
            name={user.name}
            email={user.email}
            isActive={user.isActive}
            roles={user.roles}
            driverLinked={!!user.driverId}
            driverName={driverName}
            teamName={teamName}
            teamLogo={teamLogo}
            avatarUrl={avatarUrl}
            canSteward={canSteward}
            canAdmin={canAdmin}
          />

          {attendanceHasRace ? (
            <div className="grid gap-6 lg:grid-cols-3">
              <div className="space-y-6 lg:col-span-2">{attendanceCard}</div>
              <div className="space-y-6">
                {photoCard}
                <SecurityCard />
              </div>
            </div>
          ) : (
            <div className="grid gap-6 sm:grid-cols-2">
              {photoCard}
              <SecurityCard />
            </div>
          )}
        </div>
      </Section>
    </main>
  );
}
