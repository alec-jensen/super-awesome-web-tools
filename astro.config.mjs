// @ts-check
import { defineConfig } from 'astro/config';
import node from '@astrojs/node';
import { getConfig } from './src/lib/config.js';

// Astro configuration with Node adapter so Docker runtime can execute dist/server/entry.mjs
// Expose PORT env override & fallback to YAML config server.port, then 4321
let cfgPort = 4321;
try {
	const cfg = getConfig();
	cfgPort = cfg.server?.port || cfgPort;
} catch (e) {
	// If config load fails here (e.g., during first install), keep default to not block dev
	const err = /** @type {any} */ (e);
	console.warn('[config] Failed to load at astro.config.mjs time:', err?.message || err);
}
const port = process.env.PORT ? parseInt(process.env.PORT, 10) : cfgPort;
export default defineConfig({
	adapter: node({ mode: 'standalone' }),
	server: { port, host: true }
});
