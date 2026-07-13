// @ts-nocheck
// API endpoint to get 2FA status for current user

import { getSessionUser } from '../../../../lib/auth/session.js';
import { get2FAStatus } from '../../../../lib/auth/twoFactor.js';

export const prerender = false;

export async function GET({ cookies }) {
  const sessionUser = await getSessionUser(cookies);
  
  if (!sessionUser) {
    return new Response(JSON.stringify({ ok: false, message: 'Not authenticated' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  try {
    const status = await get2FAStatus(sessionUser.id);
    
    return new Response(JSON.stringify({
      ok: true,
      email: sessionUser.email,
      ...status
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
    
  } catch (error) {
    console.error('2FA status error:', error);
    return new Response(JSON.stringify({ ok: false, message: 'Failed to get 2FA status' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
