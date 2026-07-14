"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import type { ActionResult, AdminErrorCode } from "../actions";

/**
 * Generic confirmation dialog for immediate, sensitive actions (suspend /
 * reactivate / remove). The action runs on confirm; failures stay visible in
 * the dialog rather than as a transient toast.
 */
export function ConfirmDialog({
  open,
  title,
  confirmLabel,
  tone = "primary",
  onConfirm,
  onClose,
  onDone,
  children,
}: {
  open: boolean;
  title: React.ReactNode;
  confirmLabel: string;
  tone?: "primary" | "danger";
  onConfirm: () => Promise<ActionResult>;
  onClose: () => void;
  onDone: () => void;
  children: React.ReactNode;
}) {
  const t = useTranslations("admin");
  const [error, setError] = useState<AdminErrorCode | null>(null);
  const [pending, startTransition] = useTransition();

  const confirm = () => {
    setError(null);
    startTransition(async () => {
      const res = await onConfirm();
      if (res.ok) onDone();
      else setError(res.error);
    });
  };

  return (
    <Dialog open={open} onClose={onClose} title={title} closeLabel={t("common.close")}>
      <div className="space-y-4">
        <div className="text-sm text-ink-2">{children}</div>

        {error && (
          <p
            role="alert"
            className="rounded-[2px] border border-[color:var(--isl-danger)] bg-[color:var(--isl-danger)]/10 px-3 py-2 text-sm text-[color:var(--isl-danger)]"
          >
            {t(`errors.${error}`)}
          </p>
        )}

        <div className="flex items-center justify-end gap-3 pt-1">
          <Button variant="ghost" size="sm" onClick={onClose} disabled={pending}>
            {t("common.cancel")}
          </Button>
          <Button
            variant={tone === "danger" ? "secondary" : "primary"}
            size="sm"
            onClick={confirm}
            loading={pending}
            className={
              tone === "danger"
                ? "border-[color:var(--isl-danger)] text-[color:var(--isl-danger)] hover:border-[color:var(--isl-danger)] hover:bg-[color:var(--isl-danger)]/10 hover:text-[color:var(--isl-danger)]"
                : undefined
            }
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
