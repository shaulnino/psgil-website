import { requireStewardUserForPasswordChange } from "@/lib/stewards/auth";
import { redirect } from "next/navigation";
import { forcedChangePasswordAction } from "@/app/stewards/actions";
import ChangePasswordForm from "./ChangePasswordForm";

type SearchParams = Promise<{ error?: string }>;

export default async function ChangePasswordPage({ searchParams }: { searchParams: SearchParams }) {
  const user = await requireStewardUserForPasswordChange();
  // If they somehow land here without needing to change, send them home
  if (!user.mustChangePassword) redirect("/stewards");

  const params = await searchParams;
  const errorMsg =
    params.error === "mismatch"   ? "Passwords do not match. Please try again." :
    params.error === "too-short"  ? "Password must be at least 8 characters." :
    null;

  return (
    <main className="stewards-ui min-h-screen bg-bone px-6 py-16 text-ink flex items-center justify-center">
      <div className="w-full max-w-md space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <p className="font-isl-body text-[0.75rem] font-semibold uppercase tracking-[0.2em] text-brass-ink">ISL Steward System</p>
          <h1 className="font-display text-3xl font-bold tracking-[0.005em] leading-[1.05] text-ink">Set your password</h1>
          <p className="text-sm text-ink-2">
            Welcome, <span className="text-ink font-medium">{user.name}</span>.
            You must choose a personal password before continuing.
          </p>
        </div>

        {/* Card */}
        <div className="steward-panel rounded-[2px] p-6 space-y-5">
          {/* Info banner */}
          <div className="flex items-start gap-3 rounded-[2px] border border-brass bg-cream px-4 py-3">
            <span className="mt-0.5 text-brass-ink text-base">🔒</span>
            <p className="text-sm text-ink-2 leading-relaxed">
              Your account was set up with a temporary password. Choose a new password that only you know — admins will not be able to see it.
            </p>
          </div>

          {errorMsg && (
            <div className="rounded-[2px] border border-status-danger px-4 py-3 text-sm text-status-danger">
              {errorMsg}
            </div>
          )}

          <ChangePasswordForm action={forcedChangePasswordAction} requireCurrent={false} />
        </div>

        <p className="text-center text-xs text-faint">
          Password must be at least 8 characters. You can change it again later from your account settings.
        </p>
      </div>
    </main>
  );
}
