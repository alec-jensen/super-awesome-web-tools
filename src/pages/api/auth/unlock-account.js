import { unlockAccount } from '../../../lib/auth/lockout.js';

export const prerender = false;

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export async function POST({ request }) {
  try {
    const payload = await request.json();
    const token = typeof payload.token === 'string' ? payload.token : '';

    if (!token) {
      return jsonResponse({ ok: false, message: 'Missing unlock token' }, 400);
    }

    const result = await unlockAccount(token);
    
    if (!result.success) {
      return jsonResponse({ ok: false, message: result.error }, 400);
    }

    return jsonResponse({ ok: true, message: 'Account unlocked successfully' });
  } catch (err) {
    console.error('Unlock account error:', err);
    return jsonResponse({ ok: false, message: 'Server error' }, 500);
  }
}
