import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import Section from "@/components/Section";
import LoadingLink from "@/components/LoadingLink";
import { requireAdmin } from "@/lib/auth/session";
import { listUsers } from "@/lib/accounts/repository";
import { fetchCsv, parseCsv } from "@/lib/csv";
import { mapDrivers } from "@/lib/driversData";
import { GLOBAL_CSV_URLS } from "@/lib/seasonConfig";
import { AccountsAdmin } from "./_components/AccountsAdmin";
import type { AdminAccount, DriverOption } from "./_components/types";

export const metadata: Metadata = { title: "Account Administration | F1ISL" };
export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const admin = await requireAdmin("/admin");
  const t = await getTranslations("admin");
  const users = await listUsers();

  // Project to a client-safe shape (never send passwordHash to the browser).
  const accounts: AdminAccount[] = users.map((u) => ({
    id: u.id,
    name: u.name,
    email: u.email,
    roles: u.roles,
    isActive: u.isActive,
    driverId: u.driverId,
  }));

  // CSV driver roster for linking (best-effort; empty on fetch failure).
  const driverCsv = await fetchCsv(GLOBAL_CSV_URLS.drivers).catch(() => "");
  const drivers: DriverOption[] = (driverCsv ? mapDrivers(parseCsv(driverCsv)) : [])
    .filter((d) => d.driver_id)
    .map((d) => ({ id: d.driver_id, name: d.name, role: d.role }));

  return (
    <main className="text-ink-2">
      <Section title={t("title")} description={t("description")} pageHeader>
        <div className="mx-auto max-w-5xl space-y-6">
          <LoadingLink
            href="/admin/attendance"
            className="inline-flex items-center rounded-[2px] bg-oxblood px-4 py-2.5 text-sm font-semibold uppercase tracking-[0.06em] text-bone transition-colors hover:bg-oxblood-deep"
          >
            {t("attendance")}
          </LoadingLink>

          <AccountsAdmin accounts={accounts} drivers={drivers} currentUserId={admin.id} />
        </div>
      </Section>
    </main>
  );
}
