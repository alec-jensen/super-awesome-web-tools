import { destroySessionCookie } from '../../../lib/auth/session.js';

export const prerender = false;

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export async function POST({ cookies }) {
  try {
    await destroySessionCookie(cookies);
    return jsonResponse({ ok: true, message: 'Logged out' });
  } catch (err) {
    console.error('Logout error:', err);
    return jsonResponse({ ok: false, message: 'Server error' }, 500);
  }
}
