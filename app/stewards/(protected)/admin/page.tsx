import {
  createUserAction,
  removeUserAction,
  updateUserRoleAction,
} from "@/app/stewards/actions";
import EditUserPanel from "./EditUserPanel";
import FormActionButton from "@/app/stewards/components/FormActionButton";
import { requireRole } from "@/lib/stewards/auth";
import { listUsers } from "@/lib/stewards/repository";
import type { StewardRole } from "@/lib/stewards/types";
import { getTranslations } from "next-intl/server";
import PasswordField from "./PasswordField";

const inputCls =
  "w-full rounded-[2px] border border-[color:var(--isl-hairline)] bg-paper px-3 py-2 text-ink placeholder:text-faint focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--isl-oxblood)]";

const roles: StewardRole[] = ["member", "steward", "admin"];

type SearchParams = Promise<{ error?: string }>;

export default async function StewardAdminPage({ searchParams }: { searchParams: SearchParams }) {
  await requireRole(["admin"]);
  const t = await getTranslations("stewards");
  const users = await listUsers();
  const memberDrivers = users
    .filter((u) => u.roles.includes("member"))
    .map((u) => ({ id: u.id, name: u.name, email: u.email }));
  const params = await searchParams;
  return (
    <div className="space-y-6">
      <section className="steward-panel rounded-[2px] p-5">
        <h2 className="font-display text-2xl font-bold tracking-[0.005em] leading-[1.05] text-ink">{t("admin.title")}</h2>
        <p className="mt-1 text-sm text-ink-2">{t("admin.subtitle")}</p>
        {params.error && (
          <div className="mt-3 rounded-[2px] border border-status-danger px-3 py-2 text-sm text-status-danger">
            {t("admin.errorPrefix")} {params.error}
          </div>
        )}
      </section>

      <section className="steward-panel rounded-[2px] p-5">
        <h3 className="text-lg font-bold tracking-[0.005em] leading-[1.05] text-ink">{t("admin.addUser.heading")}</h3>
        <form action={createUserAction} className="mt-3 grid gap-3 md:grid-cols-2">
          <label className="block">
            <span className="mb-1 block text-sm text-ink-2">{t("admin.addUser.name")}</span>
            <input name="name" required className={inputCls} />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm text-ink-2">{t("admin.addUser.email")}</span>
            <input name="email" type="email" required className={inputCls} />
          </label>
          {/* Client component so the show/hide toggle works */}
          <div className="md:col-span-2">
            <PasswordField />
          </div>
          <div className="md:col-span-2">
            <span className="mb-1 block text-sm text-ink-2">{t("admin.addUser.roles")}</span>
            <div className="flex flex-wrap gap-3">
              {roles.map((role) => (
                <label key={role} className="inline-flex items-center gap-2 rounded-[2px] border border-[color:var(--isl-hairline)] px-3 py-1 text-sm text-ink">
                  <input type="checkbox" name="roles" value={role} defaultChecked={role === "member"} />
                  {t(`admin.role.${role}`)}
                </label>
              ))}
            </div>
          </div>
          <div className="md:col-span-2">
            <FormActionButton idleLabel={t("admin.addUser.createIdle")} loadingLabel={t("admin.addUser.createLoading")} className="rounded-[2px] bg-ink px-5 py-2.5 text-sm font-medium uppercase tracking-[0.08em] text-bone hover:opacity-90" spinnerClassName="border-bone/30 border-t-bone" />
          </div>
        </form>
      </section>

      <section className="steward-panel overflow-hidden rounded-[2px]">
        <div className="overflow-x-auto">
          <table className="steward-table min-w-full text-start text-sm">
            <thead className="text-meta">
              <tr>
                <th className="px-4 py-3 text-start">{t("admin.table.name")}</th>
                <th className="px-4 py-3 text-start">{t("admin.table.email")}</th>
                <th className="px-4 py-3 text-start">{t("admin.table.roles")}</th>
                <th className="px-4 py-3 text-start">{t("admin.table.updateRoles")}</th>
                <th className="px-4 py-3 text-start">{t("admin.table.edit")}</th>
                <th className="px-4 py-3 text-start">{t("admin.table.remove")}</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id} className="border-t border-[color:var(--isl-hairline)]">
                  <td className="px-4 py-3 text-ink">
                    <div className="flex flex-wrap items-center gap-1.5">
                      {user.name}
                      {user.mustChangePassword && (
                        <span className="rounded-[2px] border border-status-warning px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-status-warning">
                          {t("admin.badge.pwReset")}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-ink-2">{user.email}</td>
                  <td className="px-4 py-3 text-ink-2">{user.roles.map((role) => t(`admin.role.${role}`)).join(", ")}</td>
                  <td className="px-4 py-3">
                    <form action={updateUserRoleAction} className="flex flex-wrap items-center gap-2">
                      <input type="hidden" name="user_id" value={user.id} />
                      {roles.map((role) => (
                        <label key={role} className="inline-flex items-center gap-1 rounded-[2px] border border-[color:var(--isl-hairline)] px-2 py-0.5 text-xs text-ink">
                          <input type="checkbox" name="roles" value={role} defaultChecked={user.roles.includes(role)} />
                          {t(`admin.role.${role}`)}
                        </label>
                      ))}
                      <FormActionButton idleLabel={t("admin.updateRoles.saveIdle")} loadingLabel={t("admin.updateRoles.saveLoading")} className="rounded-[2px] border border-hairline-strong px-3 py-1 text-xs uppercase tracking-[0.08em] text-ink hover:border-ink" spinnerClassName="border-ink/30 border-t-ink" />
                    </form>
                  </td>
                  <td className="px-4 py-3">
                    <EditUserPanel user={{ id: user.id, name: user.name, email: user.email, mustChangePassword: user.mustChangePassword }} />
                  </td>
                  <td className="px-4 py-3">
                    <form action={removeUserAction}>
                      <input type="hidden" name="user_id" value={user.id} />
                      <FormActionButton idleLabel={t("admin.remove.idle")} loadingLabel={t("admin.remove.loading")} className="rounded-[2px] border border-status-danger px-3 py-1 text-xs uppercase tracking-[0.08em] text-status-danger hover:bg-cream" spinnerClassName="border-status-danger/30 border-t-status-danger" />
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
