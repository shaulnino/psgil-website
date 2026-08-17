/**
 * Build a read-only "who's racing" roster for a race-day, grouped by status.
 * Only drivers who responded appear. For MAIN drivers who have a team in the
 * drivers CSV, the team name + logo are attached (reserve/team-less drivers show
 * a name only). Shared by the driver-facing list (PW-3.2). All display strings
 * are resolved server-side so the presentational component stays dumb.
 */
import { getTeamLogo, localizedDriverName, type Driver, type Team } from "@/lib/driversData";
import { localizedTeamName, makeTeamNameLookup } from "@/lib/stats/teamIdentity";
import { ATTENDANCE_STATUSES, type AttendanceRecord, type AttendanceStatus } from "@/lib/attendance/types";

export type RosterEntry = {
  driverId: string;
  name: string;
  teamName: string | null;
  teamLogo: string | null;
};

export type AttendanceRoster = Record<AttendanceStatus, RosterEntry[]>;

export function buildAttendanceRoster(
  records: AttendanceRecord[],
  drivers: Driver[],
  teams: Team[],
  locale: string,
): AttendanceRoster {
  const driverById = new Map(drivers.map((d) => [d.driver_id, d] as const));
  const teamNameByKey = new Map(teams.map((t) => [t.team_key, t.team_name] as const));
  const teamNames = makeTeamNameLookup(teams);

  const roster: AttendanceRoster = { going: [], maybe: [], out: [] };
  for (const rec of records) {
    const d = driverById.get(rec.driverId);
    const name = d ? localizedDriverName(d, locale) : rec.driverId;
    let teamName: string | null = null;
    let teamLogo: string | null = null;
    if (d && d.role === "main" && d.team_key) {
      teamName = localizedTeamName(d.team_key, locale, teamNameByKey.get(d.team_key), teamNames);
      teamLogo = getTeamLogo(d.team_key);
    }
    roster[rec.status].push({ driverId: rec.driverId, name, teamName, teamLogo });
  }
  for (const s of ATTENDANCE_STATUSES) roster[s].sort((a, b) => a.name.localeCompare(b.name));
  return roster;
}
