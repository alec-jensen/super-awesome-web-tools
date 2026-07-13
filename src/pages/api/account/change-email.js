// @ts-nocheck
import { getSessionUser } from '../../../lib/auth/session.js';
import { findUserByEmail, updateUserEmail } from '../../../lib/auth/user.js';
import { createEmailVerificationToken } from '../../../lib/auth/emailVerification.js';
import { isEmailEnabled, sendVerificationEmail } from '../../../lib/email.js';

export const prerender = false;

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function validateEmail(email) {
  if (typeof email !== 'string') return false;
  const trimmed = email.trim().toLowerCase();
  const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return regex.test(trimmed);
}

export async function POST({ request, cookies }) {
  try {
    const user = await getSessionUser(cookies);
    if (!user) {
      return jsonResponse({ ok: false, message: 'Authentication required' }, 401);
    }

    const body = await request.json();
    const newEmail = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';

    if (!validateEmail(newEmail)) {
      return jsonResponse({ ok: false, message: 'Invalid request' }, 400);
    }

    // Check if email is already in use
    const existing = await findUserByEmail(newEmail);
    if (existing && existing.id !== user.id) {
      return jsonResponse({ ok: false, message: 'Email already in use' }, 409);
    }

    // Update email and mark as unverified
    await updateUserEmail(user.id, newEmail);

    // Send verification email if SMTP is configured
    if (isEmailEnabled()) {
      try {
        const token = await createEmailVerificationToken(user.id);
        await sendVerificationEmail(newEmail, token);
        return jsonResponse({ 
          ok: true, 
          message: 'Email updated. Please check your new email to verify it.' 
        }, 200);
      } catch (emailError) {
        console.error('[change-email] Failed to send verification email:', emailError);
        return jsonResponse({ 
          ok: true, 
          message: 'Email updated, but verification email could not be sent.' 
        }, 200);
      }
    } else {
      return jsonResponse({ 
        ok: true, 
        message: 'Email updated successfully' 
      }, 200);
    }
  } catch (err) {
    console.error('Change email error:', err);
    return jsonResponse({ ok: false, message: 'Server error' }, 500);
  }
}
