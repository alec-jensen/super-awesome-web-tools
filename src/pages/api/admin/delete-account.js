import { getSessionUser } from '../../../lib/auth/session.js';
import { findUserByEmail, deleteUser } from '../../../lib/auth/user.js';

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

    // Find user
    const user = await findUserByEmail(email);
    if (!user) {
      return jsonResponse({ ok: false, message: 'User not found' }, 404);
    }

    // Prevent admin from deleting themselves
    if (user.id === sessionUser.userId) {
      return jsonResponse({ 
        ok: false, 
        message: 'You cannot delete your own account from the admin panel. Use the account page instead.' 
      }, 400);
    }

    // Delete the user
    await deleteUser(user.id);

    return jsonResponse({ 
      ok: true, 
      message: `Account for ${email} has been deleted` 
    });
  } catch (err) {
    console.error('Admin delete account error:', err);
    return jsonResponse({ ok: false, message: 'Server error' }, 500);
  }
}
