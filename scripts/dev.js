#!/usr/bin/env node
// @ts-nocheck
// Preflight dev starter: ensure desired config/server port is free, warn if not.
import { getConfig } from '../src/lib/config.js';
import { spawn } from 'node:child_process';
import net from 'node:net';

const cfg = getConfig();
const desiredPort = process.env.PORT ? parseInt(process.env.PORT, 10) : cfg.server.port;

function checkPort(port) {
  return new Promise(resolve => {
    const srv = net.createServer();
    srv.once('error', err => {
      if (err.code === 'EADDRINUSE') resolve(false);
      else resolve(false);
    });
    srv.once('listening', () => {
      srv.close(() => resolve(true));
    });
    srv.listen(port, '0.0.0.0');
  });
}

const start = async () => {
  const free = await checkPort(desiredPort);
  if (!free) {
    console.warn(`\n[dev-preflight] Port ${desiredPort} is already in use. Astro will auto-pick a new one (showing misleading baseUrl?).`);
    console.warn('[dev-preflight] Consider: kill the other process or run with PORT=xxxx npm run dev');
  }
  const child = spawn('npx', ['astro', 'dev'], { stdio: 'inherit', env: process.env });
  child.on('exit', code => process.exit(code ?? 0));
};

start();
