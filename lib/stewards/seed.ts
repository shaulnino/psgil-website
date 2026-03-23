import { hashPassword } from "@/lib/stewards/crypto";
import type { StewardStore } from "@/lib/stewards/types";

export function buildDefaultStore(): StewardStore {
  const now = new Date().toISOString();
  return {
    users: [
      {
        id: "u_admin",
        name: "PSGiL Admin",
        email: "admin@psgil.local",
        roles: ["member", "steward", "admin"],
        passwordHash: hashPassword("change-me-admin"),
        isActive: true,
        mustChangePassword: true,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: "u_steward",
        name: "Chief Steward",
        email: "steward@psgil.local",
        roles: ["member", "steward"],
        passwordHash: hashPassword("change-me-steward"),
        isActive: true,
        mustChangePassword: true,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: "u_member",
        name: "League Member",
        email: "member@psgil.local",
        roles: ["member"],
        passwordHash: hashPassword("change-me-member"),
        isActive: true,
        mustChangePassword: true,
        createdAt: now,
        updatedAt: now,
      },
    ],
    cases: [],
    responses: [],
    internalComments: [],
    verdicts: [],
    driverVerdicts: [],
    penaltiesToServe: [],
    appeals: [],
    appealVerdicts: [],
    appealDriverVerdicts: [],
    appealInternalComments: [],
  };
}
