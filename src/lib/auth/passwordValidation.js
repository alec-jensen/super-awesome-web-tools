// @ts-nocheck
// Password complexity validation based on configuration

import { getConfig } from '../config.js';

/**
 * Validates password against configured complexity requirements
 * @param {string} password - The password to validate
 * @returns {{ valid: boolean, errors: string[] }} - Validation result with specific error messages
 */
export function validatePasswordComplexity(password) {
  const config = getConfig();
  const requirements = config.auth.password;
  const errors = [];

  // Check minimum length
  if (password.length < requirements.minLength) {
    errors.push(`Password must be at least ${requirements.minLength} characters long`);
  }

  // Check uppercase requirement
  if (requirements.requireUppercase && !/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  }

  // Check lowercase requirement
  if (requirements.requireLowercase && !/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  }

  // Check number requirement
  if (requirements.requireNumber && !/[0-9]/.test(password)) {
    errors.push('Password must contain at least one number');
  }

  // Check special character requirement
  if (requirements.requireSpecial && !/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
    errors.push('Password must contain at least one special character (!@#$%^&*(),.?":{}|<>)');
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Gets a human-readable description of password requirements
 * @returns {string} - Description of password requirements
 */
export function getPasswordRequirementsDescription() {
  const config = getConfig();
  const requirements = config.auth.password;
  const parts = [`at least ${requirements.minLength} characters`];

  if (requirements.requireUppercase) parts.push('one uppercase letter');
  if (requirements.requireLowercase) parts.push('one lowercase letter');
  if (requirements.requireNumber) parts.push('one number');
  if (requirements.requireSpecial) parts.push('one special character');

  if (parts.length === 1) {
    return `Password must be ${parts[0]}.`;
  }

  return `Password must contain ${parts.slice(0, -1).join(', ')}, and ${parts[parts.length - 1]}.`;
}
