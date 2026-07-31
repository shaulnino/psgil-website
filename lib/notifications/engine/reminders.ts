/**
 * Reminder engine (PW-4, Phase 3).
 *
 * Reminders reference real domain deadlines (attendance close time, race start)
 * rather than hard-coded timers, and SELF-CANCEL: each tick recomputes who still
 * needs the nudge, so a driver who has already RSVP'd is simply not in the target
 * set. Non-overlapping stage windows + per-stage dedupe keys mean at most one
 * notification per stage even though the scheduler runs every ~10 minutes.
 *
 * Approved timings:
 *   • Attendance missing → 24h and 3h before close
 *   • Upcoming race      → 24h and 60m before start
 */
import { fetchCsv, parseCsv } from "@/lib/csv";
import { mapDrivers } from "@/lib/driversData";
import { GLOBAL_CSV_URLS } from "@/lib/seasonConfig";
import { fetchNextRaceWindow } from "@/lib/attendance/races";
import { listAttendanceForRace } from "@/lib/attendance/repository";
import { notify } from "@/lib/notifications/service";
import { readSnapshot, writeSnapshot } from "@/lib/notifications/store";

const H = 60 * 60 * 1000;

async function eligibleDriverIds(): Promise<string[]> {
  const csv = await fetchCsv(GLOBAL_CSV_URLS.drivers).catch(() => "");
  if (!csv) return [];
  return mapDrivers(parseCsv(csv))
    .filter((d) => d.role === "main" || d.role === "reserve")
    .map((d) => d.driver_id);
}

export async function runReminders(): Promise<number> {
  const win = await fetchNextRaceWindow().catch(() => null);
  if (!win || !win.race) return 0;
  const { race } = win;
  const now = win.nowTs;
  let emitted = 0;

  // ── Attendance opened (once per race, seeded silently) ────────────────────
  if (win.state === "open") {
    const lastOpened = await readSnapshot<string>("attendanceOpened");
    if (lastOpened === null) {
      await writeSnapshot("attendanceOpened", race.raceId);
    } else if (lastOpened !== race.raceId) {
      const eligible = await eligibleDriverIds();
      if (eligible.length) {
        await notify({
          type: "attendance_opened",
          audience: { kind: "drivers", driverIds: eligible },
          params: { race: race.name, raceHe: race.nameHe },
          dedupeKey: `${race.raceId}:opened`,
        });
        emitted += 1;
      }
      await writeSnapshot("attendanceOpened", race.raceId);
    }
  }

  // ── Attendance missing (24h / 3h before close) ────────────────────────────
  if (win.state === "open" && win.closesTs != null) {
    const stage =
      now >= win.closesTs - 24 * H && now < win.closesTs - 3 * H
        ? "24h"
        : now >= win.closesTs - 3 * H && now < win.closesTs
          ? "3h"
          : null;
    if (stage) {
      const eligible = await eligibleDriverIds();
      const responded = new Set(
        (await listAttendanceForRace(race.raceId).catch(() => [])).map((r) => r.driverId),
      );
      const missing = eligible.filter((id) => !responded.has(id));
      if (missing.length) {
        await notify({
          type: "attendance_missing",
          audience: { kind: "drivers", driverIds: missing },
          params: { race: race.name, raceHe: race.nameHe },
          dedupeKey: `${race.raceId}:missing:${stage}`,
        });
        emitted += 1;
      }
    }
  }

  // ── Upcoming race (24h / 60m before start) — all active users ─────────────
  const startTs = race.startTs;
  if (Number.isFinite(startTs) && startTs > 0) {
    const raceStage =
      now >= startTs - 24 * H && now < startTs - 1 * H
        ? "24h"
        : now >= startTs - 1 * H && now < startTs
          ? "60m"
          : null;
    if (raceStage) {
      await notify({
        type: "race_upcoming",
        audience: { kind: "all" },
        params: { eventId: race.raceId, race: race.name, raceHe: race.nameHe },
        dedupeKey: `${race.raceId}:upcoming:${raceStage}`,
      });
      emitted += 1;
    }
  }

  return emitted;
}
