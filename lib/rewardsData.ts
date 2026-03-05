import { fetchCsv, parseCsv } from "@/lib/csv";
import type { Driver } from "@/lib/driversData";
import type { DriverStatRow } from "@/lib/statsData";
import type { StandingsRow } from "@/lib/resultsData";

export type RewardCompetition =
  | "main"
  | "lower"
  | "wild"
  | "constructors"
  | "community";

export type RewardRecipientType = "driver" | "team";

export type AwardCode =
  | "champion"
  | "runner_up"
  | "third_place"
  | "best_of_rest"
  | "cleanest_driver"
  | "driver_of_season"
  | "grid_climber"
  | "mr_consistent"
  | "most_improved"
  | "most_valuable"
  | "constructors_champion"
  | "constructors_runner_up"
  | "constructors_third_place";

export type Reward = {
  season_id: number;
  competition: RewardCompetition;
  award_code: AwardCode;
  award_label: string;
  recipient_type: RewardRecipientType;
  recipient_id: string;
  notes?: string;
  source?: string;
  icon_key?: string;
  tooltip?: string;
  rank?: number;
};

export const DEFAULT_AWARD_LABELS: Record<AwardCode, string> = {
  champion: "Champion",
  runner_up: "Runner-up",
  third_place: "Third Place",
  best_of_rest: "Best of the Rest",
  cleanest_driver: "Cleanest Driver",
  driver_of_season: "Driver of the Season",
  grid_climber: "Grid Climber",
  mr_consistent: "Mr. Consistent",
  most_improved: "Most Improved Driver",
  most_valuable: "Most Valuable Driver",
  constructors_champion: "Constructors Champion",
  constructors_runner_up: "Constructors Runner-up",
  constructors_third_place: "Constructors Third Place",
};

export const DEFAULT_AWARD_TOOLTIPS: Record<AwardCode, string> = {
  champion: "Won the season championship.",
  runner_up: "Finished 2nd in the season championship.",
  third_place: "Finished 3rd in the season championship.",
  best_of_rest: "Finished 4th overall in the season championship.",
  cleanest_driver:
    "Lowest combined penalty total (game + stewards) across the season.",
  driver_of_season: "Most Driver of the Day awards in the season.",
  grid_climber: "Most total positions gained across the season.",
  mr_consistent: "Finished the most races across the season.",
  most_improved: "Community vote: Most Improved Driver.",
  most_valuable: "Community vote: Most Valuable Driver.",
  constructors_champion: "Team that won the constructors championship.",
  constructors_runner_up: "Team that finished 2nd in constructors.",
  constructors_third_place: "Team that finished 3rd in constructors.",
};

export const DEFAULT_AWARD_RANK: Record<AwardCode, number> = {
  champion: 10,
  runner_up: 20,
  third_place: 30,
  constructors_champion: 40,
  best_of_rest: 50,
  driver_of_season: 60,
  cleanest_driver: 70,
  grid_climber: 80,
  mr_consistent: 90,
  most_improved: 100,
  most_valuable: 110,
  constructors_runner_up: 120,
  constructors_third_place: 130,
};

const VALID_AWARD_CODES = new Set<string>(Object.keys(DEFAULT_AWARD_LABELS));
const VALID_COMPETITIONS = new Set<RewardCompetition>([
  "main",
  "lower",
  "wild",
  "constructors",
  "community",
]);
const VALID_RECIPIENT_TYPES = new Set<RewardRecipientType>(["driver", "team"]);

function s(value: string | undefined): string {
  return (value ?? "").trim();
}

function toNum(value: string): number | undefined {
  if (!value) return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}

function normalizeAwardCode(raw: string): AwardCode | null {
  const v = s(raw).toLowerCase();
  if (!VALID_AWARD_CODES.has(v)) return null;
  return v as AwardCode;
}

function normalizeCompetition(raw: string): RewardCompetition | null {
  const v = s(raw).toLowerCase() as RewardCompetition;
  if (!VALID_COMPETITIONS.has(v)) return null;
  return v;
}

function normalizeRecipientType(raw: string): RewardRecipientType | null {
  const v = s(raw).toLowerCase() as RewardRecipientType;
  if (!VALID_RECIPIENT_TYPES.has(v)) return null;
  return v;
}

function mapRewardRow(row: Record<string, string>): Reward | null {
  const seasonId = Number.parseInt(s(row.season_id), 10);
  const competition = normalizeCompetition(row.competition);
  const awardCode = normalizeAwardCode(row.award_code);
  const recipientType = normalizeRecipientType(row.recipient_type);
  const recipientId = s(row.recipient_id);
  if (
    !Number.isFinite(seasonId) ||
    !competition ||
    !awardCode ||
    !recipientType ||
    !recipientId
  ) {
    return null;
  }

  return {
    season_id: seasonId,
    competition,
    award_code: awardCode,
    award_label: s(row.award_label) || DEFAULT_AWARD_LABELS[awardCode],
    recipient_type: recipientType,
    recipient_id: recipientId,
    notes: s(row.notes) || undefined,
    source: s(row.source) || undefined,
    icon_key: s(row.icon_key) || undefined,
    tooltip: s(row.tooltip) || undefined,
    rank: toNum(s(row.rank)) ?? DEFAULT_AWARD_RANK[awardCode],
  };
}

export async function fetchRewards(url?: string): Promise<Reward[]> {
  const sourceUrl = s(url ?? process.env.REWARDS_SHEET_URL ?? "");
  if (!sourceUrl) return [];
  try {
    const csv = await fetchCsv(sourceUrl);
    const rows = parseCsv<Record<string, string>>(csv);
    return rows
      .map(mapRewardRow)
      .filter((r): r is Reward => r !== null)
      .sort((a, b) => {
        if (a.season_id !== b.season_id) return b.season_id - a.season_id;
        if ((a.rank ?? 999) !== (b.rank ?? 999)) {
          return (a.rank ?? 999) - (b.rank ?? 999);
        }
        return a.award_label.localeCompare(b.award_label);
      });
  } catch {
    return [];
  }
}

export function getDriverRewards(driverId: string, rewards: Reward[]): Reward[] {
  return rewards.filter(
    (r) => r.recipient_type === "driver" && r.recipient_id === driverId,
  );
}

export function getSeasonRewards(
  seasonId: number,
  rewards: Reward[],
): Reward[] {
  return rewards.filter((r) => r.season_id === seasonId);
}

export function groupRewardsBySeason(rewards: Reward[]): Record<number, Reward[]> {
  const grouped: Record<number, Reward[]> = {};
  for (const reward of rewards) {
    if (!grouped[reward.season_id]) grouped[reward.season_id] = [];
    grouped[reward.season_id].push(reward);
  }
  return grouped;
}

export function countRewardsByAwardCode(
  driverId: string,
  rewards: Reward[],
): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const reward of getDriverRewards(driverId, rewards)) {
    counts[reward.award_code] = (counts[reward.award_code] || 0) + 1;
  }
  return counts;
}

export function attachRewardsToDrivers(
  drivers: Driver[],
  rewards: Reward[],
): Driver[] {
  const byDriverId = new Map<string, Reward[]>();
  for (const reward of rewards) {
    if (reward.recipient_type !== "driver") continue;
    const arr = byDriverId.get(reward.recipient_id) ?? [];
    arr.push(reward);
    byDriverId.set(reward.recipient_id, arr);
  }

  return drivers.map((driver) => ({
    ...driver,
    rewards: byDriverId.get(driver.driver_id) ?? [],
  }));
}

export const DRIVER_REWARD_METRIC_LABELS = {
  mainChampionTitles: "Main Champion Titles",
  mainSecondTitles: "Main 2nd Titles",
  mainThirdTitles: "Main 3rd Titles",
  lowerChampionTitles: "Lower Champion Titles",
  lowerSecondTitles: "Lower 2nd Titles",
  lowerThirdTitles: "Lower 3rd Titles",
  wildChampionTitles: "Wild Champion Titles",
  wildSecondTitles: "Wild 2nd Titles",
  wildThirdTitles: "Wild 3rd Titles",
  bestOfRest: "Best of the Rest",
  cleanestDriver: "Cleanest Driver",
  driverOfSeason: "Driver of the Season",
  gridClimber: "Grid Climber",
  mrConsistent: "Mr. Consistent",
  mostImproved: "Most Improved",
  mostValuable: "Most Valuable",
  constructorsChampion: "Constructors Champion",
} as const;

function countByCompetitionAndAward(
  rewards: Reward[],
  competition: RewardCompetition,
  awardCode: AwardCode,
): number {
  return rewards.filter(
    (r) => r.competition === competition && r.award_code === awardCode,
  ).length;
}

export function buildRewardCountsForDriver(
  driverId: string,
  rewards: Reward[],
  seasonId?: number,
  constructorsChampionCount?: number,
): Record<string, number> {
  const scoped = rewards.filter((r) => {
    if (r.recipient_type !== "driver") return false;
    if (r.recipient_id !== driverId) return false;
    if (!seasonId) return true;
    return r.season_id === seasonId;
  });
  return {
    [DRIVER_REWARD_METRIC_LABELS.mainChampionTitles]:
      countByCompetitionAndAward(scoped, "main", "champion"),
    [DRIVER_REWARD_METRIC_LABELS.mainSecondTitles]:
      countByCompetitionAndAward(scoped, "main", "runner_up"),
    [DRIVER_REWARD_METRIC_LABELS.mainThirdTitles]:
      countByCompetitionAndAward(scoped, "main", "third_place"),
    [DRIVER_REWARD_METRIC_LABELS.lowerChampionTitles]:
      countByCompetitionAndAward(scoped, "lower", "champion"),
    [DRIVER_REWARD_METRIC_LABELS.lowerSecondTitles]:
      countByCompetitionAndAward(scoped, "lower", "runner_up"),
    [DRIVER_REWARD_METRIC_LABELS.lowerThirdTitles]:
      countByCompetitionAndAward(scoped, "lower", "third_place"),
    [DRIVER_REWARD_METRIC_LABELS.wildChampionTitles]:
      countByCompetitionAndAward(scoped, "wild", "champion"),
    [DRIVER_REWARD_METRIC_LABELS.wildSecondTitles]:
      countByCompetitionAndAward(scoped, "wild", "runner_up"),
    [DRIVER_REWARD_METRIC_LABELS.wildThirdTitles]:
      countByCompetitionAndAward(scoped, "wild", "third_place"),
    [DRIVER_REWARD_METRIC_LABELS.bestOfRest]:
      countByCompetitionAndAward(scoped, "main", "best_of_rest") +
      countByCompetitionAndAward(scoped, "lower", "best_of_rest") +
      countByCompetitionAndAward(scoped, "wild", "best_of_rest"),
    [DRIVER_REWARD_METRIC_LABELS.cleanestDriver]:
      countByCompetitionAndAward(scoped, "main", "cleanest_driver") +
      countByCompetitionAndAward(scoped, "lower", "cleanest_driver") +
      countByCompetitionAndAward(scoped, "wild", "cleanest_driver"),
    [DRIVER_REWARD_METRIC_LABELS.driverOfSeason]:
      countByCompetitionAndAward(scoped, "main", "driver_of_season") +
      countByCompetitionAndAward(scoped, "lower", "driver_of_season") +
      countByCompetitionAndAward(scoped, "wild", "driver_of_season"),
    [DRIVER_REWARD_METRIC_LABELS.gridClimber]:
      countByCompetitionAndAward(scoped, "main", "grid_climber") +
      countByCompetitionAndAward(scoped, "lower", "grid_climber") +
      countByCompetitionAndAward(scoped, "wild", "grid_climber"),
    [DRIVER_REWARD_METRIC_LABELS.mrConsistent]:
      countByCompetitionAndAward(scoped, "main", "mr_consistent") +
      countByCompetitionAndAward(scoped, "lower", "mr_consistent") +
      countByCompetitionAndAward(scoped, "wild", "mr_consistent"),
    [DRIVER_REWARD_METRIC_LABELS.mostImproved]:
      countByCompetitionAndAward(scoped, "community", "most_improved"),
    [DRIVER_REWARD_METRIC_LABELS.mostValuable]:
      countByCompetitionAndAward(scoped, "community", "most_valuable"),
    [DRIVER_REWARD_METRIC_LABELS.constructorsChampion]:
      constructorsChampionCount ??
      countByCompetitionAndAward(scoped, "constructors", "constructors_champion"),
  };
}

function normalizeTeam(value: string): string {
  const cleaned = value
    .trim()
    .toLowerCase()
    .replace(/\batlassian\b/g, "")
    .replace(/\bf1 team\b/g, "")
    .replace(/\bteam\b/g, "")
    .replace(/[^\w\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();

  const engineTokens = new Set([
    "mercedes",
    "ferrari",
    "renault",
    "honda",
    "rbpt",
    "aramco",
  ]);

  // Keep single-token teams (e.g. "Mercedes"), but trim trailing engine tags
  // for compound names (e.g. "Williams Mercedes" -> "williams").
  const tokens = cleaned.split(" ").filter(Boolean);
  while (tokens.length > 1 && engineTokens.has(tokens[tokens.length - 1])) {
    tokens.pop();
  }
  return tokens.join(" ").trim();
}

function teamsMatch(constructorTeam: string, driverTeam: string): boolean {
  const a = normalizeTeam(constructorTeam);
  const b = normalizeTeam(driverTeam);
  if (!a || !b) return false;
  if (a === b) return true;
  // Fallback for close variants (e.g. "racing bulls honda" vs "racing bulls").
  return a.includes(b) || b.includes(a);
}

function normalizeSeason(value: string): string {
  const v = value.trim();
  if (!v) return "";
  return `S${v.replace(/^S/i, "")}`;
}

export function buildConstructorsChampionCountsFromRewards(
  rewards: Reward[],
  driverStandingsMain: StandingsRow[],
  teamNameByKey: Map<string, string>,
): {
  allTimeByDriver: Map<string, number>;
  bySeasonByDriver: Map<number, Map<string, number>>;
} {
  // Source of truth: rewards CSV entries for constructors champion.
  const winningTeamsBySeason = new Map<string, string[]>();
  for (const reward of rewards) {
    if (
      reward.competition !== "constructors" ||
      reward.award_code !== "constructors_champion" ||
      reward.recipient_type !== "team"
    ) {
      continue;
    }
    const seasonKey = normalizeSeason(String(reward.season_id));
    const teamName =
      teamNameByKey.get(reward.recipient_id) || reward.recipient_id || "";
    if (!seasonKey || !teamName) continue;
    const curr = winningTeamsBySeason.get(seasonKey) ?? [];
    if (!curr.includes(teamName)) curr.push(teamName);
    winningTeamsBySeason.set(seasonKey, curr);
  }

  const winsByDriver = new Map<string, Set<string>>();
  for (const row of driverStandingsMain) {
    const driverId = (row.driver_id || "").trim();
    const seasonKey = normalizeSeason(row.season);
    const teamName = (row.team || "").trim();
    if (!driverId || !seasonKey || !teamName) continue;
    const winners = winningTeamsBySeason.get(seasonKey);
    if (!winners || !winners.some((winnerTeam) => teamsMatch(winnerTeam, teamName))) {
      continue;
    }
    const curr = winsByDriver.get(driverId) ?? new Set<string>();
    curr.add(`${seasonKey}:${normalizeTeam(teamName)}`);
    winsByDriver.set(driverId, curr);
  }

  const counts = new Map<string, number>();
  for (const [driverId, wins] of winsByDriver.entries()) {
    counts.set(driverId, wins.size);
  }

  const bySeasonByDriver = new Map<number, Map<string, number>>();
  for (const [seasonKey, winnerTeams] of winningTeamsBySeason.entries()) {
    const seasonId = Number.parseInt(seasonKey.replace(/^S/i, ""), 10);
    if (!Number.isFinite(seasonId)) continue;
    const seasonCounts = new Map<string, number>();
    for (const row of driverStandingsMain) {
      const driverId = (row.driver_id || "").trim();
      const rowSeason = normalizeSeason(row.season);
      const rowTeam = (row.team || "").trim();
      if (!driverId || !rowSeason || !rowTeam || rowSeason !== seasonKey) continue;
      if (!winnerTeams.some((winnerTeam) => teamsMatch(winnerTeam, rowTeam))) continue;
      seasonCounts.set(driverId, (seasonCounts.get(driverId) || 0) + 1);
    }
    bySeasonByDriver.set(seasonId, seasonCounts);
  }

  return { allTimeByDriver: counts, bySeasonByDriver };
}

export function augmentStatsRowsWithRewards(
  rows: DriverStatRow[],
  rewards: Reward[],
  nameToDriverId: Map<string, string>,
  seasonId?: number,
  constructorsChampionCountResolver?: (
    driverId: string,
    seasonId?: number,
  ) => number | undefined,
): DriverStatRow[] {
  return rows.map((row) => {
    const driverId = nameToDriverId.get(row.driver_name.trim().toLowerCase());
    if (!driverId) return row;
    const rewardMetrics = buildRewardCountsForDriver(
      driverId,
      rewards,
      seasonId,
      constructorsChampionCountResolver?.(driverId, seasonId),
    );
    return {
      ...row,
      metrics: {
        ...row.metrics,
        ...rewardMetrics,
      },
    };
  });
}

