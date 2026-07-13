/**
 * Attendance repository (PW-3) — validated CRUD over the attendance store.
 * Callers (server action, account/admin pages) use these rather than the store
 * directly, mirroring lib/accounts/repository.ts.
 */
import {
  getAttendance,
  listAttendanceForDriver,
  listAttendanceForRace,
  putAttendance,
} from "@/lib/attendance/store";
import { attendanceStatusSchema, type AttendanceRecord, type AttendanceStatus } from "@/lib/attendance/types";

export async function setAttendance(input: {
  raceId: string;
  driverId: string;
  accountId: string;
  status: AttendanceStatus;
}): Promise<AttendanceRecord> {
  const status = attendanceStatusSchema.parse(input.status);
  const record: AttendanceRecord = {
    raceId: input.raceId.trim(),
    driverId: input.driverId.trim(),
    accountId: input.accountId,
    status,
    updatedAt: new Date().toISOString(),
  };
  await putAttendance(record);
  return record;
}

export { getAttendance, listAttendanceForDriver, listAttendanceForRace };
