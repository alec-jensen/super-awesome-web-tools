import { createEmailVerificationToken, getVerificationStatusByEmail } from '../../../lib/auth/emailVerification.js';
import { isEmailEnabled, sendVerificationEmail } from '../../../lib/email.js';

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
    const status = await getVerificationStatusByEmail(normalizedEmail);

    if (!status.ok) {
      if (status.alreadyVerified) {
        return jsonResponse({ ok: false, message: 'Email is already verified' }, 400);
      }
      // Don't reveal if user exists or not
      return jsonResponse({ ok: true, message: 'If an account exists with that email, a verification email has been sent.' }, 200);
    }

    const token = await createEmailVerificationToken(status.userId);
    await sendVerificationEmail(normalizedEmail, token);

    return jsonResponse({ ok: true, message: 'Verification email sent' }, 200);
  } catch (err) {
    console.error('[resend-verification] Error:', err);
    return jsonResponse({ ok: false, message: 'Server error' }, 500);
  }
}
