/* ------------------------------------------------------------------ */
/*  Content-specific share-data builders                               */
/*  ----------------------------------------------------------------  */
/*  Pure functions that turn a content object + locale into a          */
/*  SharePayload. Keep all share-copy logic here so article/race       */
/*  components never duplicate it. Add a builder per new content type.  */
/* ------------------------------------------------------------------ */

import type { RaceEvent } from "@/lib/scheduleData";
import { localizedRaceName, localizedTrack } from "@/lib/scheduleData";
import type { RaceResultRow } from "@/lib/resultsData";
import { absoluteUrl } from "@/lib/share/shareUrls";
import type { SharePayload, ShareTranslator } from "@/lib/share/types";

/* ---------------------------------- Article ---------------------------------- */

export function buildArticleShare(args: {
  slug: string;
  title: string;
  excerpt?: string;
  locale: string;
}): SharePayload {
  const { slug, title, excerpt, locale } = args;
  return {
    url: absoluteUrl(locale, `/news/${encodeURIComponent(slug)}`),
    title,
    text: (excerpt ?? "").trim() || title,
    contentType: "article",
    contentId: slug,
    locale,
  };
}

/* -------------------------------- Race result -------------------------------- */

/** Season number from a schedule `season` value ("6" or "S6") → "6". */
function seasonNumber(season: string): string {
  return (season ?? "").trim().replace(/^s/i, "");
}

/** Find the driver at a finishing position ("1" | "2" | "3"). */
function driverAtPosition(results: RaceResultRow[], position: string): string {
  return results.find((r) => r.position.trim() === position)?.driver_name.trim() ?? "";
}

/**
 * Build the share payload for a completed race result.
 * Message = "{race} — Race Result" + podium + circuit/round/season, localized.
 */
export function buildRaceResultShare(args: {
  event: Pick<
    RaceEvent,
    "event_id" | "race_name" | "race_name_he" | "track" | "track_he" | "race_number" | "season"
  >;
  results: RaceResultRow[];
  locale: string;
  t: ShareTranslator;
}): SharePayload {
  const { event, results, locale, t } = args;

  const raceName = localizedRaceName(event, locale);
  const circuit = localizedTrack(event, locale);
  const round = String(event.race_number ?? "").trim();
  const season = seasonNumber(event.season);

  const p1 = driverAtPosition(results, "1");
  const p2 = driverAtPosition(results, "2");
  const p3 = driverAtPosition(results, "3");

  const title = t("race.title", { race: raceName });

  const lines: string[] = [title];
  if (p1) lines.push(t("race.podium", { p1, p2, p3 }));
  lines.push(
    circuit && round && season
      ? t("race.meta", { circuit, round, season })
      : t("race.metaNoCircuit", { round, season }),
  );

  return {
    url: absoluteUrl(locale, `/schedule/${event.event_id}`),
    title,
    text: lines.join("\n"),
    contentType: "raceResult",
    contentId: event.event_id,
    locale,
  };
}
