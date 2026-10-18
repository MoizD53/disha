import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyPassword } from "@/lib/auth/password";
import { generateDeviceCredential } from "@/lib/auth/device_auth";
import { logAudit } from "@/lib/auth/audit";
import { z } from "zod";

const enrollSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
  deviceIdentifier: z.string().min(1),
  platform: z.string().default("Android"),
  appVersion: z.string().optional(),
});

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const result = enrollSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json({ error: "Invalid payload", details: result.error.issues }, { status: 400 });
    }

    const { username, password, deviceIdentifier, platform, appVersion } = result.data;

    // Verify User
    const user = await prisma.user.findUnique({
      where: { username },
      include: { personnel: true },
    });

    if (!user || user.status !== "ACTIVE" || !user.personnel) {
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
    }

    const isValid = await verifyPassword(password, user.passwordHash);
    if (!isValid) {
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
    }

    // Upsert Device
    const device = await prisma.device.upsert({
      where: { deviceIdentifier },
      update: {
        personnelId: user.personnel.id,
        platform,
        appVersion,
        status: "ACTIVE",
      },
      create: {
        deviceIdentifier,
        personnelId: user.personnel.id,
        platform,
        appVersion,
        status: "ACTIVE",
      },
    });

    // Generate Bearer token for device
    const token = await generateDeviceCredential(device.id);

    await logAudit({
      actorId: user.id,
      action: "DEVICE_REGISTERED",
      targetType: "Device",
      targetId: device.id,
      metadata: { deviceIdentifier, platform },
    });

    return NextResponse.json({
      token,
      device: {
        id: device.id,
        status: device.status,
      },
      personnel: {
        id: user.personnel.id,
        name: user.personnel.name,
      }
    });
  } catch (error) {
    console.error("Enrollment error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
