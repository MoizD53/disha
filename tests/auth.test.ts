import test from "node:test";
import assert from "node:assert";
import { hashPassword, verifyPassword } from "../src/lib/auth/password";
import { generateSessionToken, hashToken } from "../src/lib/auth/session";

test("Password hashing", async (t) => {
  await t.test("hashing generates a different string", async () => {
    const password = "SuperSecretPassword123!";
    const hash = await hashPassword(password);
    assert.notStrictEqual(password, hash);
    assert.ok(hash.startsWith("$argon2id$"));
  });

  await t.test("verify matches correct password", async () => {
    const password = "CorrectHorseBatteryStaple";
    const hash = await hashPassword(password);
    const isValid = await verifyPassword(password, hash);
    assert.strictEqual(isValid, true);
  });

  await t.test("verify fails wrong password", async () => {
    const password = "CorrectPassword";
    const hash = await hashPassword(password);
    const isValid = await verifyPassword("WrongPassword", hash);
    assert.strictEqual(isValid, false);
  });
});

test("Session tokens", async (t) => {
  await t.test("generateSessionToken generates a 64-char hex string", () => {
    const token = generateSessionToken();
    assert.strictEqual(token.length, 64);
  });

  await t.test("hashToken hashes the token using sha256", () => {
    const token = "a".repeat(64);
    const hash = hashToken(token);
    assert.notStrictEqual(token, hash);
    assert.strictEqual(hash.length, 64); // sha256 hex is 64 chars
  });
});
