import { prisma } from "@/lib/prisma";

export async function getDashboardOverview() {
  const [personnelList, latestLocations, latestEvents, latestHeartbeats] = await Promise.all([
    prisma.personnel.findMany({
      where: { active: true },
      include: {
        devices: {
          where: { status: 'ACTIVE' },
          take: 1
        },
        dutySessions: {
          where: { endedAt: null },
          take: 1
        },
        sosEvents: {
          where: { status: 'ACTIVE' },
          take: 1,
          include: { alerts: { where: { status: { not: 'RESOLVED' } } } }
        }
      }
    }),
    prisma.$queryRaw<any[]>`
      SELECT l.* FROM "Location" l
      INNER JOIN (
        SELECT "personnelId", MAX("recordedAt") as max_time
        FROM "Location"
        GROUP BY "personnelId"
      ) max_loc ON l."personnelId" = max_loc."personnelId" AND l."recordedAt" = max_loc.max_time
    `,
    prisma.$queryRaw<any[]>`
      SELECT le.* FROM "LocationEvent" le
      INNER JOIN (
        SELECT "personnelId", MAX("recordedAt") as max_time
        FROM "LocationEvent"
        GROUP BY "personnelId"
      ) max_ev ON le."personnelId" = max_ev."personnelId" AND le."recordedAt" = max_ev.max_time
    `,
    prisma.$queryRaw<any[]>`
      SELECT h.* FROM "Heartbeat" h
      INNER JOIN (
        SELECT "personnelId", MAX("recordedAt") as max_time
        FROM "Heartbeat"
        GROUP BY "personnelId"
      ) max_hb ON h."personnelId" = max_hb."personnelId" AND h."recordedAt" = max_hb.max_time
    `,
  ]);

  const locMap = new Map(latestLocations.map(l => [l.personnelId, l]));
  const evMap = new Map(latestEvents.map(e => [e.personnelId, e]));
  const hbMap = new Map(latestHeartbeats.map(h => [h.personnelId, h]));

  const now = Date.now();
  const LOC_STALE_THRESHOLD_MS = 1000 * 60 * 3; // 3 mins for active location
  const HB_STALE_THRESHOLD_MS = 1000 * 60 * 6; // 6 mins (missed 1 heartbeat)
  const HB_OFFLINE_THRESHOLD_MS = 1000 * 60 * 15; // 15 mins (missed multiple)

  return personnelList.map(p => {
    const loc = locMap.get(p.id);
    const ev = evMap.get(p.id);
    const hb = hbMap.get(p.id);
    const activeDuty = p.dutySessions[0] || null;
    const activeSOS = p.sosEvents[0] || null;

    // Location State Logic
    let locationStatus = "NO DATA";
    let lastSeen: Date | null = null;

    const locTime = loc ? new Date(loc.recordedAt).getTime() : 0;
    const evTime = ev ? new Date(ev.recordedAt).getTime() : 0;
    
    if (loc) lastSeen = new Date(loc.recordedAt);
    if (ev && evTime > locTime) lastSeen = new Date(ev.recordedAt);

    if (!activeDuty) {
      locationStatus = "OFF DUTY";
    } else if (ev && ev.eventType === 'LOCATION_UNAVAILABLE' && evTime >= locTime) {
      locationStatus = "LOCATION UNAVAILABLE";
    } else if (lastSeen) {
       const timeDiff = now - lastSeen.getTime();
       if (timeDiff <= LOC_STALE_THRESHOLD_MS) {
          locationStatus = "TRACKING ACTIVE";
       } else {
          locationStatus = "STALE";
       }
    } else {
       locationStatus = "NO DATA";
    }

    // Device Health Logic
    let deviceStatus = "ONLINE";
    let networkStatus = "ONLINE";
    let lastHeartbeat: Date | null = null;

    if (hb) {
       lastHeartbeat = new Date(hb.recordedAt);
       const hbDiff = now - lastHeartbeat.getTime();
       if (hbDiff > HB_OFFLINE_THRESHOLD_MS) {
          deviceStatus = "OFFLINE";
          networkStatus = "OFFLINE"; // Fallback implication if heartbeats stop
       } else if (hbDiff > HB_STALE_THRESHOLD_MS) {
          deviceStatus = "STALE";
       }
       if (hb.networkState === 'OFFLINE') networkStatus = "OFFLINE";
    } else {
       deviceStatus = "OFFLINE"; // No heartbeats ever received
       networkStatus = "UNKNOWN";
    }

    // Explicit network lost events still trump normal status if recent
    if (ev && ev.eventType === 'NETWORK_LOST' && evTime > (hb ? new Date(hb.recordedAt as any).getTime() : 0)) {
       networkStatus = "OFFLINE";
    }

    // Assess GPS accuracy rating and age
    const accuracy = loc?.accuracy != null ? Number(loc.accuracy) : null;
    let accuracyRating: "OPTIMAL" | "MODERATE" | "COARSE" | null = null;
    let accuracyAgeSeconds: number | null = null;

    if (loc) {
      const recTime = new Date(loc.recordedAt as any).getTime();
      accuracyAgeSeconds = Math.max(0, Math.floor((now - recTime) / 1000));
    }

    if (accuracy !== null) {
      if (accuracy <= 10.0) accuracyRating = "OPTIMAL";
      else if (accuracy <= 30.0) accuracyRating = "MODERATE";
      else accuracyRating = "COARSE";
    }

    return {
      id: p.id,
      name: p.name,
      personnelCode: p.personnelCode,
      designation: p.designation,
      unit: p.unit,
      dutyStatus: activeDuty ? "ON DUTY" : "OFF DUTY",
      locationStatus,
      deviceStatus,
      networkStatus,
      sosStatus: activeSOS ? "SOS ACTIVE" : "NONE",
      lastSeen,
      lastHeartbeat,
      location: loc ? {
        latitude: loc.latitude,
        longitude: loc.longitude,
        accuracy: loc.accuracy,
        accuracyRating,
        accuracyAgeSeconds,
        source: loc.source,
        recordedAt: new Date(loc.recordedAt as any)
      } : null,
      device: p.devices[0] ? {
        identifier: p.devices[0].deviceIdentifier,
        batteryLevel: loc?.batteryLevel ?? null
      } : null,
      activeSOSId: activeSOS?.id ?? null,
      activeAlertId: activeSOS?.alerts?.[0]?.id ?? null
    };
  });
}
