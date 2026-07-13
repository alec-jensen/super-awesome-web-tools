import { getSessionUser } from '../../../lib/auth/session.js';
import { isEmailEnabled, sendEmail } from '../../../lib/email.js';

export const prerender = false;

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export async function POST({ request, cookies }) {
  try {
    // Check admin authentication
    const sessionUser = await getSessionUser(cookies);
    if (!sessionUser || sessionUser.role !== 'admin') {
      return jsonResponse({ ok: false, message: 'Unauthorized' }, 403);
    }

    const payload = await request.json();
    const email = typeof payload.email === 'string' ? payload.email.trim() : '';

    if (!email) {
      return jsonResponse({ ok: false, message: 'Email address required' }, 400);
    }

    // Check if email is enabled
    if (!isEmailEnabled()) {
      return jsonResponse({ 
        ok: false, 
        message: 'SMTP is not configured. Please configure SMTP settings in config.yaml' 
      }, 400);
    }

    // Send test email
    const result = await sendEmail({
      to: email,
      subject: 'SMTP Configuration Test',
      text: `This is a test email to verify your SMTP configuration is working correctly.\n\nSent at: ${new Date().toISOString()}`,
      html: `
        <h2>SMTP Configuration Test</h2>
        <p>This is a test email to verify your SMTP configuration is working correctly.</p>
        <p><strong>Sent at:</strong> ${new Date().toISOString()}</p>
        <p>If you received this email, your SMTP settings are configured properly.</p>
      `
    });

    if (result.ok) {
      return jsonResponse({ 
        ok: true, 
        message: `Test email sent successfully to ${email}`,
        messageId: result.messageId
      });
    } else {
      return jsonResponse({ 
        ok: false, 
        message: `Failed to send email: ${result.error}` 
      }, 500);
    }
  } catch (err) {
    console.error('SMTP test error:', err);
    return jsonResponse({ ok: false, message: 'Server error' }, 500);
  }
}
