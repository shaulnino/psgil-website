import { loginStewardAction } from "@/app/stewards/actions";
import FormActionButton from "@/app/stewards/components/FormActionButton";

export default function StewardLoginPage() {
  return (
    <main className="stewards-ui min-h-[70vh] bg-[#0B0B0E] px-6 py-16 text-white">
      <div className="steward-panel mx-auto w-full max-w-md rounded-2xl p-6">
        <h1 className="font-display text-3xl font-semibold">Steward Login</h1>
        <p className="mt-2 text-sm text-white/70">Access is limited to steward-system users only.</p>
        <form action={loginStewardAction} className="mt-6 space-y-4">
          <label className="block">
            <span className="mb-1 block text-sm text-white/80">Email</span>
            <input type="email" name="email" required className="w-full rounded-lg border border-white/15 bg-black/30 px-3 py-2" />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm text-white/80">Password</span>
            <input type="password" name="password" required className="w-full rounded-lg border border-white/15 bg-black/30 px-3 py-2" />
          </label>
          <FormActionButton
            idleLabel="Sign in"
            loadingLabel="Signing in..."
            className="w-full justify-center rounded-full bg-[#7020B0] px-4 py-2.5 font-semibold text-white transition hover:bg-[#7d2ac5]"
          />
        </form>
      </div>
    </main>
  );
}
