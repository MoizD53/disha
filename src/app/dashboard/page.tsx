import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { isSuperAdmin, hasPermission } from "@/lib/auth/permissions";
import { ShieldAlert, LogOut } from "lucide-react";

export default async function DashboardRootPage() {
  const { session, user } = await getSession();

  if (!session || !user) {
    redirect("/login");
  }

  if (isSuperAdmin(user)) {
    redirect("/dashboard/admins");
  }

  if (hasPermission(user, "STAFF_MANAGEMENT")) {
    redirect("/dashboard/staff");
  }

  if (hasPermission(user, "LIVE_MAP")) {
    redirect("/dashboard/map");
  }

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-6 text-center bg-slate-950">
      <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center mb-4">
        <ShieldAlert size={32} />
      </div>
      <h2 className="text-xl font-bold text-white mb-2">Access Permissions Required</h2>
      <p className="text-sm text-slate-400 max-w-md mb-6">
        Your account currently does not have any active functional permissions assigned (Staff Management or Live Map).
        Please contact your Super Admin to assign permissions.
      </p>
      <form action="/api/auth/logout" method="POST">
        <button
          type="submit"
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-rose-300 font-semibold text-xs transition-colors"
        >
          <LogOut size={14} /> Sign Out
        </button>
      </form>
    </div>
  );
}
