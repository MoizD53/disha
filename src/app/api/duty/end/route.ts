import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth, requirePersonnelMatch } from "@/lib/auth/authorization";
import { endDuty, DutyError } from "@/services/duty/duty_service";

const endDutySchema = z.object({
  personnelId: z.string().min(1),
});

export async function POST(req: Request) {
  try {
    const { user } = await requireAuth();
    
    const body = await req.json();
    const { personnelId } = endDutySchema.parse(body);

    // Enforce that FIELD_PERSONNEL can only end their own duty
    await requirePersonnelMatch(personnelId);

    const session = await endDuty(personnelId, user.id);

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
