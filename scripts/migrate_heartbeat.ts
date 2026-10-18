import { createClient } from "@libsql/client";
import "dotenv/config";

const client = createClient({
  url: process.env.TURSO_DATABASE_URL!,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

async function main() {
  try {
    await client.execute(`
      CREATE TABLE IF NOT EXISTS "Heartbeat" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "deviceId" TEXT NOT NULL,
        "personnelId" TEXT NOT NULL,
        "batteryLevel" REAL,
        "networkState" TEXT,
        "appVersion" TEXT,
        "healthState" TEXT,
        "recordedAt" DATETIME NOT NULL,
        "receivedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "Heartbeat_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "Device" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
        CONSTRAINT "Heartbeat_personnelId_fkey" FOREIGN KEY ("personnelId") REFERENCES "Personnel" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
      );
    `);
    await client.execute(`CREATE INDEX IF NOT EXISTS "Heartbeat_personnelId_recordedAt_idx" ON "Heartbeat"("personnelId", "recordedAt");`);
    
    console.log("Heartbeat table created.");
  } catch (err) {
    console.error(err);
  }
}

main();
