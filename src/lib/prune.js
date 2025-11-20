// @ts-nocheck
// Pruning utilities for short links.
// Deletes rows that have not been accessed (last_accessed) nor created recently,
// based on configured delete_unused_after_days.
// If last_accessed is NULL we fall back to created_at.
// We perform small batched deletions to avoid large locks.

import { query } from './db.js';
import { getConfig } from './config.js';
import { recycleCode } from './codegen.js';

let lastPruneRun = 0; // epoch ms
const MIN_INTERVAL_MS = 5 * 60 * 1000; // run at most every 5 minutes per process
const BATCH_SIZE = 200; // rows per deletion batch

export async function pruneOldLinks() {
  const cfg = getConfig();
  const days = cfg.features?.linkShortener?.delete_unused_after_days;
  if (!days || days <= 0) return { skipped: true };
  // Ensure table exists; rely on existing ensure function in rateLimit if needed elsewhere.
  // We just attempt delete; if table missing it will throw and we swallow.
  try {
    // Use COALESCE(last_accessed, created_at) for staleness.
    const stale = await query(
      `SELECT short_code
         FROM short_links
        WHERE COALESCE(last_accessed, created_at) < (NOW() - INTERVAL ? DAY)
        ORDER BY COALESCE(last_accessed, created_at) ASC
        LIMIT ${BATCH_SIZE}`,
      [days]
    );

    if (!Array.isArray(stale) || stale.length === 0) {
      return { skipped: false, affected: 0 };
    }

    let deleted = 0;
    for (const row of stale) {
      const code = row?.short_code;
      if (!code) continue;

      const res = await query('DELETE FROM short_links WHERE short_code = ?', [code]);
      if (res?.affectedRows > 0) {
        deleted += res.affectedRows;
        await recycleCode(code);
      }
    }

    return { skipped: false, affected: deleted };
  } catch (err) {
    console.error('Prune error', err);
    return { skipped: false, error: true };
  }
}

export function schedulePrune() {
  const now = Date.now();
  if (now - lastPruneRun < MIN_INTERVAL_MS) return; // too soon
  lastPruneRun = now;
  // Fire & forget
  pruneOldLinks().then(r => {
    if (r.affected) {
      console.log(`[prune] Deleted ${r.affected} stale short_links rows`);
    }
  }).catch(e => console.error('[prune] failure', e));
}
