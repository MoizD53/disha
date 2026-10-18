import { z } from "zod";
import { LocationSource, TrackingMode, LocationEventType } from "../../../generated/prisma/enums";

export const MAX_BATCH_SIZE = 500;
export const MAX_FUTURE_TOLERANCE_MS = 1000 * 60 * 5; // 5 minutes (clock drift)
export const MAX_PAST_TOLERANCE_MS = 1000 * 60 * 60 * 24 * 7; // 7 days (offline queue limit)

// Common schema fields
const clientEventId = z.string().min(1).max(128);
const recordedAt = z.coerce.date().refine(
  (date) => {
    const now = Date.now();
    const time = date.getTime();
    return time <= now + MAX_FUTURE_TOLERANCE_MS && time >= now - MAX_PAST_TOLERANCE_MS;
  },
  { message: "recordedAt is outside acceptable tolerance (max 7 days past, 5 mins future)" }
);

export const singleLocationSchema = z.object({
  clientEventId,
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  accuracy: z.number().min(0),
  recordedAt,
  source: z.nativeEnum(LocationSource).default(LocationSource.UNKNOWN),
  trackingMode: z.nativeEnum(TrackingMode).default(TrackingMode.NORMAL),
  batteryLevel: z.number().min(0).max(100).nullable().optional(),
  networkState: z.string().max(50).nullable().optional(),
});

export const locationEventSchema = z.object({
  clientEventId,
  eventType: z.nativeEnum(LocationEventType),
  recordedAt,
  metadata: z.record(z.string(), z.any()).nullable().optional(),
});

export const batchIngestionSchema = z.object({
  locations: z.array(singleLocationSchema).max(MAX_BATCH_SIZE).optional(),
  events: z.array(locationEventSchema).max(MAX_BATCH_SIZE).optional(),
});

export type SingleLocationInput = z.infer<typeof singleLocationSchema>;
export type LocationEventInput = z.infer<typeof locationEventSchema>;
export type BatchIngestionInput = z.infer<typeof batchIngestionSchema>;
