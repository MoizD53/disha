import { createClient } from "@libsql/client";
import "dotenv/config";

const client = createClient({
  url: process.env.TURSO_DATABASE_URL!,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

async function main() {
  try {
    await client.execute(`
      CREATE TABLE IF NOT EXISTS "DeviceCredential" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "deviceId" TEXT NOT NULL,
        "tokenHash" TEXT NOT NULL,
        "isActive" BOOLEAN NOT NULL DEFAULT 1,
        "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "lastUsedAt" DATETIME,
        CONSTRAINT "DeviceCredential_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "Device" ("id") ON DELETE CASCADE ON UPDATE CASCADE
      );
    `);

    await client.execute(`
      CREATE UNIQUE INDEX IF NOT EXISTS "DeviceCredential_tokenHash_key" ON "DeviceCredential"("tokenHash");
    `);

    await client.execute(`
      CREATE INDEX IF NOT EXISTS "DeviceCredential_deviceId_isActive_idx" ON "DeviceCredential"("deviceId", "isActive");
    `);

    console.log("DeviceCredential table and indexes created successfully.");
  } catch (err) {
    console.error("Migration error:", err);
  }
}

main();
