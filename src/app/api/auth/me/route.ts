import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { isSuperAdmin, getUserPermissions } from "@/lib/auth/permissions";

export async function GET() {
  try {
    const { user, session } = await getSession();

    if (!user || !session) {
      return NextResponse.json({ authenticated: false }, { status: 401 });
    }

    const superAdmin = isSuperAdmin(user);
    const permissions = getUserPermissions(user);

    return NextResponse.json({
      authenticated: true,
      user: {
        id: user.id,
        username: user.username,
        displayName: user.displayName || user.username,
        role: user.role,
        isSuperAdmin: superAdmin,
        permissions,
        mustChangePassword: user.mustChangePassword,
        personnel: user.personnel ? {
          id: user.personnel.id,
          name: user.personnel.name,
          personnelCode: user.personnel.personnelCode,
          designation: user.personnel.designation,
          unit: user.personnel.unit,
        } : null,
      },
    });
  } catch (error) {
    console.error("Error in /api/auth/me:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
