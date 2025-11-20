import { query } from '../../../lib/db.js';
import { ensureShortLinksExtended } from '../../../lib/rateLimit.js';
import { getSessionUser } from '../../../lib/auth/session.js';
import { recycleCode } from '../../../lib/codegen.js';

export const prerender = false;

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

async function readPayload(request) {
  const contentType = request.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    return await request.json();
  }
  const formData = await request.formData();
  return {
    code: formData.get('code'),
  };
}

export async function POST({ request, cookies }) {
  try {
    const user = await getSessionUser(cookies);
    if (!user) {
      return jsonResponse({ ok: false, message: 'Authentication required' }, 401);
    }

    const payload = await readPayload(request);
    const code = typeof payload.code === 'string' ? payload.code.trim() : '';
    if (!code) {
      return jsonResponse({ ok: false, message: 'Missing short code' }, 400);
    }

    await ensureShortLinksExtended();
    const result = await query('DELETE FROM short_links WHERE short_code = ? AND user_id = ?', [code, user.id]);

    if (result.affectedRows === 0) {
      return jsonResponse({ ok: false, message: 'Link not found' }, 404);
    }

    await recycleCode(code);

    return jsonResponse({ ok: true, message: 'Link deleted' });
  } catch (err) {
    console.error('Delete link error:', err);
    return jsonResponse({ ok: false, message: 'Server error' }, 500);
  }
}
