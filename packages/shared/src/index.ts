import { z } from 'zod';

export * from './lineup-api.js';

export const healthResponseSchema = z.object({
  status: z.literal('ok'),
  service: z.literal('lineup-engine-api'),
  timestamp: z.iso.datetime(),
});

export type HealthResponse = z.infer<typeof healthResponseSchema>;
