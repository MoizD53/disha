import test from "node:test";
import assert from "node:assert";
import { prisma } from "../src/lib/prisma";
import { UserRole, UserStatus } from "../generated/prisma/enums";
import { hashPassword } from "../src/lib/auth/password";
import { createSession } from "../src/lib/auth/session";

test("Access Control & Account Management (Phase 1 RBAC)", async (t) => {
  let superAdminUser: any;
  let superAdminToken: string;

  let staffOnlyAdminUser: any;
  let staffOnlyAdminToken: string;

  let mapOnlyAdminUser: any;
  let mapOnlyAdminToken: string;

  const TEST_SUPER_ADMIN = "test_super_admin_rbac";
  const TEST_STAFF_ADMIN = "test_staff_admin_rbac";
  const TEST_MAP_ADMIN = "test_map_admin_rbac";

  await t.test("Setup fixtures", async () => {
    // Cleanup any existing test users
    await prisma.user.deleteMany({
      where: {
        username: { in: [TEST_SUPER_ADMIN, TEST_STAFF_ADMIN, TEST_MAP_ADMIN, "new_test_admin", "new_test_staff"] },
      },
    });

    const pwdHash = await hashPassword("ValidPassword123!");

    // 1. Super Admin (role: SP)
    superAdminUser = await prisma.user.create({
      data: {
        username: TEST_SUPER_ADMIN,
        displayName: "Test Super Admin",
        passwordHash: pwdHash,
        role: UserRole.SP,
        status: UserStatus.ACTIVE,
      },
    });
    const s1 = await createSession(superAdminUser.id);
    superAdminToken = s1.token;

    // 2. Staff-only Admin
    staffOnlyAdminUser = await prisma.user.create({
      data: {
        username: TEST_STAFF_ADMIN,
        displayName: "Staff Manager Admin",
        passwordHash: pwdHash,
        role: UserRole.CONTROL_ROOM_OFFICER,
        status: UserStatus.ACTIVE,
        permissions: JSON.stringify(["STAFF_MANAGEMENT"]),
      },
    });
    const s2 = await createSession(staffOnlyAdminUser.id);
    staffOnlyAdminToken = s2.token;

    // 3. Map-only Admin
    mapOnlyAdminUser = await prisma.user.create({
      data: {
        username: TEST_MAP_ADMIN,
        displayName: "Map Tracker Admin",
        passwordHash: pwdHash,
        role: UserRole.CONTROL_ROOM_OFFICER,
        status: UserStatus.ACTIVE,
        permissions: JSON.stringify(["LIVE_MAP"]),
      },
    });
    const s3 = await createSession(mapOnlyAdminUser.id);
    mapOnlyAdminToken = s3.token;
  });

  await t.test("Admin Management: Super Admin can list admins, non-Super Admin gets 403", async () => {
    const { GET: adminListHandler } = await import("../src/app/api/admin/users/route");

    // 1. Non-Super Admin attempt -> 403 Forbidden
    const forbiddenReq = new Request("http://localhost/api/admin/users", {
      method: "GET",
      headers: { Cookie: `disha_session=${staffOnlyAdminToken}` },
    });
    const resForbidden = await adminListHandler(forbiddenReq);
    assert.strictEqual(resForbidden.status, 403);

    // 2. Super Admin attempt -> 200 OK
    const allowedReq = new Request("http://localhost/api/admin/users", {
      method: "GET",
      headers: { Cookie: `disha_session=${superAdminToken}` },
    });
    const resAllowed = await adminListHandler(allowedReq);
    assert.strictEqual(resAllowed.status, 200);
    const body = await resAllowed.json();
    assert.ok(Array.isArray(body.admins));
  });

  await t.test("Admin Management: Super Admin can create admin, duplicate username rejected", async () => {
    const { POST: createAdminHandler } = await import("../src/app/api/admin/users/route");

    // 1. Regular admin cannot create other admins
    const unauthorizedReq = new Request("http://localhost/api/admin/users", {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: `disha_session=${staffOnlyAdminToken}` },
      body: JSON.stringify({
        username: "new_test_admin",
        displayName: "New Admin",
        password: "SecurePassword123!",
        permissions: ["LIVE_MAP"],
      }),
    });
    const resUnauthorized = await createAdminHandler(unauthorizedReq);
    assert.strictEqual(resUnauthorized.status, 403);

    // 2. Super Admin can create new admin
    const validReq = new Request("http://localhost/api/admin/users", {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: `disha_session=${superAdminToken}` },
      body: JSON.stringify({
        username: "new_test_admin",
        displayName: "New Admin",
        password: "SecurePassword123!",
        permissions: ["LIVE_MAP"],
      }),
    });
    const resValid = await createAdminHandler(validReq);
    assert.strictEqual(resValid.status, 200);
    const validBody = await resValid.json();
    assert.strictEqual(validBody.success, true);
    assert.strictEqual(validBody.admin.username, "new_test_admin");
    assert.deepStrictEqual(validBody.admin.permissions, ["LIVE_MAP"]);

    // 3. Duplicate username rejected
    const duplicateReq = new Request("http://localhost/api/admin/users", {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: `disha_session=${superAdminToken}` },
      body: JSON.stringify({
        username: "new_test_admin",
        displayName: "Duplicate Admin",
        password: "SecurePassword123!",
        permissions: ["STAFF_MANAGEMENT"],
      }),
    });
    const resDuplicate = await createAdminHandler(duplicateReq);
    assert.strictEqual(resDuplicate.status, 400);
  });

  await t.test("Staff Management: Only authorized admins can access and create staff", async () => {
    const { GET: getStaffHandler, POST: createStaffHandler } = await import("../src/app/api/staff/route");

    // 1. Map-only admin cannot access staff list -> 403 Forbidden
    const mapOnlyReq = new Request("http://localhost/api/staff", {
      method: "GET",
      headers: { Cookie: `disha_session=${mapOnlyAdminToken}` },
    });
    const resMapOnly = await getStaffHandler(mapOnlyReq);
    assert.strictEqual(resMapOnly.status, 403);

    // 2. Staff-authorized admin CAN access staff list -> 200 OK
    const staffAdminReq = new Request("http://localhost/api/staff", {
      method: "GET",
      headers: { Cookie: `disha_session=${staffOnlyAdminToken}` },
    });
    const resStaffAdmin = await getStaffHandler(staffAdminReq);
    assert.strictEqual(resStaffAdmin.status, 200);

    // 3. Staff-authorized admin CAN create staff account
    const createStaffReq = new Request("http://localhost/api/staff", {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: `disha_session=${staffOnlyAdminToken}` },
      body: JSON.stringify({
        name: "Officer Priya Sharma",
        username: "new_test_staff",
        password: "StaffPassword123!",
        personnelCode: "STAFF-RBAC-01",
        designation: "Constable",
        unit: "Patrol Alpha",
      }),
    });
    const resCreateStaff = await createStaffHandler(createStaffReq);
    assert.strictEqual(resCreateStaff.status, 200);
    const staffBody = await resCreateStaff.json();
    assert.strictEqual(staffBody.success, true);
    assert.strictEqual(staffBody.staff.personnelCode, "STAFF-RBAC-01");

    // 4. Staff-authorized admin CAN create staff account without badge/designation/unit (auto-generated)
    const testUsername = `rahul_test_${Date.now()}`;
    const createStaffWithout3Req = new Request("http://localhost/api/staff", {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: `disha_session=${staffOnlyAdminToken}` },
      body: JSON.stringify({
        name: "Officer Rahul Verma",
        username: testUsername,
        password: "StaffPassword123!",
      }),
    });
    const resCreateStaffWithout3 = await createStaffHandler(createStaffWithout3Req);
    assert.strictEqual(resCreateStaffWithout3.status, 200);
    const staffWithout3Body = await resCreateStaffWithout3.json();
    assert.strictEqual(staffWithout3Body.success, true);
    assert.strictEqual(staffWithout3Body.staff.personnelCode, testUsername.toUpperCase());
    assert.strictEqual(staffWithout3Body.staff.name, "Officer Rahul Verma");

    // Cleanup created test staff
    await prisma.personnel.delete({ where: { id: staffWithout3Body.staff.id } });
    await prisma.user.delete({ where: { id: staffWithout3Body.staff.userId } });
  });

  await t.test("Admin Management: Super Admin can update admin, reset password, and cannot deactivate Super Admin", async () => {
    const { PATCH: updateAdminHandler } = await import("../src/app/api/admin/users/[id]/route");
    const { POST: resetAdminPasswordHandler } = await import("../src/app/api/admin/users/[id]/reset-password/route");

    const createdAdmin = await prisma.user.findUnique({ where: { username: "new_test_admin" } });
    assert.ok(createdAdmin);

    // 1. Update created admin display name and permissions
    const updateReq = new Request(`http://localhost/api/admin/users/${createdAdmin.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Cookie: `disha_session=${superAdminToken}` },
      body: JSON.stringify({
        displayName: "Updated Admin Name",
        permissions: ["STAFF_MANAGEMENT", "LIVE_MAP"],
      }),
    });
    const updateRes = await updateAdminHandler(updateReq, { params: Promise.resolve({ id: createdAdmin.id }) });
    assert.strictEqual(updateRes.status, 200);
    const updateBody = await updateRes.json();
    assert.strictEqual(updateBody.admin.displayName, "Updated Admin Name");
    assert.deepStrictEqual(updateBody.admin.permissions.sort(), ["LIVE_MAP", "STAFF_MANAGEMENT"]);

    // 2. Super Admin cannot be deactivated
    const deactSuperReq = new Request(`http://localhost/api/admin/users/${superAdminUser.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Cookie: `disha_session=${superAdminToken}` },
      body: JSON.stringify({ status: "INACTIVE" }),
    });
    const deactSuperRes = await updateAdminHandler(deactSuperReq, { params: Promise.resolve({ id: superAdminUser.id }) });
    assert.strictEqual(deactSuperRes.status, 400);

    // 3. Reset admin password leaves mustChangePassword as false
    const resetReq = new Request(`http://localhost/api/admin/users/${createdAdmin.id}/reset-password`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: `disha_session=${superAdminToken}` },
      body: JSON.stringify({ newPassword: "NewAdminPassword999!" }),
    });
    const resetRes = await resetAdminPasswordHandler(resetReq, { params: Promise.resolve({ id: createdAdmin.id }) });
    assert.strictEqual(resetRes.status, 200);

    const refreshedAdmin = await prisma.user.findUnique({ where: { id: createdAdmin.id } });
    assert.strictEqual(refreshedAdmin?.mustChangePassword, false);
  });

  await t.test("Staff Management: Edit staff, reset staff password, and toggle active state", async () => {
    const { PATCH: updateStaffHandler } = await import("../src/app/api/staff/[id]/route");
    const { POST: resetStaffPasswordHandler } = await import("../src/app/api/staff/[id]/reset-password/route");

    const staffUser = await prisma.user.findUnique({
      where: { username: "new_test_staff" },
      include: { personnel: true },
    });
    assert.ok(staffUser?.personnel);
    const staffId = staffUser.personnel.id;

    // 1. Update staff details
    const updateReq = new Request(`http://localhost/api/staff/${staffId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Cookie: `disha_session=${staffOnlyAdminToken}` },
      body: JSON.stringify({
        name: "Officer Priya Sharma Updated",
        designation: "Head Constable",
        active: false,
      }),
    });
    const updateRes = await updateStaffHandler(updateReq, { params: Promise.resolve({ id: staffId }) });
    assert.strictEqual(updateRes.status, 200);
    const updateBody = await updateRes.json();
    assert.strictEqual(updateBody.staff.name, "Officer Priya Sharma Updated");
    assert.strictEqual(updateBody.staff.designation, "Head Constable");
    assert.strictEqual(updateBody.staff.active, false);

    // 2. Reset staff password leaves mustChangePassword as false
    const resetReq = new Request(`http://localhost/api/staff/${staffId}/reset-password`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: `disha_session=${staffOnlyAdminToken}` },
      body: JSON.stringify({ newPassword: "NewStaffPassword456!" }),
    });
    const resetRes = await resetStaffPasswordHandler(resetReq, { params: Promise.resolve({ id: staffId }) });
    assert.strictEqual(resetRes.status, 200);

    const refreshedStaffUser = await prisma.user.findUnique({ where: { id: staffUser.id } });
    assert.strictEqual(refreshedStaffUser?.mustChangePassword, false);

    // 3. Delete staff member
    const { DELETE: deleteStaffHandler } = await import("../src/app/api/staff/[id]/route");
    const deleteReq = new Request(`http://localhost/api/staff/${staffId}`, {
      method: "DELETE",
      headers: { Cookie: `disha_session=${staffOnlyAdminToken}` },
    });
    const deleteRes = await deleteStaffHandler(deleteReq, { params: Promise.resolve({ id: staffId }) });
    assert.strictEqual(deleteRes.status, 200);

    const deletedStaff = await prisma.personnel.findUnique({ where: { id: staffId } });
    assert.strictEqual(deletedStaff, null);
  });

  await t.test("Live Map: Only admins with LIVE_MAP permission can fetch live overview", async () => {
    const { GET: overviewHandler } = await import("../src/app/api/control-room/overview/route");

    // 1. Staff-only admin CANNOT access Live Map API -> 403 Forbidden
    const staffReq = new Request("http://localhost/api/control-room/overview", {
      method: "GET",
      headers: { Cookie: `disha_session=${staffOnlyAdminToken}` },
    });
    const resStaff = await overviewHandler(staffReq);
    assert.strictEqual(resStaff.status, 403);

    // 2. Map-authorized admin CAN access Live Map API -> 200 OK
    const mapReq = new Request("http://localhost/api/control-room/overview", {
      method: "GET",
      headers: { Cookie: `disha_session=${mapOnlyAdminToken}` },
    });
    const resMap = await overviewHandler(mapReq);
    assert.strictEqual(resMap.status, 200);

    // 3. Super Admin CAN access Live Map API -> 200 OK
    const superReq = new Request("http://localhost/api/control-room/overview", {
      method: "GET",
      headers: { Cookie: `disha_session=${superAdminToken}` },
    });
    const resSuper = await overviewHandler(superReq);
    assert.strictEqual(resSuper.status, 200);

    // 4. Location History: Staff-only admin gets 403 Forbidden, Map-authorized admin gets 200
    const { GET: historyHandler } = await import("../src/app/api/control-room/personnel/[id]/location-history/route");
    const staffHistoryReq = new Request("http://localhost/api/control-room/personnel/some-id/location-history?start=2026-01-01T00:00:00Z&end=2026-01-02T00:00:00Z", {
      method: "GET",
      headers: { Cookie: `disha_session=${staffOnlyAdminToken}` },
    });
    const resStaffHistory = await historyHandler(staffHistoryReq, { params: Promise.resolve({ id: "some-id" }) });
    assert.strictEqual(resStaffHistory.status, 403);

    const mapHistoryReq = new Request("http://localhost/api/control-room/personnel/some-id/location-history?start=2026-01-01T00:00:00Z&end=2026-01-02T00:00:00Z", {
      method: "GET",
      headers: { Cookie: `disha_session=${mapOnlyAdminToken}` },
    });
    const resMapHistory = await historyHandler(mapHistoryReq, { params: Promise.resolve({ id: "some-id" }) });
    assert.strictEqual(resMapHistory.status, 200);
  });

  await t.test("Cleanup test fixtures", async () => {
    const staffUser = await prisma.user.findUnique({ where: { username: "new_test_staff" } });
    if (staffUser) {
      await prisma.personnel.deleteMany({ where: { userId: staffUser.id } });
      await prisma.user.delete({ where: { id: staffUser.id } });
    }
    await prisma.user.deleteMany({
      where: {
        username: { in: [TEST_SUPER_ADMIN, TEST_STAFF_ADMIN, TEST_MAP_ADMIN, "new_test_admin"] },
      },
    });
  });
});
