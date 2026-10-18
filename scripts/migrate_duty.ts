import { createClient } from "@libsql/client";
import "dotenv/config";

const client = createClient({
  url: process.env.TURSO_DATABASE_URL!,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

async function main() {
  try {
    await client.execute(`
      CREATE TABLE IF NOT EXISTS "DutySession" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "personnelId" TEXT NOT NULL,
        "deviceId" TEXT NOT NULL,
        "status" TEXT NOT NULL DEFAULT 'DUTY_STARTED',
        "startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "endedAt" DATETIME,
        "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" DATETIME NOT NULL,
        CONSTRAINT "DutySession_personnelId_fkey" FOREIGN KEY ("personnelId") REFERENCES "Personnel" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
        CONSTRAINT "DutySession_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "Device" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
      );
    `);
    
    // Concurrency protection: partial unique index so a personnel can only have one active duty session at a time
    await client.execute(`
      CREATE UNIQUE INDEX IF NOT EXISTS "DutySession_personnel_active_idx" 
      ON "DutySession" ("personnelId") 
      WHERE "endedAt" IS NULL;
    `);

    console.log("DutySession table and unique index created successfully.");
  } catch (err) {
    console.error(err);
  }
}

main();
