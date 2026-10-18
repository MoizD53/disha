import { NextResponse } from "next/server";
import { getSession, revokeSession, clearSessionCookie } from "@/lib/auth/session";
import { logAudit } from "@/lib/auth/audit";
import { validateOrigin } from "@/lib/security/csrf";

export async function POST(req: Request) {
  try {
    if (!validateOrigin(req)) {
      return NextResponse.json({ error: "Invalid Origin" }, { status: 403 });
    }

    const { user, session } = await getSession();

    if (session) {
      await revokeSession(session.id);
      await clearSessionCookie();

      await logAudit({
        actorId: user?.id,
        action: "LOGOUT",
        targetType: "Session",
        targetId: session.id,
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Logout error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
