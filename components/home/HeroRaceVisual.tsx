import Image from "next/image";

export type HeroRaceMeta = {
  name: string;
  date: string;
  time?: string;
  track?: string;
  /** 2-letter ISO country code, if available. */
  countryCode?: string;
};

type HeroRaceVisualProps = {
  /** Fixed cinematic hero image (not a per-race poster). */
  image: string;
  imageIsRemote: boolean;
  alt: string;
  isLive: boolean;
  liveLabel: string;
};

/**
 * The hero's visual: a fixed, cover-cropped cinematic image, biased a touch to
 * the left so the driver group frames well. Kept intentionally clean — the
 * next-race details (name/date/time/track/countdown) live in the Races section
 * and race cards below, so we don't overlay them here. The only overlay is the
 * dynamic LIVE badge, which the image can't convey on its own.
 */
export default function HeroRaceVisual({
  image,
  imageIsRemote,
  alt,
  isLive,
  liveLabel,
}: HeroRaceVisualProps) {
  return (
    <>
      <Image
        src={image}
        alt={alt}
        fill
        priority
        sizes="(max-width: 1024px) 100vw, 60vw"
        className="object-cover object-center"
        unoptimized={imageIsRemote}
      />

      {isLive && (
        <div className="absolute start-0 top-0 z-10 p-4 md:p-5">
          <span className="inline-flex items-center gap-1.5 rounded-[2px] border border-status-danger bg-black/50 px-2.5 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-status-danger backdrop-blur-sm">
            <span className="h-1.5 w-1.5 rounded-full bg-status-danger animate-[f1-tick_1s_step-end_infinite]" />
            {liveLabel}
          </span>
        </div>
      )}
    </>
  );
}
