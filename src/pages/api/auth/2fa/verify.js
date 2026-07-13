// @ts-nocheck
// API endpoint to verify 2FA code during login

import { verifyTOTP, decryptTOTPSecret } from '../../../../lib/auth/totp.js';
import { verifyAndUseBackupCode } from '../../../../lib/auth/backupCodes.js';
import { verifyEmail2FACode } from '../../../../lib/auth/emailTwoFactor.js';
import { rotateSessionOnLogin } from '../../../../lib/auth/session.js';
import { query } from '../../../../lib/db.js';

export const prerender = false;

export async function POST({ request, cookies }) {
  try {
    const body = await request.json();
    const { email, code, isBackupCode, isEmailCode } = body;
    
    if (!email || !code) {
      return new Response(JSON.stringify({ ok: false, message: 'Email and code required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Get user
    const users = await query(
      'SELECT * FROM users WHERE email = ?',
      [email.toLowerCase()]
    );
    
    if (users.length === 0) {
      return new Response(JSON.stringify({ ok: false, message: 'Invalid credentials' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    const user = users[0];
    let verified = false;
    
    if (isEmailCode) {
      // Verify email 2FA code
      verified = await verifyEmail2FACode(user.id, code);
    } else if (isBackupCode) {
      // Verify backup code
      if (!user.backup_codes) {
        return new Response(JSON.stringify({ ok: false, message: 'Invalid code' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      
      const result = verifyAndUseBackupCode(user.backup_codes, code);
      
      if (result.valid) {
        verified = true;
        
        // Update backup codes (mark as used)
        await query(
          'UPDATE users SET backup_codes = ? WHERE id = ?',
          [result.updatedCodes, user.id]
        );
        
        // Warn if running low on backup codes
        if (result.remainingCodes <= 2) {
          console.warn(`User ${user.email} has only ${result.remainingCodes} backup codes remaining`);
        }
      }
    } else {
      // Verify TOTP code
      if (user.totp_enabled && user.totp_secret) {
        const secret = decryptTOTPSecret(user.totp_secret);
        verified = verifyTOTP(secret, code);
      }
    }
    
    if (!verified) {
      return new Response(JSON.stringify({ ok: false, message: 'Invalid code' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Update last login
    await query(
      'UPDATE users SET last_login_at = NOW() WHERE id = ?',
      [user.id]
    );
    
    // Create session
    await rotateSessionOnLogin(cookies, user.id);
    
    return new Response(JSON.stringify({
      ok: true,
      message: '2FA verified successfully'
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
    
  } catch (error) {
    console.error('2FA verification error:', error);
    return new Response(JSON.stringify({ ok: false, message: 'Verification failed' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
