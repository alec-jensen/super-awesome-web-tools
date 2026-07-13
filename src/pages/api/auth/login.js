import { verifyPassword } from '../../../lib/auth/password.js';
import { findUserByEmail, recordLogin } from '../../../lib/auth/user.js';
import { rotateSessionOnLogin, destroySessionCookie } from '../../../lib/auth/session.js';
import { 
  isAccountLocked, 
  getLoginDelay, 
  recordFailedLogin, 
  resetFailedAttempts 
} from '../../../lib/auth/lockout.js';

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

export async function POST({ request, cookies }) {
  try {
    const payload = await readPayload(request);
    const email = typeof payload.email === 'string' ? payload.email.trim().toLowerCase() : '';
    const password = typeof payload.password === 'string' ? payload.password : '';

    if (!email || !password) {
      return jsonResponse({ ok: false, message: 'Invalid credentials' }, 400);
    }

    const user = await findUserByEmail(email);
    if (!user) {
      return jsonResponse({ ok: false, message: 'Invalid email or password' }, 401);
    }

    // Check if account is locked
    const locked = await isAccountLocked(user.id);
    if (locked) {
      return jsonResponse({ 
        ok: false, 
        message: 'Account is locked due to multiple failed login attempts. Check your email for unlock instructions or wait for the lockout to expire.' 
      }, 403);
    }

    // Check if user must wait before next attempt (exponential backoff)
    const delaySeconds = await getLoginDelay(user.id);
    if (delaySeconds !== null && delaySeconds > 0) {
      return jsonResponse({ 
        ok: false, 
        message: `Please wait ${delaySeconds} seconds before attempting to log in again.`,
        retryAfter: delaySeconds
      }, 429);
    }

    const valid = await verifyPassword(password, user.password_hash);
    if (!valid) {
      // Record failed login attempt
      const shouldLock = await recordFailedLogin(user.id);
      
      if (shouldLock) {
        return jsonResponse({ 
          ok: false, 
          message: 'Account has been locked due to too many failed login attempts. Check your email for unlock instructions.' 
        }, 403);
      }
      
      return jsonResponse({ ok: false, message: 'Invalid email or password' }, 401);
    }

    // Reset failed login attempts on successful login
    await resetFailedAttempts(user.id);

    // Check if 2FA is enabled
    const { has2FAEnabled, get2FAStatus } = await import('../../../lib/auth/twoFactor.js');
    const requires2FA = await has2FAEnabled(user.id);
    
    if (requires2FA) {
      // Get available 2FA methods
      const twoFactorStatus = await get2FAStatus(user.id);
      
      // Don't create session yet, require 2FA verification first
      return jsonResponse({ 
        ok: true, 
        requires2FA: true,
        email: user.email,
        twoFactorMethods: {
          totp: twoFactorStatus.totpEnabled,
          email: twoFactorStatus.emailEnabled,
          passkey: twoFactorStatus.passkeyCount > 0,
          backupCodes: twoFactorStatus.backupCodesRemaining > 0
        },
        message: '2FA verification required' 
      });
    }

    // Rotate session token on login (prevents session fixation attacks)
    // This destroys all existing sessions for the user and creates a new one
    await destroySessionCookie(cookies);
    await rotateSessionOnLogin(cookies, user.id);
    await recordLogin(user.id);

    return jsonResponse({ ok: true, message: 'Logged in' });
  } catch (err) {
    console.error('Login error:', err);
    return jsonResponse({ ok: false, message: 'Server error' }, 500);
  }
}
