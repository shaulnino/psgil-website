import { loginStewardAction } from "@/app/stewards/actions";
import FormActionButton from "@/app/stewards/components/FormActionButton";
import ForgotPasswordTip from "./ForgotPasswordTip";

type SearchParams = Promise<{ error?: string }>;

export default async function StewardLoginPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;

  return (
    <main className="stewards-ui min-h-[70vh] bg-[#0B0B0E] px-6 py-16 text-white">
      <div className="steward-panel mx-auto w-full max-w-md rounded-2xl p-6">
        <h1 className="font-display text-3xl font-semibold text-white">Steward Login</h1>
        <p className="mt-2 text-sm text-white/60">Access is limited to steward-system users only.</p>

        {params.error && (
          <div className="mt-4 rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-200">
            Incorrect email or password. Please try again.
          </div>
        )}

        <form action={loginStewardAction} className="mt-6 space-y-4">
          <label className="block">
            <span className="mb-1 block text-sm text-white/80">Email</span>
            <input
              type="email"
              name="email"
              required
              className="w-full rounded-lg border border-white/15 bg-black/30 px-3 py-2 text-white placeholder:text-white/30 focus:border-[#D4AF37]/50 focus:ring-1 focus:ring-[#D4AF37]/20 focus:outline-none transition"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm text-white/80">Password</span>
            <input
              type="password"
              name="password"
              required
              className="w-full rounded-lg border border-white/15 bg-black/30 px-3 py-2 text-white placeholder:text-white/30 focus:border-[#D4AF37]/50 focus:ring-1 focus:ring-[#D4AF37]/20 focus:outline-none transition"
            />
          </label>
          <FormActionButton
            idleLabel="Sign in"
            loadingLabel="Signing in..."
            className="w-full justify-center rounded-full bg-[#7020B0] px-4 py-2.5 font-semibold text-white transition hover:bg-[#7d2ac5]"
          />
        </form>

        <div className="mt-5 border-t border-white/8 pt-4 text-center">
          <ForgotPasswordTip />
        </div>
      </div>
    </main>
  );
}
