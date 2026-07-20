import { getTranslations } from "next-intl/server";
import { CircleOff, Percent, Scale, Flag } from "lucide-react";
import HeroActions, { type HeroState } from "@/components/home/HeroActions";
import HeroRaceVisual, { type HeroRaceMeta } from "@/components/home/HeroRaceVisual";
import LeagueAttributes, { type LeagueAttribute } from "@/components/home/LeagueAttributes";

type HomeHeroProps = {
  state: HeroState;
  /** Season display label, e.g. "Season 1". */
  seasonLabel: string;
  /** Fixed cinematic hero image (not a per-race poster). */
  image: string;
  imageIsRemote: boolean;
  /** Active race meta (used for the image alt text); null for the default state. */
  race: HeroRaceMeta | null;
  /** Watch links for live/replay states. */
  watchLinks: { label: string; url: string }[];
  /** Localized attribute labels (3 static + optional race count). */
  attributes: string[];
};

// Icons for the static attributes, in the order the i18n array declares them
// (no assists, 50% races, full stewarding). The race-count item gets the flag.
const ATTR_ICONS = [CircleOff, Percent, Scale] as const;

/**
 * Unified, league-first homepage hero (ideation-matched): one dark card with the
 * race image full-bleed on the inline-end and the league identity + state-aware
 * CTAs + icon attributes in the panel on the inline-start. Fits one viewport;
 * no separate intro block below. Race state is resolved by the server caller
 * from the same schedule data used by the Races section — no duplicated logic.
 */
export default async function HomeHero({
  state,
  seasonLabel,
  image,
  imageIsRemote,
  race,
  watchLinks,
  attributes,
}: HomeHeroProps) {
  const t = await getTranslations("home");

  const alt = race ? `${race.name} — ${t("hero.imageAlt")}` : t("hero.imageAlt");

  const attrItems: LeagueAttribute[] = attributes.map((label, i) => ({
    Icon: ATTR_ICONS[i] ?? Flag,
    label,
  }));

  return (
    <section className="relative isl-speed-lines border-b border-[color:var(--isl-hairline)]">
      <div className="mx-auto w-full max-w-[1240px] px-5 py-6 md:py-8">
        <div className="grid overflow-hidden rounded-[2px] border border-[color:var(--isl-hairline-strong)] lg:grid-cols-[1fr_1.3fr]">
          {/* League content — inline-start (order-1 on desktop) */}
          <div className="order-2 flex flex-col justify-center gap-5 bg-paper/85 p-6 backdrop-blur-sm md:p-9 lg:order-1 lg:p-10">
            <p className="font-isl-body text-[0.75rem] font-semibold uppercase tracking-[0.24em] text-brass-ink">
              {seasonLabel}
            </p>

            <h1 className="leading-[0.95]">
              <span className="block font-display text-6xl font-black tracking-[0.01em] text-brass-ink md:text-7xl">
                {t("hero.brand")}
              </span>
              <span className="mt-2 block font-display text-xl font-bold leading-tight tracking-[0.005em] text-ink md:text-2xl">
                <bdi>{t("hero.name")}</bdi>
              </span>
            </h1>

            <div className="isl-gold-rule max-w-[220px]" />

            <p className="max-w-md text-base text-ink-2">{t("hero.tagline")}</p>

            <HeroActions
              state={state}
              links={watchLinks}
              labels={{
                viewNextRace: t("hero.viewNextRace"),
                watchLive: t("hero.watchLive"),
                watchReplay: t("hero.watchReplay"),
                joinLeague: t("hero.joinLeague"),
                viewSchedule: t("hero.viewSchedule"),
              }}
            />

            <LeagueAttributes items={attrItems} />
          </div>

          {/* Race visual — inline-end (order-2 on desktop), on top on mobile.
              4:3 matches the source photo so it fills without cropping anyone. */}
          <div className="relative order-1 aspect-[4/3] bg-sink lg:order-2">
            <HeroRaceVisual
              image={image}
              imageIsRemote={imageIsRemote}
              alt={alt}
              isLive={state === "live"}
              liveLabel={t("hero.liveNow")}
            />
          </div>
        </div>
      </div>
    </section>
  );
}
