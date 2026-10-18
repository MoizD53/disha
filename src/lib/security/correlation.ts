import { randomUUID } from "crypto";

export function getCorrelationId(req: Request): string {
  const existing = req.headers.get("x-correlation-id");
  if (existing) {
    return existing;
  }
  return randomUUID();
}
