import Image from "next/image";
import { getTranslations } from "next-intl/server";
import { CheckCircle2, Ban, ShieldCheck, Settings, CalendarCheck } from "lucide-react";
import LoadingLink from "@/components/LoadingLink";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/ui/status-badge";
import { logoutAction } from "@/lib/auth/actions";
import type { AppRole } from "@/lib/accounts/types";

const PRIVILEGED: AppRole[] = ["admin", "attendance_admin", "steward"];

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  return (parts[0][0] + (parts[1]?.[0] ?? "")).toUpperCase();
}

/**
 * Compact account summary header (redesign). Replaces the old full-width "Go to"
 * panel + large profile panel: one identity strip with avatar, name, email,
 * role badges, status, linked driver/team, and permission-gated shortcuts +
 * sign-out. English values (email, driver/team names) are direction-isolated so
 * they read correctly in Hebrew RTL.
 */
export default async function AccountHeader({
  name,
  email,
  isActive,
  roles,
  driverLinked,
  driverName,
  teamName,
  teamLogo,
  avatarUrl,
  canSteward,
  canAdmin,
  canAttendance,
}: {
  name: string;
  email: string;
  isActive: boolean;
  roles: AppRole[];
  driverLinked: boolean;
  driverName: string | null;
  teamName: string | null;
  teamLogo: string | null;
  avatarUrl: string | null;
  canSteward: boolean;
  canAdmin: boolean;
  canAttendance: boolean;
}) {
  const t = await getTranslations("account.account");

  const shortcut =
    "inline-flex items-center gap-1.5 rounded-[2px] border border-oxblood px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.06em] text-oxblood transition-colors hover:bg-oxblood/10";

  return (
    <div className="rounded-[2px] border border-[color:var(--isl-hairline)] bg-cream p-5 md:p-6">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-[2px] border border-[color:var(--isl-hairline-strong)] bg-sink">
            {avatarUrl ? (
              <Image src={avatarUrl} alt="" fill sizes="64px" className="object-cover" unoptimized />
            ) : (
              <span className="flex h-full w-full items-center justify-center font-isl-display text-xl font-bold text-meta">
                {initials(name)}
              </span>
            )}
          </div>
          <div className="min-w-0">
            <h2 className="font-isl-display text-xl font-bold leading-tight text-ink">
              <bdi>{name}</bdi>
            </h2>
            <p className="truncate text-sm text-meta" dir="ltr" style={{ textAlign: "start" }}>
              {email}
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              {roles.map((r) => (
                <Badge
                  key={r}
                  variant={PRIVILEGED.includes(r) ? "brass" : "ink"}
                  className="normal-case tracking-normal"
                >
                  {t(`roleLabels.${r}`)}
                </Badge>
              ))}
              <StatusBadge icon={isActive ? CheckCircle2 : Ban} tone={isActive ? "success" : "danger"}>
                {isActive ? t("statusActive") : t("statusSuspended")}
              </StatusBadge>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:justify-end">
          {canSteward && (
            <LoadingLink href="/stewards" className={shortcut}>
              <ShieldCheck className="h-3.5 w-3.5" aria-hidden />
              {t("stewardModule")}
            </LoadingLink>
          )}
          {canAdmin && (
            <LoadingLink href="/admin" className={shortcut}>
              <Settings className="h-3.5 w-3.5" aria-hidden />
              {t("adminModule")}
            </LoadingLink>
          )}
          {canAttendance && (
            <LoadingLink href="/admin/attendance" className={shortcut}>
              <CalendarCheck className="h-3.5 w-3.5" aria-hidden />
              {t("attendanceModule")}
            </LoadingLink>
          )}
          <form action={logoutAction}>
            <button
              type="submit"
              className="rounded-[2px] px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.06em] text-meta transition-colors hover:text-ink"
            >
              {t("signOut")}
            </button>
          </form>
        </div>
      </div>

      {/* Linked-driver line */}
      <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-[color:var(--isl-hairline)] pt-3 text-sm">
        <span className="text-meta">{t("driverLink")}:</span>
        {driverLinked ? (
          <span className="flex items-center gap-2 text-ink">
            {teamLogo && (
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-[2px] bg-white p-0.5">
                <Image
                  src={teamLogo}
                  alt=""
                  width={20}
                  height={20}
                  className="h-full w-full object-contain"
                  unoptimized
                />
              </span>
            )}
            <bdi className="text-ink">{driverName}</bdi>
            {teamName && (
              <span className="text-meta">
                · <bdi>{teamName}</bdi>
              </span>
            )}
          </span>
        ) : (
          <span className="text-faint">{t("notLinkedShort")}</span>
        )}
      </div>
    </div>
  );
}
