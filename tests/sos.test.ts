import test from "node:test";
import assert from "node:assert";
import { randomUUID } from "crypto";
import { prisma } from "../src/lib/prisma";
import { startDuty, endDuty } from "../src/services/duty/duty_service";
import { startSOS, endSOS } from "../src/services/sos/sos_service";
import { acknowledgeAlert, resolveAlert } from "../src/services/alert/alert_service";

test("SOS and Alerts Logic - Decoupled 24/7", async (t) => {
  let userField: any;
  let userAdmin: any;
  let personnelA: any;
  let deviceA: any;
  
  await t.test("Setup fixtures", async () => {
    userField = await prisma.user.create({ data: { username: "sosFieldUser", passwordHash: "x", role: "FIELD_PERSONNEL", status: "ACTIVE" } });
    userAdmin = await prisma.user.create({ data: { username: "sosAdminUser", passwordHash: "x", role: "CONTROL_ROOM_OFFICER", status: "ACTIVE" } });
    
    personnelA = await prisma.personnel.create({ data: { userId: userField.id, personnelCode: "SOS-1", name: "S1", active: true } });
    deviceA = await prisma.device.create({ data: { personnelId: personnelA.id, deviceIdentifier: "SOS-DEV-1", platform: "Android", status: "ACTIVE" } });
  });

  await t.test("Start SOS while OFF DUTY succeeds", async () => {
    const cid = randomUUID();
    const res = await startSOS(personnelA.id, cid, userField.id);
    assert.strictEqual(res.status, "accepted");
    
    const sosEvent = await prisma.sOSEvent.findUnique({ where: { id: res.sosEventId } });
    assert.strictEqual(sosEvent!.dutySessionId, null);

    const alert = await prisma.alert.findFirst({ where: { sosEventId: res.sosEventId } });
    assert.ok(alert);
    assert.strictEqual(alert.status, "ACTIVE");

    await endSOS(personnelA.id, randomUUID(), userField.id);
  });

  await t.test("Start SOS during duty associates with DutySession", async () => {
    await startDuty(personnelA.id, deviceA.deviceIdentifier, userField.id);
    
    const cid = randomUUID();
    const res = await startSOS(personnelA.id, cid, userField.id);
    assert.strictEqual(res.status, "accepted");
    
    const sosEvent = await prisma.sOSEvent.findUnique({ where: { id: res.sosEventId } });
    assert.ok(sosEvent!.dutySessionId !== null);

    // End it for next tests
    await endSOS(personnelA.id, randomUUID(), userField.id);
  });

  await t.test("Concurrent/Duplicate SOS start deduplicates by Personnel", async () => {
    const cid = randomUUID();
    const p1 = startSOS(personnelA.id, cid, userField.id);
    const p2 = startSOS(personnelA.id, cid, userField.id);
    
    const results = await Promise.all([p1, p2]);
    const statuses = results.map(r => r.status);
    
    assert.ok(statuses.includes("accepted"));
    assert.ok(statuses.includes("deduplicated"));
  });

  await t.test("Acknowledge alert", async () => {
    const activeSOS = await prisma.sOSEvent.findFirst({ where: { personnelId: personnelA.id, status: "ACTIVE" } });
    const alert = await prisma.alert.findFirst({ where: { sosEventId: activeSOS!.id } });
    
    const res = await acknowledgeAlert(alert!.id, userAdmin.id);
    assert.strictEqual(res.status, "acknowledged");
    
    // Duplicate ack
    const res2 = await acknowledgeAlert(alert!.id, userAdmin.id);
    assert.strictEqual(res2.status, "already_acknowledged");
  });

  await t.test("Resolve alert", async () => {
    const alert = await prisma.alert.findFirst({ where: { personnelId: personnelA.id } });
    const res = await resolveAlert(alert!.id, userAdmin.id);
    assert.strictEqual(res.status, "resolved");
    
    const activeSOS = await prisma.sOSEvent.findFirst({ where: { personnelId: personnelA.id, status: "ACTIVE" } });
    assert.ok(activeSOS, "SOS event should still be active even if alert is resolved");
  });

  await t.test("End SOS successfully", async () => {
    const cid = randomUUID();
    const res = await endSOS(personnelA.id, cid, userField.id);
    assert.strictEqual(res.status, "resolved");
    
    const activeSOS = await prisma.sOSEvent.findFirst({ where: { personnelId: personnelA.id, status: "ACTIVE" } });
    assert.strictEqual(activeSOS, null);
  });

  await t.test("Cleanup", async () => {
    await endDuty(personnelA.id, userField.id);
    
    await prisma.alert.deleteMany({ where: { personnelId: personnelA.id } });
    await prisma.sOSEvent.deleteMany({ where: { personnelId: personnelA.id } });
    await prisma.dutySession.deleteMany({ where: { personnelId: personnelA.id } });
    await prisma.device.deleteMany({ where: { personnelId: personnelA.id } });
    await prisma.personnel.deleteMany({ where: { id: personnelA.id } });
    await prisma.user.deleteMany({ where: { id: { in: [userField.id, userAdmin.id] } } });
  });
});
