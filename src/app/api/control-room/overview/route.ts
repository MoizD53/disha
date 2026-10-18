import { NextResponse } from "next/server";
import { requireAuth, requireRole } from "@/lib/auth/authorization";
import { getDashboardOverview } from "@/services/control-room/dashboard_service";

export async function GET() {
  try {
    await requireAuth();
    await requireRole(["CONTROL_ROOM_OFFICER", "DYSP", "SP"]);
    
    const data = await getDashboardOverview();
    return NextResponse.json(data);
  } catch (error: any) {
    if (error.message === "UNAUTHORIZED") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (error.message === "FORBIDDEN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    
    console.error("Dashboard overview error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
