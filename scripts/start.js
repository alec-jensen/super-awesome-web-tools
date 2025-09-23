#!/usr/bin/env node
// @ts-nocheck
// Production start wrapper: loads config, sets PORT env if not already defined, then starts Astro's built output.
import { getConfig } from '../src/lib/config.js';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const cfg = getConfig();
if (!process.env.PORT) {
  process.env.PORT = String(cfg.server.port);
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const entry = path.resolve(__dirname, '../dist/server/entry.mjs');

// Dynamic import of built server entry
import(entry).catch(err => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
