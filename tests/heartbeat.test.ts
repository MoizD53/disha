import test from "node:test";
import assert from "node:assert";
import { prisma } from "../src/lib/prisma";
import { UserStatus, DeviceStatus } from "../generated/prisma/enums";

test("Heartbeat Logic", async (t) => {
  let userField: any;
  let personnel: any;
  let device: any;
  
  await t.test("Setup", async () => {
    userField = await prisma.user.create({ data: { username: "hb_user", passwordHash: "x", role: "FIELD_PERSONNEL", status: UserStatus.ACTIVE } });
    personnel = await prisma.personnel.create({ data: { userId: userField.id, personnelCode: "HB-1", name: "HB 1", active: true } });
    device = await prisma.device.create({ data: { personnelId: personnel.id, deviceIdentifier: "HB-DEV-1", platform: "Android", status: DeviceStatus.ACTIVE } });
  });

  await t.test("Valid heartbeat", async () => {
    const { POST } = await import("../src/app/api/telemetry/heartbeat/route");
    const req = new Request("http://localhost/api/telemetry/heartbeat", {
      method: "POST",
      body: JSON.stringify({
        personnelId: personnel.id,
        batteryLevel: 90,
        networkState: "ONLINE",
        recordedAt: new Date().toISOString()
      })
    });
    
    const res = await POST(req);
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.status, "accepted");
  });

  await t.test("Dashboard resolves ONLINE device state", async () => {
    const { getDashboardOverview } = await import("../src/services/control-room/dashboard_service");
    const overview = await getDashboardOverview();
    const p = overview.find(x => x.id === personnel.id);
    assert.ok(p);
    assert.strictEqual(p.deviceStatus, "ONLINE");
    assert.ok(p.lastHeartbeat);
  });

  await t.test("Cleanup", async () => {
    await prisma.heartbeat.deleteMany({ where: { personnelId: personnel.id } });
    await prisma.device.deleteMany({ where: { personnelId: personnel.id } });
    await prisma.personnel.deleteMany({ where: { id: personnel.id } });
    await prisma.user.deleteMany({ where: { id: userField.id } });
  });
});
