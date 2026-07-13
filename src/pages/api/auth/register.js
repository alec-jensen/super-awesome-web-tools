import { hashPassword } from '../../../lib/auth/password.js';
import { createUser, findUserByEmail, recordLogin, getUserCount } from '../../../lib/auth/user.js';
import { createSessionCookie } from '../../../lib/auth/session.js';
import { createEmailVerificationToken } from '../../../lib/auth/emailVerification.js';
import { isEmailEnabled, sendVerificationEmail } from '../../../lib/email.js';
import { validatePasswordComplexity } from '../../../lib/auth/passwordValidation.js';

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
    email: formData.get('email'),
    password: formData.get('password'),
  };
}

function validateEmail(email) {
  if (typeof email !== 'string') return false;
  const trimmed = email.trim().toLowerCase();
  const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return regex.test(trimmed);
}

export async function POST({ request, cookies }) {
  try {
    const payload = await readPayload(request);
    const email = typeof payload.email === 'string' ? payload.email.trim().toLowerCase() : '';
    const password = typeof payload.password === 'string' ? payload.password : '';

    if (!validateEmail(email)) {
      return jsonResponse({ ok: false, message: 'Invalid request' }, 400);
    }

    // Validate password complexity
    const passwordValidation = validatePasswordComplexity(password);
    if (!passwordValidation.valid) {
      return jsonResponse({ 
        ok: false, 
        message: passwordValidation.errors.join('. ') 
      }, 400);
    }

    const existing = await findUserByEmail(email);
    if (existing) {
      return jsonResponse({ ok: false, message: 'Registration failed' }, 409);
    }

    // Check if this is the first user - if so, make them an admin
    const userCount = await getUserCount();
    const role = userCount === 0 ? 'admin' : 'user';
    
    console.log('[register] User count:', userCount, '| Assigning role:', role);

    const passwordHash = await hashPassword(password);
    const userId = await createUser(email, passwordHash, role);
    await recordLogin(userId);
    await createSessionCookie(cookies, userId);

    // Send verification email if SMTP is configured
    if (isEmailEnabled()) {
      try {
        const token = await createEmailVerificationToken(userId);
        await sendVerificationEmail(email, token);
        return jsonResponse({ ok: true, message: 'Account created. Please check your email to verify your account.' }, 201);
      } catch (emailError) {
        console.error('[register] Failed to send verification email:', emailError);
        // Account is still created, just couldn't send email
        return jsonResponse({ ok: true, message: 'Account created, but verification email could not be sent.' }, 201);
      }
    } else {
      return jsonResponse({ ok: true, message: 'Account created' }, 201);
    }
  } catch (err) {
    console.error('Registration error:', err);
    return jsonResponse({ ok: false, message: 'Server error' }, 500);
  }
}
