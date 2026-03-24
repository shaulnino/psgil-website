import { NextRequest, NextResponse } from "next/server";
import { readStore, writeStore } from "@/lib/stewards/store";
import { notifyPenaltyReminder } from "@/lib/stewards/notifications";

const HOURS_48 = 48 * 60 * 60 * 1000;

export async function POST(req: NextRequest) {
  // Require a shared secret so only the Netlify scheduled function can call this.
  const secret = process.env.CRON_SECRET;
  const auth   = req.headers.get("authorization") ?? "";
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const store = await readStore();
  const now   = Date.now();
  const sent: string[] = [];

  for (const penalty of store.penaltiesToServe) {
    // Only remind for active assigned penalties that have a scheduled race.
    if (penalty.status !== "assigned") continue;
    if (!penalty.assignedRaceStartTime)  continue;
    if (penalty.reminderSentAt)          continue;

    const raceMs = new Date(penalty.assignedRaceStartTime).getTime();

    // Send when we are within 48 hours of the race (but not after it starts).
    if (now >= raceMs - HOURS_48 && now < raceMs) {
      const driver = store.users.find((u) => u.id === penalty.driverId);
      if (!driver) continue;

      await notifyPenaltyReminder(penalty, driver);
      penalty.reminderSentAt = new Date().toISOString();
      penalty.updatedAt      = penalty.reminderSentAt;
      sent.push(`${driver.name} — ${penalty.penaltyLabel}`);
    }
  }

  if (sent.length > 0) await writeStore(store);

  console.log(`[penalty-reminder] sent ${sent.length} reminder(s):`, sent);
  return NextResponse.json({ sent });
}
