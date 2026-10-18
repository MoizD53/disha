import { z } from "zod";

export const sosStartSchema = z.object({
  clientEventId: z.string().min(1).max(128),
});

export const sosEndSchema = z.object({
  clientEventId: z.string().min(1).max(128),
});

export type SOSStartInput = z.infer<typeof sosStartSchema>;
export type SOSEndInput = z.infer<typeof sosEndSchema>;
