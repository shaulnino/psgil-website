/**
 * Content diff producers (PW-4, Phase 3).
 *
 * Articles, schedule and results come from Google Sheets, so there is no
 * synchronous app write to hook into. The scheduled tick compares the current
 * CSV against a stored snapshot and emits a notification only for genuine
 * changes. On the FIRST run (no snapshot) we seed the baseline WITHOUT notifying,
 * so deploying the feature never floods users with "new" items for existing
 * content.
 */
import { fetchArticles } from "@/lib/newsData";
import { fetchCsv, parseCsv } from "@/lib/csv";
import { mapRaceEvents, type RaceEvent } from "@/lib/scheduleData";
import { GLOBAL_CSV_URLS } from "@/lib/seasonConfig";
import { notify } from "@/lib/notifications/service";
import { readSnapshot, writeSnapshot } from "@/lib/notifications/store";

/* ── Articles ─────────────────────────────────────────────────────────────
   New published story (keyed by slug — HE/EN variants share a slug). Audience:
   all active users. Push default off (announcements can opt in via prefs). */
export async function diffArticles(): Promise<number> {
  const [en, he] = await Promise.all([
    fetchArticles("en").catch(() => []),
    fetchArticles("he").catch(() => []),
  ]);
  if (en.length === 0 && he.length === 0) return 0;

  const titleEn = new Map(en.map((a) => [a.slug, a.title] as const));
  const titleHe = new Map(he.map((a) => [a.slug, a.title] as const));
  const categoryBySlug = new Map([...en, ...he].map((a) => [a.slug, a.category] as const));
  const currentSlugs = [...new Set([...titleEn.keys(), ...titleHe.keys()])];

  const prev = await readSnapshot<string[]>("articles");
  if (prev === null) {
    await writeSnapshot("articles", currentSlugs);
    return 0; // seed only
  }
  const known = new Set(prev);
  const fresh = currentSlugs.filter((slug) => !known.has(slug));

  let emitted = 0;
  for (const slug of fresh) {
    const en1 = titleEn.get(slug);
    const he1 = titleHe.get(slug);
    await notify({
      type: "article_published",
      audience: { kind: "all" },
      params: {
        slug,
        title: en1 ?? he1 ?? slug,
        titleHe: he1 ?? en1 ?? slug,
        category: categoryBySlug.get(slug) ?? "",
      },
      dedupeKey: slug,
    });
    emitted += 1;
  }
  await writeSnapshot("articles", currentSlugs);
  return emitted;
}

/* ── Schedule + results ─────────────────────────────────────────────────────
   Per-event field diff: cancellation, restoration, start time/date change, and
   scheduled→completed (official results). Audience: all active users. New events
   are recorded silently (a freshly added future race is not a "change"). */
type EventSnap = {
  status: string;
  startTime: string;
  date: string;
  resultsStatus: string;
};

const snapOf = (e: RaceEvent): EventSnap => ({
  status: (e.status ?? "").trim().toLowerCase(),
  startTime: (e.start_time ?? "").trim(),
  date: (e.date ?? "").trim(),
  resultsStatus: (e.results_status ?? "").trim().toLowerCase(),
});

export async function diffSchedule(): Promise<number> {
  const csv = await fetchCsv(GLOBAL_CSV_URLS.schedule).catch(() => "");
  if (!csv) return 0;
  const events = mapRaceEvents(parseCsv<Record<string, string>>(csv));
  if (events.length === 0) return 0;

  const current: Record<string, EventSnap> = {};
  const nameById = new Map<string, { en: string; he: string }>();
  for (const e of events) {
    const id = e.event_id.trim().toLowerCase();
    current[id] = snapOf(e);
    nameById.set(id, {
      en: e.race_name || id,
      he: e.race_name_he || e.race_name || id,
    });
  }

  const prev = await readSnapshot<Record<string, EventSnap>>("schedule");
  if (prev === null) {
    await writeSnapshot("schedule", current);
    return 0; // seed only
  }

  let emitted = 0;
  const emit = async (
    type:
      | "race_cancelled"
      | "race_restored"
      | "race_time_changed"
      | "results_official",
    eventId: string,
    dedupeSuffix: string,
  ) => {
    const nm = nameById.get(eventId) ?? { en: eventId, he: eventId };
    await notify({
      type,
      audience: { kind: "all" },
      params: { eventId, race: nm.en, raceHe: nm.he },
      dedupeKey: `${eventId}:${dedupeSuffix}`,
    });
    emitted += 1;
  };

  for (const [id, now] of Object.entries(current)) {
    const before = prev[id];
    if (!before) continue; // new event: recorded silently below

    const wasCancelled = before.status === "cancelled";
    const isCancelled = now.status === "cancelled";
    if (!wasCancelled && isCancelled) {
      await emit("race_cancelled", id, "cancelled");
      continue; // cancellation supersedes other field diffs
    }
    if (wasCancelled && !isCancelled) {
      await emit("race_restored", id, "restored");
    }

    // Official results: scheduled/other → completed.
    if (before.status !== "completed" && now.status === "completed") {
      await emit("results_official", id, "results");
    }

    // Time/date moved while still an active (non-completed, non-cancelled) race.
    if (
      now.status !== "completed" &&
      now.status !== "cancelled" &&
      (before.startTime !== now.startTime || before.date !== now.date)
    ) {
      await emit("race_time_changed", id, `time:${now.date}:${now.startTime}`);
    }
  }

  await writeSnapshot("schedule", current);
  return emitted;
}
