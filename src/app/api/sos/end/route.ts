import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth } from "@/lib/auth/authorization";
import { sosEndSchema } from "@/domain/sos/validation";
import { endSOS, SOSError } from "@/services/sos/sos_service";

export async function POST(req: Request) {
  try {
    const { user } = await requireAuth();
    
    if (!user.personnel) {
      return NextResponse.json({ error: "Only personnel can end SOS" }, { status: 403 });
    }
    
    const body = await req.json();
    const payload = sosEndSchema.parse(body);

    const result = await endSOS(user.personnel.id, payload.clientEventId, user.id);

    return NextResponse.json(result);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid payload", details: error.issues }, { status: 400 });
    }
    if (error.message === "UNAUTHORIZED") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (error instanceof SOSError) return NextResponse.json({ error: error.message, code: error.code }, { status: 400 });
    
    console.error("SOS End Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
