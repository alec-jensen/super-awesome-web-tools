import { createPasswordResetToken } from '../../../lib/auth/emailVerification.js';
import { isEmailEnabled, sendPasswordResetEmail } from '../../../lib/email.js';

export const prerender = false;

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export async function POST({ request }) {
  try {
    if (!isEmailEnabled()) {
      return jsonResponse({ ok: false, message: 'Email is not configured' }, 503);
    }

    const { email } = await request.json();

    if (!email || typeof email !== 'string') {
      return jsonResponse({ ok: false, message: 'Email is required' }, 400);
    }

    const normalizedEmail = email.trim().toLowerCase();
    const result = await createPasswordResetToken(normalizedEmail);

    if (result.ok && result.token) {
      await sendPasswordResetEmail(normalizedEmail, result.token);
    }

    // Always return success to prevent email enumeration
    return jsonResponse({ 
      ok: true, 
      message: 'If an account exists with that email, a password reset link has been sent.' 
    }, 200);
  } catch (err) {
    console.error('[request-password-reset] Error:', err);
    return jsonResponse({ ok: false, message: 'Server error' }, 500);
  }
}
