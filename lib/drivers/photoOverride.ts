/**
 * Overrides CSV `photo_url` with an account-uploaded driver photo (PW-2e),
 * matched by `account.driverId → driver.driver_id`. The sheet value remains the
 * fallback for drivers who haven't uploaded one. Server-only (reads accounts).
 */
import type { Driver } from "@/lib/driversData";
import { listAccounts } from "@/lib/accounts/store";

export async function applyUploadedDriverPhotos(drivers: Driver[]): Promise<Driver[]> {
  const accounts = await listAccounts().catch(() => []);
  const byDriverId = new Map<string, string>();
  for (const a of accounts) {
    if (a.driverId && a.driverPhotoUrl) byDriverId.set(a.driverId, a.driverPhotoUrl);
  }
  if (byDriverId.size === 0) return drivers;
  return drivers.map((d) => {
    const url = d.driver_id ? byDriverId.get(d.driver_id) : undefined;
    return url ? { ...d, photo_url: url } : d;
  });
}
