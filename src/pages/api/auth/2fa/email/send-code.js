// @ts-nocheck
// API endpoint to request an email 2FA code

import crypto from 'crypto';
import { getSessionUser } from '../../../../../lib/auth/session.js';
import { sendEmail2FACode, isEmail2FAEnabled } from '../../../../../lib/auth/emailTwoFactor.js';
import { isEmailEnabled } from '../../../../../lib/email.js';
import { query } from '../../../../../lib/db.js';

export const prerender = false;

export async function POST({ request, cookies }) {
  const sessionUser = await getSessionUser(cookies);
  
  try {
    const body = await request.json();
    const { email, idempotencyKey } = body;
    
    // Generate idempotency key if not provided
    const finalIdempotencyKey = idempotencyKey || crypto.randomBytes(32).toString('hex');
    
    // Check if email is configured
    if (!isEmailEnabled()) {
      return new Response(JSON.stringify({ ok: false, message: 'Email is not configured on this server' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    let userId, userEmail;
    
    if (sessionUser) {
      // Authenticated user requesting code
      userId = sessionUser.id;
      userEmail = sessionUser.email;
    } else if (email) {
      // Login flow - user not yet authenticated but email provided
      const users = await query(
        'SELECT id, email FROM users WHERE email = ?',
        [email.toLowerCase()]
      );
      
      if (users.length === 0) {
        // Don't reveal if email exists or not
        return new Response(JSON.stringify({ ok: true, message: 'If email 2FA is enabled, a code will be sent' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      
      userId = users[0].id;
      userEmail = users[0].email;
    } else {
      return new Response(JSON.stringify({ ok: false, message: 'Not authenticated' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Check if email 2FA is enabled
    const enabled = await isEmail2FAEnabled(userId);
    if (!enabled) {
      // Don't reveal if email 2FA is disabled during login
      if (!sessionUser) {
        return new Response(JSON.stringify({ ok: true, message: 'If email 2FA is enabled, a code will be sent' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      
      return new Response(JSON.stringify({ ok: false, message: 'Email 2FA is not enabled' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Send code
    await sendEmail2FACode(userEmail, userId, finalIdempotencyKey);
    
    return new Response(JSON.stringify({ 
      ok: true, 
      message: 'Verification code sent to your email',
      idempotencyKey: finalIdempotencyKey
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
    
  } catch (error) {
    console.error('Send email 2FA code error:', error);
    return new Response(JSON.stringify({ ok: false, message: 'Failed to send verification code' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
