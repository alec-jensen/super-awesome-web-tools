import { getConfig } from '../../../lib/config.js';
import { query } from '../../../lib/db.js';
import { ensureShortLinksExtended } from '../../../lib/rateLimit.js';
import { getSessionUser } from '../../../lib/auth/session.js';

export const prerender = false;

const SECURITY_LABELS = {
  plaintext: 'Plaintext',
  encryptedAndDecryptionKeyInURL: 'Encrypted (key in link)',
  encrypted: 'Encrypted (key separate)',
};

const securityLabelFor = (mode) => SECURITY_LABELS[mode] || 'Unknown';

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export async function GET({ cookies }) {
  try {
    const user = await getSessionUser(cookies);
    if (!user) {
      return jsonResponse({ ok: false, message: 'Authentication required' }, 401);
    }

    await ensureShortLinksExtended();
    const config = getConfig();
    const base = config?.app?.baseUrl?.replace(/\/+$/, '') || '';

    const rows = await query(
      `SELECT short_code, created_at, last_accessed, usage_count, security_mode, is_encrypted
       FROM short_links
       WHERE user_id = ?
       ORDER BY created_at DESC
       LIMIT 200`,
      [user.id]
    );

    const links = rows.map(row => {
      const iso = row.created_at instanceof Date ? row.created_at.toISOString() : new Date(row.created_at).toISOString();
      const lastAccessedIso = row.last_accessed ? (row.last_accessed instanceof Date ? row.last_accessed.toISOString() : new Date(row.last_accessed).toISOString()) : null;
      return {
        code: row.short_code,
        short: base ? `${base}/${row.short_code}` : `/${row.short_code}`,
        createdAtIso: iso,
        createdAtDisplay: new Date(iso).toLocaleString(),
        lastAccessedIso,
        lastAccessedDisplay: lastAccessedIso ? new Date(lastAccessedIso).toLocaleString() : 'Never',
        usageCount: Number(row.usage_count || 0),
        securityMode: row.security_mode,
        securityLabel: securityLabelFor(row.security_mode),
        isEncrypted: !!row.is_encrypted,
      };
    });

    return jsonResponse({ ok: true, links });
  } catch (err) {
    console.error('List links error:', err);
    return jsonResponse({ ok: false, message: 'Server error' }, 500);
  }
}
