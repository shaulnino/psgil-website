"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth/session";
import { can } from "@/lib/stewards/auth";
import { isDriverRole } from "@/lib/accounts/types";
import { setAttendance } from "@/lib/attendance/repository";
import { setAttendanceSchema } from "@/lib/attendance/types";
import { fetchUpcomingRaces } from "@/lib/attendance/races";

export type AttendanceState = { error?: string; ok?: boolean } | undefined;

/**
 * A linked driver RSVPs to one of their upcoming races. Enforces, server-side:
 *   - authenticated, active, approved account with driver permission + link;
 *   - the target race is still upcoming (RSVP closes at the race-day start).
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

  // Cutoff: the race must still be in the upcoming set (not yet started).
  const upcoming = await fetchUpcomingRaces();
  if (!upcoming.some((r) => r.raceId === parsed.data.raceId)) {
    return { error: "This race is closed for attendance." };
  }

  await setAttendance({
    raceId: parsed.data.raceId,
    driverId: user.driverId,
    accountId: user.id,
    status: parsed.data.status,
  });

  revalidatePath("/account");
  revalidatePath("/en/account");
  revalidatePath("/he/account");
  return { ok: true };
}
