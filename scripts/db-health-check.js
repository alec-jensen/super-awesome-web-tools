#!/usr/bin/env node
// @ts-nocheck
import { healthCheck, closePool } from '../src/lib/db.js';

const run = async () => {
  const res = await healthCheck();
  if (!res.ok) {
    console.error('[db-health-check] Database NOT reachable:', res.error);
    process.exitCode = 1;
  } else {
    console.log('[db-health-check] Database connection OK');
  }
  await closePool().catch(()=>{});
};

run();
