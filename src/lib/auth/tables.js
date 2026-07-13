// @ts-nocheck
// Ensures database tables for authentication (users and sessions) exist.
// Uses MariaDB via the shared query helper.

import { query } from '../db.js';

let ensured = false;

export async function ensureAuthTables() {
  if (ensured) return;

  await query(`CREATE TABLE IF NOT EXISTS users (
    id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(20) NOT NULL DEFAULT 'user',
    email_verified BOOLEAN NOT NULL DEFAULT FALSE,
    email_verification_token CHAR(64) NULL DEFAULT NULL UNIQUE,
    email_verification_expires_at TIMESTAMP NULL DEFAULT NULL,
    password_reset_token CHAR(64) NULL DEFAULT NULL UNIQUE,
    password_reset_expires_at TIMESTAMP NULL DEFAULT NULL,
    failed_login_attempts INT UNSIGNED NOT NULL DEFAULT 0,
    last_failed_login_at TIMESTAMP NULL DEFAULT NULL,
    locked_until TIMESTAMP NULL DEFAULT NULL,
    account_unlock_token CHAR(64) NULL DEFAULT NULL UNIQUE,
    totp_secret VARCHAR(255) NULL DEFAULT NULL,
    totp_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    backup_codes TEXT NULL DEFAULT NULL,
    email_2fa_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    email_2fa_code CHAR(6) NULL DEFAULT NULL,
    email_2fa_code_expires_at TIMESTAMP NULL DEFAULT NULL,
    email_2fa_code_attempts INT UNSIGNED NOT NULL DEFAULT 0,
    email_2fa_idempotency_key CHAR(64) NULL DEFAULT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    last_login_at TIMESTAMP NULL DEFAULT NULL,
    INDEX idx_email_verification_token (email_verification_token),
    INDEX idx_password_reset_token (password_reset_token),
    INDEX idx_account_unlock_token (account_unlock_token),
    INDEX idx_role (role)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

  await query(`CREATE TABLE IF NOT EXISTS sessions (
    id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
    user_id BIGINT UNSIGNED NOT NULL,
    token_hash CHAR(64) NOT NULL UNIQUE,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_user_id (user_id),
    INDEX idx_expires_at (expires_at)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

  await query(`CREATE TABLE IF NOT EXISTS passkeys (
    id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
    user_id BIGINT UNSIGNED NOT NULL,
    credential_id VARCHAR(255) NOT NULL UNIQUE,
    public_key TEXT NOT NULL,
    counter BIGINT UNSIGNED NOT NULL DEFAULT 0,
    device_name VARCHAR(255) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_used_at TIMESTAMP NULL DEFAULT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_user_id (user_id),
    INDEX idx_credential_id (credential_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

  // Attempt to add columns/indexes if schema predates this version
  try { await query('ALTER TABLE users ADD COLUMN role VARCHAR(20) NOT NULL DEFAULT \'user\''); } catch {}
  try { await query('ALTER TABLE users ADD COLUMN last_login_at TIMESTAMP NULL DEFAULT NULL'); } catch {}
  try { await query('ALTER TABLE users ADD COLUMN email_verified BOOLEAN NOT NULL DEFAULT FALSE'); } catch {}
  try { await query('ALTER TABLE users ADD COLUMN email_verification_token CHAR(64) NULL DEFAULT NULL UNIQUE'); } catch {}
  try { await query('ALTER TABLE users ADD COLUMN email_verification_expires_at TIMESTAMP NULL DEFAULT NULL'); } catch {}
  try { await query('ALTER TABLE users ADD COLUMN password_reset_token CHAR(64) NULL DEFAULT NULL UNIQUE'); } catch {}
  try { await query('ALTER TABLE users ADD COLUMN password_reset_expires_at TIMESTAMP NULL DEFAULT NULL'); } catch {}
  try { await query('ALTER TABLE users ADD COLUMN failed_login_attempts INT UNSIGNED NOT NULL DEFAULT 0'); } catch {}
  try { await query('ALTER TABLE users ADD COLUMN last_failed_login_at TIMESTAMP NULL DEFAULT NULL'); } catch {}
  try { await query('ALTER TABLE users ADD COLUMN locked_until TIMESTAMP NULL DEFAULT NULL'); } catch {}
  try { await query('ALTER TABLE users ADD COLUMN account_unlock_token CHAR(64) NULL DEFAULT NULL UNIQUE'); } catch {}
  try { await query('ALTER TABLE users ADD COLUMN totp_secret VARCHAR(255) NULL DEFAULT NULL'); } catch {}
  try { await query('ALTER TABLE users ADD COLUMN totp_enabled BOOLEAN NOT NULL DEFAULT FALSE'); } catch {}
  try { await query('ALTER TABLE users ADD COLUMN backup_codes TEXT NULL DEFAULT NULL'); } catch {}
  try { await query('ALTER TABLE users ADD COLUMN email_2fa_enabled BOOLEAN NOT NULL DEFAULT FALSE'); } catch {}
  try { await query('ALTER TABLE users ADD COLUMN email_2fa_code CHAR(6) NULL DEFAULT NULL'); } catch {}
  try { await query('ALTER TABLE users ADD COLUMN email_2fa_code_expires_at TIMESTAMP NULL DEFAULT NULL'); } catch {}
  try { await query('ALTER TABLE users ADD COLUMN email_2fa_code_attempts INT UNSIGNED NOT NULL DEFAULT 0'); } catch {}
  try { await query('ALTER TABLE users ADD COLUMN email_2fa_idempotency_key CHAR(64) NULL DEFAULT NULL'); } catch {}
  try { await query('ALTER TABLE users ADD INDEX idx_role (role)'); } catch {}
  try { await query('ALTER TABLE users ADD INDEX idx_email_verification_token (email_verification_token)'); } catch {}
  try { await query('ALTER TABLE users ADD INDEX idx_password_reset_token (password_reset_token)'); } catch {}
  try { await query('ALTER TABLE users ADD INDEX idx_account_unlock_token (account_unlock_token)'); } catch {}
  try { await query('ALTER TABLE sessions ADD COLUMN created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP'); } catch {}
  try { await query('ALTER TABLE sessions ADD INDEX idx_expires_at (expires_at)'); } catch {}

  ensured = true;
}
