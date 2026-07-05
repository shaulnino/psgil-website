import type { Metadata } from "next";
import Section from "@/components/Section";
import { requireAdmin } from "@/lib/auth/session";
import { listUsers } from "@/lib/accounts/repository";
import { ALL_ROLES } from "@/lib/accounts/types";
import { fetchCsv, parseCsv } from "@/lib/csv";
import { mapDrivers } from "@/lib/driversData";
import { GLOBAL_CSV_URLS } from "@/lib/seasonConfig";
import {
  approveAccountAction,
  createAccountAction,
  linkDriverAction,
  rejectAccountAction,
  removeAccountAction,
  setActiveAction,
  setRolesAction,
} from "./actions";

export const metadata: Metadata = { title: "Account Administration | F1ISL" };
export const dynamic = "force-dynamic";

const card = "rounded-[2px] border border-[color:var(--isl-hairline)] bg-cream p-5 md:p-6";
const h2 = "font-display text-lg font-bold tracking-[0.02em] text-ink";
const input =
  "w-full rounded-[2px] border border-[color:var(--isl-hairline-strong)] bg-sink px-3 py-2 text-sm text-ink placeholder:text-faint focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--isl-oxblood)]";
const btn =
  "rounded-[2px] border border-[color:var(--isl-hairline-strong)] px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.06em] text-ink transition-colors hover:border-ink";
const btnGold = "rounded-[2px] bg-oxblood px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.06em] text-bone hover:bg-oxblood-deep";
const btnDanger = "rounded-[2px] border border-[color:var(--isl-danger)] px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.06em] text-[color:var(--isl-danger)] hover:bg-paper";

function StatusBadge({ status }: { status: string }) {
  const tone =
    status === "approved" ? "var(--isl-success)" : status === "rejected" ? "var(--isl-danger)" : "var(--isl-warning)";
  return (
    <span
      className="rounded-[2px] border px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider"
      style={{ color: tone, borderColor: tone }}
    >
      {status}
    </span>
  );
}

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  await requireAdmin("/admin");
  const { error } = await searchParams;
  const users = await listUsers();

  // CSV driver roster for linking (best-effort; empty on fetch failure).
  const driverCsv = await fetchCsv(GLOBAL_CSV_URLS.drivers).catch(() => "");
  const driverOptions = (driverCsv ? mapDrivers(parseCsv(driverCsv)) : [])
    .map((d) => ({ id: d.driver_id, name: d.name }))
    .filter((d) => d.id);

  const pending = users.filter((u) => u.status === "pending");
  const rest = users.filter((u) => u.status !== "pending");

  return (
    <main className="text-ink-2">
      <Section title="Account Administration" description="Approve accounts, set roles, and link drivers." pageHeader>
        <div className="mx-auto max-w-5xl space-y-6">
          {error && (
            <p className="rounded-[2px] border border-[color:var(--isl-danger)] px-3 py-2 text-sm text-[color:var(--isl-danger)]">
              {error === "email-taken" ? "An account with that email already exists." : "Please check the form and try again."}
            </p>
          )}

          {/* ── Pending approvals ── */}
          <div className={card}>
            <h2 className={h2}>Pending approvals ({pending.length})</h2>
            {pending.length === 0 ? (
              <p className="mt-3 text-sm text-meta">No accounts awaiting approval.</p>
            ) : (
              <ul className="mt-4 space-y-3">
                {pending.map((u) => (
                  <li key={u.id} className="flex flex-wrap items-center justify-between gap-3 border-t border-[color:var(--isl-hairline)] pt-3">
                    <div className="text-sm">
                      <span className="text-ink">{u.name}</span>{" "}
                      <span className="text-meta">({u.email})</span>{" "}
                      {u.emailVerified ? (
                        <span className="text-[color:var(--isl-success)]">✓ verified</span>
                      ) : (
                        <span className="text-[color:var(--isl-warning)]">unverified</span>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <form action={approveAccountAction} className="flex items-center gap-2">
                        <input type="hidden" name="user_id" value={u.id} />
                        <select name="driver_id" defaultValue="" className={input + " w-auto"}>
                          <option value="">Approve as driver (no link)</option>
                          {driverOptions.map((d) => (
                            <option key={d.id} value={d.id}>Link: {d.name}</option>
                          ))}
                        </select>
                        <button type="submit" className={btnGold}>Approve</button>
                      </form>
                      <form action={rejectAccountAction}>
                        <input type="hidden" name="user_id" value={u.id} />
                        <button type="submit" className={btnDanger}>Reject</button>
                      </form>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* ── Create account ── */}
          <div className={card}>
            <h2 className={h2}>Create account</h2>
            <form action={createAccountAction} className="mt-4 grid gap-3 sm:grid-cols-2">
              <input name="name" placeholder="Full name" required className={input} />
              <input name="email" type="email" placeholder="Email" required className={input} />
              <input name="password" type="password" placeholder="Temp password (min 8)" required minLength={8} className={input + " sm:col-span-2"} />
              <div className="flex flex-wrap gap-3 sm:col-span-2">
                {ALL_ROLES.map((r) => (
                  <label key={r} className="inline-flex items-center gap-1.5 text-sm text-ink">
                    <input type="checkbox" name="roles" value={r} defaultChecked={r === "driver"} />
                    {r}
                  </label>
                ))}
              </div>
              <button type="submit" className={btnGold + " sm:col-span-2 justify-self-start"}>Create (must change password)</button>
            </form>
          </div>

          {/* ── All accounts ── */}
          <div className={card + " overflow-x-auto"}>
            <h2 className={h2}>Accounts ({rest.length})</h2>
            <table className="mt-4 min-w-full text-start text-sm">
              <thead className="text-meta">
                <tr className="text-start">
                  <th className="py-2 pe-3 text-start">Account</th>
                  <th className="py-2 pe-3 text-start">Status</th>
                  <th className="py-2 pe-3 text-start">Roles</th>
                  <th className="py-2 pe-3 text-start">Driver link</th>
                  <th className="py-2 text-start">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rest.map((u) => (
                  <tr key={u.id} className="border-t border-[color:var(--isl-hairline)] align-top">
                    <td className="py-3 pe-3">
                      <div className="text-ink">{u.name}</div>
                      <div className="text-meta">{u.email}</div>
                    </td>
                    <td className="py-3 pe-3">
                      <div className="flex flex-col gap-1">
                        <StatusBadge status={u.status} />
                        {!u.isActive && <span className="text-[10px] uppercase text-[color:var(--isl-danger)]">suspended</span>}
                      </div>
                    </td>
                    <td className="py-3 pe-3">
                      <form action={setRolesAction} className="flex flex-col gap-1">
                        <input type="hidden" name="user_id" value={u.id} />
                        {ALL_ROLES.map((r) => (
                          <label key={r} className="inline-flex items-center gap-1.5 text-xs text-ink">
                            <input type="checkbox" name="roles" value={r} defaultChecked={u.roles.includes(r)} />
                            {r}
                          </label>
                        ))}
                        <button type="submit" className={btn + " mt-1 self-start"}>Save roles</button>
                      </form>
                    </td>
                    <td className="py-3 pe-3">
                      <form action={linkDriverAction} className="flex flex-col gap-1">
                        <input type="hidden" name="user_id" value={u.id} />
                        <select name="driver_id" defaultValue={u.driverId ?? ""} className={input + " w-auto"}>
                          <option value="">— none —</option>
                          {driverOptions.map((d) => (
                            <option key={d.id} value={d.id}>{d.name}</option>
                          ))}
                        </select>
                        <button type="submit" className={btn + " self-start"}>Save link</button>
                      </form>
                    </td>
                    <td className="py-3">
                      <div className="flex flex-col gap-2">
                        <form action={setActiveAction}>
                          <input type="hidden" name="user_id" value={u.id} />
                          <input type="hidden" name="active" value={u.isActive ? "false" : "true"} />
                          <button type="submit" className={btn}>{u.isActive ? "Suspend" : "Reactivate"}</button>
                        </form>
                        <form action={removeAccountAction}>
                          <input type="hidden" name="user_id" value={u.id} />
                          <button type="submit" className={btnDanger}>Remove</button>
                        </form>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </Section>
    </main>
  );
}
