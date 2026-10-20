import { NextResponse } from "next/server";
import { z } from "zod";
import { requireSuperAdmin } from "@/lib/auth/permissions";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/auth/password";
import { logAudit } from "@/lib/auth/audit";

const resetPasswordSchema = z.object({
  newPassword: z.string().min(8, "Password must be at least 8 characters long"),
});

export async function POST(req: Request, props: { params: Promise<{ id: string }> }) {
  try {
    const { user: superAdmin } = await requireSuperAdmin(req);
    const params = await props.params;
    const adminId = params.id;

    const body = await req.json();
    const { newPassword } = resetPasswordSchema.parse(body);

    const targetUser = await prisma.user.findUnique({
      where: { id: adminId },
    });

    if (!targetUser) {
      return NextResponse.json({ error: "Admin user not found" }, { status: 404 });
    }

    const passwordHash = await hashPassword(newPassword);

    await prisma.user.update({
      where: { id: adminId },
      data: {
        passwordHash,
        mustChangePassword: false,
      },
    });

    await logAudit({
      actorId: superAdmin.id,
      action: "RESET_PASSWORD",
      targetType: "User",
      targetId: adminId,
      metadata: { username: targetUser.username },
    });

    return NextResponse.json({
      success: true,
      message: `Password for ${targetUser.username} has been reset successfully.`,
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0]?.message || "Invalid input" }, { status: 400 });
    }
    if (error.message === "UNAUTHORIZED") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (error.message === "FORBIDDEN") return NextResponse.json({ error: "Forbidden: Super Admin access required" }, { status: 403 });
    console.error("POST /api/admin/users/[id]/reset-password error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
