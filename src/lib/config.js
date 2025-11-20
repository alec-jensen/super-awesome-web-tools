// @ts-nocheck
// Configuration loader
// Loads YAML configuration with precedence:
// 1. process.env.APP_CONFIG_FILE
// 2. config/config.yaml
// 3. config.yaml
// 4. config/config.example.yaml (as fallback)
// Performs ${VAR_NAME} environment substitution inside string values.
// Applies selected environment overrides (PORT -> server.port, LOG_LEVEL -> app.logLevel, BASE_URL -> app.baseUrl)
// Exposes getConfig() and getPublicConfig() (sanitized for client usage if needed later).

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';
import { validateConfig } from './configSchema.js';

/** @type {{filePath:string, config:any}|null} */
let cachedConfig = null;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// __dirname -> src/lib; project root is two levels up
const projectRoot = path.resolve(__dirname, '../..');

const candidatePaths = () => {
  const explicit = process.env.APP_CONFIG_FILE?.trim();
  return [
    explicit,
    path.join(projectRoot, 'config', 'config.yaml'),
    path.join(projectRoot, 'config.yaml'),
    path.join(projectRoot, 'config', 'config.example.yaml'),
  ].filter(Boolean);
};

/** @param {string} p */
function fileExists(p) {
  try { return fs.statSync(p).isFile(); } catch { return false; }
}

function loadFirstExisting() {
  for (const p of candidatePaths()) {
    if (fileExists(p)) return p;
  }
  return null;
}

// Convert human-readable size strings like 10MB, 512KB, 2G into bytes (number)
/** @param {unknown} value */
function parseSize(value) {
  if (value == null || value === '') return value;
  if (typeof value === 'number') return value; // assume already bytes
  if (typeof value !== 'string') return value;
  const m = value.trim().match(/^([0-9]+)(B|KB|MB|GB|TB)?$/i);
  if (!m) return value; // leave as-is if pattern not matched
  const num = parseInt(m[1], 10);
  const unit = (m[2] || 'B').toUpperCase();
  const mult = {
    B: 1,
    KB: 1024,
    MB: 1024 ** 2,
    GB: 1024 ** 3,
    TB: 1024 ** 4,
  }[unit] || 1;
  return num * mult;
}

// Recursively walk object and perform env substitution and size parsing.
/** @param {any} obj */
function transformObject(obj) {
  if (Array.isArray(obj)) return obj.map(transformObject);
  if (obj && typeof obj === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(obj)) {
      out[k] = transformObject(v);
    }
    return out;
  }
  if (typeof obj === 'string') {
    // size parsing first? We'll detect numbers with size suffix - but only if pure pattern
    const sizeParsed = parseSize(obj);
    if (typeof sizeParsed === 'number') return sizeParsed;

    return obj.replace(/\$\{([A-Z0-9_]+)(:?-[^}]*)?}/g, (full, name, defPart) => {
      const envVal = process.env[name];
      if (envVal != null && envVal !== '') return envVal;
      if (defPart && defPart.startsWith(':-')) return defPart.slice(2);
      return full; // leave untouched
    });
  }
  return obj;
}

/** @param {any} cfg */
function applyEnvOverrides(cfg) {
  if (!cfg.app) cfg.app = {};
  if (!cfg.server) cfg.server = {};

  if (process.env.PORT) {
    const port = parseInt(process.env.PORT, 10);
    if (!Number.isNaN(port)) cfg.server.port = port;
  }
  if (process.env.LOG_LEVEL) cfg.app.logLevel = process.env.LOG_LEVEL;
  if (process.env.BASE_URL) cfg.app.baseUrl = process.env.BASE_URL;
  if (process.env.APP_ENCRYPTION_KEY) cfg.app.encryptionKey = process.env.APP_ENCRYPTION_KEY;

  // Database overrides
  if (!cfg.database) cfg.database = {};
  if (process.env.DB_HOST) cfg.database.host = process.env.DB_HOST;
  if (process.env.DB_PORT) cfg.database.port = parseInt(process.env.DB_PORT, 10);
  if (process.env.DB_USER) cfg.database.user = process.env.DB_USER;
  if (process.env.DB_PASSWORD) cfg.database.password = process.env.DB_PASSWORD;
  if (process.env.DB_NAME) cfg.database.database = process.env.DB_NAME;

  // Feature defaults if missing (for env-only config)
  if (!cfg.features) {
    cfg.features = {
      chat: { enabled: true, allow_anonymous: true },
      paste: { enabled: true, allow_anonymous: true, max_length: 100000 },
      linkShortener: { enabled: true, allow_anonymous: true, delete_unused_after_days: 90 },
      uploads: { enabled: true, allow_anonymous: true, max_size: 10 * 1024 * 1024 }
    };
  }

  return cfg;
}

/** @param {any} obj */
function deepFreeze(obj) {
  if (obj && typeof obj === 'object' && !Object.isFrozen(obj)) {
    Object.freeze(obj);
    for (const v of Object.values(obj)) deepFreeze(v);
  }
  return obj;
}

function loadConfig() {
  const filePath = loadFirstExisting();
  let parsed = {};
  
  if (filePath) {
    const raw = fs.readFileSync(filePath, 'utf8');
    parsed = parse(raw) || {};
  }

  const transformed = transformObject(parsed);
  const overridden = applyEnvOverrides(transformed);
  // Validate & coerce defaults
  const validated = validateConfig(overridden);
  return { filePath, config: deepFreeze(validated) };
}

export function getConfig() {
  if (!cachedConfig) {
    cachedConfig = loadConfig();
  }
  return cachedConfig.config;
}

// Whitelist of keys safe for client (expand as needed). We'll keep it minimal.
const PUBLIC_PATHS = [
  'app.baseUrl',
  'features.chat.enabled',
  'features.paste.enabled',
  'features.linkShortener.enabled',
  'features.uploads.enabled'
];

/** @param {any} obj @param {string} pathStr */
function pick(obj, pathStr) {
  const parts = pathStr.split('.');
  let cur = obj;
  for (const p of parts) {
    if (cur == null) return undefined; // early exit
    cur = cur[p];
  }
  return cur;
}

export function getPublicConfig() {
  const full = getConfig();
  const pub = {};
  for (const pathStr of PUBLIC_PATHS) {
    const val = pick(full, pathStr);
    if (val !== undefined) {
      // build nested structure in pub
      const segments = pathStr.split('.');
      let cursor = pub;
      segments.forEach((seg, idx) => {
        if (idx === segments.length - 1) {
          cursor[seg] = val;
        } else {
          cursor[seg] = cursor[seg] || {};
          cursor = cursor[seg];
        }
      });
    }
  }
  return pub;
}

// Optional helper to force reload (e.g., in dev / tests)
export function _reloadConfigForDev() {
  cachedConfig = null;
  return getConfig();
}
