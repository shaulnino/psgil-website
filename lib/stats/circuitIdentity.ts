/* ------------------------------------------------------------------ */
/*  Canonical circuit identity                                         */
/*                                                                     */
/*  A "circuit" in ISL data is the raw `track` string on the schedule  */
/*  CSV. That string can drift across seasons / game editions (e.g.    */
/*  "Spa" vs "Circuit de Spa-Francorchamps"). This module folds every  */
/*  known variant onto ONE stable canonical id so aggregation, URLs    */
/*  and records stay consistent, and carries the localized display     */
/*  name (`track_he`), Grand Prix name and country flag for the UI.    */
/*                                                                     */
/*  Product rule (locked): one venue = one circuit. Layout / game      */
/*  edition are metadata, never a reason to split or silently merge.   */
/* ------------------------------------------------------------------ */

import type { RaceEvent } from "@/lib/scheduleData";
import { parseDateDDMMYYYY } from "@/lib/scheduleData";

export type CircuitIdentity = {
  /** Stable canonical id (used in URLs + as the aggregation key). */
  id: string;
  /** English display name (from the latest event's `track`). */
  name: string;
  /** Hebrew display name (from `track_he`), when available. */
  nameHe?: string;
  /** ISO country code for the flag (from `country_code`). */
  countryCode?: string;
  /** Representative Grand Prix name (English). */
  grandPrix?: string;
  /** Representative Grand Prix name (Hebrew). */
  grandPrixHe?: string;
};

/* ------------------------------------------------------------------ */
/*  Slug + alias registry                                              */
/* ------------------------------------------------------------------ */

/** Lowercase, diacritic-free, hyphenated slug of a free-text track name. */
export function slugifyTrack(track: string): string {
  return (track ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Curated venue registry. Each entry has a stable canonical `id` and the
 * list of slugged aliases that fold onto it. Adding a new venue is optional
 * — unknown tracks fall back to their own slug (so nothing is ever dropped),
 * but curating an entry gives a short, stable URL id and folds name variants.
 */
const CIRCUIT_REGISTRY: { id: string; aliases: string[] }[] = [
  { id: "spa", aliases: ["circuit-de-spa-francorchamps", "spa-francorchamps", "spa"] },
  { id: "hungaroring", aliases: ["hungaroring"] },
  { id: "zandvoort", aliases: ["circuit-zandvoort", "zandvoort"] },
  { id: "monza", aliases: ["autodromo-nazionale-monza", "monza"] },
  { id: "albert-park", aliases: ["albert-park-circuit", "albert-park", "melbourne"] },
  { id: "marina-bay", aliases: ["marina-bay-street-circuit", "marina-bay", "singapore"] },
  { id: "cota", aliases: ["circuit-of-the-americas", "circuit-of-the-america", "cota"] },
  { id: "interlagos", aliases: ["autodromo-jose-carlos-pace", "interlagos", "jose-carlos-pace"] },
  { id: "las-vegas", aliases: ["las-vegas-strip-circuit", "las-vegas-strip", "las-vegas"] },
  { id: "yas-marina", aliases: ["yas-marina-circuit", "yas-marina"] },
  { id: "suzuka", aliases: ["suzuka-circuit", "suzuka"] },
  { id: "red-bull-ring", aliases: ["red-bull-ring", "spielberg"] },
  { id: "silverstone", aliases: ["silverstone-circuit", "silverstone"] },
];

const ALIAS_TO_ID = new Map<string, string>();
for (const { id, aliases } of CIRCUIT_REGISTRY) {
  for (const a of aliases) ALIAS_TO_ID.set(a, id);
}

/** Resolve any raw `track` string to its stable canonical circuit id. */
export function resolveCircuitId(track: string | undefined): string {
  const slug = slugifyTrack(track ?? "");
  if (!slug) return "";
  return ALIAS_TO_ID.get(slug) ?? slug;
}

/* ------------------------------------------------------------------ */
/*  Build identities from the schedule                                 */
/* ------------------------------------------------------------------ */

function eventTimeMs(ev: RaceEvent): number {
  const d = parseDateDDMMYYYY(ev.date);
  return d ? d.getTime() : Number.NEGATIVE_INFINITY;
}

/**
 * Build canonical circuit identities from the full schedule (all events,
 * completed or not) so the selector, flags and prep block have names for
 * every venue on the calendar. When a track's name/country drift over time,
 * the most recent event wins.
 */
export function buildCircuitIdentities(
  events: RaceEvent[],
): Map<string, CircuitIdentity> {
  // id -> { identity, latestMs }
  const acc = new Map<string, { identity: CircuitIdentity; latestMs: number }>();

  for (const ev of events) {
    const track = (ev.track ?? "").trim();
    if (!track) continue;
    const id = resolveCircuitId(track);
    if (!id) continue;

    const ms = eventTimeMs(ev);
    const existing = acc.get(id);
    if (existing && ms <= existing.latestMs) continue;

    acc.set(id, {
      latestMs: ms,
      identity: {
        id,
        name: track,
        nameHe: (ev.track_he ?? "").trim() || undefined,
        countryCode: (ev.country_code ?? "").trim() || undefined,
        grandPrix: (ev.race_name ?? "").trim() || undefined,
        grandPrixHe: (ev.race_name_he ?? "").trim() || undefined,
      },
    });
  }

  const out = new Map<string, CircuitIdentity>();
  for (const [id, { identity }] of acc) out.set(id, identity);
  return out;
}

/** Localized circuit display name — Hebrew when available on the `he` locale. */
export function localizedCircuitName(
  identity: Pick<CircuitIdentity, "name" | "nameHe">,
  locale: string,
): string {
  return locale === "he" && identity.nameHe ? identity.nameHe : identity.name;
}

/** Localized Grand Prix name — Hebrew when available on the `he` locale. */
export function localizedCircuitGrandPrix(
  identity: Pick<CircuitIdentity, "grandPrix" | "grandPrixHe">,
  locale: string,
): string | undefined {
  return locale === "he" && identity.grandPrixHe
    ? identity.grandPrixHe
    : identity.grandPrix;
}
