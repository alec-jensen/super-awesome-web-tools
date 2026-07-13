// @ts-nocheck
// Rate limiting utilities for link shortener
// Strategy: store visitor_uuid and ip with each short_links row.
// We count rows created in the last hour for either identifier and enforce a per-hour limit.

import { query } from './db.js';
import { getConfig } from './config.js';

// Normalize IP to binary (supports IPv4 & IPv6). For simplicity use inet6_aton equivalent in JS.
// For rate limiting we store ip as plain VARCHAR(45) (fits IPv6) inside short_links table.

export async function ensureShortLinksExtended() {
  // Add columns if they do not exist (best-effort). MariaDB prior to 10.3 doesn't support IF NOT EXISTS on modify, so we guard with INFORMATION_SCHEMA.
  await query(`CREATE TABLE IF NOT EXISTS short_links (
    id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
    short_code VARCHAR(16) NOT NULL UNIQUE,
    original_url TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    user_id BIGINT UNSIGNED NULL,
    visitor_uuid CHAR(36) NULL,
    ip VARCHAR(45) NULL,
    usage_count BIGINT UNSIGNED NOT NULL DEFAULT 0,
    last_accessed TIMESTAMP NULL DEFAULT NULL,
    security_mode VARCHAR(32) NOT NULL DEFAULT 'plaintext',
    encryption_key TEXT NULL,
    is_encrypted BOOLEAN NOT NULL DEFAULT FALSE,
    INDEX idx_user_id (user_id),
    INDEX idx_created (created_at),
    INDEX idx_uuid_created (visitor_uuid, created_at),
    INDEX idx_ip_created (ip, created_at),
    INDEX idx_last_accessed (last_accessed)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
  // Attempt to add missing columns (will error harmlessly if they exist). We swallow errors.
  try { await query('ALTER TABLE short_links ADD COLUMN visitor_uuid CHAR(36) NULL'); } catch {}
  try { await query('ALTER TABLE short_links ADD COLUMN ip VARCHAR(45) NULL'); } catch {}
  try { await query('ALTER TABLE short_links ADD COLUMN usage_count BIGINT UNSIGNED NOT NULL DEFAULT 0'); } catch {}
  try { await query('ALTER TABLE short_links ADD COLUMN last_accessed TIMESTAMP NULL DEFAULT NULL'); } catch {}
  try { await query('ALTER TABLE short_links ADD COLUMN security_mode VARCHAR(32) NOT NULL DEFAULT \'plaintext\''); } catch {}
  try { await query('ALTER TABLE short_links ADD COLUMN encryption_key TEXT NULL'); } catch {}
  try { await query('ALTER TABLE short_links ADD COLUMN is_encrypted BOOLEAN NOT NULL DEFAULT FALSE'); } catch {}
  try { await query('ALTER TABLE short_links ADD COLUMN user_id BIGINT UNSIGNED NULL'); } catch {}
  try { await query('ALTER TABLE short_links ADD INDEX idx_user_id (user_id)'); } catch {}
  try { await query('CREATE INDEX idx_uuid_created ON short_links (visitor_uuid, created_at)'); } catch {}
  try { await query('CREATE INDEX idx_ip_created ON short_links (ip, created_at)'); } catch {}
  try { await query('CREATE INDEX idx_last_accessed ON short_links (last_accessed)'); } catch {}
}

export async function checkLinkShortenAllowed({ visitorUuid, ip }) {
  await ensureShortLinksExtended();
  const cfg = getConfig();
  const perUserLimit = cfg.limits.linkShortenerPerHour;
  const globalLimit = cfg.limits.linkShortenerGlobalPerHour;
  const windowMinutes = cfg.limits.rateLimitWindowMinutes || 60;
  
  // Use sliding window: count links created in last N minutes
  const windowIntervalSQL = `NOW() - INTERVAL ${windowMinutes} MINUTE`;
  
  // Check per-user/IP limits (sliding window)
  const userRows = await query(
    `SELECT 
      SUM(visitor_uuid = ?) AS by_uuid,
      SUM(ip = ?) AS by_ip
     FROM short_links
     WHERE created_at >= (${windowIntervalSQL})`,
    [visitorUuid, ip]
  );
  const byUuid = Number(userRows[0].by_uuid || 0);
  const byIp = Number(userRows[0].by_ip || 0);
  
  // Check global limit (sliding window)
  const globalRows = await query(
    `SELECT COUNT(*) AS total
     FROM short_links
     WHERE created_at >= (${windowIntervalSQL})`
  );
  const globalCount = Number(globalRows[0].total || 0);
  
  // Block if EITHER uuid OR ip is at/over limit, OR if global limit exceeded
  const userAllowed = byUuid < perUserLimit && byIp < perUserLimit;
  const globalAllowed = globalCount < globalLimit;
  const allowed = userAllowed && globalAllowed;
  
  return { 
    allowed, 
    byUuid, 
    byIp, 
    globalCount,
    limit: perUserLimit,
    globalLimit,
    windowMinutes
  };
}

