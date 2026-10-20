import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth, requireDeviceAuth } from "@/lib/auth/authorization";
import { sosStartSchema } from "@/domain/sos/validation";
import { startSOS, SOSError } from "@/services/sos/sos_service";

export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get("authorization");
    let personnelId: string;
    let actorId: string;

    if (authHeader && authHeader.startsWith("Bearer ")) {
      const { personnel } = await requireDeviceAuth(req);
      personnelId = personnel.id;
      actorId = personnel.userId;
    } else {
      const { user } = await requireAuth(req);
      if (!user.personnel) {
        return NextResponse.json({ error: "Only personnel can start SOS" }, { status: 403 });
      }
      personnelId = user.personnel.id;
      actorId = user.id;
    }

    const body = await req.json();
    const payload = sosStartSchema.parse(body);

    const result = await startSOS(personnelId, payload.clientEventId, actorId);

    return NextResponse.json(result);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid payload", details: error.issues }, { status: 400 });
    }
    if (error.message === "UNAUTHORIZED") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (error.message === "FORBIDDEN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    if (error instanceof SOSError) return NextResponse.json({ error: error.message, code: error.code }, { status: 400 });

    console.error("SOS Start Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
