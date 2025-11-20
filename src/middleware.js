// Middleware: assign persistent visitor UUID cookie if absent.
// Astro runs this for every request (supported in Astro 3+ when exported at project root under src/middleware.js)
// We set a cookie 'visitor_id' with a UUID v4 and 400 day expiry (similar to long-lived analytics cookies).

import { randomUUID } from 'node:crypto';
import { RESERVED_CODES } from './lib/codegen.js';

/** @type {import('astro').MiddlewareHandler} */
export async function onRequest(context, next) {
  const { request, cookies, locals } = context;
  const url = new URL(request.url);
  const pathname = url.pathname;

  // Heuristic: if the path looks like a short code (single segment, no slash after leading, length <=16, no dot),
  // we skip assigning a visitor UUID so that passive consumers of a short link remain anonymous.
  const isPotentialRedirect = (() => {
    if (pathname === '/' || pathname.includes('/')) {
      // If there is a second slash (beyond leading) it's not a single-segment short code.
      const segments = pathname.split('/').filter(Boolean);
      if (segments.length !== 1) return false;
      const seg = segments[0];
      if (seg.length === 0 || seg.length > 16) return false;
      if (seg.includes('.')) return false; // treat dots as asset/page extension
      // Exclude known root app sections from being treated as redirects (synchronized with RESERVED_CODES in codegen.js)
      if (RESERVED_CODES.has(seg)) return false;
      return true;
    }
    return false;
  })();

  if (!isPotentialRedirect) {
    let vid = cookies.get('visitor_id')?.value;
    if (!vid) {
      vid = randomUUID();
      cookies.set('visitor_id', vid, {
        httpOnly: true,
        path: '/',
        sameSite: 'Lax',
        maxAge: 60 * 60 * 24 * 400 // ~400 days
      });
    }
    locals.visitorId = vid;
  }
  return next();
}
