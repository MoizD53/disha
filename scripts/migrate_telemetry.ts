import { createClient } from "@libsql/client";
import "dotenv/config";

const client = createClient({
  url: process.env.TURSO_DATABASE_URL!,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

async function main() {
  try {
    await client.execute(`
      CREATE TABLE IF NOT EXISTS "Location" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "clientEventId" TEXT NOT NULL,
        "personnelId" TEXT NOT NULL,
        "deviceId" TEXT NOT NULL,
        "dutySessionId" TEXT NOT NULL,
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
        CONSTRAINT "Location_dutySessionId_fkey" FOREIGN KEY ("dutySessionId") REFERENCES "DutySession" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
      );
    `);
    
    await client.execute(`CREATE UNIQUE INDEX IF NOT EXISTS "Location_clientEventId_key" ON "Location"("clientEventId");`);
    await client.execute(`CREATE INDEX IF NOT EXISTS "Location_personnelId_recordedAt_idx" ON "Location"("personnelId", "recordedAt");`);
    await client.execute(`CREATE INDEX IF NOT EXISTS "Location_dutySessionId_recordedAt_idx" ON "Location"("dutySessionId", "recordedAt");`);

    await client.execute(`
      CREATE TABLE IF NOT EXISTS "LocationEvent" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "clientEventId" TEXT NOT NULL,
        "eventType" TEXT NOT NULL,
        "personnelId" TEXT NOT NULL,
        "deviceId" TEXT NOT NULL,
        "dutySessionId" TEXT NOT NULL,
        "recordedAt" DATETIME NOT NULL,
        "receivedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "metadata" TEXT,
        "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "LocationEvent_personnelId_fkey" FOREIGN KEY ("personnelId") REFERENCES "Personnel" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
        CONSTRAINT "LocationEvent_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "Device" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
        CONSTRAINT "LocationEvent_dutySessionId_fkey" FOREIGN KEY ("dutySessionId") REFERENCES "DutySession" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
      );
    `);

    await client.execute(`CREATE UNIQUE INDEX IF NOT EXISTS "LocationEvent_clientEventId_key" ON "LocationEvent"("clientEventId");`);
    await client.execute(`CREATE INDEX IF NOT EXISTS "LocationEvent_personnelId_recordedAt_idx" ON "LocationEvent"("personnelId", "recordedAt");`);

    console.log("Telemetry tables and indexes created successfully.");
  } catch (err) {
    console.error(err);
  }
}

main();
