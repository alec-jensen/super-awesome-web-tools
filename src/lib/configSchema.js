// @ts-nocheck
import { z } from 'zod';

// Feature block schema (enabled + allow_anonymous plus optional size/length constraints)
const featureBase = z.object({
  enabled: z.boolean(),
  allow_anonymous: z.boolean().default(false)
});

const pasteFeature = featureBase.extend({
  max_length: z.number().int().positive().max(5_000_000).default(100_000)
});

const uploadFeature = featureBase.extend({
  max_size: z.number().int().positive().max(1024 ** 4).default(10 * 1024 * 1024) // 10MB default in bytes
});

export const ConfigSchema = z.object({
  app: z.object({
    baseUrl: z.string().url().or(z.string().regex(/^http:\/\/localhost:\d+$/)).describe('Base public URL'),
    logLevel: z.enum(['trace','debug','info','warn','error']).default('info')
  }),
  features: z.object({
    chat: featureBase,
    paste: pasteFeature,
    linkShortener: featureBase,
    uploads: uploadFeature
  }),
  server: z.object({
    port: z.number().int().min(1).max(65535).default(4321)
  }),
  database: z.object({
    host: z.string().min(1).default('localhost'),
    port: z.number().int().positive().default(3306),
    user: z.string().min(1),
    password: z.string().min(1),
    database: z.string().min(1)
  }).describe('MariaDB connection settings')
});

export function validateConfig(cfg) {
  const result = ConfigSchema.safeParse(cfg);
  if (!result.success) {
    const issues = result.error.issues.map(i => `- ${i.path.join('.') || '(root)'}: ${i.message}`).join('\n');
    throw new Error('Configuration validation failed:\n' + issues);
  }
  return result.data;
}
