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

/**
 * All roles a platform account can hold (flat).
 *
 * The legacy `member` role has been **retired**: `driver` carries all the
 * abilities `member` had, and any stored/legacy `member` is migrated to
 * `driver` on read (see `hydrate` in `lib/accounts/store.ts` and
 * `normalizeRoles` in `lib/stewards/auth.ts`). No new account gets `member`.
 */
export type AppRole =
  | "admin" // League Administrator — full control
  | "steward" // Steward — case/verdict/appeal workflow
  | "driver" // participant linked to a CSV driver_id; submits own attendance
  | "registered_user"; // signed-up account with no driver link (fan)

export const ALL_ROLES: AppRole[] = [
  "admin",
  "steward",
  "driver",
  "registered_user",
];

/**
 * True if these roles make the account a racing driver — i.e. a steward-case
 * participant (involved driver / complainant). Defined here (no deps) so both
 * `lib/stewards/*` and route components can import it without a circular import.
 */
export const isDriverRole = (roles: AppRole[]): boolean => roles.includes("driver");

export type Account = {
  id: string;
  name: string;
  email: string; // normalized lowercase; unique across accounts
  roles: AppRole[];
  passwordHash: string;
  /** Whether the account is enabled or suspended (admin-controlled). */
  isActive: boolean;
  /** Forces the change-password flow on next login. */
  mustChangePassword: boolean;
  /** Link to a CSV driver_id (PW-2c/d). null = unlinked. */
  driverId: string | null;
  /** Uploaded driver photo URL (PW-2e); overrides the CSV photo_url. null = none. */
  driverPhotoUrl: string | null;
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
 *  optional account fields. */
export const newAccountSchema = z.object({
  name: z.string().trim().min(1, "Name is required.").max(120),
  email: emailSchema,
  passwordHash: z.string().min(1),
  roles: z.array(roleSchema),
  mustChangePassword: z.boolean().optional(),
  driverId: z.string().trim().min(1).nullable().optional(),
});

export type NewAccountInput = z.infer<typeof newAccountSchema>;
