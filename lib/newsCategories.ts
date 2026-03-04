export const NEWS_CATEGORY = {
  ANNOUNCEMENTS: "announcements",
  RACE: "race",
  HUB: "hub",
} as const;

export type NewsCategory =
  (typeof NEWS_CATEGORY)[keyof typeof NEWS_CATEGORY];

export const NEWS_CATEGORY_LABEL: Record<NewsCategory, string> = {
  [NEWS_CATEGORY.ANNOUNCEMENTS]: "League Announcements",
  [NEWS_CATEGORY.RACE]: "Race Previews & Recaps",
  [NEWS_CATEGORY.HUB]: "F1 & Sim Hub",
};

export const NEWS_CATEGORY_ORDER: NewsCategory[] = [
  NEWS_CATEGORY.ANNOUNCEMENTS,
  NEWS_CATEGORY.RACE,
  NEWS_CATEGORY.HUB,
];

export function normalizeNewsCategory(raw: string): NewsCategory {
  const value = String(raw || "").trim().toLowerCase();
  if (!value) return NEWS_CATEGORY.HUB;

  if (value.includes("announce")) {
    return NEWS_CATEGORY.ANNOUNCEMENTS;
  }

  if (
    value === NEWS_CATEGORY.RACE ||
    value.includes("race") ||
    value.includes("preview") ||
    value.includes("recap")
  ) {
    return NEWS_CATEGORY.RACE;
  }

  if (
    value === NEWS_CATEGORY.HUB ||
    value.includes("hub") ||
    value.includes("guide") ||
    value.includes("community") ||
    value.includes("academy") ||
    value.includes("sim")
  ) {
    return NEWS_CATEGORY.HUB;
  }

  return NEWS_CATEGORY.HUB;
}

