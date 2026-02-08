import Image from "next/image";
import path from "node:path";
import { existsSync } from "node:fs";
import Button from "@/components/Button";
import HomeRaceCards from "@/components/HomeRaceCards";
import WatchLastRaceButton from "@/components/WatchLastRaceButton";
import Section from "@/components/Section";
import SnapshotStrip from "@/components/SnapshotStrip";
import SocialLinks from "@/components/SocialLinks";
import { siteConfig } from "@/lib/siteConfig";
import { fetchCsv, parseCsv } from "@/lib/csv";
import {
  mapRaceEvents,
  getLastRaceGroup,
  getNextRaceGroup,
} from "@/lib/scheduleData";
import type { RaceGroup } from "@/lib/scheduleData";

const heroImagePath = "/hero.jpg";
const resolvePublic = (filePath: string) =>
  path.join(process.cwd(), "public", filePath.replace(/^\/+/, ""));

const SCHEDULE_CSV_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vQSNGhBKLMDdmeIOy9wn3ZBS3Kk0-oBmWCMs0ANbg3qDrSsp9PbIXm8qLtTUQKA2HkvoNEpZg9Zf_Ps/pub?gid=2105913561&single=true&output=csv";

export default async function Home() {
  const heroImageExists = existsSync(resolvePublic(heroImagePath));

  /* Fetch schedule data for Races section */
  let lastGroup: RaceGroup | null = null;
  let nextGroup: RaceGroup | null = null;
  try {
    const csv = await fetchCsv(SCHEDULE_CSV_URL);
    const raw = parseCsv<Record<string, string>>(csv);
    const events = mapRaceEvents(raw);
    lastGroup = getLastRaceGroup(events);
    nextGroup = getNextRaceGroup(events);
  } catch {
    // CSV not available — cards will show fallback
  }

  // Strip non-serialisable _dateObj before sending to client component
  const stripDate = (g: RaceGroup | null) =>
    g ? { events: g.events, date: g.date, league: g.league, season: g.season } : null;
  const lastGroupSafe = stripDate(lastGroup);
  const nextGroupSafe = stripDate(nextGroup);

  // Compute unique YouTube links for the "Watch Last Race" hero button
  const lastRaceYoutubeLinks: { label: string; url: string }[] = [];
  if (lastGroup) {
    const seen = new Set<string>();
    for (const e of lastGroup.events) {
      if (e.youtube_url && !seen.has(e.youtube_url)) {
        seen.add(e.youtube_url);
        lastRaceYoutubeLinks.push({
          label: `Watch Race #${e.race_number} – ${e.race_name}`,
          url: e.youtube_url,
        });
      }
    }
    // If all races share the same URL, simplify the label
    if (lastRaceYoutubeLinks.length === 1) {
      lastRaceYoutubeLinks[0].label = siteConfig.hero.secondaryCtaLabel;
    }
  }

  return (
    <main className="bg-[#0B0B0E] text-white">
      <section className="relative overflow-hidden pb-10 pt-12 md:pt-16">
        <div className="absolute inset-0">
          {heroImageExists ? (
            <Image
              src={heroImagePath}
              alt="PSGiL racing atmosphere"
              fill
              priority
              className="object-cover object-center"
            />
          ) : (
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(112,32,176,0.35),_transparent_55%),linear-gradient(160deg,_#151120,_#0B0B0E_55%)]" />
          )}
          <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-black/60 to-[#0B0B0E]" />
          <div className="absolute inset-0 opacity-[0.08] [background-image:repeating-linear-gradient(135deg,_rgba(255,255,255,0.35)_0,_rgba(255,255,255,0.35)_1px,_transparent_1px,_transparent_8px)]" />
          <div className="absolute left-1/2 top-28 h-px w-[80%] -translate-x-1/2 -rotate-6 bg-gradient-to-r from-transparent via-[#7020B0]/70 to-transparent animate-[hero-glide_10s_linear_infinite]" />
          <div className="absolute right-6 top-16 text-[140px] font-display font-semibold tracking-[0.2em] text-white/5 md:text-[220px]">
            {siteConfig.leagueName}
          </div>
        </div>

        <div className="relative mx-auto w-full max-w-6xl px-6">
          <div className="w-full max-w-4xl">
            <Image
              src="/psgil-banner.png"
              alt="PSGiL Season 6 banner"
              width={2000}
              height={600}
              priority
              className="h-auto w-full rounded-2xl"
              sizes="(max-width: 768px) 100vw, 70vw"
            />
          </div>

          <div className="mt-8 max-w-3xl">
            <p className="text-sm uppercase tracking-[0.3em] text-white/60">
              {siteConfig.seasonLabel}
            </p>
            <h1 className="mt-4 font-display text-4xl font-semibold tracking-tight md:text-5xl lg:text-6xl">
              {siteConfig.hero.title}
            </h1>
            <p className="mt-4 max-w-xl text-base text-white/70 md:text-lg">
              {siteConfig.hero.subtitle}
            </p>
            <div className="mt-8 flex flex-wrap gap-4">
              <Button href={siteConfig.discordUrl} external>
                {siteConfig.hero.primaryCtaLabel}
              </Button>
              <WatchLastRaceButton
                links={lastRaceYoutubeLinks}
                label={siteConfig.hero.secondaryCtaLabel}
              />
            </div>
            <div className="mt-6 flex flex-wrap gap-3 text-xs">
              {siteConfig.trustChips.map((chip) => (
                <span
                  key={chip}
                  className="rounded-full border border-[#7020B0]/60 bg-white/5 px-4 py-2 text-white"
                >
                  {chip}
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>

      <div className="mx-auto mt-4 w-full max-w-6xl px-6">
        <SocialLinks items={siteConfig.socials} variant="compact" />
      </div>

      <SnapshotStrip stats={siteConfig.snapshotStats} />

      <Section title="League Format" description="Structured racing built for consistency and clean results.">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {siteConfig.leagueFormat.map((item) => (
            <div
              key={item.title}
              className="rounded-2xl border border-white/10 bg-white/5 p-5 text-sm text-white/70"
            >
              <h3 className="font-display text-base font-semibold text-[#D4AF37]">{item.title}</h3>
              <p className="mt-2 text-white/60">{item.description}</p>
            </div>
          ))}
        </div>
      </Section>

      <Section
        title="Races"
        description="Latest action and what is coming up next."
        headerRight={
          <Button href="/schedule" size="sm">
            Full Schedule
          </Button>
        }
      >
        <HomeRaceCards lastGroup={lastGroupSafe} nextGroup={nextGroupSafe} />
      </Section>

      <Section title="About Us">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-6 md:p-8">
          <p className="text-sm text-white/70 md:text-base">
            PSGiL is Israel’s largest F1 sim racing league, competing primarily on the EA Sports F1
            series, running continuously for over three years and currently in its sixth season.
            Built by drivers, for drivers, the league is centered around a strong and supportive
            community, highly competitive grids, and a deep commitment to clean, respectful
            racing—both on and off the track. With structured seasons, consistent stewarding, and a
            culture that values fairness and sportsmanship, PSGiL has grown into a home for drivers
            who are looking for serious competition without losing the human side of racing.
          </p>
        </div>
      </Section>

      <Section>
        <div className="rounded-2xl border border-[#7020B0]/40 bg-[#120b1a] px-6 py-10 md:px-10">
          <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="font-display text-2xl font-semibold text-white md:text-3xl">
                {siteConfig.joinCta.title}
              </h2>
              <p className="mt-3 max-w-xl text-sm text-white/70 md:text-base">
                {siteConfig.joinCta.description}
              </p>
              <p className="mt-3 text-xs uppercase tracking-[0.2em] text-white/50">
                {siteConfig.joinCta.subtext}
              </p>
            </div>
            <Button href={siteConfig.discordUrl} external>
              {siteConfig.joinCta.buttonLabel}
            </Button>
          </div>
        </div>
      </Section>

      <Section title="Follow PSGiL" description="Stay connected for announcements and race highlights.">
        <SocialLinks items={siteConfig.socials} />
      </Section>
    </main>
  );
}
