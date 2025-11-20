import { verifyEmailToken } from '../../../lib/auth/emailVerification.js';

export const prerender = false;

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export async function POST({ request }) {
  try {
    const { token } = await request.json();

    if (!token) {
      return jsonResponse({ ok: false, message: 'Token is required' }, 400);
    }

    const result = await verifyEmailToken(token);

    if (!result.ok) {
      return jsonResponse({ ok: false, message: result.error || 'Verification failed' }, 400);
    }

    return jsonResponse({ ok: true, message: 'Email verified successfully' }, 200);
  } catch (err) {
    console.error('[verify-email] Error:', err);
    return jsonResponse({ ok: false, message: 'Server error' }, 500);
  }
}
