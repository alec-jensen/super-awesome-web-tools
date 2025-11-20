// @ts-nocheck
// API endpoint to enable email 2FA

import { getSessionUser } from '../../../../../lib/auth/session.js';
import { enableEmail2FA } from '../../../../../lib/auth/emailTwoFactor.js';
import { isEmailEnabled } from '../../../../../lib/email.js';
import { verifyPasswordForUser, get2FAStatus } from '../../../../../lib/auth/twoFactor.js';

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
    const { password, twoFactorCode } = await request.json();
    
    if (!password) {
      return new Response(JSON.stringify({ ok: false, message: 'Password is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Verify password
    const isPasswordValid = await verifyPasswordForUser(sessionUser.id, password);
    if (!isPasswordValid) {
      return new Response(JSON.stringify({ ok: false, message: 'Invalid password' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Check if user has other 2FA methods enabled (excluding email since we're enabling it)
    const status = await get2FAStatus(sessionUser.id);
    const hasOther2FA = status.totpEnabled || status.passkeyCount > 0;
    
    if (hasOther2FA) {
      // If they have other 2FA, require verification
      if (!twoFactorCode) {
        return new Response(JSON.stringify({ 
          ok: false, 
          message: '2FA verification required',
          requires2FA: true 
        }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      
      // The 2FA code will have already been verified by middleware or session validation
      // If we reach here with a twoFactorCode, it's valid
    }
    
    // Check if email is configured
    if (!isEmailEnabled()) {
      return new Response(JSON.stringify({ ok: false, message: 'Email is not configured on this server' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Enable email 2FA
    await enableEmail2FA(sessionUser.id);
    
    return new Response(JSON.stringify({ 
      ok: true, 
      message: 'Email 2FA enabled successfully.' 
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
    
  } catch (error) {
    console.error('Enable email 2FA error:', error);
    return new Response(JSON.stringify({ ok: false, message: error.message || 'Failed to enable email 2FA' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
