"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth/session";
import { can } from "@/lib/stewards/auth";
import { isDriverRole } from "@/lib/accounts/types";
import { setAttendance } from "@/lib/attendance/repository";
import { adminSetAttendanceSchema, setAttendanceSchema } from "@/lib/attendance/types";
import { fetchNextRaceWindow } from "@/lib/attendance/races";

export type AttendanceState = { error?: string; ok?: boolean } | undefined;

function revalidateAttendance() {
  for (const p of ["/account", "/en/account", "/admin/attendance", "/en/admin/attendance"]) {
    revalidatePath(p);
  }
}

/**
 * A linked driver RSVPs to the current next race. Enforces, server-side:
 *   - authenticated, active account with driver permission + a driver link;
 *   - the target race is the current next race AND the RSVP window is OPEN
 *     (opens 3h after the previous race; closes the day before at 12:00).
 */
export async function setAttendanceAction(
  _prev: AttendanceState,
  formData: FormData,
): Promise<AttendanceState> {
  const user = await getCurrentUser();
  if (!user || !user.isActive) {
    return { error: "You must be signed in with an active account." };
  }
  if (!can(user, "submit_own_attendance") || !isDriverRole(user.roles) || !user.driverId) {
    return { error: "Only a linked driver can set attendance." };
  }

  const parsed = setAttendanceSchema.safeParse({
    raceId: formData.get("raceId"),
    status: formData.get("status"),
  });
  if (!parsed.success) return { error: "Please pick a valid response." };

  const window = await fetchNextRaceWindow();
  if (!window.race || window.race.raceId !== parsed.data.raceId || window.state !== "open") {
    return { error: "Attendance for this race isn't open right now." };
  }

  await setAttendance({
    raceId: parsed.data.raceId,
    driverId: user.driverId,
    accountId: user.id,
    status: parsed.data.status,
    setBy: "driver",
  });

  revalidateAttendance();
  return { ok: true };
}

/**
 * Admin override: set any driver's response for the current next race. Not
 * bound by the open/close window (admins can adjust any time), but still tied
 * to the current next race so old races can't be edited. Marked `setBy: admin`.
 */
export async function adminSetAttendanceAction(
  _prev: AttendanceState,
  formData: FormData,
): Promise<AttendanceState> {
  const user = await getCurrentUser();
  if (!user || !user.isActive || !can(user, "manage_attendance")) {
    return { error: "Only an admin can manage attendance." };
  }

  const parsed = adminSetAttendanceSchema.safeParse({
    raceId: formData.get("raceId"),
    driverId: formData.get("driverId"),
    status: formData.get("status"),
  });
  if (!parsed.success) return { error: "Please pick a valid response." };

  const window = await fetchNextRaceWindow();
  if (!window.race || window.race.raceId !== parsed.data.raceId) {
    return { error: "This race is no longer the active race for attendance." };
  }

  await setAttendance({
    raceId: parsed.data.raceId,
    driverId: parsed.data.driverId,
    accountId: user.id,
    status: parsed.data.status,
    setBy: "admin",
  });

  revalidateAttendance();
  return { ok: true };
}
