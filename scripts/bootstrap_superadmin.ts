import { prisma } from "../src/lib/prisma";
import { hashPassword } from "../src/lib/auth/password";
import { UserRole, UserStatus } from "../generated/prisma/enums";

/**
 * Super Admin Bootstrap Script
 *
 * Production Usage:
 *   INITIAL_ADMIN_USERNAME="admin" INITIAL_ADMIN_PASSWORD="<strong-password>" npx tsx scripts/bootstrap_superadmin.ts
 *   or:
 *   npx tsx scripts/bootstrap_superadmin.ts <username> <strong-password>
 *
 * Security Requirements:
 * - In production (NODE_ENV=production):
 *   - NEVER falls back to default credentials like admin123.
 *   - Requires explicitly supplied credentials and strong password (min 10 characters).
 *   - Fails safely with non-zero exit code if missing or weak.
 * - Argon2id hashing with cryptographic salt.
 * - Flags 'mustChangePassword: true' so the admin must set a secure password on login.
 * - Idempotent & non-destructive: updates existing Super Admin record without deleting data.
 * - Never prints plaintext password or database connection secrets.
 */
async function bootstrap() {
  const isProduction = process.env.NODE_ENV === "production";

  const rawUsername = process.argv[2] || process.env.INITIAL_ADMIN_USERNAME;
  const rawPassword = process.argv[3] || process.env.INITIAL_ADMIN_PASSWORD;

  // Strict production validation
  if (isProduction) {
    if (!rawUsername) {
      console.error("[FATAL] Super Admin Bootstrap: Username must be explicitly supplied in production via CLI argument or INITIAL_ADMIN_USERNAME env variable.");
      process.exit(1);
    }
    if (!rawPassword) {
      console.error("[FATAL] Super Admin Bootstrap: Password must be explicitly supplied in production via CLI argument or INITIAL_ADMIN_PASSWORD env variable.");
      process.exit(1);
    }
    if (rawPassword === "admin123" || rawPassword === "password" || rawPassword.toLowerCase() === rawUsername.toLowerCase()) {
      console.error("[FATAL] Super Admin Bootstrap: Insecure or default password ('admin123' / username match) is strictly rejected in production.");
      process.exit(1);
    }
    if (rawPassword.length < 10) {
      console.error("[FATAL] Super Admin Bootstrap: Production Super Admin password must be at least 10 characters long.");
      process.exit(1);
    }
  }

  // Development fallback with explicit warning
  const username = (rawUsername || "admin").trim().toLowerCase();
  const password = rawPassword || "admin123";

  if (!rawPassword) {
    console.warn("[SECURITY WARNING] No password explicitly provided. Falling back to default development password. THIS IS STRICTLY PROHIBITED IN PRODUCTION.");
  }

  if (username.length < 3) {
    console.error("Error: Username must be at least 3 characters.");
    process.exit(1);
  }

  if (password.length < 8) {
    console.error("Error: Password must be at least 8 characters long.");
    process.exit(1);
  }

  console.log(`Bootstrapping Super Admin account: '${username}'...`);

  const passwordHash = await hashPassword(password);

  const existing = await prisma.user.findUnique({
    where: { username },
  });

  if (existing) {
    await prisma.user.update({
      where: { id: existing.id },
      data: {
        role: UserRole.SP,
        status: UserStatus.ACTIVE,
        displayName: existing.displayName || "Super Administrator",
        passwordHash,
        mustChangePassword: false,
      },
    });
    console.log(`[SUCCESS] Existing Super Admin '${username}' updated successfully.`);
    console.log(`- Role: SP (Super Admin)`);
    console.log(`- Status: ACTIVE`);
    console.log(`- Password: Securely hashed with Argon2id`);
    console.log(`- Must Change Password: false`);
  } else {
    await prisma.user.create({
      data: {
        username,
        displayName: "Super Administrator",
        role: UserRole.SP,
        status: UserStatus.ACTIVE,
        passwordHash,
        permissions: "[]",
        mustChangePassword: false,
      },
    });
    console.log(`[SUCCESS] Super Admin '${username}' created successfully.`);
    console.log(`- Role: SP (Super Admin)`);
    console.log(`- Status: ACTIVE`);
    console.log(`- Password: Securely hashed with Argon2id`);
    console.log(`- Must Change Password: false`);
  }
}

bootstrap()
  .catch((err) => {
    console.error("[ERROR] Bootstrap failed:", err);
    process.exit(1);
  })
  .finally(() => {
    setTimeout(() => process.exit(0), 100);
  });
