/**
 * Unified platform account model (PW-2a).
 *
 * This is the single source of truth for user identity across the whole
 * platform — the steward portal, the public account/profile, driver attendance
 * (PW-3), and notifications (PW-4). It generalizes the former `StewardUser`:
 * `lib/stewards/types.ts` now aliases `StewardUser = Account` and
 * `StewardRole = AppRole`, so existing steward code keeps compiling unchanged.
 */
import { z } from "zod";

/** All roles a platform account can hold (flat, additive to the old set). */
export type AppRole =
  | "admin" // League Administrator — full control
  | "steward" // Steward — case/verdict/appeal workflow
  | "member" // legacy steward-portal participant (retained for existing cases)
  | "driver" // participant linked to a CSV driver_id; submits own attendance
  | "registered_user"; // signed-up account with no driver link (fan)

export const ALL_ROLES: AppRole[] = [
  "admin",
  "steward",
  "member",
  "driver",
  "registered_user",
];

/**
 * Account approval lifecycle (Identity v2). Distinct from `isActive`:
 *   - status  = where the account is in the join flow (admin approval).
 *   - isActive = whether an approved account is enabled or suspended.
 * New public registrations start `pending`; existing/admin-provisioned
 * accounts are `approved`.
 */
export type AccountStatus = "pending" | "approved" | "rejected";

export type Account = {
  id: string;
  name: string;
  email: string; // normalized lowercase; unique across accounts
  roles: AppRole[];
  passwordHash: string;
  isActive: boolean;
  /** Approval lifecycle (Identity v2). Grandfathered "approved" on migration. */
  status: AccountStatus;
  /** Forces the change-password flow on next login. */
  mustChangePassword: boolean;
  /** Whether the email has been verified (PW-2b). Grandfathered true on migration. */
  emailVerified: boolean;
  /** Link to a CSV driver_id (PW-2c/d). null = unlinked. */
  driverId: string | null;
  /** Preferred UI language. Absent = "en". */
  locale?: "en" | "he";
  createdAt: string;
  updatedAt: string;
};

/* ── Validation (zod, version-safe) ──────────────────────────────────────
   Email is validated with an explicit regex via .refine() so the schema is
   stable across zod 3/4 (which moved the string .email() helper). Trimming
   and lower-casing of email/name is done by the repository before storage. */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const roleSchema = z.enum([
  "admin",
  "steward",
  "member",
  "driver",
  "registered_user",
]);

export const emailSchema = z
  .string()
  .trim()
  .min(3)
  .max(200)
  .refine((v) => EMAIL_RE.test(v), { message: "A valid email is required." });

/** Input accepted by `createUser`. Kept shape-compatible with the old steward
 *  `NewUserInput` (name/email/passwordHash/roles/mustChangePassword) plus the
 *  new optional account fields. */
export const statusSchema = z.enum(["pending", "approved", "rejected"]);

export const newAccountSchema = z.object({
  name: z.string().trim().min(1, "Name is required.").max(120),
  email: emailSchema,
  passwordHash: z.string().min(1),
  roles: z.array(roleSchema),
  status: statusSchema.optional(),
  mustChangePassword: z.boolean().optional(),
  emailVerified: z.boolean().optional(),
  driverId: z.string().trim().min(1).nullable().optional(),
});

export type NewAccountInput = z.infer<typeof newAccountSchema>;
