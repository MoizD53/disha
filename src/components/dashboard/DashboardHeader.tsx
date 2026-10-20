"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ShieldCheck,
  Shield,
  Users,
  MapPin,
  LogOut,
  KeyRound,
  User,
  Menu,
  X,
} from "lucide-react";
import InstallPrompt from "@/components/pwa/InstallPrompt";
import ChangePasswordModal from "./ChangePasswordModal";

export type HeaderUser = {
  id: string;
  username: string;
  displayName: string;
  role: string;
  isSuperAdmin: boolean;
  permissions: string[];
  mustChangePassword: boolean;
};

export default function DashboardHeader({ initialUser }: { initialUser: HeaderUser }) {
  const pathname = usePathname();
  const [user, setUser] = useState<HeaderUser>(initialUser);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const canAccessAdmins = user.isSuperAdmin;
  const canAccessStaff = user.isSuperAdmin || user.permissions.includes("STAFF_MANAGEMENT");
  const canAccessMap = user.isSuperAdmin || user.permissions.includes("LIVE_MAP");

  const navItems = [
    {
      name: "Admin Management",
      href: "/dashboard/admins",
      icon: Shield,
      visible: canAccessAdmins,
      badge: "Super Admin",
    },
    {
      name: "Staff Management",
      href: "/dashboard/staff",
      icon: Users,
      visible: canAccessStaff,
      badge: null,
    },
    {
      name: "Live Map",
      href: "/dashboard/map",
      icon: MapPin,
      visible: canAccessMap,
      badge: "Tracking",
    },
  ].filter((item) => item.visible);

  return (
    <>
      <header className="h-16 flex items-center justify-between px-3 sm:px-6 bg-slate-950 border-b border-slate-800 flex-shrink-0 z-30 select-none">
        {/* Brand & Desktop Navigation */}
        <div className="flex items-center gap-4 lg:gap-8">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-sky-600 to-cyan-400 flex items-center justify-center shadow-lg shadow-sky-500/20 flex-shrink-0">
              <ShieldCheck size={22} className="text-white" />
            </div>
            <div className="flex flex-col">
              <div className="flex items-center gap-2">
                <span className="text-base font-black tracking-widest text-white">DISHA</span>
                <span className="hidden sm:inline-block text-[10px] font-semibold tracking-wide uppercase px-1.5 py-0.5 rounded bg-sky-950 text-sky-400 border border-sky-800/60">
                  {user.isSuperAdmin ? "SUPER ADMIN" : user.role.replace(/_/g, " ")}
                </span>
              </div>
              <span className="hidden md:inline-block text-[11px] font-medium text-slate-400 -mt-0.5">
                Command Center
              </span>
            </div>
          </div>

          {/* Desktop 3-Section Nav Switcher */}
          <nav className="hidden md:flex items-center gap-1.5 bg-slate-900/90 border border-slate-800/80 p-1 rounded-xl">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname.startsWith(item.href);

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    isActive
                      ? "bg-sky-600 text-white shadow-sm shadow-sky-600/30"
                      : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/60"
                  }`}
                >
                  <Icon size={14} />
                  <span>{item.name}</span>
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Right Section: Actions & Profile */}
        <div className="flex items-center gap-2 sm:gap-3">
          <InstallPrompt variant="header-button" />

          {/* User Profile Capsule */}
          <div className="hidden sm:flex items-center gap-2 text-xs text-slate-300 bg-slate-900 border border-slate-800 px-3 py-1.5 rounded-xl">
            <User size={13} className="text-sky-400" />
            <span className="font-semibold text-slate-200 max-w-[130px] truncate" title={user.displayName}>
              {user.displayName}
            </span>
          </div>

          {/* Change Password Button */}
          <button
            onClick={() => setShowPasswordModal(true)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-medium text-slate-400 hover:text-slate-200 hover:bg-slate-900 border border-transparent hover:border-slate-800 transition"
            title="Change your account password"
          >
            <KeyRound size={14} className="text-amber-400" />
            <span className="hidden lg:inline">Password</span>
          </button>

          {/* Logout Button */}
          <form action="/api/auth/logout" method="POST" suppressHydrationWarning>
            <button
              type="submit"
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-semibold text-rose-400 hover:text-rose-300 hover:bg-rose-950/30 border border-transparent hover:border-rose-900/50 transition cursor-pointer"
              title="Sign out of DISHA"
            >
              <LogOut size={14} />
              <span className="hidden sm:inline">Logout</span>
            </button>
          </form>

          {/* Mobile Menu Button */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-900"
            aria-label="Toggle navigation menu"
          >
            {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </header>

      {/* Mobile Dropdown Nav Menu */}
      {mobileMenuOpen && (
        <div className="md:hidden bg-slate-950/95 border-b border-slate-800 px-4 py-3 space-y-2 z-20">
          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 px-2 pb-1">
            Navigation Sections
          </div>
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname.startsWith(item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileMenuOpen(false)}
                className={`flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition ${
                  isActive
                    ? "bg-sky-600 text-white font-semibold"
                    : "text-slate-300 hover:bg-slate-900"
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Icon size={16} />
                  <span>{item.name}</span>
                </div>
                {item.badge && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-300">
                    {item.badge}
                  </span>
                )}
              </Link>
            );
          })}
        </div>
      )}

      {/* Password Change Modal (Manual trigger or Forced upon first login) */}
      <ChangePasswordModal
        isOpen={showPasswordModal || user.mustChangePassword}
        isForced={user.mustChangePassword}
        onClose={() => setShowPasswordModal(false)}
        onSuccess={() => {
          setUser((prev) => ({ ...prev, mustChangePassword: false }));
          setShowPasswordModal(false);
        }}
      />
    </>
  );
}
