import { prisma } from "@/lib/prisma";
import {
  getHeartbeatTimeoutMs,
  getHeartbeatStaleMs,
  getLocationStaleMs,
} from "@/lib/config/inactivity";

// Short-lived in-memory cache to coalesce rapid concurrent requests (e.g. multiple open dashboard tabs)
let cachedOverview: { data: any[]; timestamp: number } | null = null;
const CACHE_TTL_MS = 2000; // 2 seconds

export function invalidateDashboardCache() {
  cachedOverview = null;
}

export async function getDashboardOverview(forceFresh: boolean = false) {
  const now = Date.now();
  const isTest =
    process.env.NODE_ENV === "test" ||
    process.env.DISABLE_CACHE === "1" ||
    process.argv.some((a) => a.includes("test"));

  if (!isTest && !forceFresh && cachedOverview && now - cachedOverview.timestamp < CACHE_TTL_MS) {
    return cachedOverview.data;
  }

  const LOC_STALE_THRESHOLD_MS = getLocationStaleMs(); // 7 mins default (5-min interval + 2-min buffer)
  const HB_TIMEOUT_MS = getHeartbeatTimeoutMs(); // 2 mins default
  const HB_STALE_THRESHOLD_MS = getHeartbeatStaleMs(); // 75 secs default

  // Single efficient query using indexed filters and selecting ONLY necessary columns
  const personnelList = await prisma.personnel.findMany({
    where: { active: true },
    select: {
      id: true,
      name: true,
      personnelCode: true,
      designation: true,
      unit: true,
      devices: {
        orderBy: { registeredAt: "desc" },
        take: 1,
        select: {
          id: true,
          deviceIdentifier: true,
          status: true,
          lastSeenAt: true,
          lastHeartbeatAt: true,
          batteryLevel: true,
          networkState: true,
          latestLatitude: true,
          latestLongitude: true,
          latestAccuracy: true,
          latestSource: true,
          latestLocationTime: true,
        },
      },
      dutySessions: {
        where: { endedAt: null },
        take: 1,
        select: { id: true, status: true, startedAt: true },
      },
      sosEvents: {
        where: { status: "ACTIVE" },
        take: 1,
        select: {
          id: true,
          alerts: {
            where: { status: { not: "RESOLVED" } },
            take: 1,
            select: { id: true },
          },
        },
      },
    },
  });

  // Check if any active device is missing latest fields (e.g. legacy test records)
  const legacyLocIds = personnelList
    .filter((p) => p.devices[0] && p.devices[0].latestLatitude == null)
    .map((p) => p.id);

  let legacyLocMap = new Map<string, any>();
  if (legacyLocIds.length > 0) {
    const rawLegacy = await prisma.location.findMany({
      where: { personnelId: { in: legacyLocIds } },
      orderBy: { recordedAt: "desc" },
      take: legacyLocIds.length * 2,
    });
    for (const l of rawLegacy) {
      if (!legacyLocMap.has(l.personnelId)) {
        legacyLocMap.set(l.personnelId, l);
      }
    }
  }

  // Also check if any recent location event exists (e.g. LOCATION_UNAVAILABLE)
  const activePersonnelIds = personnelList.map((p) => p.id);
  const recentEvents = await prisma.locationEvent.findMany({
    where: {
      personnelId: { in: activePersonnelIds },
      recordedAt: { gte: new Date(now - 15 * 60 * 1000) }, // last 15 mins only
    },
    orderBy: { recordedAt: "desc" },
    take: 50,
  });
  const evMap = new Map<string, any>();
  for (const ev of recentEvents) {
    if (!evMap.has(ev.personnelId)) {
      evMap.set(ev.personnelId, ev);
    }
  }

  const result = personnelList.map((p) => {
    const primaryDevice = p.devices[0] || null;
    const activeDuty = p.dutySessions[0] || null;
    const activeSOS = p.sosEvents[0] || null;
    const ev = evMap.get(p.id);

    const isDeviceSignedOut = !primaryDevice || primaryDevice.status === "INACTIVE";

    // Latest location: prioritize single latest-position record on Device, fallback to legacy
    let loc: any = null;
    if (primaryDevice && primaryDevice.latestLatitude != null) {
      loc = {
        latitude: primaryDevice.latestLatitude,
        longitude: primaryDevice.latestLongitude,
        accuracy: primaryDevice.latestAccuracy,
        source: primaryDevice.latestSource || "GPS",
        recordedAt: primaryDevice.latestLocationTime || primaryDevice.lastSeenAt,
        batteryLevel: primaryDevice.batteryLevel,
      };
    } else {
      loc = legacyLocMap.get(p.id) || null;
    }

    const locTime = loc?.recordedAt ? new Date(loc.recordedAt).getTime() : 0;
    const evTime = ev ? new Date(ev.recordedAt).getTime() : 0;

    // Latest heartbeat: from Device record
    const hbRecordedAt = primaryDevice?.lastHeartbeatAt || primaryDevice?.lastSeenAt || null;
    const hbTime = hbRecordedAt ? new Date(hbRecordedAt).getTime() : 0;

    // Device & Network Connection Status
    let deviceStatus = "ONLINE";
    let networkStatus = "ONLINE";
    let lastHeartbeat: Date | null = null;

    if (isDeviceSignedOut) {
      deviceStatus = "OFFLINE";
      networkStatus = "OFFLINE";
    } else if (hbRecordedAt) {
      lastHeartbeat = new Date(hbRecordedAt);
      const hbDiff = now - hbTime;
      if (hbDiff > HB_TIMEOUT_MS) {
        deviceStatus = "OFFLINE";
        networkStatus = "OFFLINE";
      } else if (hbDiff > HB_STALE_THRESHOLD_MS) {
        deviceStatus = "STALE";
        networkStatus = primaryDevice.networkState === "OFFLINE" ? "OFFLINE" : "ONLINE";
      } else {
        deviceStatus = "ONLINE";
        networkStatus = primaryDevice.networkState === "OFFLINE" ? "OFFLINE" : "ONLINE";
      }
    } else {
      deviceStatus = "OFFLINE";
      networkStatus = "OFFLINE";
    }

    // Explicit network lost or signout events still trump normal status if recent
    if (
      ev &&
      (ev.eventType === "NETWORK_LOST" || ev.eventType === "LOCATION_UNAVAILABLE") &&
      evTime > hbTime
    ) {
      networkStatus = "OFFLINE";
      deviceStatus = "OFFLINE";
    }

    // Last Contact Timestamp: reflects latest valid interaction
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
            batteryLevel: loc?.batteryLevel ?? primaryDevice.batteryLevel ?? null,
            status: deviceStatus,
          }
        : null,
      activeSOSId: activeSOS?.id ?? null,
      activeAlertId: activeSOS?.alerts?.[0]?.id ?? null,
    };
  });

  cachedOverview = {
    data: result,
    timestamp: now,
  };

  return result;
}
