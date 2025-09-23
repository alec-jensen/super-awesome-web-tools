// Fake link shortener API endpoint
// Location: src/pages/api/link/shorten.js
// This is a placeholder implementation that validates a URL-ish string and returns a fake short code.

import { getConfig } from "../../../lib/config";
import { query } from "../../../lib/db.js";
import { allocateCode, ALPHABET } from "../../../lib/codegen.js";

export const prerender = false;

/**
 * POST /api/link/shorten
 * Accepts formData with field: url
 * Returns JSON: { ok: boolean, message: string, short?: string, original?: string }
 */
export async function POST({ request }) {
  try {
    const formData = await request.formData();
    const url = formData.get("url");

    if (typeof url !== "string" || !url.trim()) {
      return new Response(JSON.stringify({ ok: false, message: "Missing url field" }), { status: 400 });
    }

    // Very light validation (fake) - real impl would do more robust URL validation & persistence
    const looksLikeUrl = /^(https?:\/\/)?[\w.-]+\.[a-z]{2,}(\/.*)?$/i.test(url.trim());
    if (!looksLikeUrl) {
      return new Response(JSON.stringify({ ok: false, message: "Not a valid-looking URL" }), { status: 422 });
    }

    const config = getConfig();
    const base = config?.app?.baseUrl?.replace(/\/+$/, '');

    // Ensure table exists (lightweight idempotent). In production prefer migrations.
    await query(`CREATE TABLE IF NOT EXISTS short_links (
      id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
      short_code VARCHAR(16) NOT NULL UNIQUE,
      original_url TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

    // Allocate deterministic smallest-available code (sequential or recycled)
    let allocation;
    try {
      allocation = await allocateCode();
    } catch (err) {
      console.error('Code allocation error', err);
      return new Response(JSON.stringify({ ok: false, message: 'Code allocation failed' }), { status: 500 });
    }

    const shortCode = allocation.code;
    try {
      await query('INSERT INTO short_links (short_code, original_url) VALUES (?, ?)', [shortCode, url.trim()]);
    } catch (err) {
      // Rare race: code got allocated then inserted by another writer (should not happen with transaction logic, but safety net)
      if (err && err.code === 'ER_DUP_ENTRY') {
        return new Response(JSON.stringify({ ok: false, message: 'Collision detected, retry request' }), { status: 503 });
      }
      console.error('DB insert error for short link', err);
      return new Response(JSON.stringify({ ok: false, message: 'Database error' }), { status: 500 });
    }

    const shortUrl = `${base}/${shortCode}`;
    return new Response(JSON.stringify({ ok: true, message: 'Short URL created', short: shortUrl, original: url.trim() }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  } catch (err) {
    console.error("Shorten endpoint error", err);
    return new Response(JSON.stringify({ ok: false, message: "Server error" }), { status: 500 });
  }
}
