import { randomUUID } from "node:crypto";
import { readStore, writeStore } from "@/lib/stewards/store";
import type {
  Appeal,
  AppealDriverVerdict,
  AppealInternalComment,
  AppealOutcome,
  AppealStatus,
  AppealVerdict,
  AttachmentRef,
  CaseResponse,
  CaseStatus,
  DriverVerdict,
  InternalComment,
  PenaltyToServe,
  PenaltyToServeStatus,
  StewardCase,
  StewardRole,
  StewardStore,
  StewardUser,
  Verdict,
  VerdictDecision,
  WeekendSession,
} from "@/lib/stewards/types";
import { fetchThresholdRules } from "@/lib/stewards/penaltyRules";
import { fetchCsv, parseCsv } from "@/lib/csv";
import { mapRaceEvents, toIsraelTimestamp } from "@/lib/scheduleData";
import { GLOBAL_CSV_URLS } from "@/lib/seasonConfig";

export type RemoveUserResult =
  | { ok: true }
  | { ok: false; reason: "not-found" | "cannot-remove-self" | "last-admin" };

export type PendingIndicator = { id: string; label: string; count: number; href: string };

export type DriverVerdictWithDriver = DriverVerdict & { driver: StewardUser | null };

export type CaseWithRelations = {
  caseItem: StewardCase;
  complainant: StewardUser | null;
  involvedDrivers: StewardUser[];
  responses: (CaseResponse & { user: StewardUser | null })[];
  internalComments: (InternalComment & { author: StewardUser | null })[];
  verdict: Verdict | null;
  driverVerdicts: DriverVerdictWithDriver[];
};

type NewUserInput = {
  name: string;
  email: string;
  passwordHash: string;
  roles: StewardRole[];
  /** Defaults to true — new accounts must change password on first login. */
  mustChangePassword?: boolean;
};

type NewCaseInput = {
  title: string;
  season: string;
  round: string;
  weekendSession: WeekendSession;
  incidentLapNumber: number | null;
  qualifyingTime: string | null;
  complainantId: string;
  involvedDriverIds: string[];
  description: string;
  attachmentUrls: string[];
  links: string[];
};

type NewResponseInput = {
  caseId: string;
  userId: string;
  text: string;
  attachmentUrls: string[];
  links: string[];
};

type NewInternalCommentInput = {
  caseId: string;
  authorId: string;
  text: string;
};

export type DriverVerdictEntry = {
  driverId: string;
  license_points: number | null;
  time_penalty_seconds: number | null;
  warning_text: string | null;
};

type UpsertVerdictInput = {
  caseId: string;
  updatedBy: string;
  driverEntries: DriverVerdictEntry[];
  verdict_decision: VerdictDecision | null;
  verdict_summary: string;
  verdict_full_text: string;
  is_published: boolean;
};

const STATUSES: CaseStatus[] = [
  "Open",
  "Waiting for Response",
  "Under Review",
  "Verdict Ready",
  "Closed",
  "Archived",
];

const VALID_ROLES: StewardRole[] = ["admin", "steward", "member"];

const normalizeRoles = (roles: StewardRole[]) =>
  [...new Set(roles.filter((r) => VALID_ROLES.includes(r)))];

const attachmentsFromUrls = (urls: string[]) =>
  urls.map((url, idx) => ({ name: `Attachment ${idx + 1}`, url }));

export async function listUsers(): Promise<StewardUser[]> {
  const store = await readStore();
  return store.users.map((u) => ({ ...u, roles: normalizeRoles(u.roles ?? []) }));
}

export async function getUserById(id: string) {
  const users = await listUsers();
  return users.find((u) => u.id === id) ?? null;
}

export async function getUserByEmail(email: string) {
  const users = await listUsers();
  return users.find((u) => u.email.toLowerCase() === email.toLowerCase()) ?? null;
}

export async function createUser(input: NewUserInput) {
  const store = await readStore();
  const now = new Date().toISOString();
  const user: StewardUser = {
    id: `u_${randomUUID()}`,
    name: input.name.trim(),
    email: input.email.trim().toLowerCase(),
    roles: normalizeRoles(input.roles),
    passwordHash: input.passwordHash,
    isActive: true,
    mustChangePassword: input.mustChangePassword ?? true,
    createdAt: now,
    updatedAt: now,
  };
  store.users.push(user);
  await writeStore(store);
  return user;
}

export async function updateUser(
  userId: string,
  fields: { name?: string; email?: string; passwordHash?: string; mustChangePassword?: boolean },
) {
  const store = await readStore();
  const user = store.users.find((u) => u.id === userId);
  if (!user) return false;
  if (fields.name !== undefined)                user.name              = fields.name.trim();
  if (fields.email !== undefined)               user.email             = fields.email.trim().toLowerCase();
  if (fields.passwordHash !== undefined)        user.passwordHash      = fields.passwordHash;
  if (fields.mustChangePassword !== undefined)  user.mustChangePassword = fields.mustChangePassword;
  user.updatedAt = new Date().toISOString();
  await writeStore(store);
  return true;
}

export async function updateUserRoles(userId: string, roles: StewardRole[]) {
  const store = await readStore();
  const user = store.users.find((u) => u.id === userId);
  if (!user) return;
  user.roles = normalizeRoles(roles);
  user.updatedAt = new Date().toISOString();
  await writeStore(store);
}

export async function removeUserById(userId: string, actorUserId: string): Promise<RemoveUserResult> {
  if (userId === actorUserId) return { ok: false, reason: "cannot-remove-self" };
  const store = await readStore();
  const target = store.users.find((u) => u.id === userId);
  if (!target) return { ok: false, reason: "not-found" };
  if (target.roles.includes("admin")) {
    const adminCount = store.users.filter((u) => u.isActive && u.roles.includes("admin")).length;
    if (adminCount <= 1) return { ok: false, reason: "last-admin" };
  }
  store.users = store.users.filter((u) => u.id !== userId);
  await writeStore(store);
  return { ok: true };
}

const WAITING_DELAY_MS = 10 * 60 * 1000; // 10 minutes

/** Lazily promote Open cases that are older than WAITING_DELAY_MS to "Waiting for Response". */
async function maybePromoteOpenCases(store: StewardStore): Promise<boolean> {
  const now = Date.now();
  let changed = false;
  for (const c of store.cases) {
    if (c.status === "Open" && now - new Date(c.createdAt).getTime() >= WAITING_DELAY_MS) {
      c.status = "Waiting for Response";
      c.updatedAt = new Date().toISOString();
      changed = true;
    }
  }
  return changed;
}

export async function listCases() {
  const store = await readStore();
  if (await maybePromoteOpenCases(store)) await writeStore(store);
  return [...store.cases].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function createCase(input: NewCaseInput) {
  const store = await readStore();
  const now = new Date().toISOString();
  const caseItem: StewardCase = {
    id: `case_${randomUUID()}`,
    caseNumber: store.cases.length + 1,
    title: input.title.trim(),
    season: input.season.trim(),
    round: input.round.trim(),
    weekendSession: input.weekendSession,
    incidentLapNumber: input.incidentLapNumber,
    qualifyingTime: input.qualifyingTime,
    complainantId: input.complainantId,
    involvedDriverIds: input.involvedDriverIds,
    description: input.description.trim(),
    status: "Open",
    attachments: attachmentsFromUrls(input.attachmentUrls),
    links: input.links,
    responseIds: [],
    internalCommentIds: [],
    verdictId: null,
    createdAt: now,
    updatedAt: now,
    closedAt: null,
    archivedAt: null,
  };
  store.cases.push(caseItem);
  await writeStore(store);
  return caseItem;
}

export async function getCaseById(caseId: string): Promise<CaseWithRelations | null> {
  const store = await readStore();
  if (await maybePromoteOpenCases(store)) await writeStore(store);
  const caseItem = store.cases.find((c) => c.id === caseId);
  if (!caseItem) return null;
  const complainant = store.users.find((u) => u.id === caseItem.complainantId) ?? null;
  const involvedDrivers = store.users.filter((u) => caseItem.involvedDriverIds.includes(u.id));
  const responses = store.responses
    .filter((r) => r.caseId === caseId)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    .map((r) => ({ ...r, user: store.users.find((u) => u.id === r.userId) ?? null }));
  const internalComments = store.internalComments
    .filter((c) => c.caseId === caseId)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    .map((c) => ({ ...c, author: store.users.find((u) => u.id === c.authorId) ?? null }));
  const verdict = store.verdicts.find((v) => v.caseId === caseId) ?? null;

  // Per-driver verdicts. For legacy cases that only have penalty fields on the
  // Verdict record itself, synthesise DriverVerdict rows on-the-fly so the rest
  // of the UI never has to care about the old format.
  let driverVerdicts: DriverVerdictWithDriver[] = store.driverVerdicts
    .filter((dv) => dv.caseId === caseId)
    .map((dv) => ({ ...dv, driver: store.users.find((u) => u.id === dv.driverId) ?? null }));

  if (driverVerdicts.length === 0 && verdict && (
    verdict.license_points != null || verdict.time_penalty_seconds != null || verdict.warning_text
  )) {
    // Legacy: expand single-verdict into per-involved-driver entries
    const now = new Date().toISOString();
    driverVerdicts = caseItem.involvedDriverIds.map((driverId, i) => ({
      id: `legacy_dv_${i}`,
      caseId,
      driverId,
      license_points: verdict.license_points ?? null,
      time_penalty_seconds: verdict.time_penalty_seconds ?? null,
      warning_text: verdict.warning_text ?? null,
      createdAt: now,
      updatedAt: now,
      driver: store.users.find((u) => u.id === driverId) ?? null,
    }));
  }

  return { caseItem, complainant, involvedDrivers, responses, internalComments, verdict, driverVerdicts };
}

export async function addCaseResponse(input: NewResponseInput) {
  const store = await readStore();
  const caseItem = store.cases.find((c) => c.id === input.caseId);
  if (!caseItem) return;
  const now = new Date().toISOString();
  const responseId = `resp_${randomUUID()}`;
  store.responses.push({
    id: responseId,
    caseId: input.caseId,
    userId: input.userId,
    text: input.text.trim(),
    attachments: attachmentsFromUrls(input.attachmentUrls),
    links: input.links,
    createdAt: now,
    updatedAt: now,
  });
  caseItem.responseIds.push(responseId);

  // Only change status on active cases — never touch Verdict Ready / Closed / Archived
  if (caseItem.status === "Open" || caseItem.status === "Waiting for Response") {
    const allResponded = caseItem.involvedDriverIds.every((driverId) =>
      store.responses.some((r) => r.caseId === input.caseId && r.userId === driverId),
    );
    caseItem.status = allResponded ? "Under Review" : "Waiting for Response";
  }

  caseItem.updatedAt = now;
  await writeStore(store);
}

export async function addInternalComment(input: NewInternalCommentInput) {
  const store = await readStore();
  const caseItem = store.cases.find((c) => c.id === input.caseId);
  if (!caseItem) return;
  const now = new Date().toISOString();
  const commentId = `ic_${randomUUID()}`;
  store.internalComments.push({
    id: commentId,
    caseId: input.caseId,
    authorId: input.authorId,
    text: input.text.trim(),
    stewardOnly: true,
    createdAt: now,
    updatedAt: now,
  });
  caseItem.internalCommentIds.push(commentId);
  caseItem.updatedAt = now;
  await writeStore(store);
}

export async function deleteInternalComment(commentId: string, caseId: string) {
  const store = await readStore();
  const idx = store.internalComments.findIndex((c) => c.id === commentId && c.caseId === caseId);
  if (idx === -1) return;
  store.internalComments.splice(idx, 1);
  const caseItem = store.cases.find((c) => c.id === caseId);
  if (caseItem) {
    caseItem.internalCommentIds = caseItem.internalCommentIds.filter((id) => id !== commentId);
    caseItem.updatedAt = new Date().toISOString();
  }
  await writeStore(store);
}

export async function updateInternalComment(commentId: string, caseId: string, text: string) {
  const store = await readStore();
  const comment = store.internalComments.find((c) => c.id === commentId && c.caseId === caseId);
  if (!comment) return;
  comment.text = text.trim();
  comment.updatedAt = new Date().toISOString();
  await writeStore(store);
}

export async function upsertVerdict(input: UpsertVerdictInput) {
  const store = await readStore();
  const caseItem = store.cases.find((c) => c.id === input.caseId);
  if (!caseItem) return;
  const now = new Date().toISOString();

  // Upsert case-level verdict record (no longer contains per-driver penalties)
  const existing = store.verdicts.find((v) => v.caseId === input.caseId);
  if (existing) {
    existing.verdict_decision = input.verdict_decision;
    existing.verdict_summary = input.verdict_summary.trim();
    existing.verdict_full_text = input.verdict_full_text.trim();
    existing.is_published = input.is_published;
    existing.published_at = input.is_published ? existing.published_at ?? now : null;
    existing.updatedBy = input.updatedBy;
    existing.updatedAt = now;
    caseItem.verdictId = existing.id;
  } else {
    const verdict: Verdict = {
      id: `verdict_${randomUUID()}`,
      caseId: input.caseId,
      verdict_decision: input.verdict_decision,
      verdict_summary: input.verdict_summary.trim(),
      verdict_full_text: input.verdict_full_text.trim(),
      is_published: input.is_published,
      published_at: input.is_published ? now : null,
      updatedBy: input.updatedBy,
      createdAt: now,
      updatedAt: now,
    };
    store.verdicts.push(verdict);
    caseItem.verdictId = verdict.id;
  }

  // Replace all driverVerdict entries for this case
  store.driverVerdicts = store.driverVerdicts.filter((dv) => dv.caseId !== input.caseId);
  for (const entry of input.driverEntries) {
    if (!entry.driverId) continue;
    store.driverVerdicts.push({
      id: `dv_${randomUUID()}`,
      caseId: input.caseId,
      driverId: entry.driverId,
      license_points: entry.license_points,
      time_penalty_seconds: entry.time_penalty_seconds,
      warning_text: entry.warning_text,
      createdAt: now,
      updatedAt: now,
    });
  }

  const ACTIVE_STATUSES: CaseStatus[] = ["Open", "Waiting for Response", "Under Review"];
  if (input.is_published) {
    // Only write Closed once — never re-open a case that is already Archived
    if (caseItem.status !== "Archived") {
      caseItem.status = "Closed";
      caseItem.closedAt = caseItem.closedAt ?? now;
    }
  } else if (ACTIVE_STATUSES.includes(caseItem.status)) {
    // Draft save: promote active cases to Verdict Ready; never touch Closed/Archived/Verdict Ready
    caseItem.status = "Verdict Ready";
  }
  caseItem.updatedAt = now;
  await writeStore(store);
}

export async function publishVerdict(caseId: string, updatedBy: string) {
  const store = await readStore();
  const caseItem = store.cases.find((c) => c.id === caseId);
  const verdict = store.verdicts.find((v) => v.caseId === caseId);
  if (!caseItem || !verdict) return false;
  const now = new Date().toISOString();
  verdict.is_published = true;
  verdict.published_at = verdict.published_at ?? now;
  verdict.updatedBy = updatedBy;
  verdict.updatedAt = now;
  if (caseItem.status !== "Archived") {
    caseItem.status = "Closed";
    caseItem.closedAt = caseItem.closedAt ?? now;
    caseItem.updatedAt = now;
  }
  await writeStore(store);
  return true;
}

export async function updateCaseStatus(caseId: string, status: CaseStatus) {
  if (!STATUSES.includes(status)) return;
  const store = await readStore();
  const caseItem = store.cases.find((c) => c.id === caseId);
  if (!caseItem) return;
  const now = new Date().toISOString();
  caseItem.status = status;
  caseItem.updatedAt = now;
  caseItem.closedAt = status === "Closed" ? now : caseItem.closedAt;
  caseItem.archivedAt = status === "Archived" ? now : caseItem.archivedAt;
  await writeStore(store);
}

export type HistoricalDriverEntry = {
  driverId: string;
  licensePoints: number | null;
  timePenaltySeconds: number | null;
  warningText: string | null;
};

export type HistoricalCaseInput = {
  season: string;
  round: string;
  weekendSession: WeekendSession;
  description: string;
  verdictDecision: VerdictDecision | null;
  verdictSummary: string;
  verdictFullText: string;
  adminUserId: string;
  driverEntries: HistoricalDriverEntry[];
};

export async function addHistoricalCase(input: HistoricalCaseInput) {
  const store = await readStore();
  const now = new Date().toISOString();
  const caseId = `case_${randomUUID()}`;
  const verdictId = `verdict_${randomUUID()}`;

  const involvedDriverIds = input.driverEntries.map((e) => e.driverId);

  // Build a readable title from driver names
  const driverNames = involvedDriverIds
    .map((id) => store.users.find((u) => u.id === id)?.name.split(" ")[0] ?? id)
    .join(", ");
  const title = `${input.season} ${input.round} – ${driverNames} (historical)`;

  const caseItem: StewardCase = {
    id: caseId,
    caseNumber: store.cases.length + 1,
    title,
    historical: true,
    season: input.season.trim(),
    round: input.round.trim(),
    weekendSession: input.weekendSession,
    incidentLapNumber: null,
    qualifyingTime: null,
    complainantId: input.adminUserId,
    involvedDriverIds,
    description: input.description.trim() || "Historical penalty entry.",
    status: "Closed",
    attachments: [],
    links: [],
    responseIds: [],
    internalCommentIds: [],
    verdictId,
    createdAt: now,
    updatedAt: now,
    closedAt: now,
    archivedAt: null,
  };

  const verdict: Verdict = {
    id: verdictId,
    caseId,
    verdict_decision: input.verdictDecision,
    verdict_summary: input.verdictSummary.trim(),
    verdict_full_text: input.verdictFullText.trim(),
    is_published: true,
    published_at: now,
    updatedBy: input.adminUserId,
    createdAt: now,
    updatedAt: now,
  };

  const driverVerdicts: DriverVerdict[] = input.driverEntries.map((e) => ({
    id: `dv_${randomUUID()}`,
    caseId,
    driverId: e.driverId,
    license_points: e.licensePoints,
    time_penalty_seconds: e.timePenaltySeconds,
    warning_text: e.warningText,
    createdAt: now,
    updatedAt: now,
  }));

  store.cases.push(caseItem);
  store.verdicts.push(verdict);
  store.driverVerdicts.push(...driverVerdicts);
  await writeStore(store);
  return caseItem;
}

export async function deleteCaseById(caseId: string) {
  const store = await readStore();
  if (!store.cases.some((c) => c.id === caseId)) return false;
  store.cases = store.cases.filter((c) => c.id !== caseId);
  store.responses = store.responses.filter((r) => r.caseId !== caseId);
  store.internalComments = store.internalComments.filter((c) => c.caseId !== caseId);
  store.verdicts = store.verdicts.filter((v) => v.caseId !== caseId);
  store.driverVerdicts = store.driverVerdicts.filter((dv) => dv.caseId !== caseId);
  await writeStore(store);
  return true;
}

export type DriverPenaltyRow = {
  driverId: string;
  driverName: string;
  season: string;
  totalLicensePoints: number;
  totalTimePenaltySeconds: number;
  totalWarningsCount: number;
  totalCases: number;
};

export async function aggregateDriverPenalties(): Promise<DriverPenaltyRow[]> {
  const store = await readStore();
  const rows = new Map<string, DriverPenaltyRow>();

  // Build a set of published case IDs
  const publishedCaseIds = new Set(
    store.verdicts.filter((v) => v.is_published).map((v) => v.caseId),
  );

  // Build a map: caseId → published appeal verdict (changed_decision only)
  // When an appeal overrides a case, we use appeal driver verdicts instead.
  const appealOverrideByCaseId = new Map<string, string>(); // caseId → appealId
  for (const av of (store.appealVerdicts ?? [])) {
    if (!av.is_published || av.outcomeType !== "changed_decision") continue;
    const appeal = (store.appeals ?? []).find((a) => a.id === av.appealId);
    if (appeal) appealOverrideByCaseId.set(appeal.originalCaseId, appeal.id);
  }

  // Aggregate from per-driver verdict entries (use appeal override if present)
  for (const dv of store.driverVerdicts) {
    if (!publishedCaseIds.has(dv.caseId)) continue;
    // Skip cases where appeal has changed the decision — handled below
    if (appealOverrideByCaseId.has(dv.caseId)) continue;
    const caseItem = store.cases.find((c) => c.id === dv.caseId);
    if (!caseItem) continue;
    const driver = store.users.find((u) => u.id === dv.driverId);
    const key = `${dv.driverId}:${caseItem.season}`;
    const row = rows.get(key) ?? {
      driverId: dv.driverId,
      driverName: driver?.name ?? dv.driverId,
      season: caseItem.season,
      totalLicensePoints: 0,
      totalTimePenaltySeconds: 0,
      totalWarningsCount: 0,
      totalCases: 0,
    };
    if (dv.license_points != null) row.totalLicensePoints += dv.license_points;
    if (dv.time_penalty_seconds != null) row.totalTimePenaltySeconds += dv.time_penalty_seconds;
    if (dv.warning_text?.trim()) row.totalWarningsCount += 1;
    row.totalCases += 1;
    rows.set(key, row);
  }

  // Use appeal driver verdicts for overridden cases
  for (const [caseId, appealId] of appealOverrideByCaseId) {
    const caseItem = store.cases.find((c) => c.id === caseId);
    if (!caseItem) continue;
    const appealDvs = (store.appealDriverVerdicts ?? []).filter((adv) => adv.appealId === appealId);
    for (const adv of appealDvs) {
      const driver = store.users.find((u) => u.id === adv.driverId);
      const key = `${adv.driverId}:${caseItem.season}`;
      const row = rows.get(key) ?? {
        driverId: adv.driverId,
        driverName: driver?.name ?? adv.driverId,
        season: caseItem.season,
        totalLicensePoints: 0,
        totalTimePenaltySeconds: 0,
        totalWarningsCount: 0,
        totalCases: 0,
      };
      if (adv.license_points != null) row.totalLicensePoints += adv.license_points;
      if (adv.time_penalty_seconds != null) row.totalTimePenaltySeconds += adv.time_penalty_seconds;
      if (adv.warning_text?.trim()) row.totalWarningsCount += 1;
      row.totalCases += 1;
      rows.set(key, row);
    }
  }

  // Fallback: handle legacy verdicts that still carry per-case penalty fields
  for (const verdict of store.verdicts) {
    if (!verdict.is_published) continue;
    if (verdict.license_points == null && verdict.time_penalty_seconds == null && !verdict.warning_text) continue;
    if (appealOverrideByCaseId.has(verdict.caseId)) continue;
    const caseItem = store.cases.find((c) => c.id === verdict.caseId);
    if (!caseItem) continue;
    const alreadyMigrated = store.driverVerdicts.some((dv) => dv.caseId === verdict.caseId);
    if (alreadyMigrated) continue;
    for (const driverId of caseItem.involvedDriverIds) {
      const driver = store.users.find((u) => u.id === driverId);
      const key = `${driverId}:${caseItem.season}`;
      const row = rows.get(key) ?? {
        driverId,
        driverName: driver?.name ?? driverId,
        season: caseItem.season,
        totalLicensePoints: 0,
        totalTimePenaltySeconds: 0,
        totalWarningsCount: 0,
        totalCases: 0,
      };
      if (verdict.license_points != null) row.totalLicensePoints += verdict.license_points;
      if (verdict.time_penalty_seconds != null) row.totalTimePenaltySeconds += verdict.time_penalty_seconds;
      if (verdict.warning_text?.trim()) row.totalWarningsCount += 1;
      row.totalCases += 1;
      rows.set(key, row);
    }
  }

  return [...rows.values()];
}

/* ------------------------------------------------------------------ */
/*  Main League Race schedule helpers                                   */
/* ------------------------------------------------------------------ */

type RaceSlot = { id: string; label: string; startTime: string };

/** Returns all future Main League races ordered chronologically. */
async function getFutureMainLeagueRaces(): Promise<RaceSlot[]> {
  try {
    const csv = await fetchCsv(GLOBAL_CSV_URLS.schedule);
    const events = mapRaceEvents(parseCsv<Record<string, string>>(csv));
    const now = Date.now();
    return events
      .filter((e) => {
        if ((e.league ?? "").toLowerCase() !== "main") return false;
        const ts = toIsraelTimestamp(e.date, e.start_time ?? undefined);
        return ts !== null && ts > now;
      })
      .sort((a, b) => {
        const ta = toIsraelTimestamp(a.date, a.start_time ?? undefined) ?? 0;
        const tb = toIsraelTimestamp(b.date, b.start_time ?? undefined) ?? 0;
        return ta - tb;
      })
      .map((e) => {
        const raceNo = (e.race_number ?? "").trim().padStart(2, "0");
        const label = `${e.season} R${raceNo}${e.race_name ? ` – ${e.race_name}` : ""} (Main)`;
        const ts = toIsraelTimestamp(e.date, e.start_time ?? undefined)!;
        return { id: e.event_id, label, startTime: new Date(ts).toISOString() };
      });
  } catch {
    return [];
  }
}

/** Convenience: just the first upcoming Main League race. */
export async function getNextMainLeagueRace(): Promise<RaceSlot | null> {
  const races = await getFutureMainLeagueRaces();
  return races[0] ?? null;
}

/**
 * Returns the latest assignedRaceStartTime (ms) among a driver's
 * active (non-terminal) penalties-to-serve. Returns 0 if none.
 */
function driverLatestQueuedRaceMs(store: StewardStore, driverId: string): number {
  const ACTIVE_STATUSES: PenaltyToServeStatus[] = ["pending", "assigned", "awaiting_confirmation"];
  let latest = 0;
  for (const p of store.penaltiesToServe) {
    if (p.driverId !== driverId) continue;
    if (!ACTIVE_STATUSES.includes(p.status)) continue;
    if (!p.assignedRaceStartTime) continue;
    const ms = new Date(p.assignedRaceStartTime).getTime();
    if (ms > latest) latest = ms;
  }
  return latest;
}

/* ------------------------------------------------------------------ */
/*  Penalties to Serve — auto-generation                               */
/* ------------------------------------------------------------------ */

/** Historical / admin backfill cases must not count toward threshold penalties-to-serve. */
function isCaseHistoricalForThresholds(store: StewardStore, caseId: string): boolean {
  const c = store.cases.find((x) => x.id === caseId);
  if (!c) return false;
  if (c.historical === true) return true;
  return typeof c.title === "string" && c.title.includes("(historical)");
}

/**
 * True if this driver already has a non-cancelled threshold penalty for the same rule slot.
 * Legacy rows may have sourceRuleId null (store backfill) — match by threshold points + index.
 */
function thresholdPenaltySlotExists(
  store: StewardStore,
  driverId: string,
  rule: { id: string; thresholdLicensePoints: number },
  instanceIndex: number,
): boolean {
  return store.penaltiesToServe.some((p) => {
    if (p.driverId !== driverId || p.sourceType !== "threshold" || p.status === "cancelled") return false;
    if (p.sourceRuleIndex !== instanceIndex) return false;
    if (p.sourceRuleId != null) return p.sourceRuleId === rule.id;
    return p.sourceThresholdPoints === rule.thresholdLicensePoints;
  });
}

/**
 * Compute total license points per driver from ALL published verdicts,
 * respecting appeal overrides: when an appeal has a published "changed_decision"
 * outcome, that case's original driver verdicts are excluded and the appeal
 * driver verdicts are used instead — matching aggregateDriverPenalties() logic.
 *
 * Excludes historical admin backfill cases (they still appear on the Penalties page
 * via aggregateDriverPenalties but must not trigger automatic penalties to serve).
 * Returns a map of driverId → total license points.
 */
function computeEffectiveDriverPoints(store: StewardStore): Map<string, number> {
  const totals = new Map<string, number>();
  const publishedCaseIds = new Set(
    store.verdicts.filter((v) => v.is_published).map((v) => v.caseId),
  );

  // Build appeal override map: caseId → appealId (published changed_decision only)
  const appealOverrideByCaseId = new Map<string, string>();
  for (const av of (store.appealVerdicts ?? [])) {
    if (!av.is_published || av.outcomeType !== "changed_decision") continue;
    const appeal = (store.appeals ?? []).find((a) => a.id === av.appealId);
    if (appeal) appealOverrideByCaseId.set(appeal.originalCaseId, appeal.id);
  }

  // Count original driverVerdicts, skipping appeal-overridden and historical cases
  for (const dv of store.driverVerdicts) {
    if (!publishedCaseIds.has(dv.caseId)) continue;
    if (appealOverrideByCaseId.has(dv.caseId)) continue;
    if (isCaseHistoricalForThresholds(store, dv.caseId)) continue;
    if (dv.license_points == null || dv.license_points === 0) continue;
    totals.set(dv.driverId, (totals.get(dv.driverId) ?? 0) + dv.license_points);
  }

  // Add appeal driver verdicts for overridden cases (skip if original case was historical)
  for (const [caseId, appealId] of appealOverrideByCaseId) {
    if (isCaseHistoricalForThresholds(store, caseId)) continue;
    const appealDvs = (store.appealDriverVerdicts ?? []).filter((adv) => adv.appealId === appealId);
    for (const adv of appealDvs) {
      if (adv.license_points == null || adv.license_points === 0) continue;
      totals.set(adv.driverId, (totals.get(adv.driverId) ?? 0) + adv.license_points);
    }
  }

  return totals;
}

/**
 * Severity sort for generated penalties:
 * Race bans are served FIRST (they are more impactful), then qualifying bans,
 * then others — all ties broken by threshold points ascending.
 */
function penaltySortKey(penaltyType: string, thresholdPts: number): number {
  const typeOrder = penaltyType === "race_ban" ? 0 : penaltyType === "qualifying_ban" ? 1 : 2;
  return typeOrder * 1000 + thresholdPts;
}

/**
 * After a verdict is saved/published, check whether any driver has crossed
 * one or more thresholds and generate PenaltyToServe records as needed.
 *
 * Multi-threshold + quantity logic:
 *   - All newly-triggered rules are collected per driver in one pass.
 *   - Deduplication is by (driverId, ruleId, instanceIndex) so two rules at
 *     the same threshold level coexist, and rules with quantity > 1 create
 *     that many individual records.
 *   - All generated records are sorted: race bans first, then qualifying bans,
 *     then others — ties broken by threshold points asc.
 *   - Each record is assigned to a SUCCESSIVE future Main League race,
 *     starting AFTER any races already occupied by that driver's active penalties.
 */
export async function checkAndGeneratePenalties(triggeringCaseId: string): Promise<void> {
  const rules = await fetchThresholdRules();
  if (!rules.length) return;

  const store = await readStore();
  const driverPoints = computeEffectiveDriverPoints(store);
  if (!driverPoints.size) return;

  const futureRaces = await getFutureMainLeagueRaces();
  const now = new Date().toISOString();
  let changed = false;

  for (const [driverId, total] of driverPoints) {
    // Collect (rule, instanceIndex) pairs that haven't been generated yet.
    // Dedup key: (driverId, ruleId, instanceIndex)
    type PendingEntry = { rule: typeof rules[0]; index: number };
    const pending: PendingEntry[] = [];

    for (const rule of rules) {
      if (total < rule.thresholdLicensePoints) continue;
      for (let i = 1; i <= rule.quantity; i++) {
        if (!thresholdPenaltySlotExists(store, driverId, rule, i)) pending.push({ rule, index: i });
      }
    }
    if (!pending.length) continue;

    // Sort: race bans first, then qualifying bans, then by threshold pts asc
    pending.sort((a, b) =>
      penaltySortKey(a.rule.penaltyType, a.rule.thresholdLicensePoints) -
      penaltySortKey(b.rule.penaltyType, b.rule.thresholdLicensePoints),
    );

    // Start assigning after the driver's latest already-queued race
    let assignAfterMs = driverLatestQueuedRaceMs(store, driverId);
    const driver = store.users.find((u) => u.id === driverId);

    for (const { rule, index } of pending) {
      const slot = futureRaces.find(
        (r) => new Date(r.startTime).getTime() > assignAfterMs,
      ) ?? null;

      const penalty: PenaltyToServe = {
        id: `pts_${randomUUID()}`,
        driverId,
        sourceType: "threshold",
        sourceThresholdPoints: rule.thresholdLicensePoints,
        sourceRuleId: rule.id,
        sourceRuleIndex: index,
        sourceCaseIds: [triggeringCaseId],
        penaltyType: rule.penaltyType,
        penaltyLabel: rule.penaltyLabel,
        penaltyDescription: rule.penaltyDescription,
        assignedRaceId: slot?.id ?? null,
        assignedRaceLabel: slot?.label ?? null,
        assignedRaceStartTime: slot?.startTime ?? null,
        status: slot ? "assigned" : "pending",
        servedAt: null,
        adminNotes: null,
        createdBy: "system",
        createdAt: now,
        updatedAt: now,
        rolledFromPenaltyId: null,
        cycleNumber: 1,
        reminderSentAt: null,
      };
      store.penaltiesToServe.push(penalty);
      changed = true;

      if (slot) assignAfterMs = new Date(slot.startTime).getTime();

      if (driver) {
        import("@/lib/stewards/notifications")
          .then(({ notifyPenaltyAssigned }) => notifyPenaltyAssigned(penalty, driver))
          .catch(() => {});
      }
    }
  }

  if (changed) await writeStore(store);
}

/* ------------------------------------------------------------------ */
/*  Penalties to Serve — CRUD                                           */
/* ------------------------------------------------------------------ */

const HOURS_48_MS = 48 * 60 * 60 * 1000;

export async function listPenaltiesToServe(): Promise<PenaltyToServe[]> {
  const store = await readStore();
  const now = Date.now();
  const GRACE_MS = 2 * 60 * 60 * 1000; // 2 hours after race start
  let changed = false;

  for (const p of store.penaltiesToServe) {
    if (p.status !== "assigned" || !p.assignedRaceStartTime) continue;
    const raceTs = new Date(p.assignedRaceStartTime).getTime();

    // Promote to awaiting_confirmation once the race has passed
    if (now >= raceTs + GRACE_MS) {
      p.status = "awaiting_confirmation";
      p.updatedAt = new Date().toISOString();
      changed = true;
      continue;
    }

    // Send 48-hour reminder (fire-and-forget, same pattern as notifyPenaltyAssigned)
    if (!p.reminderSentAt && now >= raceTs - HOURS_48_MS) {
      p.reminderSentAt = new Date().toISOString();
      p.updatedAt = p.reminderSentAt;
      changed = true;
      const driver = store.users.find((u) => u.id === p.driverId);
      if (driver) {
        import("@/lib/stewards/notifications")
          .then(({ notifyPenaltyReminder }) => notifyPenaltyReminder(p, driver))
          .catch(() => {});
      }
    }
  }

  if (changed) await writeStore(store);
  return [...store.penaltiesToServe].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export type ManualPenaltyInput = {
  driverId: string;
  penaltyType: string;
  penaltyLabel: string;
  penaltyDescription: string;
  adminNotes: string | null;
  createdBy: string;
  /** How many consecutive penalties to create (each on a successive race). Default 1. */
  quantity?: number;
};

/**
 * Manually add one or more consecutive penalties-to-serve for a driver.
 * Each record is assigned to a successive future Main League race,
 * chained AFTER any races already occupied by the driver's active penalties.
 * Returns all created records.
 */
export async function addManualPenalty(input: ManualPenaltyInput): Promise<PenaltyToServe[]> {
  const store = await readStore();
  const futureRaces = await getFutureMainLeagueRaces();
  const now = new Date().toISOString();
  const qty = Math.max(1, Math.min(input.quantity ?? 1, 10)); // cap at 10

  let assignAfterMs = driverLatestQueuedRaceMs(store, input.driverId);
  const created: PenaltyToServe[] = [];

  for (let i = 1; i <= qty; i++) {
    const slot = futureRaces.find(
      (r) => new Date(r.startTime).getTime() > assignAfterMs,
    ) ?? null;

    const penalty: PenaltyToServe = {
      id: `pts_${randomUUID()}`,
      driverId: input.driverId,
      sourceType: "manual",
      sourceThresholdPoints: null,
      sourceRuleId: null,
      sourceRuleIndex: i,
      sourceCaseIds: [],
      penaltyType: input.penaltyType,
      penaltyLabel: qty > 1 ? `${input.penaltyLabel} (${i}/${qty})` : input.penaltyLabel,
      penaltyDescription: input.penaltyDescription,
      assignedRaceId: slot?.id ?? null,
      assignedRaceLabel: slot?.label ?? null,
      assignedRaceStartTime: slot?.startTime ?? null,
      status: slot ? "assigned" : "pending",
      servedAt: null,
      adminNotes: input.adminNotes,
      createdBy: input.createdBy,
      createdAt: now,
      updatedAt: now,
      rolledFromPenaltyId: null,
      cycleNumber: 1,
      reminderSentAt: null,
    };
    store.penaltiesToServe.push(penalty);
    created.push(penalty);

    if (slot) assignAfterMs = new Date(slot.startTime).getTime();
  }

  await writeStore(store);
  return created;
}

export type UpdatePenaltyStatusInput = {
  penaltyId: string;
  status: PenaltyToServeStatus;
  adminNotes?: string;
};

export async function updatePenaltyStatus(input: UpdatePenaltyStatusInput): Promise<PenaltyToServe | null> {
  const store = await readStore();
  const penalty = store.penaltiesToServe.find((p) => p.id === input.penaltyId);
  if (!penalty) return null;
  const now = new Date().toISOString();
  penalty.status = input.status;
  if (input.adminNotes !== undefined) penalty.adminNotes = input.adminNotes;
  if (input.status === "served") penalty.servedAt = now;
  penalty.updatedAt = now;
  await writeStore(store);
  return penalty;
}

/**
 * Mark a penalty as "rolled_forward" and create a new record assigned to the
 * first future Main League race that comes AFTER all of the driver's other
 * already-queued active penalties.
 *
 * Example: driver has QB #2 on Race N+1.  QB #1 was not served at Race N.
 * → QB #1 is rolled to Race N+2 (after QB #2), not to Race N+1.
 */
export async function rollForwardPenalty(
  penaltyId: string,
  adminNotes: string,
): Promise<PenaltyToServe | null> {
  const store = await readStore();
  const original = store.penaltiesToServe.find((p) => p.id === penaltyId);
  if (!original) return null;

  const futureRaces = await getFutureMainLeagueRaces();
  const now = new Date().toISOString();

  // Mark original as rolled_forward FIRST so driverLatestQueuedRaceMs
  // correctly excludes it and only counts the remaining active penalties.
  original.status = "rolled_forward";
  original.adminNotes = adminNotes || original.adminNotes;
  original.updatedAt = now;

  // Chain after the driver's remaining active penalties (e.g. other queued bans)
  const assignAfterMs = driverLatestQueuedRaceMs(store, original.driverId);
  const slot = futureRaces.find(
    (r) => new Date(r.startTime).getTime() > assignAfterMs,
  ) ?? null;

  const newPenalty: PenaltyToServe = {
    id: `pts_${randomUUID()}`,
    driverId: original.driverId,
    sourceType: original.sourceType,
    sourceThresholdPoints: original.sourceThresholdPoints,
    sourceRuleId: original.sourceRuleId,
    sourceRuleIndex: original.sourceRuleIndex,
    sourceCaseIds: original.sourceCaseIds,
    penaltyType: original.penaltyType,
    penaltyLabel: original.penaltyLabel,
    penaltyDescription: original.penaltyDescription,
    assignedRaceId: slot?.id ?? null,
    assignedRaceLabel: slot?.label ?? null,
    assignedRaceStartTime: slot?.startTime ?? null,
    status: slot ? "assigned" : "pending",
    servedAt: null,
    adminNotes: null,
    createdBy: "system",
    createdAt: now,
    updatedAt: now,
    rolledFromPenaltyId: original.id,
    cycleNumber: original.cycleNumber + 1,
    reminderSentAt: null,
  };

  store.penaltiesToServe.push(newPenalty);
  await writeStore(store);
  return newPenalty;
}

export async function deletePenaltyToServe(penaltyId: string): Promise<boolean> {
  const store = await readStore();
  const before = store.penaltiesToServe.length;
  store.penaltiesToServe = store.penaltiesToServe.filter((p) => p.id !== penaltyId);
  if (store.penaltiesToServe.length === before) return false;
  await writeStore(store);
  return true;
}

export type UpdatePenaltyFieldsInput = {
  penaltyLabel: string;
  penaltyType: string;
  penaltyDescription: string;
  adminNotes: string | null;
};

export async function updatePenaltyFields(
  penaltyId: string,
  fields: UpdatePenaltyFieldsInput,
): Promise<PenaltyToServe | null> {
  const store = await readStore();
  const penalty = store.penaltiesToServe.find((p) => p.id === penaltyId);
  if (!penalty) return null;
  penalty.penaltyLabel       = fields.penaltyLabel;
  penalty.penaltyType        = fields.penaltyType;
  penalty.penaltyDescription = fields.penaltyDescription;
  penalty.adminNotes         = fields.adminNotes;
  penalty.updatedAt          = new Date().toISOString();
  await writeStore(store);
  return penalty;
}

export type UpdateHistoricalCaseInput = {
  season: string;
  round: string;
  weekendSession: WeekendSession;
  description: string;
  verdictDecision: VerdictDecision | null;
  verdictFullText: string;
  verdictSummary: string;
  driverEntries: HistoricalDriverEntry[];
};

export async function updateHistoricalCase(
  caseId: string,
  input: UpdateHistoricalCaseInput,
): Promise<StewardCase | null> {
  const store = await readStore();
  const caseItem = store.cases.find((c) => c.id === caseId);
  const verdict  = store.verdicts.find((v) => v.caseId === caseId);
  if (!caseItem || !verdict) return null;

  const now = new Date().toISOString();
  const involvedDriverIds = input.driverEntries.map((e) => e.driverId);

  // Rebuild readable title
  const driverNames = involvedDriverIds
    .map((id) => store.users.find((u) => u.id === id)?.name.split(" ")[0] ?? id)
    .join(", ");
  caseItem.title           = `${input.season} ${input.round} – ${driverNames} (historical)`;
  caseItem.historical      = true;
  caseItem.season          = input.season.trim();
  caseItem.round           = input.round.trim();
  caseItem.weekendSession  = input.weekendSession;
  caseItem.description     = input.description.trim() || "Historical penalty entry.";
  caseItem.involvedDriverIds = involvedDriverIds;
  caseItem.updatedAt       = now;

  verdict.verdict_decision  = input.verdictDecision;
  verdict.verdict_summary   = input.verdictSummary.trim();
  verdict.verdict_full_text = input.verdictFullText.trim();
  verdict.updatedAt         = now;

  // Replace driverVerdicts for this case
  store.driverVerdicts = store.driverVerdicts.filter((dv) => dv.caseId !== caseId);
  store.driverVerdicts.push(
    ...input.driverEntries.map((e) => ({
      id: `dv_${randomUUID()}`,
      caseId,
      driverId: e.driverId,
      license_points: e.licensePoints,
      time_penalty_seconds: e.timePenaltySeconds,
      warning_text: e.warningText,
      createdAt: now,
      updatedAt: now,
    })),
  );

  await writeStore(store);
  return caseItem;
}

/** Returns all historical cases (flag or title marker), newest first. */
export async function listHistoricalCases() {
  const store = await readStore();
  return store.cases
    .filter((c) => c.historical === true || c.title.includes("(historical)"))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map((c) => {
      const verdict = store.verdicts.find((v) => v.caseId === c.id) ?? null;
      const driverVerdicts = store.driverVerdicts.filter((dv) => dv.caseId === c.id);
      return { caseItem: c, verdict, driverVerdicts };
    });
}

export async function getPendingIndicatorsForUser(user: StewardUser): Promise<PendingIndicator[]> {
  const store = await readStore();
  const indicators: PendingIndicator[] = [];
  const activeCases = store.cases.filter((c) => c.status !== "Closed" && c.status !== "Archived");
  const respondedCaseIds = new Set(
    store.responses.filter((r) => r.userId === user.id).map((r) => r.caseId),
  );
  if (user.roles.includes("member")) {
    const pendingResponse = activeCases.filter(
      (c) => c.involvedDriverIds.includes(user.id) && !respondedCaseIds.has(c.id),
    ).length;
    if (pendingResponse > 0) {
      indicators.push({
        id: "driver-response",
        label: "Cases waiting for your response",
        count: pendingResponse,
        href: "/stewards/cases?view=driver",
      });
    }
  }
  if (user.roles.includes("steward") || user.roles.includes("admin")) {
    const pendingReview = activeCases.filter((c) =>
      !store.verdicts.some((v) => v.caseId === c.id && v.is_published),
    ).length;
    if (pendingReview > 0) {
      indicators.push({
        id: "steward-review",
        label: "Cases requiring steward review",
        count: pendingReview,
        href: "/stewards/cases?view=steward",
      });
    }
  }
  if (user.roles.includes("admin")) {
    const awaitingConfirmation = store.penaltiesToServe.filter(
      (p) => p.status === "awaiting_confirmation",
    ).length;
    if (awaitingConfirmation > 0) {
      indicators.push({
        id: "penalty-confirmation",
        label: "Penalties awaiting service confirmation",
        count: awaitingConfirmation,
        href: "/stewards/penalties-to-serve",
      });
    }
  }
  // Appeals needing steward review
  if (user.roles.includes("steward") || user.roles.includes("admin")) {
    const pendingAppeals = (store.appeals ?? []).filter(
      (a) => a.status === "Submitted" || a.status === "Under Review",
    ).length;
    if (pendingAppeals > 0) {
      indicators.push({
        id: "appeals-review",
        label: "Appeals requiring steward review",
        count: pendingAppeals,
        href: "/stewards/appeals",
      });
    }
  }
  return indicators;
}

/* ------------------------------------------------------------------ */
/*  Appeal helpers                                                      */
/* ------------------------------------------------------------------ */

export const APPEAL_WINDOW_HOURS = 36;

export function appealWindowDeadline(closedAt: string): string {
  return new Date(new Date(closedAt).getTime() + APPEAL_WINDOW_HOURS * 60 * 60 * 1000).toISOString();
}

/**
 * Returns true if the 36-hour appeal window is still open.
 * Falls back to verdictPublishedAt if closedAt is null (handles legacy cases
 * that were closed before closedAt was reliably tracked).
 */
export function isAppealWindowOpen(
  closedAt: string | null,
  verdictPublishedAt?: string | null,
): boolean {
  const anchor = closedAt ?? verdictPublishedAt ?? null;
  if (!anchor) return false;
  return Date.now() < new Date(appealWindowDeadline(anchor)).getTime();
}

/* ── Appeal with relations ─────────────────────────────────── */

export type AppealWithRelations = {
  appeal: Appeal;
  originalCase: StewardCase | null;
  submittedBy: StewardUser | null;
  internalComments: (AppealInternalComment & { author: StewardUser | null })[];
  verdict: AppealVerdict | null;
  driverVerdicts: (AppealDriverVerdict & { driver: StewardUser | null })[];
};

export async function getAppealById(id: string): Promise<AppealWithRelations | null> {
  const store = await readStore();
  const appeal = (store.appeals ?? []).find((a) => a.id === id);
  if (!appeal) return null;
  const originalCase = store.cases.find((c) => c.id === appeal.originalCaseId) ?? null;
  const submittedBy = store.users.find((u) => u.id === appeal.submittedByUserId) ?? null;
  const comments = (store.appealInternalComments ?? [])
    .filter((c) => c.appealId === id)
    .map((c) => ({ ...c, author: store.users.find((u) => u.id === c.authorId) ?? null }));
  const verdict = appeal.verdictId
    ? ((store.appealVerdicts ?? []).find((v) => v.id === appeal.verdictId) ?? null)
    : null;
  const dvs = (store.appealDriverVerdicts ?? [])
    .filter((dv) => dv.appealId === id)
    .map((dv) => ({ ...dv, driver: store.users.find((u) => u.id === dv.driverId) ?? null }));
  return { appeal, originalCase, submittedBy, internalComments: comments, verdict, driverVerdicts: dvs };
}

/** All appeals filed against this case, newest first. */
export async function listAppealsForOriginalCase(caseId: string): Promise<Appeal[]> {
  const store = await readStore();
  return (store.appeals ?? [])
    .filter((a) => a.originalCaseId === caseId)
    .sort((a, b) => b.submittedAt.localeCompare(a.submittedAt));
}

/** This user's appeal for this case (any status), or null if they have not filed one. */
export async function getAppealByCaseAndUser(caseId: string, userId: string): Promise<Appeal | null> {
  const list = await listAppealsForOriginalCase(caseId);
  return list.find((a) => a.submittedByUserId === userId) ?? null;
}

/**
 * @deprecated Prefer getAppealByCaseAndUser or listAppealsForOriginalCase.
 * Most recent appeal on this case (any submitter), or null.
 */
export async function getAppealByOriginalCaseId(caseId: string): Promise<Appeal | null> {
  const list = await listAppealsForOriginalCase(caseId);
  return list[0] ?? null;
}

export async function listAppeals(): Promise<AppealWithRelations[]> {
  const store = await readStore();
  return Promise.all((store.appeals ?? []).map(async (a) => {
    const data = await getAppealById(a.id);
    return data!;
  }));
}

export async function createAppeal(input: {
  originalCaseId: string;
  submittedByUserId: string;
  description: string;
  attachments: AttachmentRef[];
  links: string[];
  closedAt: string;
}): Promise<{ appeal: Appeal; created: boolean }> {
  const store = await readStore();
  const dup = (store.appeals ?? []).find(
    (a) => a.originalCaseId === input.originalCaseId && a.submittedByUserId === input.submittedByUserId,
  );
  if (dup) return { appeal: dup, created: false };

  const now = new Date().toISOString();
  const appeal: Appeal = {
    id: `appeal_${randomUUID()}`,
    originalCaseId: input.originalCaseId,
    submittedByUserId: input.submittedByUserId,
    submittedAt: now,
    description: input.description.trim(),
    attachments: input.attachments,
    links: input.links,
    status: "Submitted",
    appealWindowDeadline: appealWindowDeadline(input.closedAt),
    verdictId: null,
    internalCommentIds: [],
    createdAt: now,
    updatedAt: now,
  };
  (store.appeals ?? (store.appeals = [])).push(appeal);
  await writeStore(store);
  return { appeal, created: true };
}

export async function addAppealInternalComment(appealId: string, authorId: string, text: string) {
  const store = await readStore();
  const appeal = (store.appeals ?? []).find((a) => a.id === appealId);
  if (!appeal) return;
  const now = new Date().toISOString();
  const id = `aic_${randomUUID()}`;
  const comment: AppealInternalComment = {
    id, appealId, authorId, text: text.trim(), stewardOnly: true, createdAt: now, updatedAt: now,
  };
  (store.appealInternalComments ?? (store.appealInternalComments = [])).push(comment);
  appeal.internalCommentIds.push(id);
  // Promote to Under Review if still Submitted
  if (appeal.status === "Submitted") { appeal.status = "Under Review"; }
  appeal.updatedAt = now;
  await writeStore(store);
}

export type UpsertAppealVerdictInput = {
  appealId: string;
  outcomeType: AppealOutcome | null;
  verdict_summary: string;
  verdict_full_text: string;
  is_published: boolean;
  updatedBy: string;
  driverEntries: { driverId: string; license_points: number | null; time_penalty_seconds: number | null; warning_text: string | null }[];
};

export async function upsertAppealVerdict(input: UpsertAppealVerdictInput) {
  const store = await readStore();
  const appeal = (store.appeals ?? []).find((a) => a.id === input.appealId);
  if (!appeal) return;
  const now = new Date().toISOString();

  const existing = (store.appealVerdicts ?? []).find((v) => v.id === appeal.verdictId);
  if (existing) {
    existing.outcomeType = input.outcomeType;
    existing.verdict_summary = input.verdict_summary.trim();
    existing.verdict_full_text = input.verdict_full_text.trim();
    existing.is_published = input.is_published;
    existing.published_at = input.is_published ? existing.published_at ?? now : null;
    existing.updatedBy = input.updatedBy;
    existing.updatedAt = now;
  } else {
    const verdict: AppealVerdict = {
      id: `av_${randomUUID()}`,
      appealId: input.appealId,
      outcomeType: input.outcomeType,
      verdict_summary: input.verdict_summary.trim(),
      verdict_full_text: input.verdict_full_text.trim(),
      is_published: input.is_published,
      published_at: input.is_published ? now : null,
      updatedBy: input.updatedBy,
      createdAt: now,
      updatedAt: now,
    };
    (store.appealVerdicts ?? (store.appealVerdicts = [])).push(verdict);
    appeal.verdictId = verdict.id;
  }

  // Replace driver verdict overrides (only meaningful for changed_decision)
  store.appealDriverVerdicts = (store.appealDriverVerdicts ?? []).filter(
    (dv) => dv.appealId !== input.appealId,
  );
  if (input.outcomeType === "changed_decision") {
    for (const entry of input.driverEntries) {
      if (!entry.driverId) continue;
      (store.appealDriverVerdicts ?? (store.appealDriverVerdicts = [])).push({
        id: `adv_${randomUUID()}`,
        appealId: input.appealId,
        driverId: entry.driverId,
        license_points: entry.license_points,
        time_penalty_seconds: entry.time_penalty_seconds,
        warning_text: entry.warning_text,
        createdAt: now,
        updatedAt: now,
      });
    }
  }

  // Update appeal status
  if (input.is_published) {
    appeal.status = "Closed";
  } else {
    appeal.status = "Verdict Ready";
  }
  appeal.updatedAt = now;
  await writeStore(store);
}

export async function publishAppealVerdict(appealId: string, updatedBy: string): Promise<boolean> {
  const store = await readStore();
  const appeal = (store.appeals ?? []).find((a) => a.id === appealId);
  const verdict = (store.appealVerdicts ?? []).find((v) => v.id === appeal?.verdictId);
  if (!appeal || !verdict) return false;
  const now = new Date().toISOString();
  verdict.is_published = true;
  verdict.published_at = verdict.published_at ?? now;
  verdict.updatedBy = updatedBy;
  verdict.updatedAt = now;
  appeal.status = "Closed";
  appeal.updatedAt = now;
  await writeStore(store);
  return true;
}

export async function updateAppealStatus(appealId: string, status: AppealStatus) {
  const store = await readStore();
  const appeal = (store.appeals ?? []).find((a) => a.id === appealId);
  if (!appeal) return;
  appeal.status = status;
  appeal.updatedAt = new Date().toISOString();
  await writeStore(store);
}

export async function deleteAppeal(appealId: string) {
  const store = await readStore();
  store.appeals = (store.appeals ?? []).filter((a) => a.id !== appealId);
  store.appealVerdicts = (store.appealVerdicts ?? []).filter((v) => v.appealId !== appealId);
  store.appealDriverVerdicts = (store.appealDriverVerdicts ?? []).filter((dv) => dv.appealId !== appealId);
  store.appealInternalComments = (store.appealInternalComments ?? []).filter((c) => c.appealId !== appealId);
  await writeStore(store);
}
