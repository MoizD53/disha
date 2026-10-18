import test from "node:test";
import assert from "node:assert";
import { prisma } from "../src/lib/prisma";
import { randomUUID } from "crypto";

test("Security and Purge Logic", async (t) => {
  let userField: any;
  let personnel: any;
  let device: any;
  
  await t.test("Setup", async () => {
    await prisma.location.deleteMany({ where: { personnel: { personnelCode: "SEC-1" } } });
    await prisma.device.deleteMany({ where: { deviceIdentifier: "SEC-DEV-1" } });
    await prisma.personnel.deleteMany({ where: { personnelCode: "SEC-1" } });
    await prisma.user.deleteMany({ where: { username: "sec_user" } });

    userField = await prisma.user.create({ data: { username: "sec_user", passwordHash: "x", role: "FIELD_PERSONNEL", status: "ACTIVE" } });
    personnel = await prisma.personnel.create({ data: { userId: userField.id, personnelCode: "SEC-1", name: "SEC 1", active: true } });
    device = await prisma.device.create({ data: { personnelId: personnel.id, deviceIdentifier: "SEC-DEV-1", platform: "Android", status: "ACTIVE" } });
  });

  await t.test("Telemetry Input Validation (Out of bounds coordinates)", async () => {
    const { singleLocationSchema } = await import("../src/domain/telemetry/validation");
    const payload = {
      personnelId: personnel.id,
      clientEventId: randomUUID(),
      latitude: 91, // INVALID
      longitude: 200, // INVALID
      accuracy: 10,
      recordedAt: new Date().toISOString()
    };
    
    const result = singleLocationSchema.safeParse(payload);
    assert.strictEqual(result.success, false);
    if (!result.success) {
      assert.ok(result.error.issues.some(i => i.path.includes("latitude")));
    }
  });

  await t.test("Rate Limiter blocks excessive logins", async () => {
    const { POST } = await import("../src/app/api/auth/login/route");
    
    let lastStatus = 200;
    // Attempt 6 logins. The 6th should be 429.
    for (let i = 0; i < 6; i++) {
      const req = new Request("http://localhost/api/auth/login", {
        method: "POST",
        headers: { "x-real-ip": "10.0.0.99", "origin": "http://localhost", "host": "localhost" },
        body: JSON.stringify({ username: "sec_user", password: "wrong" })
      });
      const res = await POST(req);
      lastStatus = res.status;
    }
    
    assert.strictEqual(lastStatus, 429, "Expected 429 Too Many Requests");
  });

  await t.test("Retention Purge deletes old telemetry", async () => {
    // Insert old telemetry (> 90 days)
    const oldDate = new Date();
    oldDate.setDate(oldDate.getDate() - 95);
    
    await prisma.location.create({
      data: {
        clientEventId: randomUUID(),
        personnelId: personnel.id,
        deviceId: device.id,
        latitude: 10,
        longitude: 10,
        accuracy: 5,
        recordedAt: oldDate
      }
    });

    const recentDate = new Date();
    recentDate.setDate(recentDate.getDate() - 10);
    
    const newLoc = await prisma.location.create({
      data: {
        clientEventId: randomUUID(),
        personnelId: personnel.id,
        deviceId: device.id,
        latitude: 12,
        longitude: 12,
        accuracy: 5,
        recordedAt: recentDate
      }
    });

    const { purgeOldTelemetry } = await import("../src/services/retention/purge_service");
    
    const result = await purgeOldTelemetry(90);
    assert.strictEqual(result.locationsPurged, 1, "Should have purged exactly 1 location");

    const surviving = await prisma.location.findMany({ where: { personnelId: personnel.id } });
    assert.strictEqual(surviving.length, 1);
    assert.strictEqual(surviving[0].id, newLoc.id);
  });

  await t.test("Cleanup", async () => {
    await prisma.location.deleteMany({ where: { personnelId: personnel.id } });
    await prisma.device.deleteMany({ where: { personnelId: personnel.id } });
    await prisma.personnel.deleteMany({ where: { id: personnel.id } });
    await prisma.user.deleteMany({ where: { id: userField.id } });
  });
});
