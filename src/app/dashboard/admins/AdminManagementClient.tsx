"use client";

import { useState, useEffect, useMemo } from "react";
import {
  Shield,
  ShieldCheck,
  UserPlus,
  Search,
  RefreshCw,
  KeyRound,
  Edit2,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Loader2,
  Users,
  MapPin,
  Lock,
  Eye,
  EyeOff,
  X,
  AlertCircle,
} from "lucide-react";

export type AdminUser = {
  id: string;
  username: string;
  displayName: string;
  role: string;
  status: "ACTIVE" | "INACTIVE";
  permissions: string[];
  mustChangePassword: boolean;
  isSuperAdmin: boolean;
  createdAt: string;
  updatedAt: string;
};

export default function AdminManagementClient({ currentUserId }: { currentUserId: string }) {
  const [admins, setAdmins] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  // Modals state
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editingAdmin, setEditingAdmin] = useState<AdminUser | null>(null);
  const [resetPasswordAdmin, setResetPasswordAdmin] = useState<AdminUser | null>(null);

  // Notification Banner
  const [notification, setNotification] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const fetchAdmins = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/users");
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to load admin accounts");
      }
      const data = await res.json();
      setAdmins(data.admins || []);
    } catch (err: any) {
      setError(err.message || "Failed to fetch admin accounts.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAdmins();
  }, []);

  const showNotification = (message: string, type: "success" | "error" = "success") => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 4000);
  };

  // Filtered admins
  const filteredAdmins = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return admins;
    return admins.filter(
      (a) =>
        a.username.toLowerCase().includes(q) ||
        (a.displayName && a.displayName.toLowerCase().includes(q))
    );
  }, [admins, searchQuery]);

  // Statistics
  const stats = useMemo(() => {
    return {
      total: admins.length,
      active: admins.filter((a) => a.status === "ACTIVE").length,
      inactive: admins.filter((a) => a.status === "INACTIVE").length,
      withStaffPerm: admins.filter((a) => a.permissions.includes("STAFF_MANAGEMENT")).length,
      withMapPerm: admins.filter((a) => a.permissions.includes("LIVE_MAP")).length,
    };
  }, [admins]);

  // Toggle status quick action
  const handleToggleStatus = async (admin: AdminUser) => {
    if (admin.isSuperAdmin) {
      showNotification("Super Admin account cannot be deactivated.", "error");
      return;
    }

    const nextStatus = admin.status === "ACTIVE" ? "INACTIVE" : "ACTIVE";
    try {
      const res = await fetch(`/api/admin/users/${admin.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      });
      const data = await res.json();
      if (!res.ok) {
        showNotification(data.error || "Failed to update status", "error");
        return;
      }
      showNotification(`Admin ${admin.username} is now ${nextStatus.toLowerCase()}.`);
      fetchAdmins();
    } catch {
      showNotification("Network error updating admin status", "error");
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-950 overflow-y-auto custom-scrollbar p-4 sm:p-6 lg:p-8">
      {/* Top Banner Alert / Notification */}
      {notification && (
        <div
          className={`mb-4 p-3.5 rounded-xl border flex items-center justify-between text-xs font-semibold animate-in fade-in duration-200 ${
            notification.type === "success"
              ? "bg-emerald-950/40 border-emerald-800 text-emerald-300"
              : "bg-rose-950/40 border-rose-800 text-rose-300"
          }`}
        >
          <div className="flex items-center gap-2">
            {notification.type === "success" ? <CheckCircle size={16} /> : <AlertTriangle size={16} />}
            <span>{notification.message}</span>
          </div>
          <button onClick={() => setNotification(null)} className="text-slate-400 hover:text-white">
            <X size={14} />
          </button>
        </div>
      )}

      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-sky-500/10 border border-sky-500/20 text-sky-400">
              <Shield size={22} />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">Admin Management</h1>
              <p className="text-xs text-slate-400 mt-0.5">
                Super Admin control room: Provision and manage administrative accounts and functional permissions.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={fetchAdmins}
            disabled={loading}
            className="p-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-white text-xs font-semibold transition"
            title="Refresh list"
          >
            <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
          </button>

          <button
            onClick={() => setCreateModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold transition shadow-lg shadow-sky-600/20 cursor-pointer"
          >
            <UserPlus size={15} />
            <span>Create Admin</span>
          </button>
        </div>
      </div>

      {/* KPI Stats Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 flex flex-col justify-center">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Total Admins</span>
          <span className="text-2xl font-black text-white mt-1">{stats.total}</span>
        </div>

        <div className="p-4 rounded-xl bg-emerald-950/20 border border-emerald-900/40 flex flex-col justify-center">
          <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" /> Active Accounts
          </span>
          <span className="text-2xl font-black text-emerald-300 mt-1">{stats.active}</span>
        </div>

        <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 flex flex-col justify-center">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
            <Users size={13} className="text-sky-400" /> Staff Mgmt Perms
          </span>
          <span className="text-2xl font-black text-sky-300 mt-1">{stats.withStaffPerm}</span>
        </div>

        <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 flex flex-col justify-center">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
            <MapPin size={13} className="text-amber-400" /> Live Map Perms
          </span>
          <span className="text-2xl font-black text-amber-300 mt-1">{stats.withMapPerm}</span>
        </div>
      </div>

      {/* Table & Controls Section */}
      <div className="flex-1 flex flex-col bg-slate-900/70 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        {/* Search bar */}
        <div className="p-3 sm:p-4 border-b border-slate-800 flex items-center justify-between gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" size={15} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by username or display name..."
              className="w-full bg-slate-950 border border-slate-700/80 rounded-xl pl-9 pr-3.5 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-sky-500 transition"
            />
          </div>
          <div className="text-xs text-slate-400 font-medium">
            Showing <span className="font-bold text-white">{filteredAdmins.length}</span> of {admins.length}
          </div>
        </div>

        {/* Content View */}
        {error ? (
          <div className="p-8 text-center flex flex-col items-center justify-center">
            <AlertCircle size={36} className="text-rose-400 mb-2" />
            <p className="text-sm font-semibold text-white">{error}</p>
            <button
              onClick={fetchAdmins}
              className="mt-4 px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-xs font-semibold text-white"
            >
              Retry
            </button>
          </div>
        ) : loading && admins.length === 0 ? (
          <div className="p-16 flex flex-col items-center justify-center text-slate-400">
            <Loader2 size={32} className="animate-spin text-sky-400 mb-3" />
            <p className="text-xs font-medium">Loading administrative accounts...</p>
          </div>
        ) : filteredAdmins.length === 0 ? (
          <div className="p-16 text-center text-slate-400">
            <Shield size={36} className="mx-auto text-slate-600 mb-2" />
            <p className="text-sm font-bold text-white">No admin accounts found</p>
            <p className="text-xs text-slate-500 mt-1">
              {searchQuery ? "Try refining your search filter." : "Click '+ Create Admin' to provision a new admin."}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto custom-scrollbar flex-1">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950/80 text-slate-400 font-bold uppercase tracking-wider border-b border-slate-800">
                <tr>
                  <th className="py-3 px-4">Admin User</th>
                  <th className="py-3 px-4">Role</th>
                  <th className="py-3 px-4">Assigned Permissions</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Password Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filteredAdmins.map((admin) => (
                  <tr key={admin.id} className="hover:bg-slate-800/30 transition">
                    {/* User info */}
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-8 h-8 rounded-xl flex items-center justify-center font-bold text-xs uppercase flex-shrink-0 ${
                            admin.isSuperAdmin
                              ? "bg-amber-500/10 border border-amber-500/30 text-amber-300"
                              : "bg-sky-500/10 border border-sky-500/30 text-sky-300"
                          }`}
                        >
                          {admin.displayName.charAt(0) || admin.username.charAt(0)}
                        </div>
                        <div>
                          <div className="font-bold text-white flex items-center gap-1.5">
                            <span>{admin.displayName}</span>
                            {admin.id === currentUserId && (
                              <span className="text-[10px] bg-slate-800 text-slate-300 px-1.5 py-0.2 rounded font-normal">
                                (You)
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] font-mono text-slate-400">
                            @{admin.username}
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Role */}
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      {admin.isSuperAdmin ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[10px] font-bold bg-amber-500/10 text-amber-300 border border-amber-500/30 uppercase tracking-wide">
                          <ShieldCheck size={12} /> Super Admin
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[10px] font-bold bg-slate-800 text-slate-300 border border-slate-700 uppercase tracking-wide">
                          Officer
                        </span>
                      )}
                    </td>

                    {/* Permissions */}
                    <td className="py-3.5 px-4">
                      {admin.isSuperAdmin ? (
                        <span className="text-[11px] font-semibold text-amber-300/90 italic">
                          Full Access (Super Admin)
                        </span>
                      ) : admin.permissions.length === 0 ? (
                        <span className="text-[11px] text-slate-500 italic">No permissions assigned</span>
                      ) : (
                        <div className="flex flex-wrap gap-1.5">
                          {admin.permissions.includes("STAFF_MANAGEMENT") && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-indigo-950/60 text-indigo-300 border border-indigo-800/60">
                              <Users size={11} /> Staff Mgmt
                            </span>
                          )}
                          {admin.permissions.includes("LIVE_MAP") && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-emerald-950/60 text-emerald-300 border border-emerald-800/60">
                              <MapPin size={11} /> Live Map
                            </span>
                          )}
                        </div>
                      )}
                    </td>

                    {/* Status */}
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <span
                        className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide ${
                          admin.status === "ACTIVE"
                            ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                            : "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                        }`}
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            admin.status === "ACTIVE" ? "bg-emerald-400" : "bg-rose-400"
                          }`}
                        />
                        {admin.status}
                      </span>
                    </td>

                    {/* Password status */}
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      {admin.mustChangePassword ? (
                        <span className="text-[10px] font-bold text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-md">
                          Temporary (Change Required)
                        </span>
                      ) : (
                        <span className="text-[10px] font-semibold text-slate-400">
                          Active & Verified
                        </span>
                      )}
                    </td>

                    {/* Actions */}
                    <td className="py-3.5 px-4 text-right whitespace-nowrap">
                      <div className="inline-flex items-center gap-1.5">
                        {/* Edit Account */}
                        <button
                          onClick={() => setEditingAdmin(admin)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
                          title="Edit admin account and permissions"
                        >
                          <Edit2 size={14} />
                        </button>

                        {/* Reset Password */}
                        <button
                          onClick={() => setResetPasswordAdmin(admin)}
                          className="p-1.5 rounded-lg text-amber-400/80 hover:text-amber-300 hover:bg-slate-800 transition"
                          title="Reset admin password"
                        >
                          <KeyRound size={14} />
                        </button>

                        {/* Activate / Deactivate Toggle (Disabled for Super Admin) */}
                        {!admin.isSuperAdmin && (
                          <button
                            onClick={() => handleToggleStatus(admin)}
                            className={`p-1.5 rounded-lg transition ${
                              admin.status === "ACTIVE"
                                ? "text-rose-400 hover:bg-rose-950/40"
                                : "text-emerald-400 hover:bg-emerald-950/40"
                            }`}
                            title={admin.status === "ACTIVE" ? "Deactivate Account" : "Activate Account"}
                          >
                            {admin.status === "ACTIVE" ? <XCircle size={14} /> : <CheckCircle size={14} />}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* CREATE ADMIN MODAL */}
      {createModalOpen && (
        <CreateAdminModal
          isOpen={createModalOpen}
          onClose={() => setCreateModalOpen(false)}
          onSuccess={() => {
            setCreateModalOpen(false);
            showNotification("Admin account created successfully.");
            fetchAdmins();
          }}
        />
      )}

      {/* EDIT ADMIN MODAL */}
      {editingAdmin && (
        <EditAdminModal
          admin={editingAdmin}
          onClose={() => setEditingAdmin(null)}
          onSuccess={() => {
            setEditingAdmin(null);
            showNotification(`Updated admin ${editingAdmin.username} successfully.`);
            fetchAdmins();
          }}
        />
      )}

      {/* RESET PASSWORD MODAL */}
      {resetPasswordAdmin && (
        <ResetAdminPasswordModal
          admin={resetPasswordAdmin}
          onClose={() => setResetPasswordAdmin(null)}
          onSuccess={() => {
            setResetPasswordAdmin(null);
            showNotification(`Password for ${resetPasswordAdmin.username} reset successfully.`);
            fetchAdmins();
          }}
        />
      )}
    </div>
  );
}

// -------------------------------------------------------------
// SUB-MODALS: Create Admin
// -------------------------------------------------------------
function CreateAdminModal({
  isOpen,
  onClose,
  onSuccess,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [staffManagement, setStaffManagement] = useState(false);
  const [liveMap, setLiveMap] = useState(false);
  const [status, setStatus] = useState<"ACTIVE" | "INACTIVE">("ACTIVE");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const permissions: string[] = [];
    if (staffManagement) permissions.push("STAFF_MANAGEMENT");
    if (liveMap) permissions.push("LIVE_MAP");

    if (password.length < 8) {
      setError("Password must be at least 8 characters long.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: username.trim(),
          displayName: displayName.trim(),
          password,
          permissions,
          status,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to create admin user");
        return;
      }

      onSuccess();
    } catch {
      setError("Network error while creating admin user.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="relative w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition"
        >
          <X size={18} />
        </button>

        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-xl bg-sky-500/10 border border-sky-500/20 text-sky-400 flex items-center justify-center flex-shrink-0">
            <UserPlus size={20} />
          </div>
          <div>
            <h3 className="text-base font-bold text-white">Create Admin Account</h3>
            <p className="text-xs text-slate-400">
              Provision a new admin account with explicit permissions for staff management and map tracking.
            </p>
          </div>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center gap-2 text-xs text-rose-300">
            <AlertTriangle size={15} className="flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Display Name <span className="text-rose-400">*</span>
              </label>
              <input
                type="text"
                required
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="e.g. Insp. Ramesh Patil"
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-sky-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Unique Login ID <span className="text-rose-400">*</span>
              </label>
              <input
                type="text"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="e.g. ramesh_patil"
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-sky-500 font-mono"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Initial Password (minimum 8 characters) <span className="text-rose-400">*</span>
            </label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Set secure initial password"
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-sky-500 pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
              >
                {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
            <p className="text-[11px] text-slate-500 mt-1">
              The user will be required to change this password upon their first login.
            </p>
          </div>

          {/* Permissions Selection */}
          <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-2.5">
            <span className="block text-xs font-bold text-slate-300 uppercase tracking-wider">
              Functional Permissions
            </span>

            <label className="flex items-start gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={staffManagement}
                onChange={(e) => setStaffManagement(e.target.checked)}
                className="mt-0.5 rounded border-slate-700 bg-slate-900 text-sky-500 focus:ring-sky-500"
              />
              <div>
                <span className="text-xs font-semibold text-white block">A. Staff Management</span>
                <span className="text-[11px] text-slate-400 block">
                  Authorizes the admin to view, create, edit, deactivate, and reset passwords for field staff.
                </span>
              </div>
            </label>

            <label className="flex items-start gap-2.5 cursor-pointer pt-1">
              <input
                type="checkbox"
                checked={liveMap}
                onChange={(e) => setLiveMap(e.target.checked)}
                className="mt-0.5 rounded border-slate-700 bg-slate-900 text-sky-500 focus:ring-sky-500"
              />
              <div>
                <span className="text-xs font-semibold text-white block">B. Location Tracking & Live Map</span>
                <span className="text-[11px] text-slate-400 block">
                  Authorizes the admin to access real-time tactical map, telemetry logs, and emergency SOS alerts.
                </span>
              </div>
            </label>
          </div>

          <div className="flex items-center justify-between pt-2">
            <label className="flex items-center gap-2 text-xs font-medium text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                checked={status === "ACTIVE"}
                onChange={(e) => setStatus(e.target.checked ? "ACTIVE" : "INACTIVE")}
                className="rounded border-slate-700 bg-slate-900 text-emerald-500 focus:ring-emerald-500"
              />
              <span>Account Active immediately</span>
            </label>

            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-300 transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-xs font-semibold text-white transition shadow-lg shadow-sky-600/20"
              >
                {loading && <Loader2 size={13} className="animate-spin" />}
                Create Account
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

// -------------------------------------------------------------
// SUB-MODALS: Edit Admin
// -------------------------------------------------------------
function EditAdminModal({
  admin,
  onClose,
  onSuccess,
}: {
  admin: AdminUser;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [displayName, setDisplayName] = useState(admin.displayName || "");
  const [staffManagement, setStaffManagement] = useState(admin.permissions.includes("STAFF_MANAGEMENT"));
  const [liveMap, setLiveMap] = useState(admin.permissions.includes("LIVE_MAP"));
  const [status, setStatus] = useState<"ACTIVE" | "INACTIVE">(admin.status);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const permissions: string[] = [];
    if (staffManagement) permissions.push("STAFF_MANAGEMENT");
    if (liveMap) permissions.push("LIVE_MAP");

    setLoading(true);
    try {
      const res = await fetch(`/api/admin/users/${admin.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          displayName: displayName.trim(),
          permissions,
          status,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to update admin user");
        return;
      }

      onSuccess();
    } catch {
      setError("Network error while updating admin user.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="relative w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition"
        >
          <X size={18} />
        </button>

        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-xl bg-sky-500/10 border border-sky-500/20 text-sky-400 flex items-center justify-center flex-shrink-0">
            <Edit2 size={20} />
          </div>
          <div>
            <h3 className="text-base font-bold text-white">Edit Admin Account</h3>
            <p className="text-xs text-slate-400">
              Modifying settings for <span className="font-mono text-sky-300">@{admin.username}</span>
            </p>
          </div>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center gap-2 text-xs text-rose-300">
            <AlertTriangle size={15} className="flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Display Name
            </label>
            <input
              type="text"
              required
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-sky-500"
            />
          </div>

          {/* Permissions (Disabled if target is Super Admin) */}
          <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-2.5">
            <span className="block text-xs font-bold text-slate-300 uppercase tracking-wider">
              Functional Permissions
            </span>

            {admin.isSuperAdmin ? (
              <p className="text-xs text-amber-300/80 italic">
                Super Admin has full privileges across all sections automatically.
              </p>
            ) : (
              <>
                <label className="flex items-start gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={staffManagement}
                    onChange={(e) => setStaffManagement(e.target.checked)}
                    className="mt-0.5 rounded border-slate-700 bg-slate-900 text-sky-500 focus:ring-sky-500"
                  />
                  <div>
                    <span className="text-xs font-semibold text-white block">Staff Management</span>
                    <span className="text-[11px] text-slate-400 block">
                      Can view, add, edit, and reset field staff accounts.
                    </span>
                  </div>
                </label>

                <label className="flex items-start gap-2.5 cursor-pointer pt-1">
                  <input
                    type="checkbox"
                    checked={liveMap}
                    onChange={(e) => setLiveMap(e.target.checked)}
                    className="mt-0.5 rounded border-slate-700 bg-slate-900 text-sky-500 focus:ring-sky-500"
                  />
                  <div>
                    <span className="text-xs font-semibold text-white block">Location Tracking & Live Map</span>
                    <span className="text-[11px] text-slate-400 block">
                      Can view tactical map, live personnel markers, and telemetry.
                    </span>
                  </div>
                </label>
              </>
            )}
          </div>

          {/* Status (Disabled if Super Admin) */}
          {!admin.isSuperAdmin && (
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 text-xs font-medium text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={status === "ACTIVE"}
                  onChange={(e) => setStatus(e.target.checked ? "ACTIVE" : "INACTIVE")}
                  className="rounded border-slate-700 bg-slate-900 text-emerald-500 focus:ring-emerald-500"
                />
                <span>Account is Active</span>
              </label>
            </div>
          )}

          <div className="flex items-center justify-end gap-2.5 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-300 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-xs font-semibold text-white transition shadow-lg shadow-sky-600/20"
            >
              {loading && <Loader2 size={13} className="animate-spin" />}
              Save Changes
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// -------------------------------------------------------------
// SUB-MODALS: Reset Admin Password
// -------------------------------------------------------------
function ResetAdminPasswordModal({
  admin,
  onClose,
  onSuccess,
}: {
  admin: AdminUser;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [newPassword, setNewPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (newPassword.length < 8) {
      setError("Password must be at least 8 characters long.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`/api/admin/users/${admin.id}/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newPassword }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to reset password");
        return;
      }

      onSuccess();
    } catch {
      setError("Network error while resetting password.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="relative w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition"
        >
          <X size={18} />
        </button>

        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center flex-shrink-0">
            <KeyRound size={20} />
          </div>
          <div>
            <h3 className="text-base font-bold text-white">Reset Admin Password</h3>
            <p className="text-xs text-slate-400">
              Set a temporary password for <span className="font-mono text-amber-300">@{admin.username}</span>
            </p>
          </div>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center gap-2 text-xs text-rose-300">
            <AlertTriangle size={15} className="flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              New Password (minimum 8 characters)
            </label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                required
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Enter new temporary password"
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
              >
                {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
            <p className="text-[11px] text-slate-500 mt-1">
              The user will be required to change their password upon their next login.
            </p>
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-300 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-xs font-semibold text-slate-950 transition font-bold shadow-lg shadow-amber-600/20"
            >
              {loading && <Loader2 size={13} className="animate-spin" />}
              Reset Password
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
