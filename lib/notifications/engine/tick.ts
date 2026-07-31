/**
 * Scheduled tick orchestrator (PW-4, Phase 3).
 *
 * Runs every ~10 minutes (Netlify Scheduled Function → secret tick endpoint).
 * Each producer is best-effort and isolated: one failing source never blocks the
 * others. Producers are individually idempotent (snapshot diffs + per-user
 * dedupe keys), so running the tick twice is safe.
 */
import { diffArticles, diffSchedule } from "@/lib/notifications/engine/content";
import { diffPenalties } from "@/lib/notifications/engine/penalties";
import { runReminders } from "@/lib/notifications/engine/reminders";

export type TickResult = {
  ok: boolean;
  ranAt: string;
  emitted: Record<string, number>;
  errors: Record<string, string>;
};

export async function runTick(): Promise<TickResult> {
  const emitted: Record<string, number> = {};
  const errors: Record<string, string> = {};

  const steps: [string, () => Promise<number>][] = [
    ["articles", diffArticles],
    ["schedule", diffSchedule],
    ["penalties", diffPenalties],
    ["reminders", runReminders],
  ];

  for (const [name, fn] of steps) {
    try {
      emitted[name] = await fn();
    } catch (err) {
      emitted[name] = 0;
      errors[name] = err instanceof Error ? err.message : String(err);
    }
  }

  return {
    ok: Object.keys(errors).length === 0,
    ranAt: new Date().toISOString(),
    emitted,
    errors,
  };
}
