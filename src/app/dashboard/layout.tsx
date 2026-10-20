import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { isSuperAdmin, getUserPermissions } from "@/lib/auth/permissions";
import DashboardHeader from "@/components/dashboard/DashboardHeader";
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

  const headerUser = {
    id: user.id,
    username: user.username,
    displayName: user.displayName || user.username,
    role: user.role,
    isSuperAdmin: isSuperAdmin(user),
    permissions: getUserPermissions(user),
    mustChangePassword: user.mustChangePassword,
  };

  return (
    <div className="h-screen w-screen flex flex-col bg-slate-950 text-slate-100 overflow-hidden">
      {/* Top Navigation Bar */}
      <DashboardHeader initialUser={headerUser} />

      {/* Main Workspace for active section */}
      <main className="flex-1 flex overflow-hidden relative">
        {children}
      </main>

      {/* Floating PWA Install Banner */}
      <InstallPrompt variant="floating-banner" />
    </div>
  );
}
