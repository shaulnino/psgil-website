"use client";

import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import { ALL_ROLES, type AppRole } from "@/lib/accounts/types";

const PRIVILEGED: AppRole[] = ["admin", "attendance_admin", "steward"];
const STANDARD: AppRole[] = ["driver", "registered_user"];

/**
 * Roles multi-select — selected roles shown as removable chips, editing via a
 * grouped checklist popover (privileged vs standard). Replaces the four always-
 * visible checkboxes. Keyboard-operable and RTL-safe.
 */
export function RolesField({
  value,
  onChange,
  disabledRoles = [],
}: {
  value: AppRole[];
  onChange: (roles: AppRole[]) => void;
  /** Roles that cannot be toggled (e.g. removing own/last admin), with reason via title. */
  disabledRoles?: { role: AppRole; reason: string }[];
}) {
  const t = useTranslations("admin");
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const toggle = (r: AppRole) => {
    onChange(value.includes(r) ? value.filter((x) => x !== r) : [...value, r]);
  };
  const disabledFor = (r: AppRole) => disabledRoles.find((d) => d.role === r);

  const ordered = ALL_ROLES.filter((r) => value.includes(r));

  const renderGroup = (group: AppRole[], heading: string) => (
    <div className="py-1">
      <p className="px-3 pb-1 font-isl-body text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-meta">
        {heading}
      </p>
      {group.map((r) => {
        const checked = value.includes(r);
        const blocked = disabledFor(r);
        return (
          <button
            key={r}
            type="button"
            role="menuitemcheckbox"
            aria-checked={checked}
            disabled={!!blocked}
            title={blocked?.reason}
            onClick={() => toggle(r)}
            className={`flex w-full items-center gap-2 px-3 py-1.5 text-start font-isl-body text-sm transition-colors ${
              blocked
                ? "cursor-not-allowed text-faint"
                : "text-ink-2 hover:bg-cream hover:text-ink"
            }`}
          >
            <span
              className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-[2px] border ${
                checked
                  ? "border-oxblood bg-oxblood text-bone"
                  : "border-[color:var(--isl-hairline-strong)]"
              }`}
              aria-hidden
            >
              {checked && <Check className="h-3 w-3" strokeWidth={3} />}
            </span>
            {t(`roles.${r}`)}
          </button>
        );
      })}
    </div>
  );

  return (
    <div ref={ref} className="relative">
      <div className="flex flex-wrap items-center gap-1.5">
        {ordered.length === 0 && (
          <span className="text-sm text-faint">{t("drawer.noRoles")}</span>
        )}
        {ordered.map((r) => {
          const blocked = disabledFor(r);
          return (
            <Badge
              key={r}
              variant={PRIVILEGED.includes(r) ? "brass" : "ink"}
              className="gap-1 normal-case tracking-normal"
            >
              {t(`roles.${r}`)}
              {!blocked && (
                <button
                  type="button"
                  onClick={() => toggle(r)}
                  aria-label={t("drawer.removeRole", { role: t(`roles.${r}`) })}
                  className="-me-0.5 rounded-[1px] text-current/70 hover:text-current focus-visible:outline focus-visible:outline-1 focus-visible:outline-[color:var(--isl-oxblood)]"
                >
                  <X className="h-3 w-3" strokeWidth={2.5} aria-hidden />
                </button>
              )}
            </Badge>
          );
        })}
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-haspopup="menu"
          aria-expanded={open}
          className="inline-flex items-center gap-1 rounded-[2px] border border-[color:var(--isl-hairline-strong)] px-2 py-0.5 text-xs font-semibold uppercase tracking-[0.06em] text-meta transition-colors hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--isl-oxblood)]"
        >
          {t("drawer.editRoles")}
          <ChevronDown className={`h-3 w-3 transition-transform ${open ? "rotate-180" : ""}`} aria-hidden />
        </button>
      </div>
      {open && (
        <div
          role="menu"
          className="absolute z-40 mt-1 min-w-[13rem] rounded-[2px] border border-[color:var(--isl-hairline)] bg-paper py-1 shadow-[0_8px_24px_rgba(0,0,0,0.5)]"
        >
          {renderGroup(PRIVILEGED, t("roles.groupPrivileged"))}
          <div className="my-1 border-t border-[color:var(--isl-hairline)]" />
          {renderGroup(STANDARD, t("roles.groupStandard"))}
        </div>
      )}
    </div>
  );
}
