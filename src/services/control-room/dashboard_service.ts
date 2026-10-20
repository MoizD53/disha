import { prisma } from "@/lib/prisma";
import {
  getHeartbeatTimeoutMs,
  getHeartbeatStaleMs,
  getLocationStaleMs,
} from "@/lib/config/inactivity";

export async function getDashboardOverview() {
  const [personnelList, latestLocations, latestEvents, latestHeartbeats, recentLocations] = await Promise.all([
    prisma.personnel.findMany({
      where: { active: true },
      include: {
        devices: {
          orderBy: { registeredAt: "desc" },
          take: 1,
        },
        dutySessions: {
          where: { endedAt: null },
          take: 1,
        },
        sosEvents: {
          where: { status: "ACTIVE" },
          take: 1,
          include: { alerts: { where: { status: { not: "RESOLVED" } } } },
        },
      },
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
    prisma.location.findMany({
      where: {
        recordedAt: { gte: new Date(Date.now() - 5 * 60 * 1000) },
      },
      orderBy: { recordedAt: "desc" },
      take: 300,
    }),
  ]);

  const locMap = new Map(latestLocations.map((l) => [l.personnelId, l]));
  const evMap = new Map(latestEvents.map((e) => [e.personnelId, e]));
  const hbMap = new Map(latestHeartbeats.map((h) => [h.personnelId, h]));

  const now = Date.now();
  const LOC_STALE_THRESHOLD_MS = getLocationStaleMs(); // 3 mins default
  const HB_TIMEOUT_MS = getHeartbeatTimeoutMs(); // 2 mins default
  const HB_STALE_THRESHOLD_MS = getHeartbeatStaleMs(); // 75 secs default

  // Prefer fresh verified fixes (accuracy <= 20m, age <= 90s) over coarse cellular bounces
  const verifiedRecentMap = new Map<string, any>();
  for (const rLoc of recentLocations) {
    if (!verifiedRecentMap.has(rLoc.personnelId) && Number(rLoc.accuracy) <= 20.0) {
      const ageMs = now - new Date(rLoc.recordedAt).getTime();
      if (ageMs <= 90_000) {
        verifiedRecentMap.set(rLoc.personnelId, rLoc);
      }
    }
  }

  return personnelList.map((p) => {
    const latestRaw = locMap.get(p.id);
    const verifiedRecent = verifiedRecentMap.get(p.id);
    const loc = verifiedRecent || latestRaw;
    const ev = evMap.get(p.id);
    const hb = hbMap.get(p.id);
    const activeDuty = p.dutySessions[0] || null;
    const activeSOS = p.sosEvents[0] || null;
    const primaryDevice = p.devices[0] || null;
    const isDeviceSignedOut = !primaryDevice || primaryDevice.status === "INACTIVE";

    const locTime = loc ? new Date(loc.recordedAt).getTime() : 0;
    const evTime = ev ? new Date(ev.recordedAt).getTime() : 0;
    const hbTime = hb ? new Date(hb.recordedAt).getTime() : 0;

    // Device & Network Connection Status
    let deviceStatus = "ONLINE";
    let networkStatus = "ONLINE";
    let lastHeartbeat: Date | null = null;

    if (isDeviceSignedOut) {
      deviceStatus = "OFFLINE";
      networkStatus = "OFFLINE";
    } else if (hb) {
      lastHeartbeat = new Date(hb.recordedAt);
      const hbDiff = now - lastHeartbeat.getTime();
      if (hbDiff > HB_TIMEOUT_MS) {
        deviceStatus = "OFFLINE";
        networkStatus = "OFFLINE";
      } else if (hbDiff > HB_STALE_THRESHOLD_MS) {
        deviceStatus = "STALE";
        networkStatus = hb.networkState === "OFFLINE" ? "OFFLINE" : "ONLINE";
      } else {
        deviceStatus = "ONLINE";
        networkStatus = hb.networkState === "OFFLINE" ? "OFFLINE" : "ONLINE";
      }
    } else {
      deviceStatus = "OFFLINE";
      networkStatus = "OFFLINE";
    }

    // Explicit network lost or signout events still trump normal status if recent
    if (
      ev &&
      (ev.eventType === "NETWORK_LOST" || ev.eventType === "LOCATION_UNAVAILABLE") &&
      evTime > (hb ? new Date(hb.recordedAt as any).getTime() : 0)
    ) {
      networkStatus = "OFFLINE";
      deviceStatus = "OFFLINE";
    }

    // Last Contact Timestamp: reflects latest valid interaction across telemetry, heartbeats, or events
    let lastSeen: Date | null = null;
    const latestActiveTime = Math.max(locTime, evTime, hbTime);
    if (latestActiveTime > 0) {
      lastSeen = new Date(latestActiveTime);
    }

    // Location State Logic (decoupled from duty status)
    let locationStatus = "NO DATA";
    if (!activeDuty) {
      locationStatus = "OFF DUTY";
    } else if (ev && ev.eventType === "LOCATION_UNAVAILABLE" && evTime >= locTime) {
      locationStatus = "LOCATION UNAVAILABLE";
    } else if (loc) {
      const timeDiff = now - locTime;
      // Mark location stale if location threshold is exceeded OR if device connection is offline
      if (timeDiff <= LOC_STALE_THRESHOLD_MS && deviceStatus === "ONLINE") {
        locationStatus = "TRACKING ACTIVE";
      } else {
        locationStatus = "STALE";
      }
    } else {
      locationStatus = "NO DATA";
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
      else if (accuracy <= 20.0) accuracyRating = "MODERATE"; // Verified target <= 20m
      else accuracyRating = "COARSE"; // > 20m is Low Accuracy
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
      location: loc
        ? {
            latitude: loc.latitude,
            longitude: loc.longitude,
            accuracy: loc.accuracy,
            accuracyRating,
            accuracyAgeSeconds,
            source: loc.source,
            recordedAt: new Date(loc.recordedAt as any),
          }
        : null,
      device: primaryDevice
        ? {
            identifier: primaryDevice.deviceIdentifier,
            batteryLevel: loc?.batteryLevel ?? hb?.batteryLevel ?? null,
            status: deviceStatus,
          }
        : null,
      activeSOSId: activeSOS?.id ?? null,
      activeAlertId: activeSOS?.alerts?.[0]?.id ?? null,
    };
  });
}
