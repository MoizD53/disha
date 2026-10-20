import test from "node:test";
import assert from "node:assert";
import { prisma } from "../src/lib/prisma";
import { getStaffLocationTrail, haversineDistanceMeters } from "../src/services/control-room/trail_service";
import { randomUUID } from "node:crypto";
import { getISTDayRange } from "../src/lib/utils/time";

test("Staff Location Trail & Route History Service", async (t) => {
  let testUser: any;
  let testPersonnel: any;
  let testDevice: any;
  let testSession1: any;
  let testSession2: any;

  await t.test("Setup fixtures", async () => {
    testUser = await prisma.user.create({
      data: {
        username: `trail_test_${Date.now()}`,
        passwordHash: "hash",
        role: "FIELD_PERSONNEL",
        status: "ACTIVE",
      },
    });

    testPersonnel = await prisma.personnel.create({
      data: {
        userId: testUser.id,
        name: "Officer Trail Test",
        designation: "Constable",
        unit: "Traffic",
        personnelCode: `PC-TR-${Date.now()}`,
        active: true,
      },
    });

    testDevice = await prisma.device.create({
      data: {
        personnelId: testPersonnel.id,
        deviceIdentifier: `DEV-TR-${Date.now()}`,
        platform: "ANDROID",
        status: "ACTIVE",
      },
    });

    // Create two duty sessions on 2026-10-20
    testSession1 = await prisma.dutySession.create({
      data: {
        personnelId: testPersonnel.id,
        deviceId: testDevice.id,
        status: "DUTY_ENDED",
        startedAt: new Date("2026-10-20T03:30:00.000Z"), // 09:00 IST
        endedAt: new Date("2026-10-20T07:30:00.000Z"), // 13:00 IST
      },
    });

    testSession2 = await prisma.dutySession.create({
      data: {
        personnelId: testPersonnel.id,
        deviceId: testDevice.id,
        status: "DUTY_STARTED",
        startedAt: new Date("2026-10-20T09:30:00.000Z"), // 15:00 IST
        endedAt: null,
      },
    });

    // Add 4 chronological points in Session 1
    // Point 1: Dahod Station
    await prisma.location.create({
      data: {
        clientEventId: randomUUID(),
        personnelId: testPersonnel.id,
        deviceId: testDevice.id,
        dutySessionId: testSession1.id,
        latitude: 22.8333,
        longitude: 74.2562,
        accuracy: 8.5, // Optimal <= 10m
        recordedAt: new Date("2026-10-20T04:00:00.000Z"),
        source: "GPS",
      },
    });

    // Point 2: 500m away, 5 min later (normal patrol walking/driving)
    await prisma.location.create({
      data: {
        clientEventId: randomUUID(),
        personnelId: testPersonnel.id,
        deviceId: testDevice.id,
        dutySessionId: testSession1.id,
        latitude: 22.8360,
        longitude: 74.2580,
        accuracy: 14.0, // Verified <= 20m
        recordedAt: new Date("2026-10-20T04:05:00.000Z"),
        source: "GPS",
      },
    });

    // Point 3: Tracking Gap of 30 mins, then new point
    await prisma.location.create({
      data: {
        clientEventId: randomUUID(),
        personnelId: testPersonnel.id,
        deviceId: testDevice.id,
        dutySessionId: testSession1.id,
        latitude: 22.8390,
        longitude: 74.2600,
        accuracy: 18.0,
        recordedAt: new Date("2026-10-20T04:35:00.000Z"),
        source: "GPS",
      },
    });

    // Point 4: Massive GPS Teleportation Jump (10km in 10 seconds -> 3600 km/h)
    await prisma.location.create({
      data: {
        clientEventId: randomUUID(),
        personnelId: testPersonnel.id,
        deviceId: testDevice.id,
        dutySessionId: testSession1.id,
        latitude: 22.9200,
        longitude: 74.3500,
        accuracy: 120.0, // Coarse / Low accuracy
        recordedAt: new Date("2026-10-20T04:35:10.000Z"),
        source: "NETWORK",
      },
    });

    // Point 5: In Session 2 (afternoon session)
    await prisma.location.create({
      data: {
        clientEventId: randomUUID(),
        personnelId: testPersonnel.id,
        deviceId: testDevice.id,
        dutySessionId: testSession2.id,
        latitude: 22.8400,
        longitude: 74.2610,
        accuracy: 9.0,
        recordedAt: new Date("2026-10-20T10:00:00.000Z"),
        source: "GPS",
      },
    });
  });

  await t.test("Haversine distance calculation is accurate", () => {
    // Distance between (22.8333, 74.2562) and (22.8360, 74.2580) is ~354 meters
    const dist = haversineDistanceMeters(22.8333, 74.2562, 22.8360, 74.2580);
    assert.ok(dist > 340 && dist < 370, `Expected distance ~354m, got ${dist}`);
  });

  await t.test("Fetch entire day trail with summary and jump filtering", async () => {
    const result = await getStaffLocationTrail(testPersonnel.id, {
      dateStr: "2026-10-20",
    });

    assert.strictEqual(result.personnel.id, testPersonnel.id);
    assert.strictEqual(result.sessions.length, 2);
    assert.strictEqual(result.locations.length, 5);

    // Verify summary statistics
    const summary = result.summary;
    assert.strictEqual(summary.totalPoints, 5);
    assert.strictEqual(summary.optimalPointsCount, 2); // 8.5m and 9.0m
    assert.strictEqual(summary.verifiedPointsCount, 4); // 8.5m, 14.0m, 18.0m, 9.0m
    assert.strictEqual(summary.coarsePointsCount, 1); // 120m

    // Verify that the teleportation jump was flagged as anomaly and excluded from distance
    assert.strictEqual(summary.jumpAnomaliesCount, 1);
    assert.ok(result.locations[3].isAnomaly === true);
    // Estimated distance should be ~0.8 to 1.5 km, NOT 12+ km!
    assert.ok(
      summary.estimatedDistanceKm < 5.0,
      `Distance should not include 10km jump, got ${summary.estimatedDistanceKm} km`
    );

    // Verify tracking gap detection (> 5 mins)
    assert.ok(summary.gapCount >= 1);
    assert.ok(summary.longestGapMinutes >= 29);
  });

  await t.test("Filter trail by specific duty session", async () => {
    const resultSession1 = await getStaffLocationTrail(testPersonnel.id, {
      dateStr: "2026-10-20",
      dutySessionId: testSession1.id,
    });

    assert.strictEqual(resultSession1.locations.length, 4);
    assert.ok(resultSession1.locations.every((l) => l.dutySessionId === testSession1.id));
  });

  await t.test("Handle empty dates gracefully", async () => {
    const resultEmpty = await getStaffLocationTrail(testPersonnel.id, {
      dateStr: "2025-01-01",
    });

    assert.strictEqual(resultEmpty.locations.length, 0);
    assert.strictEqual(resultEmpty.summary.totalPoints, 0);
    assert.strictEqual(resultEmpty.summary.estimatedDistanceKm, 0);
    assert.strictEqual(resultEmpty.summary.gapCount, 0);
  });

  await t.test("Cleanup test fixtures", async () => {
    await prisma.location.deleteMany({ where: { personnelId: testPersonnel.id } });
    await prisma.dutySession.deleteMany({ where: { personnelId: testPersonnel.id } });
    await prisma.device.deleteMany({ where: { personnelId: testPersonnel.id } });
    await prisma.personnel.delete({ where: { id: testPersonnel.id } });
    await prisma.user.delete({ where: { id: testUser.id } });
  });
});
