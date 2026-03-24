import { can, requireStewardUser } from "@/lib/stewards/auth";
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
  const isAdmin = can(user, "manage_penalties");
  const params = await searchParams;

  const [penalties, users, rules] = await Promise.all([
    listPenaltiesToServe(),
    listUsers(),
    isAdmin ? fetchThresholdRules() : Promise.resolve([]),
  ]);

  const driverName = (id: string) => users.find((u) => u.id === id)?.name ?? id;
  const memberDrivers = users.filter((u) => u.roles.includes("member"));

  const active       = penalties.filter((p) => p.status === "assigned" || p.status === "pending");
  const awaiting     = penalties.filter((p) => p.status === "awaiting_confirmation");
  const history      = penalties.filter((p) => ["served", "not_served", "rolled_forward", "cancelled"].includes(p.status));

  const inputCls = "w-full rounded-lg border border-white/15 bg-black/30 px-3 py-2 text-sm text-white/85 focus:border-[#D4AF37]/50 focus:outline-none transition";

  return (
    <div className="space-y-8">

      {/* Header */}
      <section className="steward-panel rounded-2xl p-5">
        <h2 className="font-display text-2xl font-semibold">Penalties to Serve</h2>
        <p className="mt-1 text-sm text-white/60">
          Race-service penalties assigned to drivers based on accumulated license points.
          All penalties must be served in the next Main League race.
        </p>
        {params.error && (
          <div className="mt-3 rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-200">
            Error: {params.error}
          </div>
        )}
        {rules.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2">
            {rules.map((r) => (
              <span key={r.id} className="rounded-full border border-[#D4AF37]/30 bg-[#D4AF37]/8 px-3 py-1 text-xs text-[#f4d98a]">
                {r.thresholdLicensePoints} pts → {r.penaltyLabel}
              </span>
            ))}
          </div>
        )}
      </section>

      {/* Awaiting confirmation — admin alert */}
      {awaiting.length > 0 && (
        <section>
          <div className="mb-3 flex items-center gap-2">
            <span className="relative flex h-2.5 w-2.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-60" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-amber-400" />
            </span>
            <h3 className="text-base font-semibold text-amber-200">Awaiting Service Confirmation</h3>
            <span className="rounded-full bg-amber-500/20 border border-amber-400/40 px-2 py-0.5 text-xs font-bold text-amber-200">
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
        <h3 className="mb-3 text-base font-semibold text-white/90">
          Active Penalties
          {active.length > 0 && (
            <span className="ml-2 rounded-full bg-white/10 px-2 py-0.5 text-xs text-white/60">{active.length}</span>
          )}
        </h3>
        {active.length === 0 ? (
          <div className="steward-soft rounded-xl px-4 py-5 text-sm text-white/50">
            No active penalties to serve.
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
        <section className="steward-panel rounded-2xl p-5">
          <h3 className="text-base font-semibold">Add Penalty Manually</h3>
          <p className="mt-0.5 text-xs text-white/50">Directly assign a penalty-to-serve without a threshold trigger.</p>
          <p className="mt-2 text-xs text-[#D4AF37]/70">
            Will be queued after any existing active penalties for that driver.
          </p>
          <form action={addManualPenaltyAction} className="mt-4 grid gap-3 md:grid-cols-2">
            <label className="block">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-wider text-white/60">Driver *</span>
              <select name="driver_id" required className={inputCls}>
                <option value="">Select driver…</option>
                {memberDrivers.map((d) => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-wider text-white/60">
                Quantity
                <span className="ml-1 font-normal normal-case tracking-normal text-white/35">(consecutive penalties)</span>
              </span>
              <input name="quantity" type="number" min={1} max={10} defaultValue={1} className={inputCls} />
            </label>
            <PenaltyRuleSelect rules={rules} />
            <label className="block md:col-span-2">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-wider text-white/60">Admin notes</span>
              <input name="admin_notes" placeholder="Reason for manual assignment…" className={inputCls} />
            </label>
            <div className="md:col-span-2">
              <FormActionButton
                idleLabel="Add Penalty"
                loadingLabel="Adding…"
                className="rounded-full bg-[#7020B0] px-5 py-2 text-sm font-semibold shadow-[0_0_14px_rgba(112,32,176,0.3)] hover:bg-[#7c2ac3] transition"
              />
            </div>
          </form>
        </section>
      )}

      {/* History */}
      {history.length > 0 && (
        <section>
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-white/40">History</h3>
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
  pending:                "bg-amber-400/15 text-amber-200 border-amber-400/40",
  assigned:               "bg-blue-400/15 text-blue-200 border-blue-400/40",
  awaiting_confirmation:  "bg-amber-500/20 text-amber-100 border-amber-500/60",
  served:                 "bg-emerald-500/15 text-emerald-200 border-emerald-500/40",
  not_served:             "bg-red-500/15 text-red-200 border-red-400/40",
  rolled_forward:         "bg-purple-500/15 text-purple-200 border-purple-400/40",
  cancelled:              "bg-white/5 text-white/40 border-white/15",
};

const STATUS_LABEL: Record<PenaltyToServeStatus, string> = {
  pending:                "Pending",
  assigned:               "Assigned",
  awaiting_confirmation:  "Awaiting Confirmation",
  served:                 "Served",
  not_served:             "Not Served",
  rolled_forward:         "Rolled Forward",
  cancelled:              "Cancelled",
};

type RuleOption = { id: string; penaltyType: string; penaltyLabel: string; penaltyDescription: string };

function PenaltyCard({
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
  const borderCls = variant === "alert"
    ? "border-amber-500/40 bg-amber-500/8"
    : variant === "history"
      ? "border-white/8 bg-white/3 opacity-70"
      : "border-white/12 bg-white/4";

  return (
    <div className={`rounded-xl border px-4 py-4 transition ${borderCls}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        {/* Left — main info */}
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-bold text-white/90">{driverName}</span>
            <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${STATUS_CHIP[penalty.status]}`}>
              {STATUS_LABEL[penalty.status]}
            </span>
            {penalty.sourceType === "manual" && (
              <span className="rounded-full bg-white/10 border border-white/15 px-2 py-0.5 text-[9px] text-white/50">manual</span>
            )}
            {penalty.cycleNumber > 1 && (
              <span className="rounded-full bg-purple-500/15 border border-purple-400/30 px-2 py-0.5 text-[9px] text-purple-300">
                roll #{penalty.cycleNumber}
              </span>
            )}
          </div>

          <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1">
            <span className="text-sm font-semibold text-[#f4d98a]">{penalty.penaltyLabel}</span>
            {penalty.assignedRaceLabel && (
              <span className="text-sm text-white/55">→ {penalty.assignedRaceLabel}</span>
            )}
          </div>

          {penalty.penaltyDescription && (
            <p className="mt-1 text-xs text-white/40">{penalty.penaltyDescription}</p>
          )}

          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-0.5 text-[11px] text-white/35">
            {penalty.sourceThresholdPoints && (
              <span>Triggered at {penalty.sourceThresholdPoints} pts</span>
            )}
            {penalty.assignedRaceStartTime && (
              <span>Race: {new Date(penalty.assignedRaceStartTime).toLocaleDateString()}</span>
            )}
            <span>Created: {new Date(penalty.createdAt).toLocaleDateString()}</span>
          </div>

          {penalty.adminNotes && (
            <p className="mt-2 rounded-lg border border-white/10 bg-black/20 px-3 py-1.5 text-xs text-white/50">
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
                    idleLabel="✓ Served"
                    loadingLabel="Saving…"
                    className="rounded-full bg-emerald-600/80 px-3 py-1.5 text-xs font-semibold transition hover:bg-emerald-500"
                  />
                </form>
                <form action={markPenaltyNotServedAction} className="inline">
                  <input type="hidden" name="penalty_id" value={penalty.id} />
                  <FormActionButton
                    idleLabel="✗ Not Served"
                    loadingLabel="Rolling…"
                    className="rounded-full bg-red-600/80 px-3 py-1.5 text-xs font-semibold transition hover:bg-red-500"
                  />
                </form>
              </>
            )}
            {(penalty.status === "assigned" || penalty.status === "pending") && (
              <>
                <form action={markPenaltyServedAction} className="inline">
                  <input type="hidden" name="penalty_id" value={penalty.id} />
                  <FormActionButton
                    idleLabel="Mark Served"
                    loadingLabel="Saving…"
                    className="rounded-full border border-emerald-500/50 px-3 py-1.5 text-xs text-emerald-200 hover:bg-emerald-500/15 transition"
                  />
                </form>
                <form action={cancelPenaltyAction} className="inline">
                  <input type="hidden" name="penalty_id" value={penalty.id} />
                  <FormActionButton
                    idleLabel="Cancel"
                    loadingLabel="…"
                    className="rounded-full border border-white/20 px-3 py-1.5 text-xs text-white/50 hover:border-white/40 transition"
                  />
                </form>
              </>
            )}
            {(penalty.status === "cancelled" || penalty.status === "served") && (
              <form action={deletePenaltyAction} className="inline">
                <input type="hidden" name="penalty_id" value={penalty.id} />
                <FormActionButton
                  idleLabel="Delete"
                  loadingLabel="…"
                  className="rounded-full border border-red-500/30 px-3 py-1.5 text-xs text-red-300/60 hover:bg-red-500/10 transition"
                />
              </form>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
