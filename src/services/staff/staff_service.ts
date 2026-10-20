import { prisma } from "@/lib/prisma";
import { getHeartbeatTimeoutMs } from "@/lib/config/inactivity";

export async function fetchStaffList() {
  const [staffList, latestHeartbeats, latestLocations] = await Promise.all([
    prisma.personnel.findMany({
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
          orderBy: { registeredAt: "desc" },
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
    }),
    prisma.$queryRaw<any[]>`
      SELECT h.* FROM "Heartbeat" h
      INNER JOIN (
        SELECT "personnelId", MAX("recordedAt") as max_time
        FROM "Heartbeat"
        GROUP BY "personnelId"
      ) max_hb ON h."personnelId" = max_hb."personnelId" AND h."recordedAt" = max_hb.max_time
    `,
    prisma.$queryRaw<any[]>`
      SELECT l.* FROM "Location" l
      INNER JOIN (
        SELECT "personnelId", MAX("recordedAt") as max_time
        FROM "Location"
        GROUP BY "personnelId"
      ) max_loc ON l."personnelId" = max_loc."personnelId" AND l."recordedAt" = max_loc.max_time
    `,
  ]);

  const hbMap = new Map(latestHeartbeats.map((h) => [h.personnelId, h]));
  const locMap = new Map(latestLocations.map((l) => [l.personnelId, l]));
  const now = Date.now();
  const timeoutMs = getHeartbeatTimeoutMs();

  return staffList.map((p) => {
    const dev = p.devices[0] || null;
    const hb = hbMap.get(p.id);
    const loc = locMap.get(p.id);

    const hbTime = hb ? new Date(hb.recordedAt).getTime() : 0;
    const locTime = loc ? new Date(loc.recordedAt).getTime() : 0;
    const devSeenTime = dev?.lastSeenAt ? new Date(dev.lastSeenAt).getTime() : 0;
    const lastActiveTime = Math.max(hbTime, locTime, devSeenTime);

    let connectionStatus: "ONLINE" | "OFFLINE" = "OFFLINE";
    if (dev && dev.status === "ACTIVE" && lastActiveTime > 0) {
      const diff = now - lastActiveTime;
      if (diff <= timeoutMs) {
        connectionStatus = "ONLINE";
      }
    }

    return {
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
      connectionStatus,
      lastSeenAt: lastActiveTime > 0 ? new Date(lastActiveTime).toISOString() : null,
      mustChangePassword: p.user.mustChangePassword,
      device: dev
        ? {
            id: dev.id,
            deviceIdentifier: dev.deviceIdentifier,
            platform: dev.platform,
            status: dev.status,
            connectionStatus,
            lastSeenAt: lastActiveTime > 0 ? new Date(lastActiveTime).toISOString() : null,
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
    };
  });
}
