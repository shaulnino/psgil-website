"use client";

import { useState } from "react";
import Image from "next/image";
import Button from "@/components/Button";
import ZoomableImage from "@/components/ZoomableImage";
import type { RaceGroup, RaceEvent } from "@/lib/scheduleData";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

type HomeRaceCardsProps = {
  lastGroup: RaceGroup | null;
  nextGroup: RaceGroup | null;
};

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

/** Short label for a race (tab/button text). */
function raceLabel(event: RaceEvent): string {
  return event.race_name || `Race #${event.race_number}`;
}

/** Collect unique youtube URLs from a group. */
function uniqueYoutubeUrls(group: RaceGroup): { label: string; url: string }[] {
  const seen = new Set<string>();
  const result: { label: string; url: string }[] = [];
  for (const e of group.events) {
    if (e.youtube_url && !seen.has(e.youtube_url)) {
      seen.add(e.youtube_url);
      result.push({
        label: group.events.length > 1 ? `Watch Race #${e.race_number}` : "Watch on YouTube",
        url: e.youtube_url,
      });
    }
  }
  // If all races share the same URL, use a single generic label
  if (result.length === 1) result[0].label = "Watch on YouTube";
  return result;
}

/** Check if at least one event has a results image. */
function hasAnyResults(group: RaceGroup): boolean {
  return group.events.some((e) => !!e.results_image);
}

/** Check if the group is completed (any event completed). */
function isGroupCompleted(group: RaceGroup): boolean {
  return group.events.some((e) => e.status.toLowerCase() === "completed");
}

/* ------------------------------------------------------------------ */
/*  League badge                                                       */
/* ------------------------------------------------------------------ */

function LeagueBadge({ league }: { league: string }) {
  const isMain = league.toLowerCase() === "main";
  return (
    <span
      className={`inline-flex items-center justify-center rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase leading-none tracking-wider ${
        isMain
          ? "border border-[#7020B0]/40 bg-[#7020B0]/20 text-[#a855f7]"
          : "border border-[#D4AF37]/30 bg-[#D4AF37]/15 text-[#D4AF37]"
      }`}
    >
      {isMain ? "MAIN" : "WILD"}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/*  Race day card                                                      */
/* ------------------------------------------------------------------ */

function RaceGroupCard({
  heading,
  group,
  onShowResults,
}: {
  heading: string;
  group: RaceGroup;
  onShowResults?: () => void;
}) {
  const isSingle = group.events.length === 1;
  const first = group.events[0];
  const poster = group.events.find((e) => !!e.poster_image) ?? first;
  const hasPoster = !!poster.poster_image;
  const completed = isGroupCompleted(group);
  const youtubeLinks = completed ? uniqueYoutubeUrls(group) : [];
  const showResults = completed && hasAnyResults(group) && !!onShowResults;
  const isWild = group.league.toLowerCase() === "wild";

  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <h3 className="font-display text-lg font-semibold text-white">{heading}</h3>
          <LeagueBadge league={group.league} />
        </div>
        <span className="text-sm text-white/60">{group.date}</span>
      </div>

      {/* Poster */}
      <div className="mt-4 overflow-hidden rounded-xl border border-white/10 bg-[#0B0B0E]">
        {hasPoster ? (
          <ZoomableImage
            src={poster.poster_image!}
            alt={`${first.race_name} poster`}
            fill
            sizes="(max-width: 768px) 100vw, 50vw"
            triggerClassName="group relative aspect-video cursor-pointer"
            imageClassName="object-cover transition duration-200 group-hover:scale-[1.02]"
          />
        ) : (
          <div className="flex aspect-video items-center justify-center bg-gradient-to-br from-[#111122] via-[#0B0B0E] to-[#1b0b2e]">
            <span className="text-xs uppercase tracking-[0.2em] text-white/60">
              Poster coming soon
            </span>
          </div>
        )}
      </div>

      {/* Description */}
      <div className="mt-4 space-y-1">
        {isSingle ? (
          <p className="text-sm text-white/70">
            Season {first.season}, Race #{first.race_number}, {first.race_name}
            {isWild ? ", Wild Event" : ""}
          </p>
        ) : (
          <>
            <p className="text-sm font-medium text-white/80">
              Season {group.season} · {isWild ? "Wild Event Day" : "Race Day"} · {group.date}
            </p>
            {group.events.map((e) => (
              <p key={e.race_number} className="text-sm text-white/60">
                Race #{e.race_number}: {e.race_name}
              </p>
            ))}
          </>
        )}
      </div>

      {/* Actions */}
      <div className="mt-5 flex flex-wrap gap-3">
        {youtubeLinks.map((yt) => (
          <Button key={yt.url} href={yt.url} variant="primary" size="sm" external>
            {yt.label}
          </Button>
        ))}
        {showResults && (
          <button
            type="button"
            onClick={onShowResults}
            className="inline-flex items-center justify-center rounded-full border border-white/20 px-4 py-2 text-sm font-semibold text-white/90 transition hover:border-[#7020B0]/60 hover:text-white hover:shadow-[0_0_16px_rgba(112,32,176,0.35)]"
          >
            Race Results
          </button>
        )}
        {!completed && (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/50">
            <span className="h-1.5 w-1.5 rounded-full bg-white/40" />
            Upcoming
          </span>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Multi-race results modal with tab selector + zoom                  */
/* ------------------------------------------------------------------ */

function GroupResultsModal({
  group,
  onClose,
}: {
  group: RaceGroup;
  onClose: () => void;
}) {
  // Only include events that actually have a results image
  const withResults = group.events.filter((e) => !!e.results_image);
  const isSingle = withResults.length === 1;
  const [activeIdx, setActiveIdx] = useState(0);
  const [zoom, setZoom] = useState(1);
  const clamp = (v: number) => Math.min(3, Math.max(1, v));

  const current = withResults[activeIdx] ?? withResults[0];
  if (!current?.results_image) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
      onClick={onClose}
    >
      <div className="relative mx-4 w-full max-w-5xl" onClick={(e) => e.stopPropagation()}>
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute -top-10 right-0 z-10 flex h-8 w-8 items-center justify-center rounded-full border border-white/20 bg-black/60 text-white/80 transition hover:text-white"
        >
          ×
        </button>

        {/* Zoom controls */}
        <div className="absolute -top-10 left-0 z-10 flex items-center gap-2">
          <button
            onClick={() => setZoom((z) => clamp(z - 0.25))}
            className="flex h-8 w-8 items-center justify-center rounded-full border border-white/20 bg-black/60 text-white/80 transition hover:text-white"
          >
            −
          </button>
          <span className="text-xs text-white/60">{Math.round(zoom * 100)}%</span>
          <button
            onClick={() => setZoom((z) => clamp(z + 0.25))}
            className="flex h-8 w-8 items-center justify-center rounded-full border border-white/20 bg-black/60 text-white/80 transition hover:text-white"
          >
            +
          </button>
          <button
            onClick={() => setZoom(1)}
            className="flex h-8 items-center justify-center rounded-full border border-white/20 bg-black/60 px-3 text-xs text-white/80 transition hover:text-white"
          >
            Reset
          </button>
        </div>

        {/* Tab selector for multi-race groups */}
        {!isSingle && (
          <div className="mb-3 flex items-center gap-1 rounded-full border border-white/10 bg-black/60 p-1 backdrop-blur-sm">
            {withResults.map((e, idx) => (
              <button
                key={e.race_number}
                onClick={() => {
                  setActiveIdx(idx);
                  setZoom(1);
                }}
                className={`rounded-full px-4 py-1.5 text-xs font-semibold transition ${
                  idx === activeIdx
                    ? "bg-[#7020B0]/80 text-white shadow-[0_0_12px_rgba(112,32,176,0.3)]"
                    : "text-white/50 hover:text-white/80"
                }`}
              >
                {raceLabel(e)}
              </button>
            ))}
          </div>
        )}

        {/* Results image with zoom */}
        <div
          className="max-h-[85vh] overflow-auto rounded-2xl border border-white/10 bg-[#0B0B0E] p-3 shadow-[0_0_30px_rgba(0,0,0,0.4)]"
          onWheel={(e) => {
            e.stopPropagation();
            setZoom((z) => clamp(z - e.deltaY * 0.002));
          }}
        >
          <Image
            key={current.race_number}
            src={current.results_image!}
            alt={`${current.race_name} results`}
            width={2000}
            height={1200}
            sizes="100vw"
            quality={100}
            unoptimized
            className="h-auto w-full object-contain transition-transform"
            style={{ width: `${zoom * 100}%` }}
          />
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main export                                                        */
/* ------------------------------------------------------------------ */

export default function HomeRaceCards({ lastGroup, nextGroup }: HomeRaceCardsProps) {
  const [showResultsGroup, setShowResultsGroup] = useState<RaceGroup | null>(null);

  // Nothing to show at all
  if (!lastGroup && !nextGroup) {
    return (
      <div className="flex items-center justify-center rounded-2xl border border-white/10 bg-white/5 py-16">
        <p className="text-sm text-white/50">Race schedule not available yet.</p>
      </div>
    );
  }

  return (
    <>
      <div className="grid gap-6 lg:grid-cols-2">
        {lastGroup ? (
          <RaceGroupCard
            heading="Last Race"
            group={lastGroup}
            onShowResults={
              hasAnyResults(lastGroup)
                ? () => setShowResultsGroup(lastGroup)
                : undefined
            }
          />
        ) : (
          <div className="flex items-center justify-center rounded-2xl border border-white/10 bg-white/5 py-16">
            <p className="text-sm text-white/50">No past races yet.</p>
          </div>
        )}
        {nextGroup ? (
          <RaceGroupCard heading="Next Race" group={nextGroup} />
        ) : (
          <div className="flex items-center justify-center rounded-2xl border border-white/10 bg-white/5 py-16">
            <p className="text-sm text-white/50">Season complete — stay tuned!</p>
          </div>
        )}
      </div>

      {/* Results zoom modal (single or multi-race) */}
      {showResultsGroup && hasAnyResults(showResultsGroup) && (
        <GroupResultsModal
          group={showResultsGroup}
          onClose={() => setShowResultsGroup(null)}
        />
      )}
    </>
  );
}
