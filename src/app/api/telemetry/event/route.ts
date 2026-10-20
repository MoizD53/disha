import { NextResponse } from "next/server";
import { z } from "zod";
import { requireDeviceAuth } from "@/lib/auth/authorization";
import { locationEventSchema } from "@/domain/telemetry/validation";
import { ingestLocationEvent, TelemetryError } from "@/services/telemetry/ingestion_service";

export async function POST(req: Request) {
  try {
    const { personnel } = await requireDeviceAuth(req);
    
    if (!personnel) {
      return NextResponse.json({ error: "Only personnel can submit telemetry" }, { status: 403 });
    }
    
    const body = await req.json();
    const payload = locationEventSchema.parse(body);

    const result = await ingestLocationEvent(personnel.id, payload);

    return NextResponse.json(result);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid event payload", details: error.issues }, { status: 400 });
    }
    if (error.message === "UNAUTHORIZED") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (error.message === "FORBIDDEN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    if (error instanceof TelemetryError) return NextResponse.json({ error: error.message, code: error.code }, { status: 400 });
    
    console.error("Event Ingestion Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
