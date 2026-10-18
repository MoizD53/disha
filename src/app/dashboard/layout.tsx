import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { LogOut, ShieldCheck, User } from "lucide-react";
import InstallPrompt from "@/components/pwa/InstallPrompt";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { session, user } = await getSession();
  if (!session || !user || user.role === "FIELD_PERSONNEL") {
    redirect("/login");
  }

  return (
    <div className="h-screen w-screen flex flex-col bg-slate-950 text-slate-100 overflow-hidden">
      {/* Top Navigation */}
      <header className="h-14 sm:h-16 flex items-center justify-between px-3 sm:px-6 bg-slate-950 border-b border-slate-800/80 flex-shrink-0 z-30 select-none">
        <div className="flex items-center gap-2 sm:gap-3.5">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-gradient-to-tr from-sky-600 to-cyan-400 flex items-center justify-center shadow-lg shadow-sky-500/20 flex-shrink-0">
              <ShieldCheck size={20} className="text-white" />
            </div>
            <div className="flex items-baseline">
              <span className="text-sm sm:text-base font-black tracking-widest text-white">DISHA</span>
              <span className="hidden md:inline-block ml-2 text-xs font-semibold text-slate-400 tracking-normal border-l border-slate-800 pl-2">
                Command Center
              </span>
            </div>
          </div>
          <span className="px-2 py-0.5 text-[10px] sm:text-xs font-bold bg-sky-950 text-sky-300 border border-sky-800/60 rounded-md uppercase">
            {user.role.replace(/_/g, " ")}
          </span>
        </div>

        <div className="flex items-center gap-2 sm:gap-4">
          <InstallPrompt variant="header-button" />

          <div className="hidden sm:flex items-center gap-2 text-xs text-slate-400 bg-slate-900 border border-slate-800 px-2.5 py-1.5 rounded-lg">
            <User size={13} className="text-sky-400" />
            <span className="font-semibold text-slate-200">{user.username}</span>
          </div>

          <form action="/api/auth/logout" method="POST" suppressHydrationWarning>
            <button
              type="submit"
              suppressHydrationWarning
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-rose-400 hover:text-rose-300 hover:bg-rose-950/30 transition-all cursor-pointer"
              title="Sign out of DISHA"
            >
              <LogOut size={15} />
              <span className="hidden sm:inline">Logout</span>
            </button>
          </form>
        </div>
      </header>

      {/* Main Workspace */}
      <main className="flex-1 flex overflow-hidden relative">
        {children}
      </main>

      {/* Floating PWA Install Banner */}
      <InstallPrompt variant="floating-banner" />
    </div>
  );
}
