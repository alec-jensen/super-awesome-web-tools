// @ts-nocheck
import { getSessionUser, destroySessionCookie } from '../../../lib/auth/session.js';
import { findUserByEmail, deleteUser } from '../../../lib/auth/user.js';
import { verifyPassword } from '../../../lib/auth/password.js';

export const prerender = false;

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export async function POST({ request, cookies }) {
  try {
    const user = await getSessionUser(cookies);
    if (!user) {
      return jsonResponse({ ok: false, message: 'Authentication required' }, 401);
    }

    const body = await request.json();
    const password = typeof body.password === 'string' ? body.password : '';
    const confirmation = typeof body.confirmation === 'string' ? body.confirmation : '';

    if (!password || confirmation !== 'DELETE') {
      return jsonResponse({ ok: false, message: 'Invalid request' }, 400);
    }

    // Verify password
    const userRecord = await findUserByEmail(user.email);
    if (!userRecord) {
      return jsonResponse({ ok: false, message: 'User not found' }, 404);
    }

    const validPassword = await verifyPassword(password, userRecord.password_hash);
    if (!validPassword) {
      return jsonResponse({ ok: false, message: 'Invalid credentials' }, 401);
    }

    // Delete user (sessions will be cascaded)
    await deleteUser(user.id);
    
    // Destroy session cookie
    await destroySessionCookie(cookies);

    return jsonResponse({ 
      ok: true, 
      message: 'Account deleted successfully' 
    }, 200);
  } catch (err) {
    console.error('Delete account error:', err);
    return jsonResponse({ ok: false, message: 'Server error' }, 500);
  }
}
