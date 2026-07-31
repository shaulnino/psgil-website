/**
 * Steward notification producers (PW-4, Phase 1).
 *
 * These emit IN-APP notifications alongside the existing email notifications in
 * `lib/stewards/notifications.ts` — they don't replace them. Call them AFTER the
 * domain write has committed. All are idempotent (per-case/appeal dedupe keys).
 *
 * Steward case participants (`complainantId`, `involvedDriverIds`, response
 * `userId`) are ACCOUNT ids, so they map straight onto the notification audience.
 * Push copy stays generic by design (see registry + Phase 2) — no case details
 * on a lock screen.
 */
import { notify } from "@/lib/notifications/service";

type CaseLike = { id: string; complainantId: string; involvedDriverIds: string[] };

const dedupeRecipients = (ids: (string | null | undefined)[]) =>
  [...new Set(ids)].filter((id): id is string => !!id);

/** A new case names involved drivers — tell them (never the complainant). */
export async function notifyStewardCaseInvolved(caseItem: CaseLike): Promise<void> {
  const recipients = dedupeRecipients(caseItem.involvedDriverIds).filter(
    (id) => id !== caseItem.complainantId,
  );
  if (recipients.length === 0) return;
  await notify({
    type: "steward_case_involved",
    audience: { kind: "users", userIds: recipients },
    params: { caseId: caseItem.id },
    dedupeKey: caseItem.id,
  });
}

/** A verdict was published — tell the complainant and all involved drivers. */
export async function notifyStewardVerdictPublished(caseItem: CaseLike): Promise<void> {
  const recipients = dedupeRecipients([caseItem.complainantId, ...caseItem.involvedDriverIds]);
  if (recipients.length === 0) return;
  await notify({
    type: "steward_verdict_published",
    audience: { kind: "users", userIds: recipients },
    params: { caseId: caseItem.id },
    dedupeKey: `${caseItem.id}:verdict`,
  });
}

/** An appeal decision was published — tell the original case's parties. */
export async function notifyStewardAppealVerdictPublished(
  appealId: string,
  originalCase: CaseLike,
): Promise<void> {
  const recipients = dedupeRecipients([
    originalCase.complainantId,
    ...originalCase.involvedDriverIds,
  ]);
  if (recipients.length === 0) return;
  await notify({
    type: "appeal_verdict_published",
    audience: { kind: "users", userIds: recipients },
    params: { appealId },
    dedupeKey: `${appealId}:verdict`,
  });
}
