import { NextResponse } from "next/server";
import { z } from "zod";
import { requirePersonnelMatch, requireDeviceAuth } from "@/lib/auth/authorization";
import { startDuty, DutyError } from "@/services/duty/duty_service";

const startDutySchema = z.object({
  personnelId: z.string().min(1),
  deviceIdentifier: z.string().min(1),
});

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { personnelId, deviceIdentifier } = startDutySchema.parse(body);

    const authHeader = req.headers.get("authorization");
    let actorId: string;

    if (authHeader && authHeader.startsWith("Bearer ")) {
      const { device, personnel } = await requireDeviceAuth(req);
      if (personnel.id !== personnelId) {
        return NextResponse.json(
          { error: "Forbidden: Device credential does not belong to specified personnel" },
          { status: 403 }
        );
      }
      if (device.deviceIdentifier !== deviceIdentifier) {
        return NextResponse.json(
          { error: "Forbidden: Device identifier does not match credential" },
          { status: 403 }
        );
      }
      actorId = personnel.userId;
    } else {
      const { user } = await requirePersonnelMatch(personnelId, req);
      actorId = user.id;
    }

    const session = await startDuty(personnelId, deviceIdentifier, actorId);

    return NextResponse.json({ success: true, session });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid request payload" }, { status: 400 });
    }
    if (error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error.message === "FORBIDDEN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    if (error instanceof DutyError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: 400 });
    }
    console.error("Start Duty Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
