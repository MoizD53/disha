import test from "node:test";
import assert from "node:assert";
import { prisma } from "../src/lib/prisma";
import { UserRole, UserStatus, DeviceStatus } from "../generated/prisma/enums";
import { hashPassword } from "../src/lib/auth/password";
import { createSession } from "../src/lib/auth/session";
import { generateDeviceCredential } from "../src/lib/auth/device_auth";

async function cleanOldFixtures(username: string) {
  try {
    const oldUsers = await prisma.user.findMany({ where: { username } });
    for (const u of oldUsers) {
      const p = await prisma.personnel.findUnique({ where: { userId: u.id } });
      if (p) {
        const devs = await prisma.device.findMany({ where: { personnelId: p.id } });
        for (const d of devs) {
          await prisma.deviceCredential.deleteMany({ where: { deviceId: d.id } });
        }
        await prisma.heartbeat.deleteMany({ where: { personnelId: p.id } });
        await prisma.dutySession.deleteMany({ where: { personnelId: p.id } });
        await prisma.location.deleteMany({ where: { personnelId: p.id } });
        await prisma.locationEvent.deleteMany({ where: { personnelId: p.id } });
        await prisma.sOSEvent.deleteMany({ where: { personnelId: p.id } });
        await prisma.alert.deleteMany({ where: { personnelId: p.id } });
        await prisma.device.deleteMany({ where: { personnelId: p.id } });
        await prisma.personnel.delete({ where: { id: p.id } });
      }
      await prisma.session.deleteMany({ where: { userId: u.id } });
      await prisma.user.delete({ where: { id: u.id } });
    }
  } catch (err) {
    // ignore
  }
}

test("API Route Handlers: Authentication and Authorization Verification", async (t) => {
  const TEST_USER = "route_test_officer";
  let userField: any;
  let personnelField: any;
  let deviceField: any;
  let sessionField: any;
  let sessionToken: string;
  let deviceToken: string;

  await t.test("Setup fixtures", async () => {
    await cleanOldFixtures(TEST_USER);

    const passwordHash = await hashPassword("ValidPassword123!");
    userField = await prisma.user.create({
      data: {
        username: TEST_USER,
        passwordHash,
        role: UserRole.FIELD_PERSONNEL,
        status: UserStatus.ACTIVE,
      },
    });

    personnelField = await prisma.personnel.create({
      data: {
        userId: userField.id,
        personnelCode: "RT-101",
        name: "Route Test Officer",
        active: true,
      },
    });

    deviceField = await prisma.device.create({
      data: {
        personnelId: personnelField.id,
        deviceIdentifier: "DEV-RT-101",
        platform: "Android",
        status: DeviceStatus.ACTIVE,
      },
    });

    // Create session
    const sess = await createSession(userField.id, "TestAgent", "127.0.0.1");
    sessionField = sess.session;
    sessionToken = sess.token;

    // Create device token
    deviceToken = await generateDeviceCredential(deviceField.id);
  });

  await t.test("POST /api/duty/start handler correctly resolves user and starts duty", async () => {
    const { startDuty } = await import("../src/services/duty/duty_service");
    const session = await startDuty(personnelField.id, deviceField.deviceIdentifier, userField.id);
    assert.ok(session.id);
    assert.strictEqual(session.status, "DUTY_STARTED");
  });

  await t.test("POST /api/duty/end handler correctly resolves user and ends duty", async () => {
    const { endDuty } = await import("../src/services/duty/duty_service");
    const session = await endDuty(personnelField.id, userField.id);
    assert.ok(session.id);
    assert.strictEqual(session.status, "DUTY_ENDED");
  });

  await t.test("POST /api/telemetry/heartbeat verifies device Bearer token and rejects invalid token", async () => {
    const { POST: heartbeatHandler } = await import("../src/app/api/telemetry/heartbeat/route");

    // 1. Valid device Bearer token
    const validReq = new Request("http://localhost/api/telemetry/heartbeat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${deviceToken}`,
      },
      body: JSON.stringify({
        personnelId: personnelField.id,
        batteryLevel: 95,
        networkState: "WIFI",
        recordedAt: new Date().toISOString(),
      }),
    });

    const validRes = await heartbeatHandler(validReq);
    assert.strictEqual(validRes.status, 200);
    const validBody = await validRes.json();
    assert.strictEqual(validBody.status, "accepted");

    // 2. Invalid device Bearer token is rejected with 401
    const invalidReq = new Request("http://localhost/api/telemetry/heartbeat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer invalid_token_12345",
      },
      body: JSON.stringify({
        personnelId: personnelField.id,
        batteryLevel: 95,
        networkState: "WIFI",
        recordedAt: new Date().toISOString(),
      }),
    });

    const invalidRes = await heartbeatHandler(invalidReq);
    assert.strictEqual(invalidRes.status, 401);
  });

  await t.test("Cleanup test fixtures", async () => {
    await cleanOldFixtures(TEST_USER);
  });
});
