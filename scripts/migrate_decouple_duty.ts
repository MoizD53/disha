import { createClient } from "@libsql/client";
import "dotenv/config";

const client = createClient({
  url: process.env.TURSO_DATABASE_URL!,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

async function main() {
  try {
    // Drop existing tables to recreate them with optional dutySessionId
    // Note: Since this is MVP dev, dropping test data is acceptable for schema sync.
    await client.execute(`DROP TABLE IF EXISTS "Alert";`);
    await client.execute(`DROP TABLE IF EXISTS "SOSEvent";`);
    await client.execute(`DROP TABLE IF EXISTS "LocationEvent";`);
    await client.execute(`DROP TABLE IF EXISTS "Location";`);

    // Location
    await client.execute(`
      CREATE TABLE IF NOT EXISTS "Location" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "clientEventId" TEXT NOT NULL,
        "personnelId" TEXT NOT NULL,
        "deviceId" TEXT NOT NULL,
        "dutySessionId" TEXT,
        "latitude" REAL NOT NULL,
        "longitude" REAL NOT NULL,
        "accuracy" REAL NOT NULL,
        "recordedAt" DATETIME NOT NULL,
        "receivedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "source" TEXT NOT NULL DEFAULT 'UNKNOWN',
        "trackingMode" TEXT NOT NULL DEFAULT 'NORMAL',
        "batteryLevel" REAL,
        "networkState" TEXT,
        "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "Location_personnelId_fkey" FOREIGN KEY ("personnelId") REFERENCES "Personnel" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
        CONSTRAINT "Location_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "Device" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
        CONSTRAINT "Location_dutySessionId_fkey" FOREIGN KEY ("dutySessionId") REFERENCES "DutySession" ("id") ON DELETE SET NULL ON UPDATE CASCADE
      );
    `);
    await client.execute(`CREATE UNIQUE INDEX IF NOT EXISTS "Location_clientEventId_key" ON "Location"("clientEventId");`);
    await client.execute(`CREATE INDEX IF NOT EXISTS "Location_personnelId_recordedAt_idx" ON "Location"("personnelId", "recordedAt");`);
    await client.execute(`CREATE INDEX IF NOT EXISTS "Location_dutySessionId_recordedAt_idx" ON "Location"("dutySessionId", "recordedAt");`);

    // LocationEvent
    await client.execute(`
      CREATE TABLE IF NOT EXISTS "LocationEvent" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "clientEventId" TEXT NOT NULL,
        "eventType" TEXT NOT NULL,
        "personnelId" TEXT NOT NULL,
        "deviceId" TEXT NOT NULL,
        "dutySessionId" TEXT,
        "recordedAt" DATETIME NOT NULL,
        "receivedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "metadata" TEXT,
        "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "LocationEvent_personnelId_fkey" FOREIGN KEY ("personnelId") REFERENCES "Personnel" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
        CONSTRAINT "LocationEvent_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "Device" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
        CONSTRAINT "LocationEvent_dutySessionId_fkey" FOREIGN KEY ("dutySessionId") REFERENCES "DutySession" ("id") ON DELETE SET NULL ON UPDATE CASCADE
      );
    `);
    await client.execute(`CREATE UNIQUE INDEX IF NOT EXISTS "LocationEvent_clientEventId_key" ON "LocationEvent"("clientEventId");`);
    await client.execute(`CREATE INDEX IF NOT EXISTS "LocationEvent_personnelId_recordedAt_idx" ON "LocationEvent"("personnelId", "recordedAt");`);

    // SOSEvent
    await client.execute(`
      CREATE TABLE IF NOT EXISTS "SOSEvent" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "clientEventId" TEXT NOT NULL,
        "personnelId" TEXT NOT NULL,
        "deviceId" TEXT NOT NULL,
        "dutySessionId" TEXT,
        "startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "endedAt" DATETIME,
        "status" TEXT NOT NULL DEFAULT 'ACTIVE',
        "initialLocationId" TEXT,
        "lastLocationId" TEXT,
        "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" DATETIME NOT NULL,
        CONSTRAINT "SOSEvent_personnelId_fkey" FOREIGN KEY ("personnelId") REFERENCES "Personnel" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
        CONSTRAINT "SOSEvent_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "Device" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
        CONSTRAINT "SOSEvent_dutySessionId_fkey" FOREIGN KEY ("dutySessionId") REFERENCES "DutySession" ("id") ON DELETE SET NULL ON UPDATE CASCADE
      );
    `);
    
    // CRITICAL FIX: Only one active SOS per PERSONNEL instead of DutySession
    await client.execute(`CREATE UNIQUE INDEX IF NOT EXISTS "SOSEvent_personnelId_active_idx" ON "SOSEvent"("personnelId") WHERE "endedAt" IS NULL;`);
    await client.execute(`CREATE UNIQUE INDEX IF NOT EXISTS "SOSEvent_clientEventId_key" ON "SOSEvent"("clientEventId");`);
    await client.execute(`CREATE INDEX IF NOT EXISTS "SOSEvent_personnelId_status_idx" ON "SOSEvent"("personnelId", "status");`);

    // Alert
    await client.execute(`
      CREATE TABLE IF NOT EXISTS "Alert" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "type" TEXT NOT NULL,
        "severity" TEXT NOT NULL DEFAULT 'CRITICAL',
        "personnelId" TEXT NOT NULL,
        "dutySessionId" TEXT,
        "sosEventId" TEXT,
        "message" TEXT NOT NULL,
        "status" TEXT NOT NULL DEFAULT 'ACTIVE',
        "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "acknowledgedAt" DATETIME,
        "acknowledgedBy" TEXT,
        "resolvedAt" DATETIME,
        "resolvedBy" TEXT,
        CONSTRAINT "Alert_personnelId_fkey" FOREIGN KEY ("personnelId") REFERENCES "Personnel" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
        CONSTRAINT "Alert_dutySessionId_fkey" FOREIGN KEY ("dutySessionId") REFERENCES "DutySession" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
        CONSTRAINT "Alert_sosEventId_fkey" FOREIGN KEY ("sosEventId") REFERENCES "SOSEvent" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
        CONSTRAINT "Alert_acknowledgedBy_fkey" FOREIGN KEY ("acknowledgedBy") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
        CONSTRAINT "Alert_resolvedBy_fkey" FOREIGN KEY ("resolvedBy") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
      );
    `);
    await client.execute(`CREATE INDEX IF NOT EXISTS "Alert_status_idx" ON "Alert"("status");`);
    await client.execute(`CREATE INDEX IF NOT EXISTS "Alert_personnelId_status_idx" ON "Alert"("personnelId", "status");`);

    console.log("Decoupled telemetry & SOS tables recreated successfully.");
  } catch (err) {
    console.error(err);
  }
}

main();
