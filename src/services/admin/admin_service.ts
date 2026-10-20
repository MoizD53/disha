import { prisma } from "@/lib/prisma";
import { UserRole } from "../../../generated/prisma/enums";

export async function fetchAdminUsersList() {
  const admins = await prisma.user.findMany({
    where: {
      role: { in: [UserRole.SP, UserRole.CONTROL_ROOM_OFFICER, UserRole.DYSP] },
    },
    select: {
      id: true,
      username: true,
      displayName: true,
      role: true,
      status: true,
      permissions: true,
      mustChangePassword: true,
      createdAt: true,
      updatedAt: true,
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return admins.map((admin) => {
    let perms: string[] = [];
    if (admin.role === UserRole.SP) {
      perms = ["STAFF_MANAGEMENT", "LIVE_MAP"];
    } else if (admin.permissions) {
      try {
        perms = JSON.parse(admin.permissions);
      } catch {
        perms = [];
      }
    }

    return {
      id: admin.id,
      username: admin.username,
      displayName: admin.displayName || admin.username,
      role: admin.role,
      status: admin.status as "ACTIVE" | "INACTIVE",
      permissions: perms,
      mustChangePassword: admin.mustChangePassword,
      isSuperAdmin: admin.role === UserRole.SP,
      createdAt: admin.createdAt.toISOString(),
      updatedAt: admin.updatedAt.toISOString(),
    };
  });
}
