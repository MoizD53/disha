import { prisma } from "../src/lib/prisma";

async function main() {
  console.log("Checking User table columns...");
  const cols = await prisma.$queryRawUnsafe<any[]>('PRAGMA table_info("User")');
  const colNames = cols.map((c: any) => c.name);
  console.log("Existing columns:", colNames);

  if (!colNames.includes("displayName")) {
    console.log("Adding displayName column to User table...");
    await prisma.$executeRawUnsafe('ALTER TABLE "User" ADD COLUMN "displayName" TEXT');
    console.log("Added displayName.");
  }

  if (!colNames.includes("permissions")) {
    console.log("Adding permissions column to User table...");
    await prisma.$executeRawUnsafe('ALTER TABLE "User" ADD COLUMN "permissions" TEXT DEFAULT \'[]\'');
    console.log("Added permissions.");
  }

  if (!colNames.includes("mustChangePassword")) {
    console.log("Adding mustChangePassword column to User table...");
    await prisma.$executeRawUnsafe('ALTER TABLE "User" ADD COLUMN "mustChangePassword" BOOLEAN NOT NULL DEFAULT 0');
    console.log("Added mustChangePassword.");
  }

  const updatedCols = await prisma.$queryRawUnsafe<any[]>('PRAGMA table_info("User")');
  console.log("Updated columns:", updatedCols.map((c: any) => c.name));

  // Update existing admin user to have a default displayName and empty permissions
  const admin = await prisma.user.findUnique({ where: { username: "admin" } });
  if (admin) {
    await prisma.$executeRawUnsafe(
      'UPDATE "User" SET "displayName" = ? WHERE "username" = ? AND "displayName" IS NULL',
      "Super Administrator",
      "admin"
    );
    console.log("Updated admin displayName to 'Super Administrator'.");
  }
}

main()
  .catch(console.error)
  .finally(() => {
    // allow process to exit cleanly
    setTimeout(() => process.exit(0), 100);
  });
