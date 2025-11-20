// @ts-nocheck
// API endpoint to enable TOTP after verifying the code

import { getSessionUser } from '../../../../../lib/auth/session.js';
import { verifyTOTP, decryptTOTPSecret } from '../../../../../lib/auth/totp.js';
import { generateBackupCodes, encryptBackupCodes } from '../../../../../lib/auth/backupCodes.js';
import { query } from '../../../../../lib/db.js';

export const prerender = false;

export async function POST({ request, cookies }) {
  const sessionUser = await getSessionUser(cookies);
  
  if (!sessionUser) {
    return new Response(JSON.stringify({ ok: false, message: 'Not authenticated' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  try {
    const body = await request.json();
    const { code } = body;
    
    if (!code || code.length !== 6) {
      return new Response(JSON.stringify({ ok: false, message: 'Invalid code format' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Get the TOTP secret
    const users = await query(
      'SELECT totp_secret FROM users WHERE id = ?',
      [sessionUser.id]
    );
    
    if (users.length === 0 || !users[0].totp_secret) {
      return new Response(JSON.stringify({ ok: false, message: 'TOTP not set up' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    const secret = decryptTOTPSecret(users[0].totp_secret);
    
    // Verify the code
    if (!verifyTOTP(secret, code)) {
      return new Response(JSON.stringify({ ok: false, message: 'Invalid code' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Generate backup codes
    const backupCodes = generateBackupCodes();
    const encryptedBackupCodes = encryptBackupCodes(backupCodes);
    
    // Enable TOTP
    await query(
      'UPDATE users SET totp_enabled = TRUE, backup_codes = ? WHERE id = ?',
      [encryptedBackupCodes, sessionUser.id]
    );
    
    return new Response(JSON.stringify({
      ok: true,
      message: 'TOTP enabled successfully',
      backupCodes // Return these once for the user to save
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
    
  } catch (error) {
    console.error('TOTP enable error:', error);
    return new Response(JSON.stringify({ ok: false, message: 'Failed to enable TOTP' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
