// @ts-nocheck
// Email sending utilities using nodemailer
// Requires SMTP configuration in config.yaml

import nodemailer from 'nodemailer';
import { getConfig } from './config.js';

let transporter = null;

/**
 * Initialize the email transporter if SMTP is configured
 */
function getTransporter() {
  const config = getConfig();
  
  if (!config.smtp) {
    return null;
  }

  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: config.smtp.host,
      port: config.smtp.port,
      secure: config.smtp.secure,
      auth: {
        user: config.smtp.auth.user,
        pass: config.smtp.auth.pass,
      },
    });
  }

  return transporter;
}

/**
 * Check if email is enabled (SMTP configured)
 */
export function isEmailEnabled() {
  const config = getConfig();
  return config.smtp !== undefined;
}

/**
 * Send an email
 * @param {Object} options - Email options
 * @param {string} options.to - Recipient email address
 * @param {string} options.subject - Email subject
 * @param {string} options.text - Plain text body
 * @param {string} options.html - HTML body
 */
export async function sendEmail({ to, subject, text, html }) {
  const config = getConfig();
  const transport = getTransporter();

  if (!transport) {
    console.warn('[email] SMTP not configured, email not sent:', { to, subject });
    return { ok: false, error: 'SMTP not configured' };
  }

  try {
    const info = await transport.sendMail({
      from: config.smtp.from,
      to,
      subject,
      text,
      html,
    });

    console.log('[email] Sent:', { to, subject, messageId: info.messageId });
    return { ok: true, messageId: info.messageId };
  } catch (error) {
    console.error('[email] Failed to send:', { to, subject, error: error.message });
    return { ok: false, error: error.message };
  }
}

/**
 * Send email verification email
 */
export async function sendVerificationEmail(email, token) {
  const config = getConfig();
  const verificationUrl = `${config.app.baseUrl}/verify-email?token=${token}`;

  const text = `
Welcome to ${new URL(config.app.baseUrl).hostname}!

Please verify your email address by clicking the link below:

${verificationUrl}

This link will expire in 24 hours.

If you didn't create an account, you can safely ignore this email.
  `.trim();

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .button { display: inline-block; padding: 12px 24px; background: #0066cc; color: white; text-decoration: none; border-radius: 4px; margin: 20px 0; }
    .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; font-size: 12px; color: #666; }
  </style>
</head>
<body>
  <div class="container">
    <h2>Welcome to ${new URL(config.app.baseUrl).hostname}!</h2>
    <p>Please verify your email address by clicking the button below:</p>
    <a href="${verificationUrl}" class="button">Verify Email Address</a>
    <p>Or copy and paste this link into your browser:</p>
    <p><a href="${verificationUrl}">${verificationUrl}</a></p>
    <p class="footer">
      This link will expire in 24 hours.<br>
      If you didn't create an account, you can safely ignore this email.
    </p>
  </div>
</body>
</html>
  `.trim();

  return await sendEmail({
    to: email,
    subject: 'Verify your email address',
    text,
    html,
  });
}

/**
 * Send password reset email
 */
export async function sendPasswordResetEmail(email, token) {
  const config = getConfig();
  const resetUrl = `${config.app.baseUrl}/reset-password?token=${token}`;

  const text = `
Password Reset Request

You requested a password reset for your account at ${new URL(config.app.baseUrl).hostname}.

Click the link below to reset your password:

${resetUrl}

This link will expire in 1 hour.

If you didn't request a password reset, you can safely ignore this email.
  `.trim();

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .button { display: inline-block; padding: 12px 24px; background: #0066cc; color: white; text-decoration: none; border-radius: 4px; margin: 20px 0; }
    .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; font-size: 12px; color: #666; }
  </style>
</head>
<body>
  <div class="container">
    <h2>Password Reset Request</h2>
    <p>You requested a password reset for your account at ${new URL(config.app.baseUrl).hostname}.</p>
    <a href="${resetUrl}" class="button">Reset Password</a>
    <p>Or copy and paste this link into your browser:</p>
    <p><a href="${resetUrl}">${resetUrl}</a></p>
    <p class="footer">
      This link will expire in 1 hour.<br>
      If you didn't request a password reset, you can safely ignore this email.
    </p>
  </div>
</body>
</html>
  `.trim();

  return await sendEmail({
    to: email,
    subject: 'Reset your password',
    text,
    html,
  });
}
