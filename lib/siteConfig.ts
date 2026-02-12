/* ------------------------------------------------------------------ */
/*  Site-wide static configuration                                     */
/*  ----------------------------------------------------------------  */
/*  Season-specific labels use {currentSeason} and {seasonCount}       */
/*  tokens which are resolved at render time from the seasons config.  */
/* ------------------------------------------------------------------ */

export type SiteConfig = {
  leagueName: string;
  discordUrl: string;
  seo: {
    title: string;
    description: string;
  };
  navigation: { label: string; href: string }[];
  hero: {
    title: string;
    subtitle: string;
    primaryCtaLabel: string;
    secondaryCtaLabel: string;
  };
  trustChips: string[];
  snapshotStats: { label: string; value: string }[];
  aboutBullets: string[];
  whatYouGet: { title: string; description: string; icon: "shield" | "users" | "chart" }[];
  leagueFormat: { title: string; description: string }[];
  joinCta: {
    title: string;
    description: string;
    buttonLabel: string;
    subtext: string;
  };
  socials: { label: string; href: string; icon: "facebook" | "discord" | "youtube" | "instagram" }[];
  footerNote: string;
};

export const siteConfig: SiteConfig = {
  leagueName: "PSGiL",
  discordUrl: "https://discord.gg/v6zF6QME7J",
  seo: {
    title: "PSGiL – F1 Sim Racing League (Israel)",
    description:
      "PSGiL is Israel's premium F1 sim racing league. Competitive clean racing, full season stats, and a community-first Formula 1 league experience.",
  },
  navigation: [
    { label: "Drivers", href: "/drivers" },
    { label: "Schedule & Results", href: "/schedule" },
    { label: "Tables", href: "/statistics" },
    { label: "Articles", href: "/articles" },
  ],
  hero: {
    title: "PSGiL – F1 Sim Racing League",
    subtitle:
      "Israel's largest F1 sim racing league, competing primarily on the EA Sports F1 series. Built on competition, respect, and an outstanding community.",
    primaryCtaLabel: "Join Now",
    secondaryCtaLabel: "Watch Last Race",
  },
  trustChips: [
    "3+ years running",
    "{currentSeason} live",
    "No assists • 50% races",
    "Fair & stewarded racing",
    "Two seasons per year",
    "Competitive grid",
    "Full race stats & history",
    "EA Sports F1 series",
  ],
  snapshotStats: [
    { label: "Seasons", value: "{seasonCount}" },
    { label: "Races", value: "60+" },
    { label: "Total Drivers", value: "50+" },
    { label: "Winners", value: "12" },
  ],
  aboutBullets: [
    "3+ years active",
    "Currently in {currentSeason}",
    "Community-first & respectful racing",
    "Full stats kept from the beginning",
  ],
  whatYouGet: [
    {
      title: "Clean racing",
      description: "Racecraft-first culture with stewarding and respect.",
      icon: "shield",
    },
    {
      title: "Community",
      description: "Active Discord, events, and shared improvement.",
      icon: "users",
    },
    {
      title: "Stats & highlights",
      description: "Structured race data, recaps, and season stories.",
      icon: "chart",
    },
  ],
  leagueFormat: [
    {
      title: "EA SPORTS F1 series",
      description:
        "We race on the official EA Sports F1 titles with standardized settings for fair competition.",
    },
    {
      title: "50% race length",
      description:
        "Half-distance races with real strategy—tyre wear, pit stops, and clean execution matter.",
    },
    {
      title: "No assists",
      description: "No driving assists. Full driver control for a competitive and authentic experience.",
    },
    {
      title: "League championship",
      description: "Season-long Drivers & Teams championships with consistent points, results, and standings.",
    },
    {
      title: "Two seasons per year",
      description:
        "A reliable calendar with two structured seasons each year—consistent racing and progression.",
    },
    {
      title: "Stewarding culture",
      description: "Clear rules and active stewarding to keep racing fair, respectful, and clean.",
    },
  ],
  joinCta: {
    title: "Ready to race with us?",
    description: "Join the community, get onboarded, and compete in organized events.",
    buttonLabel: "Join PSGiL Discord",
    subtext: "New drivers welcome • Quick onboarding",
  },
  socials: [
    {
      label: "Facebook",
      href: "https://www.facebook.com/profile.php?id=61550314611661",
      icon: "facebook",
    },
    { label: "Discord", href: "https://discord.gg/v6zF6QME7J", icon: "discord" },
    { label: "YouTube", href: "https://www.youtube.com/@PSGiLF1", icon: "youtube" },
    {
      label: "Instagram",
      href: "https://www.instagram.com/psgil_f1?utm_source=ig_web_button_share_sheet&igsh=ZDNlZDc0MzIxNw==",
      icon: "instagram",
    },
  ],
  footerNote: "Community-run league",
};
