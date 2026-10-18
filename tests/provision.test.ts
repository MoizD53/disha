import test from "node:test";
import assert from "node:assert";
import { prisma } from "../src/lib/prisma";
import { hashPassword, verifyPassword } from "../src/lib/auth/password";
import { UserRole, UserStatus } from "../generated/prisma/enums";

const TEST_ADMIN_USER = "test_sp_prov_admin";
const TEST_FIELD_USER = "test_field_prov_officer";
const TEST_PERSONNEL_CODE = "TEST-POL-PROV-99";

async function cleanFixtures() {
  await prisma.personnel.deleteMany({ where: { personnelCode: TEST_PERSONNEL_CODE } });
  await prisma.user.deleteMany({ where: { username: { in: [TEST_ADMIN_USER, TEST_FIELD_USER] } } });
}

test("Personnel & Admin Provisioning Workflow", async (t) => {
  await t.test("Setup test fixtures", async () => {
    await cleanFixtures();
  });

  await t.test("Argon2id password hashing validation", async () => {
    const rawPass = "SuperSecretPass123!";
    const hash = await hashPassword(rawPass);
    assert.ok(hash.startsWith("$argon2id$"));
    assert.strictEqual(await verifyPassword(rawPass, hash), true);
    assert.strictEqual(await verifyPassword("WrongPassword!", hash), false);
  });

  await t.test("Provision SP Admin: Creates User with SP role and NO Personnel record", async () => {
    const hash = await hashPassword("AdminPass123!");
    const user = await prisma.user.create({
      data: {
        username: TEST_ADMIN_USER,
        passwordHash: hash,
        role: UserRole.SP,
        status: UserStatus.ACTIVE,
      },
      include: { personnel: true },
    });

    assert.ok(user.id);
    assert.strictEqual(user.username, TEST_ADMIN_USER);
    assert.strictEqual(user.role, UserRole.SP);
    assert.strictEqual(user.status, UserStatus.ACTIVE);
    assert.strictEqual(user.personnel, null, "SP user should not have a field personnel record");
  });

  await t.test("Provision SP Admin Idempotency: Re-provisioning updates credentials and stays ACTIVE", async () => {
    const existing = await prisma.user.findUnique({
      where: { username: TEST_ADMIN_USER },
      include: { personnel: true },
    });
    assert.ok(existing);

    const newHash = await hashPassword("NewAdminPass456!");
    const updated = await prisma.user.update({
      where: { id: existing.id },
      data: {
        passwordHash: newHash,
        role: UserRole.SP,
        status: UserStatus.ACTIVE,
      },
    });

    assert.strictEqual(updated.id, existing.id);
    assert.strictEqual(await verifyPassword("NewAdminPass456!", updated.passwordHash), true);
  });

  await t.test("Provision FIELD_PERSONNEL: Creates User and linked Personnel record", async () => {
    const hash = await hashPassword("OfficerPass123!");
    const user = await prisma.user.create({
      data: {
        username: TEST_FIELD_USER,
        passwordHash: hash,
        role: UserRole.FIELD_PERSONNEL,
        status: UserStatus.ACTIVE,
      },
    });

    const personnel = await prisma.personnel.create({
      data: {
        userId: user.id,
        personnelCode: TEST_PERSONNEL_CODE,
        name: "Officer Test",
        designation: "Sub-Inspector",
        unit: "Delta Unit",
        phone: "+919999999999",
        active: true,
      },
    });

    assert.ok(personnel.id);
    assert.strictEqual(personnel.userId, user.id);
    assert.strictEqual(personnel.personnelCode, TEST_PERSONNEL_CODE);
    assert.strictEqual(personnel.active, true);

    const retrieved = await prisma.user.findUnique({
      where: { username: TEST_FIELD_USER },
      include: { personnel: true },
    });

    assert.ok(retrieved?.personnel);
    assert.strictEqual(retrieved.personnel.personnelCode, TEST_PERSONNEL_CODE);
    assert.strictEqual(retrieved.personnel.name, "Officer Test");
  });

  await t.test("Provision FIELD_PERSONNEL Idempotency: Re-provisioning safely updates profile", async () => {
    const existingUser = await prisma.user.findUnique({
      where: { username: TEST_FIELD_USER },
      include: { personnel: true },
    });
    assert.ok(existingUser && existingUser.personnel);

    const newHash = await hashPassword("UpdatedOfficerPass789!");
    await prisma.user.update({
      where: { id: existingUser.id },
      data: {
        passwordHash: newHash,
        role: UserRole.FIELD_PERSONNEL,
        status: UserStatus.ACTIVE,
      },
    });

    const updatedPersonnel = await prisma.personnel.update({
      where: { id: existingUser.personnel.id },
      data: {
        name: "Officer Test Updated",
        designation: "Inspector",
        unit: "Alpha Unit",
        active: true,
      },
    });

    assert.strictEqual(updatedPersonnel.name, "Officer Test Updated");
    assert.strictEqual(updatedPersonnel.designation, "Inspector");
    assert.strictEqual(updatedPersonnel.unit, "Alpha Unit");
    assert.strictEqual(updatedPersonnel.personnelCode, TEST_PERSONNEL_CODE);
  });

  await t.test("Cleanup test fixtures", async () => {
    await cleanFixtures();
  });
});
