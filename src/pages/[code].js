// Dynamic redirect route for short URLs
// Matches /<code> at root. Looks up short_links table and 302 redirects to original_url.
// If not found, returns 404.
// NOTE: This file must not clash with existing top-level routes; explicit pages override this dynamic one.

import { query } from '../lib/db.js';

export const prerender = false; // dynamic

export async function GET({ params }) {
  const { code } = params;
  if (!code || code.length > 16) {
    return new Response('Not found', { status: 404 });
  }
  try {
    // Ensure table exists (lightweight safety; real deployments should manage migrations)
    await query(`CREATE TABLE IF NOT EXISTS short_links (
      id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
      short_code VARCHAR(16) NOT NULL UNIQUE,
      original_url TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

    const rows = await query('SELECT original_url FROM short_links WHERE short_code = ? LIMIT 1', [code]);
    if (!rows || rows.length === 0) {
      return new Response('Not found', { status: 404 });
    }
    const original = rows[0].original_url;
    // Basic safety: ensure the URL has a scheme; if missing, assume https
    let target = original.trim();
    if (!/^https?:\/\//i.test(target)) {
      target = 'https://' + target;
    }
    return Response.redirect(target, 302);
  } catch (err) {
    console.error('Redirect lookup failed', err);
    return new Response('Server error', { status: 500 });
  }
}
