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

const linkUrl = z.string().min(1).url().or(z.string().regex(/^\/[\w\-.~\/]*$/)).describe('URL (absolute or site-relative path)');

export const ConfigSchema = z.object({
  app: z.object({
    baseUrl: z.string().url().or(z.string().regex(/^http:\/\/localhost:\d+$/)).describe('Base public URL'),
    logLevel: z.enum(['trace','debug','info','warn','error']).default('info'),
    encryptionKey: z.string().min(32).describe('Base64url-encoded encryption key for sensitive data (TOTP secrets, etc.). Generate with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'base64url\'))"'),
    footerLinks: z.object({
      privacyPolicy: linkUrl.optional(),
      termsOfService: linkUrl.optional(),
      securityPolicy: linkUrl.optional(),
      legal: linkUrl.optional()
    }).default({})
  }),
  features: z.object({
    chat: featureBase,
    paste: pasteFeature,
    linkShortener: featureBase.extend({
      delete_unused_after_days: z.number().int().positive().max(3650).default(90).describe('Delete unused short links after this many days of no access (uses last_accessed, falls back to created_at)')
    }),
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
  }).describe('MariaDB connection settings'),
  smtp: z.object({
    host: z.string().min(1),
    port: z.number().int().positive().default(587),
    secure: z.boolean().default(false).describe('Use TLS (true for port 465, false for STARTTLS on 587)'),
    auth: z.object({
      user: z.string().min(1),
      pass: z.string().min(1)
    }),
    from: z.string().email().describe('From email address for all outgoing emails')
  }).optional().describe('SMTP configuration for sending emails (verification, password reset). If not configured, email features are disabled.'),
  auth: z.object({
    password: z.object({
      minLength: z.number().int().min(8).max(128).default(12).describe('Minimum password length'),
      requireUppercase: z.boolean().default(false).describe('Require at least one uppercase letter'),
      requireLowercase: z.boolean().default(false).describe('Require at least one lowercase letter'),
      requireNumber: z.boolean().default(false).describe('Require at least one number'),
      requireSpecial: z.boolean().default(false).describe('Require at least one special character (!@#$%^&*(),.?":{}|<>)')
    }).default({
      minLength: 12,
      requireUppercase: false,
      requireLowercase: false,
      requireNumber: false,
      requireSpecial: false
    }),
    lockout: z.object({
      enabled: z.boolean().default(true).describe('Enable account lockout after failed login attempts'),
      maxAttempts: z.number().int().min(3).max(20).default(5).describe('Maximum failed login attempts before lockout'),
      exponentialDelay: z.boolean().default(true).describe('Use exponential backoff for failed login attempts'),
      baseDelaySeconds: z.number().int().min(1).max(300).default(2).describe('Base delay in seconds for exponential backoff (delay = base * 2^(attempts-1))'),
      lockoutDurationMinutes: z.number().int().min(5).max(1440).default(30).describe('Duration of account lockout in minutes'),
      sendLockoutEmail: z.boolean().default(true).describe('Send email notification when account is locked')
    }).default({
      enabled: true,
      maxAttempts: 5,
      exponentialDelay: true,
      baseDelaySeconds: 2,
      lockoutDurationMinutes: 30,
      sendLockoutEmail: true
    })
  }).default({
    password: {
      minLength: 12,
      requireUppercase: false,
      requireLowercase: false,
      requireNumber: false,
      requireSpecial: false
    },
    lockout: {
      enabled: true,
      maxAttempts: 5,
      exponentialDelay: true,
      baseDelaySeconds: 2,
      lockoutDurationMinutes: 30,
      sendLockoutEmail: true
    }
  }).describe('Authentication security settings'),
  limits: z.object({
    linkShortenerPerHour: z.number().int().positive().max(10000).default(100).describe('Maximum links a user/IP can create per hour'),
    linkShortenerGlobalPerHour: z.number().int().positive().max(1000000).default(10000).describe('Maximum links system-wide per hour (prevents DoS)'),
    rateLimitWindowMinutes: z.number().int().min(1).max(1440).default(60).describe('Rate limit sliding window size in minutes (60 = 1 hour sliding window)'),
    codeAllocationRetries: z.number().int().min(1).max(100).default(10).describe('Maximum retries for code allocation (prevents runaway loops)'),
    maxConcurrentAllocations: z.number().int().min(1).max(1000).default(50).describe('Maximum concurrent code allocation attempts (prevents connection pool exhaustion)')
  }).default({ 
    linkShortenerPerHour: 100,
    linkShortenerGlobalPerHour: 10000,
    rateLimitWindowMinutes: 60,
    codeAllocationRetries: 10,
    maxConcurrentAllocations: 50
  })
});

export function validateConfig(cfg) {
  const result = ConfigSchema.safeParse(cfg);
  if (!result.success) {
    const issues = result.error.issues.map(i => `- ${i.path.join('.') || '(root)'}: ${i.message}`).join('\n');
    throw new Error('Configuration validation failed:\n' + issues);
  }
  return result.data;
}
