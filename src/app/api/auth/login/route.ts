import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { verifyPassword } from "@/lib/auth/password";
import { createSession, setSessionCookie } from "@/lib/auth/session";
import { logAudit } from "@/lib/auth/audit";


import { checkRateLimit } from "@/lib/security/rate_limiter";
import { validateOrigin } from "@/lib/security/csrf";

const loginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

export async function POST(req: Request) {
  try {
    if (!validateOrigin(req)) {
      return NextResponse.json({ error: "Invalid Origin" }, { status: 403 });
    }

    const ipAddress = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "unknown";
    const userAgent = req.headers.get("user-agent") || undefined;

    // Strict rate limit: max 5 login attempts per minute per IP
    if (!checkRateLimit(ipAddress, 5, 60000)) {
      return NextResponse.json({ error: "Too many login attempts. Please try again later." }, { status: 429 });
    }

    const body = await req.json();
    const { username, password } = loginSchema.parse(body);

    const user = await prisma.user.findUnique({
      where: { username },
    });

    if (!user || user.status !== "ACTIVE") {
      await logAudit({
        action: "LOGIN_FAILED",
        metadata: { username },
        ipAddress,
        userAgent,
      });
      return NextResponse.json({ error: "Invalid username or password" }, { status: 401 });
    }

    const isValid = await verifyPassword(password, user.passwordHash);

    if (!isValid) {
      await logAudit({
        actorId: user.id,
        action: "LOGIN_FAILED",
        metadata: { username },
        ipAddress,
        userAgent,
      });
      return NextResponse.json({ error: "Invalid username or password" }, { status: 401 });
    }

    const { session, token } = await createSession(user.id, userAgent, ipAddress);
    await setSessionCookie(token, session.expiresAt);

    await logAudit({
      actorId: user.id,
      action: "LOGIN",
      targetType: "Session",
      targetId: session.id,
      ipAddress,
      userAgent,
    });

    return NextResponse.json({ success: true, role: user.role });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid request payload" }, { status: 400 });
    }
    console.error("Login error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
