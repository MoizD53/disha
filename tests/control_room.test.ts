import test from "node:test";
import assert from "node:assert";
import { prisma } from "../src/lib/prisma";
import { randomUUID } from "crypto";
import { User, Personnel } from "@prisma/client";

test("Control Room Dashboard API Logic", async (t) => {
  let adminUser: User;
  let fieldUser: User;
  let personnel: Personnel;
  
  await t.test("Setup fixtures", async () => {
    adminUser = await prisma.user.create({ data: { username: "cr_admin", passwordHash: "x", role: "CONTROL_ROOM_OFFICER", status: "ACTIVE" } });
    fieldUser = await prisma.user.create({ data: { username: "cr_field", passwordHash: "x", role: "FIELD_PERSONNEL", status: "ACTIVE" } });
    
    personnel = await prisma.personnel.create({ data: { userId: fieldUser.id, personnelCode: "CR-1", name: "CR 1", active: true } });
    await prisma.device.create({ data: { personnelId: personnel.id, deviceIdentifier: "CR-DEV-1", platform: "Android", status: "ACTIVE" } });
  });

  await t.test("Overview service returns formatted data", async () => {
    const { getDashboardOverview } = await import("../src/services/control-room/dashboard_service");
    
    // Insert a dummy location
    await prisma.location.create({
      data: {
        clientEventId: randomUUID(),
        personnelId: personnel.id,
        deviceId: (await prisma.device.findFirst({ where: { personnelId: personnel.id } }))!.id,
        latitude: 10,
        longitude: 20,
        accuracy: 5,
        recordedAt: new Date(),
      }
    });

    const data = await getDashboardOverview();
    assert.ok(Array.isArray(data));
    
    const p = data.find(d => d.id === personnel.id);
    assert.ok(p);
    assert.strictEqual(p.dutyStatus, "OFF DUTY");
    assert.strictEqual(p.locationStatus, "OFF DUTY");
    assert.strictEqual(p.sosStatus, "NONE");
    assert.strictEqual(p.deviceStatus, "OFFLINE"); // Changed because no heartbeat exists
    assert.strictEqual(p.networkStatus, "OFFLINE"); // No heartbeat -> OFFLINE
    assert.ok(p.location);
  });

  await t.test("Cleanup", async () => {
    await prisma.location.deleteMany({ where: { personnelId: personnel.id } });
    await prisma.device.deleteMany({ where: { personnelId: personnel.id } });
    await prisma.personnel.deleteMany({ where: { id: personnel.id } });
    await prisma.user.deleteMany({ where: { id: { in: [adminUser.id, fieldUser.id] } } });
  });
});
