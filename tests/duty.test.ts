import test from "node:test";
import assert from "node:assert";
import { prisma } from "../src/lib/prisma";
import { startDuty, endDuty, DutyError, getActiveDutySession } from "../src/services/duty/duty_service";
import { DeviceStatus } from "../generated/prisma/enums";

test("Duty Service and State Machine Integration", async (t) => {
  let personnelA: any;
  let personnelB: any;
  let deviceA: any;
  let deviceB: any;
  let revokedDevice: any;
  let sessionId: string;

  await t.test("Setup fixtures", async () => {
    const userA = await prisma.user.create({ data: { username: "userA", passwordHash: "x", role: "FIELD_PERSONNEL", status: "ACTIVE" } });
    const userB = await prisma.user.create({ data: { username: "userB", passwordHash: "x", role: "FIELD_PERSONNEL", status: "ACTIVE" } });
    
    personnelA = await prisma.personnel.create({ data: { userId: userA.id, personnelCode: "P-A", name: "A", active: true } });
    personnelB = await prisma.personnel.create({ data: { userId: userB.id, personnelCode: "P-B", name: "B", active: true } });
    
    deviceA = await prisma.device.create({ data: { personnelId: personnelA.id, deviceIdentifier: "DEV-A", platform: "Android", status: DeviceStatus.ACTIVE } });
    deviceB = await prisma.device.create({ data: { personnelId: personnelB.id, deviceIdentifier: "DEV-B", platform: "Android", status: DeviceStatus.ACTIVE } });
    revokedDevice = await prisma.device.create({ data: { personnelId: personnelA.id, deviceIdentifier: "DEV-REVOKED", platform: "Android", status: DeviceStatus.REVOKED } });
  });

  await t.test("Start duty successfully", async () => {
    const session = await startDuty(personnelA.id, deviceA.deviceIdentifier, "actorA");
    assert.ok(session.id);
    assert.strictEqual(session.status, "DUTY_STARTED");
    assert.strictEqual(session.endedAt, null);
    sessionId = session.id;
  });

  await t.test("Start duty twice fails (ALREADY_ON_DUTY)", async () => {
    await assert.rejects(
      startDuty(personnelA.id, deviceA.deviceIdentifier, "actorA"),
      (err: unknown) => err.code === "ALREADY_ON_DUTY"
    );
  });

  await t.test("End duty successfully", async () => {
    const session = await endDuty(personnelA.id, "actorA");
    assert.strictEqual(session.status, "DUTY_ENDED");
    assert.notStrictEqual(session.endedAt, null);
  });

  await t.test("End duty twice fails (NOT_ON_DUTY)", async () => {
    await assert.rejects(
      endDuty(personnelA.id, "actorA"),
      (err: unknown) => err.code === "NOT_ON_DUTY"
    );
  });

  await t.test("Revoked device attempting duty", async () => {
    await assert.rejects(
      startDuty(personnelA.id, revokedDevice.deviceIdentifier, "actorA"),
      (err: unknown) => err.code === "DEVICE_INACTIVE"
    );
  });

  await t.test("Wrong device/personnel combination", async () => {
    await assert.rejects(
      startDuty(personnelA.id, deviceB.deviceIdentifier, "actorA"),
      (err: unknown) => err.code === "DEVICE_MISMATCH"
    );
  });

  await t.test("Concurrent duplicate duty-start attempts", async () => {
    // Attempt to start duty twice perfectly concurrently for personnelB
    const p1 = startDuty(personnelB.id, deviceB.deviceIdentifier, "actorB");
    const p2 = startDuty(personnelB.id, deviceB.deviceIdentifier, "actorB");
    
    let successCount = 0;
    let errorCount = 0;

    const results = await Promise.allSettled([p1, p2]);
    for (const res of results) {
      if (res.status === "fulfilled") successCount++;
      if (res.status === "rejected" && res.reason.code === "ALREADY_ON_DUTY") errorCount++;
    }

    assert.strictEqual(successCount, 1, "Only one should succeed");
    assert.strictEqual(errorCount, 1, "The other should throw ALREADY_ON_DUTY");
  });

  await t.test("Telemetry/session validation helper rejects ended session", async () => {
    // Assuming getActiveDutySession is the helper telemetry will use
    const active = await getActiveDutySession(personnelA.id);
    assert.strictEqual(active, null, "Should return null for ended session");
  });

  await t.test("Cleanup", async () => {
    await prisma.dutySession.deleteMany({ where: { personnelId: { in: [personnelA.id, personnelB.id] } } });
    await prisma.device.deleteMany({ where: { id: { in: [deviceA.id, deviceB.id, revokedDevice.id] } } });
    await prisma.personnel.deleteMany({ where: { id: { in: [personnelA.id, personnelB.id] } } });
    await prisma.user.deleteMany({ where: { username: { in: ["userA", "userB"] } } });
  });
});
