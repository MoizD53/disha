import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth/permissions";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/auth/audit";

export async function GET(req: Request, props: { params: Promise<{ id: string }> }) {
  try {
    const { user } = await requirePermission("LIVE_MAP", req);
    
    const resolvedParams = await props.params;
    const personnelId = resolvedParams.id;
    
    const { searchParams } = new URL(req.url);
    const startParam = searchParams.get("start");
    const endParam = searchParams.get("end");
    
    if (!startParam || !endParam) {
      return NextResponse.json({ error: "Missing start or end parameters" }, { status: 400 });
    }

    const startTime = new Date(startParam);
    const endTime = new Date(endParam);
    
    // Safety limit: 90 days range maximum
    const diffDays = (endTime.getTime() - startTime.getTime()) / (1000 * 3600 * 24);
    if (diffDays > 90) {
      return NextResponse.json({ error: "Requested range exceeds 90 days" }, { status: 400 });
    }
    if (diffDays < 0) {
      return NextResponse.json({ error: "Invalid date range" }, { status: 400 });
    }

    const locations = await prisma.location.findMany({
      where: {
        personnelId,
        recordedAt: { gte: startTime, lte: endTime }
      },
      orderBy: { recordedAt: 'asc' },
      take: 2000,
      select: {
        id: true,
        latitude: true,
        longitude: true,
        accuracy: true,
        recordedAt: true,
        trackingMode: true,
        source: true,
      }
    });

    await logAudit({
      actorId: user.id,
      action: "VIEW_LOCATION_HISTORY",
      targetType: "Personnel",
      targetId: personnelId,
      metadata: { start: startTime.toISOString(), end: endTime.toISOString() }
    });

    return NextResponse.json({ locations });
  } catch (error: any) {
    if (error.message === "UNAUTHORIZED") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (error.message === "FORBIDDEN") return NextResponse.json({ error: "Forbidden: Live Map permission required" }, { status: 403 });
    
    console.error("History overview error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
