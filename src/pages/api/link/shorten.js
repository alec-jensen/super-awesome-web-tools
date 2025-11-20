// Fake link shortener API endpoint
// Location: src/pages/api/link/shorten.js
// This is a placeholder implementation that validates a URL-ish string and returns a fake short code.

import { getConfig } from "../../../lib/config";
import { query } from "../../../lib/db.js";
import { allocateCode, recycleCode } from "../../../lib/codegen.js";
import { checkLinkShortenAllowed, ensureShortLinksExtended } from "../../../lib/rateLimit.js";
import { schedulePrune } from "../../../lib/prune.js";
import { getSessionUser } from "../../../lib/auth/session.js";
import { MAX_URL_LENGTH, MAX_ENCRYPTED_LENGTH } from "../../../lib/urlValidation.js";

export const prerender = false;

const ENCRYPTED_PAYLOAD_REGEX = /^[A-Za-z0-9_-]+$/;

/**
 * POST /api/link/shorten
 * Accepts JSON with fields: url, security (plaintext|encryptedAndDecryptionKeyInURL|encrypted), keyLength, clientEncrypted
 * Returns JSON: { ok: boolean, message: string, short?: string, original?: string, key?: string }
 */
export async function POST({ request, cookies, clientAddress }) {
  let codeInUse = false;
  let shortCode = null;

  try {
    // Only accept JSON content type
    const contentType = request.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      return new Response(JSON.stringify({ ok: false, message: 'Unsupported media type' }), { 
        status: 415,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const body = await request.json();
    const url = body.url;
    const securityValue = body.security || "plaintext";
    const security = securityValue.toString();
    const keyLengthParam = body.keyLength;
    const parsedKeyBits = keyLengthParam != null ? parseInt(keyLengthParam.toString(), 10) : 128;
    const keyLengthBits = Number.isFinite(parsedKeyBits) ? parsedKeyBits : 128;
    const clientEncrypted = body.clientEncrypted === true || body.clientEncrypted === "1" || body.clientEncrypted === 1;

    if (typeof url !== "string" || !url.trim()) {
      return new Response(JSON.stringify({ ok: false, message: "Invalid request" }), { status: 400 });
    }

    const validSecurityModes = ["plaintext", "encryptedAndDecryptionKeyInURL", "encrypted"];
    if (!validSecurityModes.includes(security)) {
      return new Response(JSON.stringify({ ok: false, message: "Invalid request" }), { status: 400 });
    }

    if (keyLengthBits < 112 || keyLengthBits > 256) {
      return new Response(JSON.stringify({ ok: false, message: "Invalid request" }), { status: 400 });
    }

    const trimmedUrl = url.trim();
    const requiresEncryption = security === "encrypted" || security === "encryptedAndDecryptionKeyInURL";

    // M-3: Enforce URL length limits to prevent DoS
    if (requiresEncryption) {
      // Encrypted payloads are larger due to IV, tag, and base64 encoding
      if (trimmedUrl.length > MAX_ENCRYPTED_LENGTH) {
        return new Response(JSON.stringify({ 
          ok: false, 
          message: "Request payload too large" 
        }), { status: 400 });
      }
    } else {
      // Plaintext URLs
      if (trimmedUrl.length > MAX_URL_LENGTH) {
        return new Response(JSON.stringify({ 
          ok: false, 
          message: "Request payload too large" 
        }), { status: 400 });
      }
    }

    if (requiresEncryption && !clientEncrypted) {
      return new Response(JSON.stringify({ ok: false, message: "Invalid request" }), { status: 400 });
    }

    if (!requiresEncryption && clientEncrypted) {
      return new Response(JSON.stringify({ ok: false, message: "Invalid request" }), { status: 400 });
    }

    if (requiresEncryption) {
      if (!ENCRYPTED_PAYLOAD_REGEX.test(trimmedUrl)) {
        return new Response(JSON.stringify({ ok: false, message: "Invalid request" }), { status: 400 });
      }
    } else {
      const looksLikeUrl = /^(https?:\/\/)?[\w.-]+\.[a-z]{2,}(\/.*)?$/i.test(trimmedUrl);
      if (!looksLikeUrl) {
        return new Response(JSON.stringify({ ok: false, message: "Invalid request" }), { status: 422 });
      }
    }

    // For client-side encryption modes we do NOT accept or store encryption keys.
    // The client is responsible for keeping the decryption key locally. Never
    // persist client-provided keys on the server.
    let encryptionKey = null;

    const config = getConfig();
    const base = config?.app?.baseUrl?.replace(/\/+$/, "") || "";
    const user = await getSessionUser(cookies);

    const visitorId = cookies.get("visitor_id")?.value || "anon";
    const ip =
      clientAddress ||
      request.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
      "0.0.0.0";

    let rl;
    try {
      rl = await checkLinkShortenAllowed({ visitorUuid: visitorId, ip });
    } catch (err) {
      console.error("Rate limit check failed", err);
      return new Response(JSON.stringify({ ok: false, message: "Server error" }), { status: 500 });
    }

    if (!rl.allowed) {
      // Determine which limit was exceeded for better error message
      const isGlobalLimit = rl.globalCount >= rl.globalLimit;
      const message = isGlobalLimit 
        ? "Service temporarily unavailable"
        : "Rate limit exceeded";
      return new Response(
        JSON.stringify({ ok: false, message }), 
        { status: 429 }
      );
    }

    await ensureShortLinksExtended();
    schedulePrune();

    let allocation;
    try {
      allocation = await allocateCode();
    } catch (err) {
      console.error("Code allocation error", err);
      return new Response(JSON.stringify({ ok: false, message: "Server error" }), { status: 500 });
    }

    shortCode = allocation.code;
    codeInUse = true;

    const urlToStore = trimmedUrl;
    const isEncrypted = requiresEncryption;

    try {
      await query(
        "INSERT INTO short_links (short_code, original_url, visitor_uuid, ip, security_mode, encryption_key, is_encrypted, user_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        [
          shortCode,
          urlToStore,
          visitorId,
          ip,
          security,
          null, // never store client keys
          isEncrypted,
          user ? user.id : null,
        ]
      );
      codeInUse = false;
    } catch (err) {
      if (err && err.code === "ER_DUP_ENTRY") {
        if (codeInUse && shortCode) {
          try {
            await recycleCode(shortCode);
          } catch (recycleErr) {
            console.error("Failed to recycle code after collision", recycleErr);
          }
          codeInUse = false;
        }
        return new Response(JSON.stringify({ ok: false, message: "Service temporarily unavailable" }), { status: 503 });
      }
      console.error("DB insert error for short link", err);
      if (codeInUse && shortCode) {
        try {
          await recycleCode(shortCode);
        } catch (recycleErr) {
          console.error("Failed to recycle code after DB error", recycleErr);
        }
        codeInUse = false;
      }
      return new Response(JSON.stringify({ ok: false, message: "Server error" }), { status: 500 });
    }

    const response = {
      ok: true,
      message: "Short URL created",
      short: `${base}/${shortCode}`,
    };

    if (!requiresEncryption) {
      response.original = trimmedUrl;
    }

    if (requiresEncryption) {
      const isStandardKeyLength = keyLengthBits === 128 || keyLengthBits === 192 || keyLengthBits === 256;
      if (!isStandardKeyLength) {
        response.warning = `Warning: Using non-standard key length (${keyLengthBits} bits). Officially supported AES key lengths are 128, 192, and 256 bits.`;
      }
      // Do not return or store client keys. For 'encryptedAndDecryptionKeyInURL'
      // the client should append the fragment locally (we do not include it in
      // the short URL returned by the server to avoid server-side key exposure).
      if (security === "encrypted") {
        response.message = "Short URL created. SAVE THE KEY - you will need it to access the URL!";
      }
    }

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Shorten endpoint error", err);
    if (codeInUse && shortCode) {
      try {
        await recycleCode(shortCode);
      } catch (recycleErr) {
        console.error("Failed to recycle code after unexpected error", recycleErr);
      }
    }
    return new Response(JSON.stringify({ ok: false, message: "Server error" }), { status: 500 });
  }
}
