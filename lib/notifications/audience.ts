/**
 * Audience resolution (PW-4) — turns a declarative recipient spec into a set of
 * account IDs, resolved securely on the server. Phase 0 ships the role/user/all
 * primitives; Phase 1 adds domain-scoped audiences (race-eligible drivers,
 * steward-case participants, affected driver) on top of these.
 */
import { listUsers } from "@/lib/accounts/repository";
import type { Account, AppRole } from "@/lib/accounts/types";

export type AudienceSpec =
  | { kind: "users"; userIds: string[] }
  /** CSV driver_ids → the accounts linked to them (attendance/schedule domains). */
  | { kind: "drivers"; driverIds: string[] }
  | { kind: "roles"; roles: AppRole[] }
  | { kind: "activeDrivers" }
  | { kind: "all" };

function isEligible(a: Account): boolean {
  return a.isActive;
}

export async function resolveAudience(spec: AudienceSpec): Promise<string[]> {
  if (spec.kind === "users") {
    // De-dupe; eligibility (active) is enforced against the account store.
    const wanted = new Set(spec.userIds.map((s) => s.trim()).filter(Boolean));
    if (wanted.size === 0) return [];
    const users = await listUsers();
    return users.filter((u) => wanted.has(u.id) && isEligible(u)).map((u) => u.id);
  }

  if (spec.kind === "drivers") {
    const wanted = new Set(spec.driverIds.map((s) => s.trim()).filter(Boolean));
    if (wanted.size === 0) return [];
    const users = await listUsers();
    return users
      .filter((u) => u.driverId && wanted.has(u.driverId) && isEligible(u))
      .map((u) => u.id);
  }

  const users = (await listUsers()).filter(isEligible);

  switch (spec.kind) {
    case "all":
      return users.map((u) => u.id);
    case "activeDrivers":
      return users.filter((u) => u.roles.includes("driver") && u.driverId).map((u) => u.id);
    case "roles": {
      const roles = new Set(spec.roles);
      return users.filter((u) => u.roles.some((r) => roles.has(r))).map((u) => u.id);
    }
  }
}
