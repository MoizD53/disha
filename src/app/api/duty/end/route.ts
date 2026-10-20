import { NextResponse } from "next/server";
import { z } from "zod";
import { requirePersonnelMatch, requireDeviceAuth } from "@/lib/auth/authorization";
import { endDuty, DutyError } from "@/services/duty/duty_service";

const endDutySchema = z.object({
  personnelId: z.string().min(1),
});

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { personnelId } = endDutySchema.parse(body);

    const authHeader = req.headers.get("authorization");
    let actorId: string;

    if (authHeader && authHeader.startsWith("Bearer ")) {
      const { personnel } = await requireDeviceAuth(req);
      if (personnel.id !== personnelId) {
        return NextResponse.json(
          { error: "Forbidden: Device credential does not belong to specified personnel" },
          { status: 403 }
        );
      }
      actorId = personnel.userId;
    } else {
      const { user } = await requirePersonnelMatch(personnelId, req);
      actorId = user.id;
    }

    const session = await endDuty(personnelId, actorId);

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
    console.error("End Duty Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
