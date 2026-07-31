/**
 * Penalty diff producer (PW-4, Phase 3).
 *
 * Penalties-to-serve are created inside `checkAndGeneratePenalties` (which
 * returns void) and by admin actions, so there's no clean synchronous hook.
 * The tick snapshots the set of penalty ids and notifies the affected driver
 * (an ACCOUNT id) once per new penalty. Seeded silently on first run.
 */
import { listPenaltiesToServe } from "@/lib/stewards/repository";
import { notify } from "@/lib/notifications/service";
import { readSnapshot, writeSnapshot } from "@/lib/notifications/store";

export async function diffPenalties(): Promise<number> {
  const penalties = await listPenaltiesToServe().catch(() => []);
  // Only actionable states are worth a "you have a penalty" notification.
  const active = penalties.filter(
    (p) => p.status === "assigned" || p.status === "pending",
  );
  const currentIds = active.map((p) => p.id);

  const prev = await readSnapshot<string[]>("penalties");
  if (prev === null) {
    await writeSnapshot("penalties", currentIds);
    return 0;
  }
  const known = new Set(prev);

  let emitted = 0;
  for (const p of active) {
    if (known.has(p.id)) continue;
    await notify({
      type: "steward_penalty_assigned",
      audience: { kind: "users", userIds: [p.driverId] },
      params: { penalty: p.penaltyLabel },
      dedupeKey: p.id,
    });
    emitted += 1;
  }
  // Snapshot ALL known ids we've seen so a penalty leaving the active set (served)
  // doesn't reappear as "new" if it briefly returns.
  await writeSnapshot("penalties", [...new Set([...prev, ...currentIds])]);
  return emitted;
}
