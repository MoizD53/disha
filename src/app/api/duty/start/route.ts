import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth, requirePersonnelMatch } from "@/lib/auth/authorization";
import { startDuty, DutyError } from "@/services/duty/duty_service";

const startDutySchema = z.object({
  personnelId: z.string().min(1),
  deviceIdentifier: z.string().min(1),
});

export async function POST(req: Request) {
  try {
    const { user } = await requireAuth();
    
    const body = await req.json();
    const { personnelId, deviceIdentifier } = startDutySchema.parse(body);

    // Enforce that FIELD_PERSONNEL can only start their own duty
    await requirePersonnelMatch(personnelId);

    const session = await startDuty(personnelId, deviceIdentifier, user.id);

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
