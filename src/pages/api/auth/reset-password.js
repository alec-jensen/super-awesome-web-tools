import { resetPasswordWithToken } from '../../../lib/auth/emailVerification.js';
import { hashPassword } from '../../../lib/auth/password.js';

export const prerender = false;

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export async function POST({ request }) {
  try {
    const { token, password } = await request.json();

    if (!token || typeof token !== 'string') {
      return jsonResponse({ ok: false, message: 'Token is required' }, 400);
    }

    if (!password || typeof password !== 'string') {
      return jsonResponse({ ok: false, message: 'Password is required' }, 400);
    }

    if (password.length < 12) {
      return jsonResponse({ ok: false, message: 'Password must be at least 12 characters long' }, 400);
    }

    const passwordHash = await hashPassword(password);
    const result = await resetPasswordWithToken(token, passwordHash);

    if (!result.ok) {
      return jsonResponse({ ok: false, message: result.error || 'Password reset failed' }, 400);
    }

    return jsonResponse({ ok: true, message: 'Password reset successfully' }, 200);
  } catch (err) {
    console.error('[reset-password] Error:', err);
    return jsonResponse({ ok: false, message: 'Server error' }, 500);
  }
}
