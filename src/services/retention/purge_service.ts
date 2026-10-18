import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/auth/audit";

// The maximum retention limit allowed by policy
export const MAX_LOCATION_RETENTION_DAYS = 90;

export async function purgeOldTelemetry(daysToKeep: number = 90, actorId?: string) {
  // Enforce max retention policy (can't accidentally configure keeping data for 10 years, though a lower value is fine for testing)
  if (daysToKeep > MAX_LOCATION_RETENTION_DAYS) {
    daysToKeep = MAX_LOCATION_RETENTION_DAYS;
  }

  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

  await logAudit({
    actorId,
    action: "RETENTION_PURGE_STARTED",
    metadata: { cutoffDate: cutoffDate.toISOString(), daysToKeep }
  });

  try {
    let locationsPurged = 0;
    let eventsPurged = 0;
    let heartbeatsPurged = 0;

    // We do this in bounded batches conceptually to prevent table lock if it gets huge.
    // In libSQL, deleteMany works fine. In production Postgres, it should be chunked.
    // For MVP, we will simulate a batching delete loop.
    
    // Purge Locations
    while (true) {
       const batch = await prisma.location.findMany({
         where: { recordedAt: { lt: cutoffDate } },
         select: { id: true },
         take: 1000
       });
       if (batch.length === 0) break;
       const ids = batch.map(b => b.id);
       const res = await prisma.location.deleteMany({ where: { id: { in: ids } } });
       locationsPurged += res.count;
    }

    // Purge LocationEvents
    while (true) {
       const batch = await prisma.locationEvent.findMany({
         where: { recordedAt: { lt: cutoffDate } },
         select: { id: true },
         take: 1000
       });
       if (batch.length === 0) break;
       const ids = batch.map(b => b.id);
       const res = await prisma.locationEvent.deleteMany({ where: { id: { in: ids } } });
       eventsPurged += res.count;
    }

    // Purge Heartbeats
    while (true) {
       const batch = await prisma.heartbeat.findMany({
         where: { recordedAt: { lt: cutoffDate } },
         select: { id: true },
         take: 1000
       });
       if (batch.length === 0) break;
       const ids = batch.map(b => b.id);
       const res = await prisma.heartbeat.deleteMany({ where: { id: { in: ids } } });
       heartbeatsPurged += res.count;
    }

    await logAudit({
      actorId,
      action: "RETENTION_PURGE_COMPLETED",
      metadata: { locationsPurged, eventsPurged, heartbeatsPurged, cutoffDate: cutoffDate.toISOString() }
    });

    return { locationsPurged, eventsPurged, heartbeatsPurged };

  } catch (error: unknown) {
    await logAudit({
      actorId,
      action: "RETENTION_PURGE_FAILED",
      metadata: { error: (error as any)?.message, cutoffDate: cutoffDate.toISOString() }
    });
    throw error;
  }
}
