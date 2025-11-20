import { getSessionUser } from '../../../lib/auth/session.js';
import { query } from '../../../lib/db.js';
import { ensureAuthTables } from '../../../lib/auth/tables.js';
import { findUserByEmail } from '../../../lib/auth/user.js';

export const prerender = false;

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export async function POST({ request, cookies }) {
  try {
    // Check admin authentication
    const sessionUser = await getSessionUser(cookies);
    if (!sessionUser || sessionUser.role !== 'admin') {
      return jsonResponse({ ok: false, message: 'Unauthorized' }, 403);
    }

    const payload = await request.json();
    const email = typeof payload.email === 'string' ? payload.email.trim().toLowerCase() : '';

    if (!email) {
      return jsonResponse({ ok: false, message: 'Email address required' }, 400);
    }

    await ensureAuthTables();

    // Find user
    const user = await findUserByEmail(email);
    if (!user) {
      return jsonResponse({ ok: false, message: 'User not found' }, 404);
    }

    // Unlock the account
    await query(
      `UPDATE users 
       SET locked_until = NULL,
           account_unlock_token = NULL,
           failed_login_attempts = 0,
           last_failed_login_at = NULL
       WHERE id = ?`,
      [user.id]
    );

    return jsonResponse({ 
      ok: true, 
      message: `Account for ${email} has been unlocked` 
    });
  } catch (err) {
    console.error('Admin unlock account error:', err);
    return jsonResponse({ ok: false, message: 'Server error' }, 500);
  }
}
