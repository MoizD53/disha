import { NextResponse } from "next/server";
import { getSession, revokeSession, clearSessionCookie } from "@/lib/auth/session";
import { logAudit } from "@/lib/auth/audit";
import { validateOrigin } from "@/lib/security/csrf";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  try {
    if (!validateOrigin(req)) {
      return NextResponse.json({ error: "Invalid Origin" }, { status: 403 });
    }

    const { user, session } = await getSession();

    if (session) {
      await revokeSession(session.id);
      await clearSessionCookie();

      // If user has associated personnel/devices, mark them inactive
      if (user?.personnel) {
        await prisma.device.updateMany({
          where: { personnelId: user.personnel.id, status: "ACTIVE" },
          data: { status: "INACTIVE", lastSeenAt: new Date() },
        });

        const activeDevices = await prisma.device.findMany({
          where: { personnelId: user.personnel.id },
          select: { id: true },
        });

        if (activeDevices.length > 0) {
          const deviceIds = activeDevices.map((d) => d.id);
          await prisma.deviceCredential.updateMany({
            where: { deviceId: { in: deviceIds }, isActive: true },
            data: { isActive: false },
          });
        }
      }

      await logAudit({
        actorId: user?.id,
        action: "LOGOUT",
        targetType: "Session",
        targetId: session.id,
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Logout error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
