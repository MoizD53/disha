import { NextResponse } from "next/server";
import { z } from "zod";
import { requireSuperAdmin } from "@/lib/auth/permissions";
import { prisma } from "@/lib/prisma";
import { UserRole, UserStatus } from "../../../../../../generated/prisma/enums";
import { logAudit } from "@/lib/auth/audit";

const updateAdminSchema = z.object({
  displayName: z.string().min(2, "Display name must be at least 2 characters").max(100).optional(),
  permissions: z.array(z.enum(["STAFF_MANAGEMENT", "LIVE_MAP"])).optional(),
  status: z.enum(["ACTIVE", "INACTIVE"]).optional(),
});

export async function PATCH(req: Request, props: { params: Promise<{ id: string }> }) {
  try {
    const { user: superAdmin } = await requireSuperAdmin(req);
    const params = await props.params;
    const adminId = params.id;

    const body = await req.json();
    const data = updateAdminSchema.parse(body);

    const targetUser = await prisma.user.findUnique({
      where: { id: adminId },
    });

    if (!targetUser) {
      return NextResponse.json({ error: "Admin user not found" }, { status: 404 });
    }

    // Do not allow deactivating the Super Admin
    if (targetUser.role === UserRole.SP && data.status === "INACTIVE") {
      return NextResponse.json({ error: "Cannot deactivate Super Admin account" }, { status: 400 });
    }

    const updatePayload: any = {};
    if (data.displayName !== undefined) updatePayload.displayName = data.displayName;
    if (data.status !== undefined) {
      updatePayload.status = data.status === "ACTIVE" ? UserStatus.ACTIVE : UserStatus.INACTIVE;
    }
    // Permissions only apply to non-Super Admin
    if (data.permissions !== undefined && targetUser.role !== UserRole.SP) {
      updatePayload.permissions = JSON.stringify(data.permissions);
    }

    const updated = await prisma.user.update({
      where: { id: adminId },
      data: updatePayload,
      select: {
        id: true,
        username: true,
        displayName: true,
        role: true,
        status: true,
        permissions: true,
        mustChangePassword: true,
        updatedAt: true,
      },
    });

    await logAudit({
      actorId: superAdmin.id,
      action: "UPDATE_ADMIN",
      targetType: "User",
      targetId: updated.id,
      metadata: data,
    });

    let perms: string[] = [];
    if (updated.role === UserRole.SP) {
      perms = ["STAFF_MANAGEMENT", "LIVE_MAP"];
    } else {
      try {
        perms = JSON.parse(updated.permissions || "[]");
      } catch {
        perms = [];
      }
    }

    return NextResponse.json({
      success: true,
      admin: {
        ...updated,
        isSuperAdmin: updated.role === UserRole.SP,
        permissions: perms,
      },
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0]?.message || "Invalid input" }, { status: 400 });
    }
    if (error.message === "UNAUTHORIZED") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (error.message === "FORBIDDEN") return NextResponse.json({ error: "Forbidden: Super Admin access required" }, { status: 403 });
    console.error("PATCH /api/admin/users/[id] error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
