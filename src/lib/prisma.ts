import "dotenv/config";
import { PrismaLibSql } from "@prisma/adapter-libsql";
import { PrismaClient } from "../../generated/prisma/client";

/**
 * Resilient fetch wrapper for Turso over HTTP.
 * Automatically retries transient DNS lookup failures (ENOTFOUND) and socket disconnects.
 */
const resilientFetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
  const maxAttempts = 3;
  let lastError: any;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const req = input instanceof Request ? input.clone() : input;
      return await fetch(req, init);
    } catch (err: any) {
      lastError = err;
      const isTransient =
        err?.code === "ENOTFOUND" ||
        err?.cause?.code === "ENOTFOUND" ||
        err?.message?.includes("ENOTFOUND") ||
        err?.message?.includes("fetch failed") ||
        err?.code === "ECONNRESET" ||
        err?.code === "ETIMEDOUT";

      if (isTransient && attempt < maxAttempts) {
        await new Promise((resolve) => setTimeout(resolve, 300 * attempt));
        continue;
      }
      throw err;
    }
  }

  throw lastError;
};

const adapter = new PrismaLibSql({
  url: process.env.TURSO_DATABASE_URL!,
  authToken: process.env.TURSO_AUTH_TOKEN!,
  fetch: resilientFetch,
});

export const prisma = new PrismaClient({
  adapter,
});