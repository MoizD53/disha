import { NextResponse } from "next/server";
import { z } from "zod";
import { requirePermission } from "@/lib/auth/permissions";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/auth/password";
import { UserRole, UserStatus } from "../../../../generated/prisma/enums";
import { logAudit } from "@/lib/auth/audit";

const createStaffSchema = z.object({
  name: z.string().min(2, "Staff name must be at least 2 characters").max(100),
  username: z.string().min(3, "Login ID must be at least 3 characters").max(50).regex(/^[a-zA-Z0-9_.-]+$/, "Username can only contain alphanumeric characters, dots, underscores, and dashes"),
  password: z.string().min(8, "Password must be at least 8 characters long"),
  personnelCode: z.string().min(2, "Personnel code is required").max(50),
  designation: z.string().max(100).optional().nullable(),
  unit: z.string().max(100).optional().nullable(),
  phone: z.string().max(20).optional().nullable(),
  status: z.enum(["ACTIVE", "INACTIVE"]).default("ACTIVE"),
});

export async function GET(req: Request) {
  try {
    await requirePermission("STAFF_MANAGEMENT", req);

    const staffList = await prisma.personnel.findMany({
      include: {
        user: {
          select: {
            id: true,
            username: true,
            displayName: true,
            role: true,
            status: true,
            mustChangePassword: true,
            createdAt: true,
            updatedAt: true,
          },
        },
        devices: {
          where: { status: "ACTIVE" },
          take: 1,
          select: {
            id: true,
            deviceIdentifier: true,
            platform: true,
            status: true,
            lastSeenAt: true,
          },
        },
        dutySessions: {
          where: { endedAt: null },
          take: 1,
          select: {
            id: true,
            status: true,
            startedAt: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    const formatted = staffList.map((p) => ({
      id: p.id,
      userId: p.userId,
      username: p.user.username,
      name: p.name,
      personnelCode: p.personnelCode,
      designation: p.designation,
      unit: p.unit,
      phone: p.phone,
      active: p.active,
      status: p.user.status,
      mustChangePassword: p.user.mustChangePassword,
      device: p.devices[0] || null,
      activeDuty: p.dutySessions[0] || null,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
    }));

    return NextResponse.json({ staff: formatted });
  } catch (error: any) {
    if (error.message === "UNAUTHORIZED") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (error.message === "FORBIDDEN") return NextResponse.json({ error: "Forbidden: Staff Management permission required" }, { status: 403 });
    console.error("GET /api/staff error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const { user: currentAdmin } = await requirePermission("STAFF_MANAGEMENT", req);

    const body = await req.json();
    const data = createStaffSchema.parse(body);

    const normalizedUsername = data.username.toLowerCase();

    // Check if username already exists
    const existingUser = await prisma.user.findUnique({
      where: { username: normalizedUsername },
    });

    if (existingUser) {
      return NextResponse.json({ error: "Login ID already taken. Please choose another." }, { status: 400 });
    }

    // Check if personnelCode already exists
    const existingPersonnelCode = await prisma.personnel.findUnique({
      where: { personnelCode: data.personnelCode },
    });

    if (existingPersonnelCode) {
      return NextResponse.json({ error: "Personnel code / Badge ID already in use." }, { status: 400 });
    }

    const passwordHash = await hashPassword(data.password);
    const userStatus = data.status === "ACTIVE" ? UserStatus.ACTIVE : UserStatus.INACTIVE;

    // Create User and linked Personnel atomically
    const newUser = await prisma.user.create({
      data: {
        username: normalizedUsername,
        displayName: data.name,
        passwordHash,
        role: UserRole.FIELD_PERSONNEL,
        status: userStatus,
        permissions: "[]",
        mustChangePassword: true,
        personnel: {
          create: {
            personnelCode: data.personnelCode,
            name: data.name,
            designation: data.designation || null,
            unit: data.unit || null,
            phone: data.phone || null,
            active: data.status === "ACTIVE",
          },
        },
      },
      include: {
        personnel: true,
      },
    });

    await logAudit({
      actorId: currentAdmin.id,
      action: "CREATE_STAFF",
      targetType: "Personnel",
      targetId: newUser.personnel!.id,
      metadata: { username: newUser.username, personnelCode: data.personnelCode },
    });

    return NextResponse.json({
      success: true,
      staff: {
        id: newUser.personnel!.id,
        userId: newUser.id,
        username: newUser.username,
        name: newUser.personnel!.name,
        personnelCode: newUser.personnel!.personnelCode,
        designation: newUser.personnel!.designation,
        unit: newUser.personnel!.unit,
        phone: newUser.personnel!.phone,
        active: newUser.personnel!.active,
        status: newUser.status,
        createdAt: newUser.personnel!.createdAt,
      },
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0]?.message || "Invalid input" }, { status: 400 });
    }
    if (error.message === "UNAUTHORIZED") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (error.message === "FORBIDDEN") return NextResponse.json({ error: "Forbidden: Staff Management permission required" }, { status: 403 });
    console.error("POST /api/staff error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
