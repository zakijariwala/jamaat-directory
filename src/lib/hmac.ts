// HMAC-SHA256 request signing for /api/ingest.
// The Apps Script signs the raw JSON body with a shared secret; the Worker
// verifies it. Uses Web Crypto, available in both Workers and Node 18+.

export async function hmacSha256Hex(secret: string, message: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(message));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** Constant-time-ish comparison of the computed vs supplied signature. */
export async function verifySignature(
  secret: string,
  message: string,
  signatureHex: string,
): Promise<boolean> {
  if (!signatureHex) return false;
  const expected = await hmacSha256Hex(secret, message);
  if (expected.length !== signatureHex.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) {
    diff |= expected.charCodeAt(i) ^ signatureHex.charCodeAt(i);
  }
  return diff === 0;
}
