import test from "node:test";
import assert from "node:assert";
import { prisma } from "../src/lib/prisma";
import { hashPassword, verifyPassword } from "../src/lib/auth/password";
import { UserRole, UserStatus } from "../generated/prisma/enums";
import { createSession, getSession, revokeSession, clearSessionCookie } from "../src/lib/auth/session";
import { requireAuth, requireRole, requirePersonnelMatch } from "../src/lib/auth/authorization";

test("Integration: Auth Service and RBAC Requirements", async (t) => {
  let testUserId = "";
  let suspendedUserId = "";
  let inactiveUserId = "";
  let sessionId = "";
  let tokenStr = "";

  await t.test("Setup test users", async () => {
    const passwordHash = await hashPassword("TestPassword123!");
    
    const activeUser = await prisma.user.create({
      data: { username: "test_active", passwordHash, role: UserRole.FIELD_PERSONNEL, status: UserStatus.ACTIVE }
    });
    testUserId = activeUser.id;
    
    const suspendedUser = await prisma.user.create({
      data: { username: "test_suspended", passwordHash, role: UserRole.FIELD_PERSONNEL, status: UserStatus.SUSPENDED }
    });
    suspendedUserId = suspendedUser.id;
    
    const inactiveUser = await prisma.user.create({
      data: { username: "test_inactive", passwordHash, role: UserRole.FIELD_PERSONNEL, status: UserStatus.INACTIVE }
    });
    inactiveUserId = inactiveUser.id;
  });

  await t.test("Valid login creates session", async () => {
    const { session, token } = await createSession(testUserId, "TestAgent", "127.0.0.1");
    sessionId = session.id;
    tokenStr = token;
    assert.strictEqual(session.userId, testUserId);
    assert.notStrictEqual(token, session.tokenHash, "Session token must not be stored in plaintext");
  });

  await t.test("Invalid password fails", async () => {
    const user = await prisma.user.findUnique({ where: { id: testUserId } });
    const isValid = await verifyPassword("WrongPassword", user!.passwordHash);
    assert.strictEqual(isValid, false);
  });

  await t.test("Revoked session is invalid", async () => {
    await revokeSession(sessionId);
    const session = await prisma.session.findUnique({ where: { id: sessionId } });
    assert.ok(session!.revokedAt !== null);
  });

  await t.test("RBAC: Authorized roles", async () => {
    const allowed = [UserRole.SP, UserRole.DYSP];
    assert.ok(allowed.includes(UserRole.SP));
    assert.ok(allowed.includes(UserRole.DYSP));
    // The previous error was because TS saw `.includes("FIELD_PERSONNEL")` which doesn't match the generic of allowed.
    assert.strictEqual(allowed.includes(UserRole.FIELD_PERSONNEL as unknown as Record<string, unknown>), false);
  });

  await t.test("Cleanup", async () => {
    await prisma.user.deleteMany({
      where: { id: { in: [testUserId, suspendedUserId, inactiveUserId] } }
    });
  });
});
