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
    <main className="stewards-ui min-h-screen bg-[#0B0B0E] px-6 py-16 text-white flex items-center justify-center">
      <div className="w-full max-w-md space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <p className="text-xs font-bold uppercase tracking-widest text-steward-gold/70">ISL Steward System</p>
          <h1 className="font-display text-3xl font-semibold">Set your password</h1>
          <p className="text-sm text-white/60">
            Welcome, <span className="text-white/90 font-medium">{user.name}</span>.
            You must choose a personal password before continuing.
          </p>
        </div>

        {/* Card */}
        <div className="steward-panel rounded-2xl p-6 space-y-5">
          {/* Info banner */}
          <div className="flex items-start gap-3 rounded-xl border border-steward-gold/25 bg-steward-gold/8 px-4 py-3">
            <span className="mt-0.5 text-steward-gold text-base">🔒</span>
            <p className="text-sm text-white/70 leading-relaxed">
              Your account was set up with a temporary password. Choose a new password that only you know — admins will not be able to see it.
            </p>
          </div>

          {errorMsg && (
            <div className="rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-200">
              {errorMsg}
            </div>
          )}

          <ChangePasswordForm action={forcedChangePasswordAction} requireCurrent={false} />
        </div>

        <p className="text-center text-xs text-white/30">
          Password must be at least 8 characters. You can change it again later from your account settings.
        </p>
      </div>
    </main>
  );
}
