import { getSession } from "./session";
import { UserRole } from "../../../generated/prisma/enums";

export async function requireAuth() {
  const { user, session } = await getSession();
  
  if (!user || !session) {
    throw new Error("UNAUTHORIZED");
  }

  return { user, session };
}

export async function requireRole(allowedRoles: UserRole[]) {
  const { user, session } = await requireAuth();

  if (!allowedRoles.includes(user.role as UserRole)) {
    throw new Error("FORBIDDEN");
  }

  return { user, session };
}

// Helper to assert field personnel isolation
export async function requirePersonnelMatch(requestedPersonnelId: string) {
  const { user, session } = await requireAuth();
  
  if (user.role === UserRole.FIELD_PERSONNEL) {
    if (!user.personnel || user.personnel.id !== requestedPersonnelId) {
      throw new Error("FORBIDDEN");
    }
  }
  
  return { user, session };
}

export async function requireDeviceAuth(req: Request) {
  const authHeader = req.headers.get("authorization");
  if (authHeader && authHeader.startsWith("Bearer ")) {
    const token = authHeader.substring(7);
    const { verifyDeviceToken } = await import("./device_auth");
    const device = await verifyDeviceToken(token);
    if (device) {
      return { device, personnel: device.personnel, isBearer: true };
    }
    throw new Error("UNAUTHORIZED");
  }

  // Fallback to cookie auth for MVP backward compatibility
  const { user, session } = await requireAuth();
  if (!user.personnel) {
    throw new Error("FORBIDDEN");
  }

  // Find the primary active device for this personnel
  const { prisma } = await import("@/lib/prisma");
  const device = await prisma.device.findFirst({
    where: { personnelId: user.personnel.id, status: "ACTIVE" },
  });

  if (!device) {
    throw new Error("FORBIDDEN");
  }

  return { device, personnel: user.personnel, isBearer: false, session };
}

