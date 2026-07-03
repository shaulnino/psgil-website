/* ------------------------------------------------------------------ */
/*  Site-wide static configuration                                     */
/*  ----------------------------------------------------------------  */
/*  Display copy has been migrated to next-intl message catalogs       */
/*  (messages/en/common.json + messages/en/home.json). This file now   */
/*  holds only structural/code data: nav ids + hrefs, snapshot stat    */
/*  ids + season-token values, social links, and dead legacy config.   */
/*                                                                      */
/*  Season-specific values use {currentSeason} / {seasonCount} tokens   */
/*  which are resolved at render time via resolveTemplate().            */
/* ------------------------------------------------------------------ */

export type SiteConfig = {
  discordUrl: string;
  navigation: { id: string; href: string }[];
  snapshotStats: { id: string; value: string }[];
  aboutBullets: string[];
  whatYouGet: { title: string; description: string; icon: "shield" | "users" | "chart" }[];
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
  discordUrl: "https://discord.gg/v6zF6QME7J",
  navigation: [
    { id: "schedule", href: "/schedule" },
    { id: "tables", href: "/statistics" },
    { id: "drivers", href: "/drivers" },
    { id: "stats", href: "/stats" },
    { id: "news", href: "/news" },
    { id: "stewards", href: "/stewards/login" },
  ],
  snapshotStats: [
    { id: "seasons", value: "{seasonCount}" },
    { id: "races", value: "{totalRaces}" },
    { id: "totalDrivers", value: "{totalDrivers}" },
    { id: "winners", value: "{uniqueWinners}" },
  ],
  // DEAD CONFIG — never rendered anywhere. Retained intentionally.
  aboutBullets: [
    "Inaugural season",
    "Currently in {currentSeason}",
    "Community-first & respectful racing",
    "Full stats kept from the beginning",
  ],
  // DEAD CONFIG — never rendered anywhere. Retained intentionally.
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
  // DEAD CONFIG — never rendered anywhere. Retained intentionally.
  joinCta: {
    title: "Ready to race with us?",
    description: "Join the community, get onboarded, and compete in organized events.",
    buttonLabel: "Join ISL Discord",
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
