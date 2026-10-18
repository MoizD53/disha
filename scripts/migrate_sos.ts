import { createClient } from "@libsql/client";
import "dotenv/config";

const client = createClient({
  url: process.env.TURSO_DATABASE_URL!,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

async function main() {
  try {
    await client.execute(`
      CREATE TABLE IF NOT EXISTS "SOSEvent" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "clientEventId" TEXT NOT NULL,
        "personnelId" TEXT NOT NULL,
        "deviceId" TEXT NOT NULL,
        "dutySessionId" TEXT NOT NULL,
        "startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "endedAt" DATETIME,
        "status" TEXT NOT NULL DEFAULT 'ACTIVE',
        "initialLocationId" TEXT,
        "lastLocationId" TEXT,
        "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" DATETIME NOT NULL,
        CONSTRAINT "SOSEvent_personnelId_fkey" FOREIGN KEY ("personnelId") REFERENCES "Personnel" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
        CONSTRAINT "SOSEvent_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "Device" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
        CONSTRAINT "SOSEvent_dutySessionId_fkey" FOREIGN KEY ("dutySessionId") REFERENCES "DutySession" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
      );
    `);

    // Only one active SOS per duty session
    await client.execute(`CREATE UNIQUE INDEX IF NOT EXISTS "SOSEvent_dutySessionId_active_idx" ON "SOSEvent"("dutySessionId") WHERE "endedAt" IS NULL;`);
    await client.execute(`CREATE UNIQUE INDEX IF NOT EXISTS "SOSEvent_clientEventId_key" ON "SOSEvent"("clientEventId");`);
    await client.execute(`CREATE INDEX IF NOT EXISTS "SOSEvent_personnelId_status_idx" ON "SOSEvent"("personnelId", "status");`);
    await client.execute(`CREATE INDEX IF NOT EXISTS "SOSEvent_dutySessionId_status_idx" ON "SOSEvent"("dutySessionId", "status");`);

    await client.execute(`
      CREATE TABLE IF NOT EXISTS "Alert" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "type" TEXT NOT NULL,
        "severity" TEXT NOT NULL DEFAULT 'CRITICAL',
        "personnelId" TEXT NOT NULL,
        "dutySessionId" TEXT NOT NULL,
        "sosEventId" TEXT,
        "message" TEXT NOT NULL,
        "status" TEXT NOT NULL DEFAULT 'ACTIVE',
        "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "acknowledgedAt" DATETIME,
        "acknowledgedBy" TEXT,
        "resolvedAt" DATETIME,
        "resolvedBy" TEXT,
        CONSTRAINT "Alert_personnelId_fkey" FOREIGN KEY ("personnelId") REFERENCES "Personnel" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
        CONSTRAINT "Alert_dutySessionId_fkey" FOREIGN KEY ("dutySessionId") REFERENCES "DutySession" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
        CONSTRAINT "Alert_sosEventId_fkey" FOREIGN KEY ("sosEventId") REFERENCES "SOSEvent" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
        CONSTRAINT "Alert_acknowledgedBy_fkey" FOREIGN KEY ("acknowledgedBy") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
        CONSTRAINT "Alert_resolvedBy_fkey" FOREIGN KEY ("resolvedBy") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
      );
    `);

    await client.execute(`CREATE INDEX IF NOT EXISTS "Alert_status_idx" ON "Alert"("status");`);
    await client.execute(`CREATE INDEX IF NOT EXISTS "Alert_personnelId_status_idx" ON "Alert"("personnelId", "status");`);

    console.log("SOS and Alert tables created successfully.");
  } catch (err) {
    console.error(err);
  }
}

main();
