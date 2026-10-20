import { NextResponse } from "next/server";
import { z } from "zod";
import { requireSuperAdmin } from "@/lib/auth/permissions";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/auth/password";
import { UserRole, UserStatus } from "../../../../../generated/prisma/enums";
import { logAudit } from "@/lib/auth/audit";

import { fetchAdminUsersList } from "@/services/admin/admin_service";

const createAdminSchema = z.object({
  username: z.string().min(3, "Username must be at least 3 characters").max(50).regex(/^[a-zA-Z0-9_.-]+$/, "Username can only contain alphanumeric characters, dots, underscores, and dashes"),
  displayName: z.string().min(2, "Display name must be at least 2 characters").max(100),
  password: z.string().min(8, "Password must be at least 8 characters long"),
  permissions: z.array(z.enum(["STAFF_MANAGEMENT", "LIVE_MAP"])).default([]),
  status: z.enum(["ACTIVE", "INACTIVE"]).default("ACTIVE"),
});

export async function GET(req: Request) {
  try {
    await requireSuperAdmin(req);
    const admins = await fetchAdminUsersList();
    return NextResponse.json({ admins });
  } catch (error: any) {
    if (error.message === "UNAUTHORIZED") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (error.message === "FORBIDDEN") return NextResponse.json({ error: "Forbidden: Super Admin access required" }, { status: 403 });
    console.error("GET /api/admin/users error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const { user: superAdmin } = await requireSuperAdmin(req);

    const body = await req.json();
    const data = createAdminSchema.parse(body);

    // Check if username already exists
    const existing = await prisma.user.findUnique({
      where: { username: data.username.toLowerCase() },
    });

    if (existing) {
      return NextResponse.json({ error: "Login ID already taken. Please choose another." }, { status: 400 });
    }

    const passwordHash = await hashPassword(data.password);

    const newAdmin = await prisma.user.create({
      data: {
        username: data.username.toLowerCase(),
        displayName: data.displayName,
        passwordHash,
        role: UserRole.CONTROL_ROOM_OFFICER,
        status: data.status === "ACTIVE" ? UserStatus.ACTIVE : UserStatus.INACTIVE,
        permissions: JSON.stringify(data.permissions),
        mustChangePassword: false,
      },
      select: {
        id: true,
        username: true,
        displayName: true,
        role: true,
        status: true,
        permissions: true,
        mustChangePassword: true,
        createdAt: true,
      },
    });

    await logAudit({
      actorId: superAdmin.id,
      action: "CREATE_ADMIN",
      targetType: "User",
      targetId: newAdmin.id,
      metadata: { username: newAdmin.username, permissions: data.permissions },
    });

    let perms: string[] = [];
    try {
      perms = JSON.parse(newAdmin.permissions || "[]");
    } catch {
      perms = [];
    }

    return NextResponse.json({
      success: true,
      admin: {
        ...newAdmin,
        isSuperAdmin: false,
        permissions: perms,
      },
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0]?.message || "Invalid input" }, { status: 400 });
    }
    if (error.message === "UNAUTHORIZED") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (error.message === "FORBIDDEN") return NextResponse.json({ error: "Forbidden: Super Admin access required" }, { status: 403 });
    console.error("POST /api/admin/users error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
