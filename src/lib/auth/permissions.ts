import { requireAuth } from "./authorization";
import type { AuthenticatedUser } from "./session";

export type Permission = "STAFF_MANAGEMENT" | "LIVE_MAP";

export const ALL_PERMISSIONS: Permission[] = ["STAFF_MANAGEMENT", "LIVE_MAP"];

export const PERMISSION_LABELS: Record<Permission, string> = {
  STAFF_MANAGEMENT: "Staff Management",
  LIVE_MAP: "Live Map & Tracking",
};

export function isSuperAdmin(user: { role: string } | null | undefined): boolean {
  if (!user) return false;
  const role = user.role?.toUpperCase();
  return role === "SP" || role === "SUPER_ADMIN";
}

export function getUserPermissions(
  user: { role: string; permissions?: string | null } | null | undefined
): Permission[] {
  if (!user) return [];
  if (isSuperAdmin(user)) {
    return ["STAFF_MANAGEMENT", "LIVE_MAP"];
  }
  if (!user.permissions) return [];
  try {
    const parsed = typeof user.permissions === "string" ? JSON.parse(user.permissions) : user.permissions;
    if (Array.isArray(parsed)) return parsed as Permission[];
  } catch {
    // ignore parsing failure
  }
  return [];
}

export function hasPermission(
  user: { role: string; permissions?: string | null } | null | undefined,
  permission: Permission
): boolean {
  if (!user) return false;
  if (isSuperAdmin(user)) return true;
  const perms = getUserPermissions(user);
  return perms.includes(permission);
}

export async function requireSuperAdmin(req?: Request): Promise<{ user: AuthenticatedUser; session: any }> {
  const { user, session } = await requireAuth(req);
  if (!isSuperAdmin(user)) {
    throw new Error("FORBIDDEN");
  }
  return { user, session };
}

export async function requirePermission(permission: Permission, req?: Request): Promise<{ user: AuthenticatedUser; session: any }> {
  const { user, session } = await requireAuth(req);
  if (!hasPermission(user, permission)) {
    throw new Error("FORBIDDEN");
  }
  return { user, session };
}
