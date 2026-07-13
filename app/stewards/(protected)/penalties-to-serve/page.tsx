import { getTranslations } from "next-intl/server";
import { can, requireStewardUser } from "@/lib/stewards/auth";
import { isDriverRole } from "@/lib/accounts/types";
import { fmtDate } from "@/app/stewards/lib/dates";
import {
  listPenaltiesToServe,
  listUsers,
} from "@/lib/stewards/repository";
import { fetchThresholdRules } from "@/lib/stewards/penaltyRules";
import type { PenaltyToServe, PenaltyToServeStatus } from "@/lib/stewards/types";
import FormActionButton from "@/app/stewards/components/FormActionButton";
import EditPenaltyModal from "./EditPenaltyModal";
import PenaltyRuleSelect from "./PenaltyRuleSelect";
import {
  addManualPenaltyAction,
  cancelPenaltyAction,
  deletePenaltyAction,
  markPenaltyNotServedAction,
  markPenaltyServedAction,
} from "@/app/stewards/actions";

type SearchParams = Promise<{ error?: string }>;

export default async function PenaltiesToServePage({ searchParams }: { searchParams: SearchParams }) {
  const user = await requireStewardUser();
  const t = await getTranslations("stewards");
  const isAdmin = can(user, "manage_penalties");
  const params = await searchParams;

  const [penalties, users, rules] = await Promise.all([
    listPenaltiesToServe(),
    listUsers(),
    isAdmin ? fetchThresholdRules() : Promise.resolve([]),
  ]);

  const driverName = (id: string) => users.find((u) => u.id === id)?.name ?? id;
  const memberDrivers = users.filter((u) => isDriverRole(u.roles));

  const active       = penalties.filter((p) => p.status === "assigned" || p.status === "pending");
  const awaiting     = penalties.filter((p) => p.status === "awaiting_confirmation");
  const history      = penalties.filter((p) => ["served", "not_served", "rolled_forward", "cancelled"].includes(p.status));

  const inputCls = "w-full rounded-[2px] border border-[color:var(--isl-hairline)] bg-paper px-3 py-2 text-sm text-ink placeholder:text-faint focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--isl-oxblood)]";

  return (
    <div className="space-y-8">

      {/* Header */}
      <section className="steward-panel rounded-[2px] p-5">
        <h2 className="font-display text-2xl font-bold tracking-[0.005em] leading-[1.05] text-ink">{t("penaltiesToServe.title")}</h2>
        <p className="mt-1 text-sm text-ink-2">
          {t("penaltiesToServe.subtitle")}
        </p>
        {params.error && (
          <div className="mt-3 rounded-[2px] border border-status-danger px-3 py-2 text-sm text-status-danger">
            {t("penaltiesToServe.errorPrefix")} {params.error}
          </div>
        )}
        {rules.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2">
            {rules.map((r) => (
              <span key={r.id} className="rounded-[2px] border border-brass px-3 py-1 text-xs text-ink-2">
                <span className="num">{r.thresholdLicensePoints}</span> {t("penaltiesToServe.ptsArrow")} {r.penaltyLabel}
              </span>
            ))}
          </div>
        )}
      </section>

      {/* Awaiting confirmation — admin alert */}
      {awaiting.length > 0 && (
        <section>
          <div className="mb-3 flex items-center gap-2">
            <span className="inline-flex h-2 w-2 rounded-full bg-status-warning animate-[f1-tick_1s_step-end_infinite]" />
            <h3 className="text-base font-display font-bold tracking-[0.005em] leading-[1.05] text-ink">{t("penaltiesToServe.awaitingHeading")}</h3>
            <span className="rounded-[2px] border border-status-warning px-2 py-0.5 text-xs font-bold text-status-warning num">
              {awaiting.length}
            </span>
          </div>
          <div className="space-y-3">
            {awaiting.map((p) => (
              <PenaltyCard
                key={p.id}
                penalty={p}
                driverName={driverName(p.driverId)}
                isAdmin={isAdmin}
                variant="alert"
                rules={rules}
              />
            ))}
          </div>
        </section>
      )}

      {/* Active penalties */}
      <section>
        <h3 className="mb-3 text-base font-display font-bold tracking-[0.005em] leading-[1.05] text-ink">
          {t("penaltiesToServe.activeHeading")}
          {active.length > 0 && (
            <span className="ms-2 rounded-[2px] border border-[color:var(--isl-hairline)] px-2 py-0.5 text-xs text-meta num">{active.length}</span>
          )}
        </h3>
        {active.length === 0 ? (
          <div className="steward-soft rounded-[2px] px-4 py-5 text-sm text-meta">
            {t("penaltiesToServe.noActive")}
          </div>
        ) : (
          <div className="space-y-3">
            {active.map((p) => (
              <PenaltyCard
                key={p.id}
                penalty={p}
                driverName={driverName(p.driverId)}
                isAdmin={isAdmin}
                variant="active"
                rules={rules}
              />
            ))}
          </div>
        )}
      </section>

      {/* Admin — manual add */}
      {isAdmin && (
        <section className="steward-panel rounded-[2px] p-5">
          <h3 className="text-base font-display font-bold tracking-[0.005em] leading-[1.05] text-ink">{t("penaltiesToServe.addManual.heading")}</h3>
          <p className="mt-0.5 text-xs text-meta">{t("penaltiesToServe.addManual.subtitle")}</p>
          <p className="mt-2 text-xs text-brass-ink">
            {t("penaltiesToServe.addManual.queuedNote")}
          </p>
          <form action={addManualPenaltyAction} className="mt-4 grid gap-3 md:grid-cols-2">
            <label className="block">
              <span className="mb-1 block font-isl-body text-[0.75rem] font-semibold uppercase tracking-[0.2em] text-meta">{t("penaltiesToServe.addManual.driver")}</span>
              <select name="driver_id" required className={inputCls}>
                <option value="">{t("penaltiesToServe.addManual.selectDriver")}</option>
                {memberDrivers.map((d) => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="mb-1 block font-isl-body text-[0.75rem] font-semibold uppercase tracking-[0.2em] text-meta">
                {t("penaltiesToServe.addManual.quantity")}
                <span className="ms-1 font-normal normal-case tracking-normal text-faint">{t("penaltiesToServe.addManual.quantityHint")}</span>
              </span>
              <input name="quantity" type="number" min={1} max={10} defaultValue={1} className={inputCls} />
            </label>
            <PenaltyRuleSelect rules={rules} />
            <label className="block md:col-span-2">
              <span className="mb-1 block font-isl-body text-[0.75rem] font-semibold uppercase tracking-[0.2em] text-meta">{t("penaltiesToServe.addManual.adminNotes")}</span>
              <input name="admin_notes" placeholder={t("penaltiesToServe.addManual.adminNotesPlaceholder")} className={inputCls} />
            </label>
            <div className="md:col-span-2">
              <FormActionButton
                idleLabel={t("penaltiesToServe.addManual.submit")}
                loadingLabel={t("penaltiesToServe.addManual.submitting")}
                className="rounded-[2px] bg-ink px-5 py-2.5 text-sm font-medium uppercase tracking-[0.08em] text-bone transition-opacity hover:opacity-90"
                spinnerClassName="border-bone/30 border-t-bone"
              />
            </div>
          </form>
        </section>
      )}

      {/* History */}
      {history.length > 0 && (
        <section>
          <h3 className="mb-3 font-isl-body text-[0.75rem] font-semibold uppercase tracking-[0.2em] text-meta">{t("penaltiesToServe.historyHeading")}</h3>
          <div className="space-y-2">
            {history.map((p) => (
              <PenaltyCard
                key={p.id}
                penalty={p}
                driverName={driverName(p.driverId)}
                isAdmin={isAdmin}
                variant="history"
                rules={rules}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Penalty Card                                                        */
/* ------------------------------------------------------------------ */

const STATUS_CHIP: Record<PenaltyToServeStatus, string> = {
  pending:                "text-status-warning border-status-warning",
  assigned:               "text-status-info border-status-info",
  awaiting_confirmation:  "text-status-warning border-status-warning",
  served:                 "text-status-success border-status-success",
  not_served:             "text-status-danger border-status-danger",
  rolled_forward:         "text-brass-ink border-brass",
  cancelled:              "text-meta border-[color:var(--isl-hairline)]",
};

type RuleOption = { id: string; penaltyType: string; penaltyLabel: string; penaltyDescription: string };

async function PenaltyCard({
  penalty,
  driverName,
  isAdmin,
  variant,
  rules,
}: {
  penalty: PenaltyToServe;
  driverName: string;
  isAdmin: boolean;
  variant: "active" | "alert" | "history";
  rules: RuleOption[];
}) {
  const t = await getTranslations("stewards");
  const borderCls = variant === "alert"
    ? "border-status-warning bg-cream"
    : variant === "history"
      ? "border-[color:var(--isl-hairline)] bg-cream opacity-70"
      : "border-[color:var(--isl-hairline)] bg-paper";

  return (
    <div className={`rounded-[2px] border px-4 py-4 ${borderCls}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        {/* Left — main info */}
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-bold text-ink">{driverName}</span>
            <span className={`inline-flex items-center rounded-[2px] border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${STATUS_CHIP[penalty.status]}`}>
              {t(`penaltiesToServe.status.${penalty.status}`)}
            </span>
            {penalty.sourceType === "manual" && (
              <span className="rounded-[2px] border border-[color:var(--isl-hairline)] px-2 py-0.5 text-[9px] text-meta uppercase tracking-wider">{t("penaltiesToServe.card.manual")}</span>
            )}
            {penalty.cycleNumber > 1 && (
              <span className="rounded-[2px] border border-brass px-2 py-0.5 text-[9px] text-brass-ink uppercase tracking-wider">
                {t("penaltiesToServe.card.roll")}<span className="num">{penalty.cycleNumber}</span>
              </span>
            )}
          </div>

          <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1">
            <span className="text-sm font-semibold text-ink">{penalty.penaltyLabel}</span>
            {penalty.assignedRaceLabel && (
              <span className="text-sm text-ink-2">{t("penaltiesToServe.card.raceArrow")} {penalty.assignedRaceLabel}</span>
            )}
          </div>

          {penalty.penaltyDescription && (
            <p className="mt-1 text-xs text-meta">{penalty.penaltyDescription}</p>
          )}

          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-0.5 text-[11px] text-faint">
            {penalty.sourceThresholdPoints && (
              <span>{t("penaltiesToServe.card.triggeredAt")} <span className="num">{penalty.sourceThresholdPoints}</span> {t("penaltiesToServe.card.pts")}</span>
            )}
            {penalty.assignedRaceStartTime && (
              <span>{t("penaltiesToServe.card.race")} <span className="num">{fmtDate(penalty.assignedRaceStartTime)}</span></span>
            )}
            <span>{t("penaltiesToServe.card.created")} <span className="num">{fmtDate(penalty.createdAt)}</span></span>
          </div>

          {penalty.adminNotes && (
            <p className="mt-2 rounded-[2px] border border-[color:var(--isl-hairline)] bg-cream px-3 py-1.5 text-xs text-ink-2">
              📝 {penalty.adminNotes}
            </p>
          )}
        </div>

        {/* Right — admin actions */}
        {isAdmin && (
          <div className="flex flex-wrap gap-2 shrink-0">
            {penalty.sourceType === "manual" && (
              <EditPenaltyModal penalty={penalty} rules={rules} />
            )}
            {(penalty.status === "awaiting_confirmation") && (
              <>
                <form action={markPenaltyServedAction} className="inline">
                  <input type="hidden" name="penalty_id" value={penalty.id} />
                  <FormActionButton
                    idleLabel={t("penaltiesToServe.card.confirmServed")}
                    loadingLabel={t("penaltiesToServe.card.saving")}
                    className="rounded-[2px] border border-status-success px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.08em] text-status-success transition-colors hover:bg-cream"
                    spinnerClassName="border-status-success/30 border-t-status-success"
                  />
                </form>
                <form action={markPenaltyNotServedAction} className="inline">
                  <input type="hidden" name="penalty_id" value={penalty.id} />
                  <FormActionButton
                    idleLabel={t("penaltiesToServe.card.notServed")}
                    loadingLabel={t("penaltiesToServe.card.rolling")}
                    className="rounded-[2px] border border-status-danger px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.08em] text-status-danger transition-colors hover:bg-cream"
                    spinnerClassName="border-status-danger/30 border-t-status-danger"
                  />
                </form>
              </>
            )}
            {(penalty.status === "assigned" || penalty.status === "pending") && (
              <>
                <form action={markPenaltyServedAction} className="inline">
                  <input type="hidden" name="penalty_id" value={penalty.id} />
                  <FormActionButton
                    idleLabel={t("penaltiesToServe.card.markServed")}
                    loadingLabel={t("penaltiesToServe.card.saving")}
                    className="rounded-[2px] border border-status-success px-3 py-1.5 text-xs uppercase tracking-[0.08em] text-status-success transition-colors hover:bg-cream"
                    spinnerClassName="border-status-success/30 border-t-status-success"
                  />
                </form>
                <form action={cancelPenaltyAction} className="inline">
                  <input type="hidden" name="penalty_id" value={penalty.id} />
                  <FormActionButton
                    idleLabel={t("penaltiesToServe.card.cancel")}
                    loadingLabel={t("penaltiesToServe.card.ellipsis")}
                    className="rounded-[2px] border border-hairline-strong px-3 py-1.5 text-xs uppercase tracking-[0.08em] text-ink-2 transition-colors hover:border-ink"
                    spinnerClassName="border-[color:var(--isl-hairline)] border-t-ink"
                  />
                </form>
              </>
            )}
            {(penalty.status === "cancelled" || penalty.status === "served") && (
              <form action={deletePenaltyAction} className="inline">
                <input type="hidden" name="penalty_id" value={penalty.id} />
                <FormActionButton
                  idleLabel={t("penaltiesToServe.card.delete")}
                  loadingLabel={t("penaltiesToServe.card.ellipsis")}
                  className="rounded-[2px] border border-status-danger px-3 py-1.5 text-xs uppercase tracking-[0.08em] text-status-danger transition-colors hover:bg-cream"
                  spinnerClassName="border-status-danger/30 border-t-status-danger"
                />
              </form>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
