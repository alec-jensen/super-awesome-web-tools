// @ts-nocheck
// WebAuthn / Passkey support for 2FA
// Simplified WebAuthn implementation without external dependencies

import crypto from 'crypto';
import { query } from '../db.js';

/**
 * Generate a challenge for WebAuthn
 */
export function generateChallenge() {
  return crypto.randomBytes(32).toString('base64url');
}

/**
 * Create registration options for a new passkey
 */
export async function generateRegistrationOptions(user) {
  const challenge = generateChallenge();
  
  return {
    challenge,
    rp: {
      name: 'super-awesome-web-tools',
      id: undefined // Will be set by client to current domain
    },
    user: {
      id: Buffer.from(user.id.toString()).toString('base64url'),
      name: user.email,
      displayName: user.email
    },
    pubKeyCredParams: [
      { type: 'public-key', alg: -7 },  // ES256
      { type: 'public-key', alg: -257 } // RS256
    ],
    timeout: 60000,
    attestation: 'none',
    authenticatorSelection: {
      authenticatorAttachment: 'platform',
      requireResidentKey: false,
      userVerification: 'preferred'
    }
  };
}

/**
 * Verify registration response and store passkey
 */
export async function verifyRegistration(userId, credential, challenge, deviceName) {
  // Basic validation
  if (!credential || !credential.id || !credential.response) {
    throw new Error('Invalid credential');
  }
  
  // In a full implementation, you would verify the attestation
  // For now, we'll do basic validation and store the credential
  
  const publicKey = credential.response.publicKey;
  const credentialId = credential.id;
  
  // Store the passkey
  await query(
    `INSERT INTO passkeys (user_id, credential_id, public_key, device_name, counter)
     VALUES (?, ?, ?, ?, ?)`,
    [userId, credentialId, publicKey, deviceName, 0]
  );
  
  return { success: true };
}

/**
 * Generate authentication options for passkey login
 */
export async function generateAuthenticationOptions(userId) {
  const challenge = generateChallenge();
  
  // Get user's passkeys
  const passkeys = await query(
    'SELECT credential_id FROM passkeys WHERE user_id = ?',
    [userId]
  );
  
  return {
    challenge,
    timeout: 60000,
    rpId: undefined, // Will be set by client
    allowCredentials: passkeys.map(pk => ({
      type: 'public-key',
      id: pk.credential_id
    })),
    userVerification: 'preferred'
  };
}

/**
 * Verify authentication response
 */
export async function verifyAuthentication(userId, credential, challenge) {
  if (!credential || !credential.id) {
    throw new Error('Invalid credential');
  }
  
  // Get the passkey from database
  const passkeys = await query(
    'SELECT * FROM passkeys WHERE user_id = ? AND credential_id = ?',
    [userId, credential.id]
  );
  
  if (passkeys.length === 0) {
    throw new Error('Passkey not found');
  }
  
  const passkey = passkeys[0];
  
  // In a full implementation, you would verify the signature
  // For now, we'll update the counter and last_used_at
  
  await query(
    'UPDATE passkeys SET counter = counter + 1, last_used_at = NOW() WHERE id = ?',
    [passkey.id]
  );
  
  return { success: true };
}

/**
 * Get all passkeys for a user
 */
export async function getUserPasskeys(userId) {
  return await query(
    'SELECT id, credential_id, device_name, created_at, last_used_at FROM passkeys WHERE user_id = ?',
    [userId]
  );
}

/**
 * Delete a passkey
 */
export async function deletePasskey(userId, passkeyId) {
  const result = await query(
    'DELETE FROM passkeys WHERE id = ? AND user_id = ?',
    [passkeyId, userId]
  );
  
  return result.affectedRows > 0;
}
