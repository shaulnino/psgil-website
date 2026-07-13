/**
 * Driver race attendance (PW-3).
 *
 * A driver RSVPs to an upcoming race-day (a "race group" — one night, which may
 * contain a double-header). One record per (raceId, driverId), where `raceId` is
 * the group's anchor event_id (see `raceGroupAnchorId` in lib/scheduleData.ts).
 * This matches the per-record storage design in docs/pw-2-identity-design.md §10
 * (Option B): a driver only ever writes their own record, so concurrent writes
 * never contend.
 */
import { z } from "zod";

export type AttendanceStatus = "going" | "maybe" | "out";

export const ATTENDANCE_STATUSES: AttendanceStatus[] = ["going", "maybe", "out"];

/** Who last wrote a record — the driver themselves, or an admin override. */
export type AttendanceSetBy = "driver" | "admin";

export type AttendanceRecord = {
  /** Anchor event_id of the race-day group being RSVP'd to. */
  raceId: string;
  /** CSV driver_id the RSVP is for. */
  driverId: string;
  /** Account that wrote the record (audit; the driver's own account, or the admin's). */
  accountId: string;
  status: AttendanceStatus;
  /** Provenance: whether the driver set this or an admin overrode it. */
  setBy: AttendanceSetBy;
  updatedAt: string;
};

export const attendanceStatusSchema = z.enum(["going", "maybe", "out"]);

export const setAttendanceSchema = z.object({
  raceId: z.string().trim().min(1),
  status: attendanceStatusSchema,
});

/** Admin override: also carries the target driver_id. */
export const adminSetAttendanceSchema = z.object({
  raceId: z.string().trim().min(1),
  driverId: z.string().trim().min(1),
  status: attendanceStatusSchema,
});
