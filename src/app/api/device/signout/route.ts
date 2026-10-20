import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSession, revokeSession } from "@/lib/auth/session";
import { logAudit } from "@/lib/auth/audit";
import { randomUUID } from "crypto";

const signoutSchema = z.object({
  personnelId: z.string().optional(),
  deviceIdentifier: z.string().optional(),
});

export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get("authorization");
    let targetDevice: any = null;
    let targetPersonnel: any = null;
    let actorId: string | null = null;

    // Optional body
    let body: any = {};
    try {
      body = await req.json();
    } catch {
      body = {};
    }
    const parsed = signoutSchema.safeParse(body);
    const requestedPersonnelId = parsed.success ? parsed.data.personnelId : undefined;
    const requestedDeviceIdentifier = parsed.success ? parsed.data.deviceIdentifier : undefined;

    if (authHeader && authHeader.startsWith("Bearer ")) {
      const token = authHeader.substring(7);
      const { verifyDeviceToken } = await import("@/lib/auth/device_auth");
      targetDevice = await verifyDeviceToken(token);
      if (!targetDevice) {
        return NextResponse.json({ error: "Unauthorized: Invalid device token" }, { status: 401 });
      }
      targetPersonnel = targetDevice.personnel;
      actorId = targetPersonnel.userId;

      // Ownership check: Prevent one worker from signing out another worker's device
      if (requestedPersonnelId && requestedPersonnelId !== targetPersonnel.id) {
        return NextResponse.json({ error: "Forbidden: Personnel ID mismatch" }, { status: 403 });
      }
      if (requestedDeviceIdentifier && requestedDeviceIdentifier !== targetDevice.deviceIdentifier) {
        return NextResponse.json({ error: "Forbidden: Device identifier mismatch" }, { status: 403 });
      }
    } else {
      // Cookie session fallback
      const { user, session } = await getSession(req);
      if (!user || !session) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
      actorId = user.id;

      if (!user.personnel) {
        return NextResponse.json({ error: "Forbidden: Not a field personnel account" }, { status: 403 });
      }

      targetPersonnel = user.personnel;

      if (requestedPersonnelId && requestedPersonnelId !== targetPersonnel.id) {
        return NextResponse.json({ error: "Forbidden: Personnel ID mismatch" }, { status: 403 });
      }

      targetDevice = await prisma.device.findFirst({
        where: {
          personnelId: targetPersonnel.id,
          ...(requestedDeviceIdentifier ? { deviceIdentifier: requestedDeviceIdentifier } : {}),
        },
        orderBy: { registeredAt: "desc" },
      });

      await revokeSession(session.id);
    }

    if (targetDevice) {
      // Deactivate all active credentials for this device
      await prisma.deviceCredential.updateMany({
        where: { deviceId: targetDevice.id, isActive: true },
        data: { isActive: false },
      });

      // Mark device connection status as INACTIVE immediately
      await prisma.device.update({
        where: { id: targetDevice.id },
        data: {
          status: "INACTIVE",
          lastSeenAt: new Date(),
        },
      });

      // Log network lost event with reason DEVICE_SIGNOUT
      await prisma.locationEvent.create({
        data: {
          clientEventId: randomUUID(),
          eventType: "NETWORK_LOST",
          personnelId: targetPersonnel.id,
          deviceId: targetDevice.id,
          recordedAt: new Date(),
          metadata: JSON.stringify({ reason: "DEVICE_SIGNOUT" }),
        },
      });

      // Invalidate active web/app sessions for this user
      if (targetPersonnel.userId) {
        await prisma.session.updateMany({
          where: { userId: targetPersonnel.userId, revokedAt: null },
          data: { revokedAt: new Date() },
        });
      }

      await logAudit({
        actorId: actorId || undefined,
        action: "DEVICE_SIGNOUT",
        targetType: "Device",
        targetId: targetDevice.id,
        metadata: {
          deviceIdentifier: targetDevice.deviceIdentifier,
          personnelId: targetPersonnel.id,
        },
      });
    }

    return NextResponse.json({
      success: true,
      message: "Device signed out and connection marked inactive.",
      deviceId: targetDevice?.id || null,
      status: "INACTIVE",
    });
  } catch (error) {
    console.error("Signout error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
