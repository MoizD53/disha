import { randomBytes, createHash } from "crypto";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import type { User, Session, Personnel } from "../../../generated/prisma/client";
import { UserRole } from "../../../generated/prisma/enums";

export type AuthenticatedUser = User & {
  personnel?: Personnel | null;
};

const SESSION_COOKIE_NAME = "disha_session";
const SESSION_EXPIRES_IN_MS = 1000 * 60 * 60 * 24 * 7; // 7 days

export function generateSessionToken(): string {
  return randomBytes(32).toString("hex");
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export async function createSession(userId: string, userAgent?: string, ipAddress?: string): Promise<{ session: Session, token: string }> {
  const token = generateSessionToken();
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + SESSION_EXPIRES_IN_MS);

  const session = await prisma.session.create({
    data: {
      userId,
      tokenHash,
      expiresAt,
      userAgent,
      ipAddress,
    },
  });

  return { session, token };
}

export async function setSessionCookie(token: string, expiresAt: Date) {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

export async function clearSessionCookie() {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE_NAME);
}

export async function getSession(req?: Request): Promise<{ user: AuthenticatedUser | null; session: Session | null }> {
  let token: string | undefined;

  if (req) {
    const cookieHeader = req.headers.get("cookie") || "";
    const match = cookieHeader.match(new RegExp(`(?:^|; )${SESSION_COOKIE_NAME}=([^;]*)`));
    if (match) token = match[1];
  }

  if (!token) {
    try {
      const cookieStore = await cookies();
      token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
    } catch {
      // outside Next.js request context (e.g., in unit test runner)
    }
  }
  
  if (!token) {
    return { user: null, session: null };
  }

  try {
    const tokenHash = hashToken(token);

    const session = await prisma.session.findUnique({
      where: { tokenHash },
      include: { 
        user: {
          include: { personnel: true }
        } 
      },
    });

    if (!session) {
      return { user: null, session: null };
    }

    if (session.revokedAt || session.expiresAt.getTime() <= Date.now() || session.user.status !== "ACTIVE") {
      return { user: null, session: null };
    }

    // Update lastSeenAt asynchronously
    prisma.session.update({
      where: { id: session.id },
      data: { lastSeenAt: new Date() }
    }).catch(() => {});

    // Extend expiration if it's close to expiring (e.g., less than 3 days left)
    const threeDaysInMs = 1000 * 60 * 60 * 24 * 3;
    if (session.expiresAt.getTime() - Date.now() < threeDaysInMs) {
      const newExpiresAt = new Date(Date.now() + SESSION_EXPIRES_IN_MS);
      await prisma.session.update({
        where: { id: session.id },
        data: { expiresAt: newExpiresAt }
      }).catch(() => {});
      session.expiresAt = newExpiresAt;
      await setSessionCookie(token, newExpiresAt).catch(() => {});
    }

    return { user: session.user as AuthenticatedUser, session };
  } catch (error: any) {
    if (error?.digest === "DYNAMIC_SERVER_USAGE") throw error;
    console.error("[Session] Error resolving session from database:", error);
    return { user: null, session: null };
  }
}

export async function revokeSession(sessionId: string) {
  await prisma.session.update({
    where: { id: sessionId },
    data: { revokedAt: new Date() },
  });
}
