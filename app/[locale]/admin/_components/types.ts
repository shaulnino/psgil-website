import type { AppRole } from "@/lib/accounts/types";
import type { DriverOption } from "./DriverLinkField";

/**
 * Client-safe projection of an Account for the admin UI. Deliberately omits
 * `passwordHash` and other server-only fields so they never reach the browser.
 */
export type AdminAccount = {
  id: string;
  name: string;
  email: string;
  roles: AppRole[];
  isActive: boolean;
  driverId: string | null;
};

export type { DriverOption };
