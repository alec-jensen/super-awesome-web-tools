import { getSessionUser } from '../../../lib/auth/session.js';
import { query } from '../../../lib/db.js';
import { ensureAuthTables } from '../../../lib/auth/tables.js';

export const prerender = false;

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export async function GET({ cookies }) {
  try {
    // Check admin authentication
    const sessionUser = await getSessionUser(cookies);
    if (!sessionUser || sessionUser.role !== 'admin') {
      return jsonResponse({ ok: false, message: 'Unauthorized' }, 403);
    }

    await ensureAuthTables();

    // Get all locked accounts
    const rows = await query(
      `SELECT email, locked_until, failed_login_attempts, last_failed_login_at
       FROM users 
       WHERE locked_until IS NOT NULL AND locked_until > NOW()
       ORDER BY locked_until DESC`
    );

    return jsonResponse({ 
      ok: true, 
      accounts: rows || []
    });
  } catch (err) {
    console.error('Get locked accounts error:', err);
    return jsonResponse({ ok: false, message: 'Server error' }, 500);
  }
}
