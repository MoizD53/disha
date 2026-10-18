import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { validateDeviceAuthorization } from "@/services/telemetry/ingestion_service";

const heartbeatSchema = z.object({
  personnelId: z.string(),
  batteryLevel: z.number().nullable().optional(),
  networkState: z.string().nullable().optional(),
  appVersion: z.string().nullable().optional(),
  healthState: z.string().nullable().optional(),
  recordedAt: z.string().transform(str => new Date(str))
});

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const parsed = heartbeatSchema.parse(body);

    let device;
    const authHeader = req.headers.get("authorization");
    if (authHeader && authHeader.startsWith("Bearer ")) {
      const token = authHeader.substring(7);
      const { verifyDeviceToken } = await import("@/lib/auth/device_auth");
      const verifiedDevice = await verifyDeviceToken(token);
      if (!verifiedDevice) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
      if (verifiedDevice.personnelId !== parsed.personnelId) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      device = verifiedDevice;
    } else {
      const auth = await validateDeviceAuthorization(parsed.personnelId);
      device = auth.device;
    }

    const heartbeat = await prisma.heartbeat.create({
      data: {
        deviceId: device.id,
        personnelId: parsed.personnelId,
        batteryLevel: parsed.batteryLevel,
        networkState: parsed.networkState,
        appVersion: parsed.appVersion,
        healthState: parsed.healthState,
        recordedAt: parsed.recordedAt
      }
    });

    return NextResponse.json({ status: "accepted", heartbeatId: heartbeat.id });
  } catch (error: any) {
    if (error.name === "ZodError") {
      return NextResponse.json({ error: "Validation failed", details: error.issues || error.errors }, { status: 400 });
    }
    if (error.code === "DEVICE_INACTIVE" || error.code === "PERSONNEL_INACTIVE") {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    console.error("Heartbeat error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
