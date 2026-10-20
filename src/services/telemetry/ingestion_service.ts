import { prisma } from "@/lib/prisma";
import { DutyStatus, DeviceStatus, UserStatus } from "../../../generated/prisma/enums";
import { SingleLocationInput, LocationEventInput, BatchIngestionInput } from "@/domain/telemetry/validation";
import { getActiveDutySession } from "@/services/duty/duty_service";
import { logAudit } from "@/lib/auth/audit";

export class TelemetryError extends Error {
  constructor(message: string, public code: string) {
    super(message);
    this.name = "TelemetryError";
  }
}

export async function validateDeviceAuthorization(personnelId: string) {
  const personnel = await prisma.personnel.findUnique({
    where: { id: personnelId },
    include: { user: true }
  });

  if (!personnel) {
    throw new TelemetryError("Personnel not found.", "NOT_FOUND");
  }

  if (!personnel.active) {
    throw new TelemetryError("Personnel is inactive.", "PERSONNEL_INACTIVE");
  }

  if (personnel.user.status !== UserStatus.ACTIVE) {
    throw new TelemetryError("User account is not active.", "USER_INACTIVE");
  }

  // Get active device for this personnel
  const device = await prisma.device.findFirst({
    where: { personnelId, status: DeviceStatus.ACTIVE }
  });

  if (!device) {
    throw new TelemetryError("No active device found for this personnel.", "DEVICE_INACTIVE");
  }

  // Optionally get active duty session
  const session = await getActiveDutySession(personnelId);

  return { personnel, device, session };
}

export async function ingestSingleLocation(personnelId: string, input: SingleLocationInput) {
  const { device, session } = await validateDeviceAuthorization(personnelId);

  const activeSOS = await prisma.sOSEvent.findFirst({
    where: { personnelId, endedAt: null, status: "ACTIVE" }
  });

  const actualTrackingMode = activeSOS ? "SOS" : "NORMAL";

  try {
    const location = await prisma.location.create({
      data: {
        clientEventId: input.clientEventId,
        personnelId: personnelId,
        deviceId: device.id,
        dutySessionId: session?.id ?? null,
        latitude: input.latitude,
        longitude: input.longitude,
        accuracy: input.accuracy,
        recordedAt: input.recordedAt,
        source: input.source,
        trackingMode: actualTrackingMode,
        batteryLevel: input.batteryLevel ?? null,
        networkState: input.networkState ?? null,
      },
    });

    // Keep device lastSeenAt and ACTIVE status fresh on incoming location telemetry
    await prisma.device.update({
      where: { id: device.id },
      data: { lastSeenAt: new Date(), status: "ACTIVE" },
    });

    return { status: "accepted", locationId: location.id, receivedAt: location.receivedAt };
  } catch (error: unknown) {
    if ((error as any)?.message?.includes("UNIQUE constraint failed") || (error as any)?.code === "P2002") {
      const existing = await prisma.location.findUnique({ where: { clientEventId: input.clientEventId } });
      return { status: "deduplicated", locationId: existing?.id, receivedAt: existing?.receivedAt };
    }
    throw error;
  }
}

export async function ingestLocationEvent(personnelId: string, input: LocationEventInput) {
  const { device, session } = await validateDeviceAuthorization(personnelId);

  try {
    const event = await prisma.locationEvent.create({
      data: {
        clientEventId: input.clientEventId,
        eventType: input.eventType,
        personnelId: personnelId,
        deviceId: device.id,
        dutySessionId: session?.id ?? null,
        recordedAt: input.recordedAt,
        metadata: input.metadata ? JSON.stringify(input.metadata) : null,
      },
    });

    if (input.eventType === "LOCATION_UNAVAILABLE" || input.eventType === "LOCATION_RECOVERED") {
       await logAudit({
         action: input.eventType as "LOCATION_UNAVAILABLE" | "LOCATION_RECOVERED",
         targetType: "LocationEvent",
         targetId: event.id,
         metadata: { clientEventId: input.clientEventId }
       });
    }

    return { status: "accepted", eventId: event.id, receivedAt: event.receivedAt };
  } catch (error: unknown) {
    if ((error as any)?.message?.includes("UNIQUE constraint failed") || (error as any)?.code === "P2002") {
      const existing = await prisma.locationEvent.findUnique({ where: { clientEventId: input.clientEventId } });
      return { status: "deduplicated", eventId: existing?.id, receivedAt: existing?.receivedAt };
    }
    throw error;
  }
}

export async function ingestBatch(personnelId: string, input: BatchIngestionInput) {
  // Validate authorization and active device once for the entire batch
  const { device, session } = await validateDeviceAuthorization(personnelId);

  const activeSOS = await prisma.sOSEvent.findFirst({
    where: { personnelId, endedAt: null, status: "ACTIVE" }
  });
  const actualTrackingMode = activeSOS ? "SOS" : "NORMAL";

  const results = {
    locations: [] as unknown as Record<string, unknown>[],
    events: [] as unknown as Record<string, unknown>[]
  };

  if (input.locations && input.locations.length > 0) {
    for (const loc of input.locations) {
      try {
        const location = await prisma.location.create({
          data: {
            clientEventId: loc.clientEventId,
            personnelId: personnelId,
            deviceId: device.id,
            dutySessionId: session?.id ?? null,
            latitude: loc.latitude,
            longitude: loc.longitude,
            accuracy: loc.accuracy,
            recordedAt: loc.recordedAt,
            source: loc.source,
            trackingMode: actualTrackingMode,
            batteryLevel: loc.batteryLevel ?? null,
            networkState: loc.networkState ?? null,
          },
        });
        results.locations.push({ clientEventId: loc.clientEventId, status: "accepted", locationId: location.id, receivedAt: location.receivedAt });
      } catch (err: unknown) {
        if ((err as any)?.message?.includes("UNIQUE constraint failed") || (err as any)?.code === "P2002") {
          const existing = await prisma.location.findUnique({ where: { clientEventId: loc.clientEventId } });
          results.locations.push({ clientEventId: loc.clientEventId, status: "deduplicated", locationId: existing?.id, receivedAt: existing?.receivedAt });
        } else {
          results.locations.push({ clientEventId: loc.clientEventId, status: "error", error: (err as any)?.message });
        }
      }
    }
  }

  if (input.events && input.events.length > 0) {
    for (const ev of input.events) {
      try {
        const res = await ingestLocationEvent(personnelId, ev);
        results.events.push({ clientEventId: ev.clientEventId, ...res });
      } catch (err: unknown) {
         results.events.push({ clientEventId: ev.clientEventId, status: "error", error: (err as any)?.message });
      }
    }
  }

  return results;
}
