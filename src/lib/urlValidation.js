/**
 * Client-side URL validation utilities
 * Defense-in-depth validation to prevent malicious URLs
 * Used on both link submission and decryption pages
 */

// Maximum URL lengths
export const MAX_URL_LENGTH = 8192; // 8KB for plaintext URLs
export const MAX_ENCRYPTED_LENGTH = 16384; // 16KB for encrypted payloads

// Dangerous protocols that should never be allowed
const DANGEROUS_PROTOCOLS = [
  'javascript:',
  'data:',
  'vbscript:',
  'file:',
  'about:',
  'blob:',
];

// Blocked hostnames (localhost, private IPs)
const BLOCKED_HOSTNAMES = [
  'localhost',
  '127.0.0.1',
  '0.0.0.0',
  '::1',
];

/**
 * Validate a URL for safety before storing or redirecting
 * @param {string} url - The URL to validate
 * @param {Object} options - Validation options
 * @param {boolean} options.allowHttp - Whether to allow http:// (default: true)
 * @param {boolean} options.blockLocalhost - Whether to block localhost (default: true)
 * @param {number} options.maxLength - Maximum URL length (default: MAX_URL_LENGTH)
 * @returns {{ valid: boolean, error?: string, normalizedUrl?: string }}
 */
export function validateUrl(url, options = {}) {
  const {
    allowHttp = true,
    blockLocalhost = true,
    maxLength = MAX_URL_LENGTH,
  } = options;

  // Basic checks
  if (!url || typeof url !== 'string') {
    return { valid: false, error: 'URL is required' };
  }

  const trimmedUrl = url.trim();

  // Length check
  if (trimmedUrl.length > maxLength) {
    return { valid: false, error: `URL exceeds maximum length of ${maxLength} characters` };
  }

  if (trimmedUrl.length === 0) {
    return { valid: false, error: 'URL cannot be empty' };
  }

  // Normalize URL (add https:// if missing protocol)
  let normalizedUrl = trimmedUrl;
  if (!/^[a-zA-Z][\w+.-]*:/.test(normalizedUrl)) {
    if (normalizedUrl.startsWith('//')) {
      normalizedUrl = `https:${normalizedUrl}`;
    } else {
      normalizedUrl = `https://${normalizedUrl}`;
    }
  }

  // Check for dangerous protocols
  const lowerUrl = normalizedUrl.toLowerCase();
  for (const protocol of DANGEROUS_PROTOCOLS) {
    if (lowerUrl.startsWith(protocol)) {
      return { valid: false, error: `Protocol ${protocol} is not allowed` };
    }
  }

  // Parse URL
  let parsed;
  try {
    parsed = new URL(normalizedUrl);
  } catch (err) {
    return { valid: false, error: 'Invalid URL format' };
  }

  // Protocol validation
  if (!allowHttp && parsed.protocol === 'http:') {
    return { valid: false, error: 'HTTP is not allowed, use HTTPS' };
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return { valid: false, error: 'Only HTTP and HTTPS protocols are allowed' };
  }

  // Hostname validation
  if (blockLocalhost) {
    const hostname = parsed.hostname.toLowerCase();
    
    // Check exact matches
    if (BLOCKED_HOSTNAMES.includes(hostname)) {
      return { valid: false, error: 'Localhost URLs are not allowed' };
    }

    // Check private IP ranges (IPv4)
    if (/^10\./.test(hostname) || 
        /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(hostname) ||
        /^192\.168\./.test(hostname)) {
      return { valid: false, error: 'Private IP addresses are not allowed' };
    }

    // Check link-local
    if (/^169\.254\./.test(hostname)) {
      return { valid: false, error: 'Link-local addresses are not allowed' };
    }

    // Check IPv6 localhost and private ranges
    if (hostname.includes(':') && (
        hostname === '::1' ||
        hostname.startsWith('fe80:') ||
        hostname.startsWith('fc00:') ||
        hostname.startsWith('fd00:')
      )) {
      return { valid: false, error: 'Private IPv6 addresses are not allowed' };
    }
  }

  // TLD validation (basic - at least 2 chars)
  if (!parsed.hostname.includes('.')) {
    return { valid: false, error: 'URL must have a valid domain' };
  }

  const tld = parsed.hostname.split('.').pop();
  if (!tld || tld.length < 2) {
    return { valid: false, error: 'Invalid top-level domain' };
  }

  return { valid: true, normalizedUrl };
}

/**
 * Simple check if string looks like a URL (less strict, for initial checks)
 * @param {string} str - String to check
 * @returns {boolean}
 */
export function looksLikeUrl(str) {
  if (!str || typeof str !== 'string') return false;
  const trimmed = str.trim();
  if (trimmed.length === 0) return false;
  
  // Very basic pattern - allows most things that might be URLs
  return /^(https?:\/\/)?[\w.-]+\.[a-z]{2,}/i.test(trimmed);
}

/**
 * Browser-compatible version of validateUrl for inclusion in inline scripts
 * Returns the validation function as a string
 */
export function getValidateUrlScript() {
  return `
const MAX_URL_LENGTH = ${MAX_URL_LENGTH};
const DANGEROUS_PROTOCOLS = ${JSON.stringify(DANGEROUS_PROTOCOLS)};
const BLOCKED_HOSTNAMES = ${JSON.stringify(BLOCKED_HOSTNAMES)};

function validateUrl(url, options = {}) {
  const {
    allowHttp = true,
    blockLocalhost = true,
    maxLength = MAX_URL_LENGTH,
  } = options;

  if (!url || typeof url !== 'string') {
    return { valid: false, error: 'URL is required' };
  }

  const trimmedUrl = url.trim();

  if (trimmedUrl.length > maxLength) {
    return { valid: false, error: \`URL exceeds maximum length of \${maxLength} characters\` };
  }

  if (trimmedUrl.length === 0) {
    return { valid: false, error: 'URL cannot be empty' };
  }

  let normalizedUrl = trimmedUrl;
  if (!/^[a-zA-Z][\\w+.-]*:/.test(normalizedUrl)) {
    if (normalizedUrl.startsWith('//')) {
      normalizedUrl = \`https:\${normalizedUrl}\`;
    } else {
      normalizedUrl = \`https://\${normalizedUrl}\`;
    }
  }

  const lowerUrl = normalizedUrl.toLowerCase();
  for (const protocol of DANGEROUS_PROTOCOLS) {
    if (lowerUrl.startsWith(protocol)) {
      return { valid: false, error: \`Protocol \${protocol} is not allowed\` };
    }
  }

  let parsed;
  try {
    parsed = new URL(normalizedUrl);
  } catch (err) {
    return { valid: false, error: 'Invalid URL format' };
  }

  if (!allowHttp && parsed.protocol === 'http:') {
    return { valid: false, error: 'HTTP is not allowed, use HTTPS' };
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return { valid: false, error: 'Only HTTP and HTTPS protocols are allowed' };
  }

  if (blockLocalhost) {
    const hostname = parsed.hostname.toLowerCase();
    
    if (BLOCKED_HOSTNAMES.includes(hostname)) {
      return { valid: false, error: 'Localhost URLs are not allowed' };
    }

    if (/^10\\./.test(hostname) || 
        /^172\\.(1[6-9]|2[0-9]|3[0-1])\\./.test(hostname) ||
        /^192\\.168\\./.test(hostname)) {
      return { valid: false, error: 'Private IP addresses are not allowed' };
    }

    if (/^169\\.254\\./.test(hostname)) {
      return { valid: false, error: 'Link-local addresses are not allowed' };
    }

    if (hostname.includes(':') && (
        hostname === '::1' ||
        hostname.startsWith('fe80:') ||
        hostname.startsWith('fc00:') ||
        hostname.startsWith('fd00:')
      )) {
      return { valid: false, error: 'Private IPv6 addresses are not allowed' };
    }
  }

  if (!parsed.hostname.includes('.')) {
    return { valid: false, error: 'URL must have a valid domain' };
  }

  const tld = parsed.hostname.split('.').pop();
  if (!tld || tld.length < 2) {
    return { valid: false, error: 'Invalid top-level domain' };
  }

  return { valid: true, normalizedUrl };
}
`.trim();
}
