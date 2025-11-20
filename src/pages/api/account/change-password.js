// @ts-nocheck
import { getSessionUser } from '../../../lib/auth/session.js';
import { findUserByEmail, updateUserPassword } from '../../../lib/auth/user.js';
import { verifyPassword, hashPassword } from '../../../lib/auth/password.js';
import { validatePasswordComplexity } from '../../../lib/auth/passwordValidation.js';

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
    const currentPassword = typeof body.currentPassword === 'string' ? body.currentPassword : '';
    const newPassword = typeof body.newPassword === 'string' ? body.newPassword : '';

    if (!currentPassword || !newPassword) {
      return jsonResponse({ ok: false, message: 'Invalid request' }, 400);
    }

    // Verify current password
    const userRecord = await findUserByEmail(user.email);
    if (!userRecord) {
      return jsonResponse({ ok: false, message: 'User not found' }, 404);
    }

    const validPassword = await verifyPassword(currentPassword, userRecord.password_hash);
    if (!validPassword) {
      return jsonResponse({ ok: false, message: 'Current password is incorrect' }, 401);
    }

    // Validate new password complexity
    const passwordValidation = validatePasswordComplexity(newPassword);
    if (!passwordValidation.valid) {
      return jsonResponse({ 
        ok: false, 
        message: passwordValidation.errors.join('. ') 
      }, 400);
    }

    // Hash and update password
    const newPasswordHash = await hashPassword(newPassword);
    await updateUserPassword(user.id, newPasswordHash);

    return jsonResponse({ 
      ok: true, 
      message: 'Password changed successfully' 
    }, 200);
  } catch (err) {
    console.error('Change password error:', err);
    return jsonResponse({ ok: false, message: 'Server error' }, 500);
  }
}
