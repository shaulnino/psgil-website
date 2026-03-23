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
import PasswordField from "./PasswordField";

const roles: StewardRole[] = ["member", "steward", "admin"];

type SearchParams = Promise<{ error?: string }>;

export default async function StewardAdminPage({ searchParams }: { searchParams: SearchParams }) {
  await requireRole(["admin"]);
  const users = await listUsers();
  const memberDrivers = users
    .filter((u) => u.roles.includes("member"))
    .map((u) => ({ id: u.id, name: u.name, email: u.email }));
  const params = await searchParams;
  return (
    <div className="space-y-6">
      <section className="steward-panel rounded-2xl p-5">
        <h2 className="font-display text-2xl font-semibold">Steward Admin</h2>
        <p className="mt-1 text-sm text-white/70">Manage users, multi-role access, and steward-module permissions.</p>
        {params.error && (
          <div className="mt-3 rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-100">
            Error: {params.error}
          </div>
        )}
      </section>

      <section className="steward-panel rounded-2xl p-5">
        <h3 className="text-lg font-semibold">Add user</h3>
        <form action={createUserAction} className="mt-3 grid gap-3 md:grid-cols-2">
          <label className="block">
            <span className="mb-1 block text-sm text-white/80">Name</span>
            <input name="name" required className="w-full rounded-lg border border-white/15 bg-black/30 px-3 py-2" />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm text-white/80">Email</span>
            <input name="email" type="email" required className="w-full rounded-lg border border-white/15 bg-black/30 px-3 py-2" />
          </label>
          {/* Client component so the show/hide toggle works */}
          <div className="md:col-span-2">
            <PasswordField />
          </div>
          <div className="md:col-span-2">
            <span className="mb-1 block text-sm text-white/80">Roles</span>
            <div className="flex flex-wrap gap-3">
              {roles.map((role) => (
                <label key={role} className="inline-flex items-center gap-2 rounded-full border border-white/20 px-3 py-1 text-sm">
                  <input type="checkbox" name="roles" value={role} defaultChecked={role === "member"} />
                  {role}
                </label>
              ))}
            </div>
          </div>
          <div className="md:col-span-2">
            <FormActionButton idleLabel="Create User" loadingLabel="Creating..." className="rounded-full bg-[#7020B0] px-5 py-2.5 text-sm font-semibold" />
          </div>
        </form>
      </section>

      <section className="steward-panel overflow-hidden rounded-2xl">
        <div className="overflow-x-auto">
          <table className="steward-table min-w-full text-left text-sm">
            <thead className="bg-white/5 text-white/80">
              <tr>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Roles</th>
                <th className="px-4 py-3">Update roles</th>
                <th className="px-4 py-3">Edit</th>
                <th className="px-4 py-3">Remove</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id} className="border-t border-white/10">
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap items-center gap-1.5">
                      {user.name}
                      {user.mustChangePassword && (
                        <span className="rounded-full bg-amber-500/15 border border-amber-500/35 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-amber-300/80">
                          pw reset
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">{user.email}</td>
                  <td className="px-4 py-3">{user.roles.join(", ")}</td>
                  <td className="px-4 py-3">
                    <form action={updateUserRoleAction} className="flex flex-wrap items-center gap-2">
                      <input type="hidden" name="user_id" value={user.id} />
                      {roles.map((role) => (
                        <label key={role} className="inline-flex items-center gap-1 rounded-full border border-white/15 px-2 py-0.5 text-xs">
                          <input type="checkbox" name="roles" value={role} defaultChecked={user.roles.includes(role)} />
                          {role}
                        </label>
                      ))}
                      <FormActionButton idleLabel="Save" loadingLabel="Saving..." className="rounded-full border border-white/20 px-3 py-1 text-xs" />
                    </form>
                  </td>
                  <td className="px-4 py-3">
                    <EditUserPanel user={{ id: user.id, name: user.name, email: user.email, mustChangePassword: user.mustChangePassword }} />
                  </td>
                  <td className="px-4 py-3">
                    <form action={removeUserAction}>
                      <input type="hidden" name="user_id" value={user.id} />
                      <FormActionButton idleLabel="Remove" loadingLabel="Removing..." className="rounded-full border border-red-500/50 px-3 py-1 text-xs text-red-200 hover:bg-red-500/15" />
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
