"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ShieldCheck, Eye, EyeOff, Loader2, LockKeyhole, User } from "lucide-react";
import InstallPrompt from "@/components/pwa/InstallPrompt";

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleLogin(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: username.trim(), password }),
      });

      const result = await response.json();

      if (!response.ok) {
        setError(result.error || "Login failed. Please verify credentials.");
        return;
      }

      if (result.success && result.role !== "FIELD_PERSONNEL") {
        router.replace("/dashboard");
        router.refresh();
      } else if (result.success) {
        setError("Field personnel cannot access the command control room.");
        await fetch("/api/auth/logout", { method: "POST" });
      } else {
        setError("Unexpected response. Please try again.");
      }
    } catch {
      setError("Unable to connect to the DISHA server. Please check your network connection.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen flex flex-col items-center justify-center bg-slate-950 px-3 sm:px-6 py-6 sm:py-10 text-white relative pt-[max(1.5rem,env(safe-area-inset-top))] pb-[max(1.5rem,env(safe-area-inset-bottom))]">
      {/* Top bar with PWA install button */}
      <div className="absolute top-4 right-4 z-20">
        <InstallPrompt variant="header-button" />
      </div>

      <div className="w-full max-w-sm sm:max-w-md my-auto">
        <div className="mb-6 sm:mb-8 text-center">
          <div className="mx-auto mb-3.5 flex h-14 w-14 sm:h-16 sm:w-16 items-center justify-center rounded-2xl border border-sky-400/20 bg-sky-500/10 shadow-lg shadow-sky-500/10">
            <ShieldCheck className="h-8 w-8 sm:h-9 sm:w-9 text-sky-400" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-[0.25em] text-white">DISHA</h1>
        </div>

        <section className="rounded-2xl border border-slate-800 bg-slate-900/90 p-5 sm:p-8 shadow-2xl backdrop-blur-md">
          <div className="mb-6">
            <h2 className="text-lg sm:text-xl font-bold text-white">Admin Login</h2>
          </div>

          <form onSubmit={handleLogin} suppressHydrationWarning className="space-y-4 sm:space-y-5">
            <div>
              <label htmlFor="username" className="mb-1.5 block text-xs sm:text-sm font-semibold text-slate-300">
                Username
              </label>
              <div className="relative">
                <User className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500 pointer-events-none" />
                <input
                  id="username"
                  name="username"
                  type="text"
                  autoComplete="username"
                  required
                  autoFocus
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Enter username"
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 py-2.5 sm:py-3 pl-10 pr-4 text-xs sm:text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-sky-400 focus:ring-2 focus:ring-sky-400/20"
                />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="mb-1.5 block text-xs sm:text-sm font-semibold text-slate-300">
                Password
              </label>
              <div className="relative">
                <LockKeyhole className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500 pointer-events-none" />
                <input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter password"
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 py-2.5 sm:py-3 pl-10 pr-11 text-xs sm:text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-sky-400 focus:ring-2 focus:ring-sky-400/20"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-slate-400 hover:text-white transition-colors cursor-pointer"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {error && (
              <div role="alert" className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-3.5 py-2.5 text-xs text-rose-300 animate-in fade-in duration-150">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              suppressHydrationWarning
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-sky-500 hover:bg-sky-400 py-3 sm:py-3.5 font-bold text-xs sm:text-sm text-slate-950 transition-all shadow-lg shadow-sky-500/20 active:scale-98 disabled:cursor-not-allowed disabled:opacity-60 cursor-pointer"
            >
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              {loading ? "Verifying..." : "Sign In"}
            </button>
          </form>

          <p className="mt-5 text-center text-[11px] leading-4 text-slate-500">
            Authorized personnel only. Access and actions are audited.
          </p>
        </section>

        <p className="mt-5 text-center text-[11px] text-slate-600">
          DISHA · Tactical Safety &amp; Command Telemetry
        </p>
      </div>

      <InstallPrompt variant="floating-banner" />
    </main>
  );
}