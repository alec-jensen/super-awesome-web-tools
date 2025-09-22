// @ts-check
import { defineConfig } from 'astro/config';
import node from '@astrojs/node';

// Astro configuration with Node adapter so Docker runtime can execute dist/server/entry.mjs
// Expose PORT env override & bind to all interfaces for container networking.
const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 4321;
export default defineConfig({
	adapter: node({ mode: 'standalone' }),
	server: { port, host: true }
});
