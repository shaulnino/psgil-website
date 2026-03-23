"use server";

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  canCommentInternally,
  canCreateComplaint,
  clearStewardSessionCookie,
  createStewardSession,
  requireRole,
  requireStewardUser,
  requireStewardUserForPasswordChange,
  setStewardSessionCookie,
} from "@/lib/stewards/auth";
import { hashPassword, verifyPassword } from "@/lib/stewards/crypto";
import {
  addAppealInternalComment,
  addCaseResponse,
  addInternalComment,
  addHistoricalCase,
  addManualPenalty,
  checkAndGeneratePenalties,
  createAppeal,
  createCase,
  createUser,
  deleteAppeal,
  deleteCaseById,
  deletePenaltyToServe,
  getCaseById,
  getAppealByOriginalCaseId,
  getAppealById,
  getUserByEmail,
  isAppealWindowOpen,
  listUsers,
  publishAppealVerdict,
  publishVerdict,
  removeUserById,
  rollForwardPenalty,
  updateAppealStatus,
  updateCaseStatus,
  updateHistoricalCase,
  updatePenaltyFields,
  updatePenaltyStatus,
  updateUser,
  updateUserRoles,
  upsertAppealVerdict,
  upsertVerdict,
} from "@/lib/stewards/repository";
import type { HistoricalDriverEntry, UpdateHistoricalCaseInput, UpsertAppealVerdictInput } from "@/lib/stewards/repository";
import {
  notifyAppealSubmitted,
  notifyAppealVerdictPublished,
  notifyAllResponsesSubmitted,
  notifyCaseSubmitted,
  notifyInternalDiscussion,
  notifyResponseConfirmation,
  notifyVerdictPublished,
} from "@/lib/stewards/notifications";
import type { CaseStatus, StewardRole, VerdictDecision, WeekendSession } from "@/lib/stewards/types";

const parseLines = (value: FormDataEntryValue | null) =>
  typeof value === "string"
    ? value
        .split("\n")
        .map((v) => v.trim())
        .filter(Boolean)
    : [];

const parseMulti = (formData: FormData, key: string) =>
  formData
    .getAll(key)
    .filter((v): v is string => typeof v === "string")
    .map((v) => v.trim())
    .filter(Boolean);

const toNumberOrNull = (value: string) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
};

const firstName = (name: string) => name.trim().split(/\s+/).filter(Boolean)[0] ?? name.trim();

const shortRaceLabel = (season: string, round: string) => {
  const s = season.replace(/^S/i, "").trim();
  const raceMatch = round.match(/Race\s*0*(\d+)/i);
  const race = raceMatch ? raceMatch[1].padStart(2, "0") : "00";
  const circuit = round
    .replace(/^Race\s*\d+\s*-\s*/i, "")
    .replace(/\(.*?\)/g, "")
    .replace(/grand prix/gi, "")
    .replace(/\s+/g, " ")
    .trim();
  return `S${s}R${race}${circuit ? ` ${circuit}` : ""}`;
};

async function saveAttachments(files: File[]): Promise<string[]> {
  const validFiles = files.filter((f) => f && f.size > 0);
  if (validFiles.length === 0) return [];

  const isNetlify = !!(process.env.NETLIFY_BLOBS_CONTEXT || process.env.NETLIFY_DEV);

  if (isNetlify) {
    // Netlify filesystem is read-only — store files in Netlify Blobs instead.
    const { getStore } = await import("@netlify/blobs");
    const blobStore = getStore("steward-files");
    const urls: string[] = [];
    for (const file of validFiles) {
      const ext = path.extname(file.name || "").toLowerCase();
      const key = `${Date.now()}-${randomUUID()}${ext && ext.length < 12 ? ext : ""}`;
      const buffer = await file.arrayBuffer();
      await blobStore.set(key, buffer, {
        metadata: {
          name: file.name || key,
          type: file.type || "application/octet-stream",
        },
      });
      urls.push(`/api/stewards/attachment?key=${encodeURIComponent(key)}`);
    }
    return urls;
  } else {
    // Local dev: write to public/uploads/stewards (filesystem is writable).
    const dir = path.join(process.cwd(), "public", "uploads", "stewards");
    await mkdir(dir, { recursive: true });
    const urls: string[] = [];
    for (const file of validFiles) {
      const ext = path.extname(file.name || "").toLowerCase();
      const filename = `${Date.now()}-${randomUUID()}${ext && ext.length < 12 ? ext : ""}`;
      await writeFile(path.join(dir, filename), Buffer.from(await file.arrayBuffer()));
      urls.push(`/uploads/stewards/${filename}`);
    }
    return urls;
  }
}

export async function loginStewardAction(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const user = await getUserByEmail(email);
  if (!user || !user.isActive || !verifyPassword(password, user.passwordHash)) {
    redirect("/stewards/login?error=1");
  }
  const token = await createStewardSession(user);
  await setStewardSessionCookie(token);
  // Force password change before entering the module
  if (user.mustChangePassword) redirect("/stewards/change-password");
  redirect("/stewards");
}

export async function logoutStewardAction() {
  await clearStewardSessionCookie();
  redirect("/stewards/login");
}

export async function createComplaintAction(formData: FormData) {
  const user = await requireStewardUser();
  if (!canCreateComplaint(user.roles)) redirect("/stewards");

  const season = String(formData.get("season") ?? "").trim();
  const round = String(formData.get("round") ?? "").trim();
  const weekendSessionRaw = String(formData.get("weekend_session") ?? "").trim();
  const weekendSession: WeekendSession =
    weekendSessionRaw === "Qualifying" ? "Qualifying"
    : weekendSessionRaw === "Sprint" ? "Sprint"
    : "Race";
  const lapRaw = String(formData.get("incident_lap_number") ?? "").trim();
  const qualifyingTime = String(formData.get("qualifying_time") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const requestedInvolved = parseMulti(formData, "involved_driver_ids");
  const evidenceItems = parseLines(formData.get("evidence_items"));
  const uploadedFiles = formData
    .getAll("attachment_files")
    .filter((f): f is File => f instanceof File);
  const attachmentUrls = await saveAttachments(uploadedFiles);

  const users = await listUsers();
  const memberIds = new Set(users.filter((u) => u.roles.includes("member")).map((u) => u.id));
  const involvedDriverIds = requestedInvolved.filter((id) => memberIds.has(id));

  const isRaceLike = weekendSession === "Race" || weekendSession === "Sprint";
  const incidentLapNumber =
    isRaceLike && lapRaw ? toNumberOrNull(lapRaw) : null;
  const hasEvidence = attachmentUrls.length > 0 || evidenceItems.length > 0;

  if (!season || !round || !weekendSessionRaw || !description || involvedDriverIds.length === 0) {
    redirect("/stewards/cases?error=missing-fields&view=driver");
  }
  if (isRaceLike && (!incidentLapNumber || incidentLapNumber <= 0)) {
    redirect("/stewards/cases?error=missing-fields&view=driver");
  }
  if (weekendSession === "Qualifying" && !qualifyingTime) {
    redirect("/stewards/cases?error=missing-fields&view=driver");
  }
  if (!hasEvidence) redirect("/stewards/cases?error=evidence-required&view=driver");

  const byId = new Map(users.map((u) => [u.id, u]));
  const complainantName = firstName(user.name);
  const others = involvedDriverIds
    .map((id) => byId.get(id)?.name)
    .filter((n): n is string => Boolean(n))
    .map(firstName)
    .filter((n) => n !== complainantName);

  const title = `${shortRaceLabel(season, round)} - ${complainantName}${others.length ? `, ${others.join(", ")}` : ""}`;

  const created = await createCase({
    title,
    season,
    round,
    weekendSession,
    incidentLapNumber: isRaceLike ? (incidentLapNumber as number) : null,
    qualifyingTime: weekendSession === "Qualifying" ? qualifyingTime : null,
    complainantId: user.id,
    involvedDriverIds,
    description,
    attachmentUrls,
    links: evidenceItems,
  });

  await notifyCaseSubmitted(created, users);

  revalidatePath("/stewards");
  revalidatePath("/stewards/cases");
  redirect(`/stewards/cases/${created.id}?submitted=1&view=driver`);
}

export async function submitCaseResponseAction(formData: FormData) {
  const user = await requireStewardUser();
  const caseId = String(formData.get("case_id") ?? "");
  const text = String(formData.get("text") ?? "").trim();
  const evidenceItems = parseLines(formData.get("evidence_items"));
  const uploadedFiles = formData
    .getAll("attachment_files")
    .filter((f): f is File => f instanceof File);
  const attachmentUrls = await saveAttachments(uploadedFiles);

  const caseData = await getCaseById(caseId);
  if (!caseData || !text) redirect(`/stewards/cases/${caseId}?view=driver`);

  // Only involved drivers submit statements (complainant already gave their side in the complaint)
  if (!caseData.caseItem.involvedDriverIds.includes(user.id)) {
    redirect(`/stewards/cases/${caseId}?view=driver`);
  }

  // Enforce one statement per driver
  const alreadySubmitted = caseData.responses.some((r) => r.userId === user.id);
  if (alreadySubmitted) redirect(`/stewards/cases/${caseId}?view=driver`);

  await addCaseResponse({ caseId, userId: user.id, text, attachmentUrls, links: evidenceItems });
  const users = await listUsers();

  // Confirmation to the responding driver only
  await notifyResponseConfirmation(caseData.caseItem, user, users);

  // If all involved drivers have now responded, notify stewards + complainant once
  const updatedCase = await getCaseById(caseId);
  const allResponded = updatedCase?.caseItem.involvedDriverIds.every((driverId) =>
    updatedCase.responses.some((r) => r.userId === driverId),
  );
  if (allResponded && updatedCase) {
    await notifyAllResponsesSubmitted(updatedCase.caseItem, users);
  }

  revalidatePath(`/stewards/cases/${caseId}`);
  revalidatePath("/stewards/cases");
}

export async function addInternalCommentAction(formData: FormData) {
  const user = await requireStewardUser();
  if (!canCommentInternally(user.roles)) redirect("/stewards");
  const caseId = String(formData.get("case_id") ?? "");
  const text = String(formData.get("text") ?? "").trim();
  if (!caseId || !text) redirect(`/stewards/cases/${caseId}?view=steward`);
  await addInternalComment({ caseId, authorId: user.id, text });

  // Notify other stewards about the discussion activity
  const [caseData, users] = await Promise.all([getCaseById(caseId), listUsers()]);
  if (caseData) await notifyInternalDiscussion(caseData.caseItem, user.name, users);

  revalidatePath(`/stewards/cases/${caseId}`);
}

export async function upsertVerdictAction(formData: FormData) {
  const user = await requireRole(["admin", "steward"]);
  const caseId = String(formData.get("case_id") ?? "");
  const summary = String(formData.get("verdict_summary") ?? "").trim();
  const fullText = String(formData.get("verdict_full_text") ?? "").trim();
  const isPublished = String(formData.get("is_published") ?? "") === "on";
  const driverVerdictsJson = String(formData.get("driver_verdicts_json") ?? "[]");
  const VALID_DECISIONS: VerdictDecision[] = ["Racing Incident", "No Further Action", "Penalty Imposed", "Driver Reprimand", "Other"];
  const decisionRaw = String(formData.get("verdict_decision") ?? "").trim() as VerdictDecision;
  const verdictDecision: VerdictDecision | null = VALID_DECISIONS.includes(decisionRaw) ? decisionRaw : null;

  if (!caseId || !summary || !fullText) redirect(`/stewards/cases/${caseId}?view=steward`);

  let driverEntries: { driverId: string; license_points: number | null; time_penalty_seconds: number | null; warning_text: string | null }[] = [];
  try {
    const parsed = JSON.parse(driverVerdictsJson);
    if (Array.isArray(parsed)) {
      driverEntries = parsed.map((e) => ({
        driverId: String(e.driverId ?? ""),
        license_points: e.licensePoints != null && e.licensePoints !== "" ? Number(e.licensePoints) : null,
        time_penalty_seconds: e.timePenaltySeconds != null && e.timePenaltySeconds !== "" ? Number(e.timePenaltySeconds) : null,
        warning_text: e.warningText?.trim() || null,
      })).filter((e) => e.driverId);
    }
  } catch { /* ignore parse errors */ }

  await upsertVerdict({
    caseId,
    updatedBy: user.id,
    driverEntries,
    verdict_decision: verdictDecision,
    verdict_summary: summary,
    verdict_full_text: fullText,
    is_published: isPublished,
  });

  if (isPublished) {
    const caseData = await getCaseById(caseId);
    if (caseData?.verdict) {
      const users = await listUsers();
      await notifyVerdictPublished(caseData.caseItem, caseData.verdict, users);
    }
  }
  revalidatePath(`/stewards/cases/${caseId}`);
  revalidatePath("/stewards/penalties");
  revalidatePath("/stewards/penalties-to-serve");
  // Auto-generate penalties-to-serve if thresholds crossed
  await checkAndGeneratePenalties(caseId).catch(() => {});
}

export async function publishVerdictAction(formData: FormData) {
  const user = await requireRole(["admin", "steward"]);
  const caseId = String(formData.get("case_id") ?? "");
  if (!caseId) redirect(`/stewards/cases?view=steward`);
  const ok = await publishVerdict(caseId, user.id);
  if (ok) {
    const caseData = await getCaseById(caseId);
    if (caseData?.verdict) {
      const users = await listUsers();
      await notifyVerdictPublished(caseData.caseItem, caseData.verdict, users);
    }
    // Auto-generate penalties-to-serve if thresholds crossed
    await checkAndGeneratePenalties(caseId).catch(() => {});
  }
  revalidatePath(`/stewards/cases/${caseId}`);
  revalidatePath("/stewards/cases");
  revalidatePath("/stewards/penalties");
  revalidatePath("/stewards/penalties-to-serve");
  redirect(`/stewards/cases/${caseId}?view=steward`);
}

export async function updateCaseStatusAction(formData: FormData) {
  await requireRole(["admin", "steward"]);
  const caseId = String(formData.get("case_id") ?? "");
  const status = String(formData.get("status") ?? "") as CaseStatus;
  if (!caseId) redirect("/stewards/cases?view=steward");
  await updateCaseStatus(caseId, status);
  revalidatePath(`/stewards/cases/${caseId}`);
  revalidatePath("/stewards/cases");
}

export async function updateUserRoleAction(formData: FormData) {
  await requireRole(["admin"]);
  const userId = String(formData.get("user_id") ?? "");
  const roles = parseMulti(formData, "roles").filter(
    (r): r is StewardRole => r === "admin" || r === "steward" || r === "member",
  );
  if (!userId || roles.length === 0) redirect("/stewards/admin");
  await updateUserRoles(userId, roles);
  revalidatePath("/stewards/admin");
}

export async function createUserAction(formData: FormData) {
  await requireRole(["admin"]);
  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const roles = parseMulti(formData, "roles").filter(
    (r): r is StewardRole => r === "admin" || r === "steward" || r === "member",
  );
  if (!name || !email || !password || roles.length === 0) {
    redirect("/stewards/admin?error=invalid-user");
  }
  await createUser({ name, email, passwordHash: hashPassword(password), roles });
  revalidatePath("/stewards/admin");
}

export async function editUserAction(formData: FormData) {
  await requireRole(["admin"]);
  const userId   = String(formData.get("user_id")  ?? "").trim();
  const name     = String(formData.get("name")      ?? "").trim();
  const email    = String(formData.get("email")     ?? "").trim();
  const password = String(formData.get("password")  ?? "").trim();
  if (!userId || !name || !email) redirect("/stewards/admin?error=invalid-user");
  const fields: { name: string; email: string; passwordHash?: string; mustChangePassword?: boolean } = { name, email };
  if (password) {
    fields.passwordHash = hashPassword(password);
    // Admin resetting a password forces the user to change it on next login
    fields.mustChangePassword = true;
  }
  await updateUser(userId, fields);
  revalidatePath("/stewards/admin");
}

/**
 * Forced change — called from /stewards/change-password (no current-password check).
 * Only allowed when the session user has mustChangePassword = true.
 */
export async function forcedChangePasswordAction(formData: FormData) {
  const user = await requireStewardUserForPasswordChange();
  if (!user.mustChangePassword) redirect("/stewards");

  const newPw  = String(formData.get("new_password")     ?? "").trim();
  const confirm = String(formData.get("confirm_password") ?? "").trim();

  if (!newPw || newPw.length < 8)         redirect("/stewards/change-password?error=too-short");
  if (newPw !== confirm)                   redirect("/stewards/change-password?error=mismatch");

  await updateUser(user.id, { passwordHash: hashPassword(newPw), mustChangePassword: false });
  redirect("/stewards");
}

/**
 * Voluntary change — user is already inside the module and wants to update their password.
 * Requires current password verification.
 */
export async function selfChangePasswordAction(formData: FormData): Promise<{ error?: string }> {
  const user = await requireStewardUser();

  const currentPw = String(formData.get("current_password") ?? "").trim();
  const newPw     = String(formData.get("new_password")     ?? "").trim();
  const confirm   = String(formData.get("confirm_password") ?? "").trim();

  if (!verifyPassword(currentPw, user.passwordHash)) return { error: "current-incorrect" };
  if (!newPw || newPw.length < 8)                    return { error: "too-short" };
  if (newPw !== confirm)                              return { error: "mismatch" };

  await updateUser(user.id, { passwordHash: hashPassword(newPw) });
  return {};
}

export async function addHistoricalPenaltyAction(formData: FormData) {
  "use server";
  const admin = await requireRole(["admin"]);
  const VALID_DECISIONS: VerdictDecision[] = ["Racing Incident", "No Further Action", "Penalty Imposed", "Driver Reprimand", "Other"];

  const season          = String(formData.get("season")           ?? "").trim();
  const round           = String(formData.get("round")            ?? "").trim();
  const weekendSession  = String(formData.get("weekendSession")   ?? "Race") as WeekendSession;
  const description     = String(formData.get("description")      ?? "").trim();
  const decisionRaw     = String(formData.get("verdict_decision") ?? "").trim() as VerdictDecision;
  const verdictDecision = VALID_DECISIONS.includes(decisionRaw) ? decisionRaw : null;
  const verdictFullText = String(formData.get("verdict_full_text") ?? "").trim();
  const entriesJson     = String(formData.get("driver_entries_json") ?? "[]");

  if (!season || !round) redirect("/stewards/admin?error=missing-fields");

  let rawEntries: { driverId: string; licensePoints: string; timePenaltySeconds: string; warningText: string }[] = [];
  try { rawEntries = JSON.parse(entriesJson); } catch { /* ignore */ }

  const driverEntries: HistoricalDriverEntry[] = rawEntries
    .filter((e) => e.driverId)
    .map((e) => ({
      driverId:           e.driverId,
      licensePoints:      e.licensePoints      ? parseInt(e.licensePoints, 10)      : null,
      timePenaltySeconds: e.timePenaltySeconds ? parseFloat(e.timePenaltySeconds)   : null,
      warningText:        e.warningText?.trim() || null,
    }));

  if (driverEntries.length === 0) redirect("/stewards/admin?error=no-drivers");

  // Auto-build summary from entries
  const parts = driverEntries.map((e) => {
    const chips: string[] = [];
    if (e.licensePoints)      chips.push(`+${e.licensePoints} pts`);
    if (e.timePenaltySeconds) chips.push(`+${e.timePenaltySeconds}s`);
    if (e.warningText)        chips.push("Warning");
    return chips.length ? chips.join(", ") : "No penalty";
  });
  const verdictSummary = (verdictDecision ?? "Historical entry") + (parts.some((p) => p !== "No penalty") ? ` — ${parts.join(" | ")}` : "");

  await addHistoricalCase({
    season, round, weekendSession, description, verdictDecision,
    verdictSummary, verdictFullText,
    adminUserId: admin.id,
    driverEntries,
  });

  revalidatePath("/stewards/penalties");
  revalidatePath("/stewards/cases");
  revalidatePath("/stewards/admin");
}

export async function removeUserAction(formData: FormData) {
  const admin = await requireRole(["admin"]);
  const userId = String(formData.get("user_id") ?? "");
  if (!userId) redirect("/stewards/admin?error=invalid-user");
  const result = await removeUserById(userId, admin.id);
  if (!result.ok) redirect(`/stewards/admin?error=${result.reason}`);
  revalidatePath("/stewards/admin");
}

export async function removeCaseAction(formData: FormData) {
  await requireRole(["admin"]);
  const caseId = String(formData.get("case_id") ?? "");
  const redirectTo = String(formData.get("redirect_to") ?? "/stewards/cases?view=steward");
  if (!caseId) redirect("/stewards/cases?view=steward");
  await deleteCaseById(caseId);
  revalidatePath("/stewards");
  revalidatePath("/stewards/cases");
  revalidatePath("/stewards/penalties");
  redirect(redirectTo);
}

/* ------------------------------------------------------------------ */
/*  Penalties to Serve — admin actions                                  */
/* ------------------------------------------------------------------ */

export async function addManualPenaltyAction(formData: FormData) {
  const admin = await requireRole(["admin"]);
  const driverId       = String(formData.get("driver_id")       ?? "").trim();
  const penaltyType    = String(formData.get("penalty_type")    ?? "").trim() || "manual";
  const penaltyLabel   = String(formData.get("penalty_label")   ?? "").trim();
  const penaltyDesc    = String(formData.get("penalty_description") ?? "").trim();
  const adminNotes     = String(formData.get("admin_notes")     ?? "").trim() || null;
  const quantityRaw    = parseInt(String(formData.get("quantity") ?? "1").trim(), 10);
  const quantity       = isNaN(quantityRaw) || quantityRaw < 1 ? 1 : quantityRaw;
  if (!driverId || !penaltyLabel) redirect("/stewards/penalties-to-serve?error=missing-fields");

  await addManualPenalty({
    driverId, penaltyType, penaltyLabel, penaltyDescription: penaltyDesc,
    adminNotes, createdBy: admin.id, quantity,
  });
  revalidatePath("/stewards/penalties-to-serve");
}

export async function markPenaltyServedAction(formData: FormData) {
  await requireRole(["admin"]);
  const id    = String(formData.get("penalty_id") ?? "").trim();
  const notes = String(formData.get("admin_notes") ?? "").trim() || undefined;
  if (!id) redirect("/stewards/penalties-to-serve");
  await updatePenaltyStatus({ penaltyId: id, status: "served", adminNotes: notes });
  revalidatePath("/stewards/penalties-to-serve");
}

export async function markPenaltyNotServedAction(formData: FormData) {
  await requireRole(["admin"]);
  const id    = String(formData.get("penalty_id") ?? "").trim();
  const notes = String(formData.get("admin_notes") ?? "").trim() || "";
  if (!id) redirect("/stewards/penalties-to-serve");
  const newPenalty = await rollForwardPenalty(id, notes);
  if (newPenalty) {
    // Email notification for roll-forward
    try {
      const { notifyPenaltyRolledForward } = await import("@/lib/stewards/notifications");
      const { listUsers: listU } = await import("@/lib/stewards/repository");
      const users = await listU();
      const driver = users.find((u) => u.id === newPenalty.driverId);
      if (driver) await notifyPenaltyRolledForward(newPenalty, driver);
    } catch { /* non-fatal */ }
  }
  revalidatePath("/stewards/penalties-to-serve");
}

export async function cancelPenaltyAction(formData: FormData) {
  await requireRole(["admin"]);
  const id    = String(formData.get("penalty_id") ?? "").trim();
  const notes = String(formData.get("admin_notes") ?? "").trim() || undefined;
  if (!id) redirect("/stewards/penalties-to-serve");
  await updatePenaltyStatus({ penaltyId: id, status: "cancelled", adminNotes: notes });
  revalidatePath("/stewards/penalties-to-serve");
}

export async function deletePenaltyAction(formData: FormData) {
  await requireRole(["admin"]);
  const id = String(formData.get("penalty_id") ?? "").trim();
  if (!id) redirect("/stewards/penalties-to-serve");
  await deletePenaltyToServe(id);
  revalidatePath("/stewards/penalties-to-serve");
}

export async function editPenaltyToServeAction(formData: FormData) {
  await requireRole(["admin"]);
  const id          = String(formData.get("penalty_id")          ?? "").trim();
  const label       = String(formData.get("penalty_label")       ?? "").trim();
  const type        = String(formData.get("penalty_type")        ?? "").trim() || "manual";
  const description = String(formData.get("penalty_description") ?? "").trim();
  const notes       = String(formData.get("admin_notes")         ?? "").trim() || null;
  if (!id || !label) redirect("/stewards/penalties-to-serve?error=missing-fields");
  await updatePenaltyFields(id, { penaltyLabel: label, penaltyType: type, penaltyDescription: description, adminNotes: notes });
  revalidatePath("/stewards/penalties-to-serve");
}

export async function editHistoricalCaseAction(formData: FormData) {
  await requireRole(["admin"]);
  const VALID_DECISIONS: VerdictDecision[] = ["Racing Incident", "No Further Action", "Penalty Imposed", "Driver Reprimand", "Other"];
  const caseId          = String(formData.get("case_id")           ?? "").trim();
  const season          = String(formData.get("season")            ?? "").trim();
  const round           = String(formData.get("round")             ?? "").trim();
  const weekendSession  = String(formData.get("weekendSession")    ?? "Race") as WeekendSession;
  const description     = String(formData.get("description")       ?? "").trim();
  const decisionRaw     = String(formData.get("verdict_decision")  ?? "").trim() as VerdictDecision;
  const verdictDecision = VALID_DECISIONS.includes(decisionRaw) ? decisionRaw : null;
  const verdictFullText = String(formData.get("verdict_full_text") ?? "").trim();
  const entriesJson     = String(formData.get("driver_entries_json") ?? "[]");
  if (!caseId || !season || !round) redirect("/stewards/penalties?error=missing-fields");

  let rawEntries: { driverId: string; licensePoints: string; timePenaltySeconds: string; warningText: string }[] = [];
  try { rawEntries = JSON.parse(entriesJson); } catch { /* ignore */ }

  const driverEntries: HistoricalDriverEntry[] = rawEntries
    .filter((e) => e.driverId)
    .map((e) => ({
      driverId:           e.driverId,
      licensePoints:      e.licensePoints      ? parseInt(e.licensePoints, 10)    : null,
      timePenaltySeconds: e.timePenaltySeconds ? parseFloat(e.timePenaltySeconds) : null,
      warningText:        e.warningText?.trim() || null,
    }));

  if (driverEntries.length === 0) redirect("/stewards/penalties?error=no-drivers");

  const parts = driverEntries.map((e) => {
    const chips: string[] = [];
    if (e.licensePoints)      chips.push(`+${e.licensePoints} pts`);
    if (e.timePenaltySeconds) chips.push(`+${e.timePenaltySeconds}s`);
    if (e.warningText)        chips.push("Warning");
    return chips.length ? chips.join(", ") : "No penalty";
  });
  const verdictSummary = (verdictDecision ?? "Historical entry") + (parts.some((p) => p !== "No penalty") ? ` — ${parts.join(" | ")}` : "");

  const input: UpdateHistoricalCaseInput = {
    season, round, weekendSession, description,
    verdictDecision, verdictSummary, verdictFullText, driverEntries,
  };
  await updateHistoricalCase(caseId, input);
  revalidatePath("/stewards/penalties");
  revalidatePath("/stewards/cases");
}

/* ─────────────────────────────────────────────────────────────────── */
/*  APPEAL ACTIONS                                                      */
/* ─────────────────────────────────────────────────────────────────── */

export async function submitAppealAction(formData: FormData) {
  const user = await requireStewardUser();
  const caseId = String(formData.get("case_id") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();

  if (!caseId || !description) redirect("/stewards/cases?error=appeal-missing-fields");

  const data = await getCaseById(caseId);
  if (!data) redirect("/stewards/cases");
  const { caseItem } = data;

  // Eligibility checks
  const isEligible =
    caseItem.complainantId === user.id || caseItem.involvedDriverIds.includes(user.id);
  if (!isEligible) redirect(`/stewards/cases/${caseId}?error=not-eligible`);
  if (caseItem.status !== "Closed") redirect(`/stewards/cases/${caseId}?error=not-closed`);
  const caseVerdict = data.verdict;
  if (!isAppealWindowOpen(caseItem.closedAt, caseVerdict?.published_at)) redirect(`/stewards/cases/${caseId}?error=window-expired`);

  const existing = await getAppealByOriginalCaseId(caseId);
  if (existing) redirect(`/stewards/cases/${caseId}?error=appeal-exists`);

  // Handle evidence uploads
  const evidenceItems = parseLines(formData.get("evidence_items"));
  const uploadedFiles = formData
    .getAll("attachment_files")
    .filter((f): f is File => f instanceof File);
  const pastedFiles = formData
    .getAll("pasted_files")
    .filter((f): f is File => f instanceof File);
  const allFiles = [...uploadedFiles, ...pastedFiles];
  const attachmentUrls = await saveAttachments(allFiles);
  const attachments: { name: string; url: string }[] = allFiles.map((f, i) => ({
    name: f.name || `evidence-${i + 1}`,
    url: attachmentUrls[i],
  }));
  const links = evidenceItems;

  // At least one piece of evidence required
  if (attachments.length === 0 && links.length === 0) {
    redirect(`/stewards/cases/${caseId}?error=appeal-no-evidence`);
  }

  const appeal = await createAppeal({
    originalCaseId: caseId,
    submittedByUserId: user.id,
    description,
    attachments,
    links,
    closedAt: caseItem.closedAt ?? caseVerdict?.published_at ?? new Date().toISOString(),
  });

  // Notify all parties
  const allUsers = await listUsers();
  const involvedUsers = allUsers.filter(
    (u) =>
      u.id === caseItem.complainantId ||
      caseItem.involvedDriverIds.includes(u.id) ||
      u.roles.includes("steward") ||
      u.roles.includes("admin"),
  );
  try {
    await notifyAppealSubmitted(appeal, caseItem, user, involvedUsers);
  } catch { /* non-fatal */ }

  revalidatePath(`/stewards/cases/${caseId}`);
  revalidatePath("/stewards/cases");
  revalidatePath("/stewards/appeals");
  redirect(`/stewards/appeals/${appeal.id}?submitted=1`);
}

export async function addAppealInternalCommentAction(formData: FormData) {
  const user = await requireStewardUser();
  if (!canCommentInternally(user.roles)) redirect("/stewards");
  const appealId = String(formData.get("appeal_id") ?? "").trim();
  const text = String(formData.get("text") ?? "").trim();
  if (!appealId || !text) return;
  await addAppealInternalComment(appealId, user.id, text);
  revalidatePath(`/stewards/appeals/${appealId}`);
}

export async function upsertAppealVerdictAction(formData: FormData) {
  const user = await requireStewardUser();
  if (!user.roles.includes("steward") && !user.roles.includes("admin")) redirect("/stewards");

  const appealId       = String(formData.get("appeal_id")        ?? "").trim();
  const outcomeRaw     = String(formData.get("outcome_type")      ?? "").trim();
  const summaryRaw     = String(formData.get("verdict_summary")   ?? "").trim();
  const fullTextRaw    = String(formData.get("verdict_full_text") ?? "").trim();
  const isPublished    = formData.get("is_published") === "true";
  const entriesJson    = String(formData.get("driver_entries_json") ?? "[]");

  if (!appealId) redirect("/stewards/appeals");

  const outcomeType = (outcomeRaw === "no_change" || outcomeRaw === "changed_decision")
    ? outcomeRaw
    : null;

  type RawEntry = { driverId: string; licensePoints: string; timePenaltySeconds: string; warningText: string };
  const rawEntries: RawEntry[] = JSON.parse(entriesJson);
  const driverEntries = rawEntries.map((e) => ({
    driverId: e.driverId,
    license_points: e.licensePoints ? parseInt(e.licensePoints, 10) : null,
    time_penalty_seconds: e.timePenaltySeconds ? parseFloat(e.timePenaltySeconds) : null,
    warning_text: e.warningText?.trim() || null,
  }));

  const input: UpsertAppealVerdictInput = {
    appealId,
    outcomeType,
    verdict_summary: summaryRaw,
    verdict_full_text: fullTextRaw,
    is_published: isPublished,
    updatedBy: user.id,
    driverEntries,
  };
  await upsertAppealVerdict(input);

  if (isPublished) {
    // Re-run penalty generation since effective verdicts may have changed
    const appealData = await getAppealById(appealId);
    if (appealData?.originalCase) {
      try { await checkAndGeneratePenalties(appealData.originalCase.id); } catch { /* non-fatal */ }
    }
    // Notify involved parties
    if (appealData) {
      const allUsers = await listUsers();
      const { appeal, originalCase, verdict } = appealData;
      if (originalCase && verdict) {
        const recipients = allUsers.filter(
          (u) =>
            u.id === originalCase.complainantId ||
            originalCase.involvedDriverIds.includes(u.id),
        );
        try {
          await notifyAppealVerdictPublished(appeal, verdict, originalCase, recipients);
        } catch { /* non-fatal */ }
      }
    }
  }

  revalidatePath(`/stewards/appeals/${appealId}`);
  revalidatePath("/stewards/cases");
  revalidatePath("/stewards/penalties");
}

export async function publishAppealVerdictAction(formData: FormData) {
  const user = await requireStewardUser();
  if (!user.roles.includes("steward") && !user.roles.includes("admin")) redirect("/stewards");
  const appealId = String(formData.get("appeal_id") ?? "").trim();
  if (!appealId) redirect("/stewards/appeals");

  await publishAppealVerdict(appealId, user.id);

  const appealData = await getAppealById(appealId);
  if (appealData?.originalCase) {
    try { await checkAndGeneratePenalties(appealData.originalCase.id); } catch { /* non-fatal */ }
  }
  if (appealData?.originalCase && appealData.verdict) {
    const allUsers = await listUsers();
    const recipients = allUsers.filter(
      (u) =>
        u.id === appealData.originalCase!.complainantId ||
        appealData.originalCase!.involvedDriverIds.includes(u.id),
    );
    try {
      await notifyAppealVerdictPublished(appealData.appeal, appealData.verdict, appealData.originalCase, recipients);
    } catch { /* non-fatal */ }
  }

  revalidatePath(`/stewards/appeals/${appealId}`);
  revalidatePath("/stewards/cases");
  revalidatePath("/stewards/penalties");
}

export async function updateAppealStatusAction(formData: FormData) {
  const user = await requireStewardUser();
  if (!user.roles.includes("steward") && !user.roles.includes("admin")) redirect("/stewards");
  const appealId = String(formData.get("appeal_id") ?? "").trim();
  const status = String(formData.get("status") ?? "").trim();
  const VALID = ["Submitted", "Under Review", "Verdict Ready", "Closed"];
  if (!appealId || !VALID.includes(status)) return;
  await updateAppealStatus(appealId, status as import("@/lib/stewards/types").AppealStatus);
  revalidatePath(`/stewards/appeals/${appealId}`);
  revalidatePath("/stewards/appeals");
}

export async function deleteAppealAction(formData: FormData) {
  await requireRole(["admin"]);
  const appealId = String(formData.get("appeal_id") ?? "").trim();
  if (!appealId) return;
  await deleteAppeal(appealId);
  revalidatePath("/stewards/appeals");
  revalidatePath("/stewards/cases");
  redirect("/stewards/appeals");
}
