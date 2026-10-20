import { prisma } from "@/lib/prisma";

export async function fetchStaffList() {
  const staffList = await prisma.personnel.findMany({
    include: {
      user: {
        select: {
          id: true,
          username: true,
          displayName: true,
          role: true,
          status: true,
          mustChangePassword: true,
          createdAt: true,
          updatedAt: true,
        },
      },
      devices: {
        where: { status: "ACTIVE" },
        take: 1,
        select: {
          id: true,
          deviceIdentifier: true,
          platform: true,
          status: true,
          lastSeenAt: true,
        },
      },
      dutySessions: {
        where: { endedAt: null },
        take: 1,
        select: {
          id: true,
          status: true,
          startedAt: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  return staffList.map((p) => ({
    id: p.id,
    userId: p.userId,
    username: p.user.username,
    name: p.name,
    personnelCode: p.personnelCode,
    designation: p.designation,
    unit: p.unit,
    phone: p.phone,
    active: p.active,
    status: p.user.status as "ACTIVE" | "INACTIVE",
    mustChangePassword: p.user.mustChangePassword,
    device: p.devices[0]
      ? {
          id: p.devices[0].id,
          deviceIdentifier: p.devices[0].deviceIdentifier,
          platform: p.devices[0].platform,
          status: p.devices[0].status,
          lastSeenAt: p.devices[0].lastSeenAt ? p.devices[0].lastSeenAt.toISOString() : null,
        }
      : null,
    activeDuty: p.dutySessions[0]
      ? {
          id: p.dutySessions[0].id,
          status: p.dutySessions[0].status,
          startedAt: p.dutySessions[0].startedAt.toISOString(),
        }
      : null,
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
  }));
}
