import type { Metadata } from "next";
import Section from "@/components/Section";
import LoadingLink from "@/components/LoadingLink";
import { requireAdmin } from "@/lib/auth/session";
import { listUsers } from "@/lib/accounts/repository";
import { ALL_ROLES } from "@/lib/accounts/types";
import { fetchCsv, parseCsv } from "@/lib/csv";
import { mapDrivers } from "@/lib/driversData";
import { GLOBAL_CSV_URLS } from "@/lib/seasonConfig";
import {
  createAccountAction,
  linkDriverAction,
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

  return (
    <main className="text-ink-2">
      <Section title="Account Administration" description="Create accounts, set roles, and link drivers." pageHeader>
        <div className="mx-auto max-w-5xl space-y-6">
          <LoadingLink
            href="/admin/attendance"
            className="inline-flex items-center rounded-[2px] bg-oxblood px-4 py-2.5 text-sm font-semibold uppercase tracking-[0.06em] text-bone transition-colors hover:bg-oxblood-deep"
          >
            Race attendance
          </LoadingLink>

          {error && (
            <p className="rounded-[2px] border border-[color:var(--isl-danger)] px-3 py-2 text-sm text-[color:var(--isl-danger)]">
              {error === "email-taken" ? "An account with that email already exists." : "Please check the form and try again."}
            </p>
          )}

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
            <h2 className={h2}>Accounts ({users.length})</h2>
            <table className="mt-4 min-w-full text-start text-sm">
              <thead className="text-meta">
                <tr className="text-start">
                  <th className="py-2 pe-3 text-start">Account</th>
                  <th className="py-2 pe-3 text-start">Roles</th>
                  <th className="py-2 pe-3 text-start">Driver link</th>
                  <th className="py-2 text-start">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id} className="border-t border-[color:var(--isl-hairline)] align-top">
                    <td className="py-3 pe-3">
                      <div className="text-ink">{u.name}</div>
                      <div className="text-meta">{u.email}</div>
                      {!u.isActive && <span className="text-[10px] uppercase text-[color:var(--isl-danger)]">suspended</span>}
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
